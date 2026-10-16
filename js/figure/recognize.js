import { rgbToLab, labToRgb, rgbToHex, kmeans } from '../color.js';

const root = new URL('../../vendor/mediapipe/',import.meta.url);
const next = () => new Promise(r=>setTimeout(r,30));
let library, fileset;
const buffers = new Map();
async function model(name, progress) {
  if(buffers.has(name))return buffers.get(name);
  const response=await fetch(new URL(name,root),{cache:'force-cache'});
  if(!response.ok)throw Error('模型檔讀取失敗');
  const length=Number(response.headers.get('content-length')),reader=response.body?.getReader();
  if(!reader){const b=new Uint8Array(await response.arrayBuffer());buffers.set(name,b);return b;}
  let size=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);size+=value.length;progress(`載入辨識模型 ${name}：${length?Math.round(size/length*100)+'%':(size/1048576).toFixed(1)+' MB'}`);}
  const data=new Uint8Array(size);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}buffers.set(name,data);return data;
}
async function task(type,name,options,progress,cpu=false) {
  library ||= await import('../../vendor/mediapipe/vision_bundle.mjs');
  fileset ||= await library.FilesetResolver.forVisionTasks(new URL('wasm',root).href);
  const modelAssetBuffer=await model(name,progress);
  // 每次只保留一個工作，避免 iPad 同時持有四份 WASM 記憶體。
  try{return await library[type].createFromOptions(fileset,{...options,baseOptions:{modelAssetBuffer,delegate:cpu?'CPU':'GPU'}});}
  catch(e){progress('改用 CPU 辨識中…');await next();return library[type].createFromOptions(fileset,{...options,baseOptions:{modelAssetBuffer,delegate:'CPU'}});}
}
function dominant(data, test, count=1) {
  const samples=[];
  for(let y=0;y<data.height;y+=3)for(let x=0;x<data.width;x+=3){
    if(!test(x/data.width,y/data.height))continue;
    const i=(y*data.width+x)*4,l=rgbToLab(...data.data.slice(i,i+3));
    samples.push(l);
  }
  // 依這個部位自己的亮度分布去掉兩端，黑髮、白衣仍能保留原色。
  const light=samples.map(l=>l[0]).sort((a,b)=>a-b);
  const low=light[Math.floor(light.length*.1)],high=light[Math.floor(light.length*.9)];
  const labs=[];for(const l of samples)if(l[0]>=low&&l[0]<=high)labs.push(...l);
  if(labs.length<18)return [];
  const centers=kmeans(new Float32Array(labs),Math.min(3,Math.max(count,2)));
  const n=centers.map(()=>0);
  for(let i=0;i<labs.length;i+=3){let j=0,d=Infinity;centers.forEach((c,k)=>{const v=c.reduce((a,v,t)=>a+(v-labs[i+t])**2,0);if(v<d){d=v;j=k;}});n[j]++;}
  return centers.map((lab,i)=>({lab,n:n[i],hex:rgbToHex(labToRgb(...lab))})).sort((a,b)=>b.n-a.n).slice(0,count);
}
const maskAt = (mask,x,y) => mask.data[Math.min(mask.height-1,Math.floor(y*mask.height))*mask.width+Math.min(mask.width-1,Math.floor(x*mask.width))];
function copyMask(result) {
  const m=result.categoryMask;if(!m)throw Error('辨識沒有產生區域');
  return {data:m.getAsUint8Array().slice(),width:m.width,height:m.height};
}
export async function recognize(canvas,current,progress,point,cpu=false) {
  const data=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height);
  let worker;
  const s={...current};
  try {
    progress('尋找人或小動物…');await next();
    worker=await task('ObjectDetector','detector.tflite',{runningMode:'IMAGE',scoreThreshold:.35,maxResults:8},progress,cpu);
    const detections=worker.detect(canvas).detections;worker.close();worker=null;
    const animals=detections.filter(d=>['cat','dog','bird','teddy bear','horse','sheep','cow','elephant','bear','zebra','giraffe'].includes(d.categories[0]?.categoryName));
    const person=detections.find(d=>d.categories[0]?.categoryName==='person');
    const animal=animals[0];
    const kind=point?'animal':person&&(!animal||person.categories[0].score>=animal.categories[0].score)?'person':animal?'animal':current.kind;
    if(kind==='animal') {
      if(!animal&&!point) return null;
      s.kind='animal';const category=animal?.categories[0].categoryName;
      if(['cat','dog','bird'].includes(category))s.species=category;
      const b=animal?.boundingBox;
      const keypoint=point||{x:(b.originX+b.width/2)/canvas.width,y:(b.originY+b.height/2)/canvas.height};
      progress('找出動物的毛色區域…');await next();
      worker=await task('InteractiveSegmenter','interactive.tflite',{outputCategoryMask:false,outputConfidenceMasks:true},progress,cpu);
      let mask;worker.segment(canvas,{keypoint},r=>{const m=r.confidenceMasks[0];mask={data:m.getAsFloat32Array().slice(),width:m.width,height:m.height};});worker.close();worker=null;
      // 使用物體信心遮罩；此版本的類別遮罩以 0／255 表示，不能當成 0／1。
      const colors=dominant(data,(x,y)=>maskAt(mask,x,y)>=.65,3);
      if(!colors.length)return null;
      s.main=colors[0].hex;s.second=colors[1]?.hex||s.main;s.third=colors[2]?.hex||s.second;
      const total=colors.reduce((n,c)=>n+c.n,0), contrast=colors[1]?Math.hypot(...colors[0].lab.map((v,i)=>v-colors[1].lab[i])):0;
      // 空間交替次數區分條紋與斑點；只是初稿，學生仍可改花色。
      let transitions=0, rows=0;
      for(let y=.15;y<.9;y+=.1){let prev=-1;for(let x=.05;x<.95;x+=.025){if(maskAt(mask,x,y)<.65)continue;const i=(Math.floor(y*data.height)*data.width+Math.floor(x*data.width))*4;const lab=rgbToLab(...data.data.slice(i,i+3));let best=0,dist=Infinity;colors.forEach((c,k)=>{const d=c.lab.reduce((a,v,t)=>a+(v-lab[t])**2,0);if(d<dist){dist=d;best=k;}});if(prev>=0&&prev!==best)transitions++;prev=best;}rows++;}
      s.pattern=contrast<18||!colors[1]||colors[1].n/total<.12?'solid':colors[2]&&colors[2].n/total>.18?'patches':transitions/rows>5?'spots':transitions/rows>2?'tabby':'patches';
      return {look:s,note:!['cat','dog','bird'].includes(category)?'已取出毛色，請選最接近的動物種類。':'已辨識小動物；花色可以再調整。'};
    }
    progress('找出頭髮、膚色與衣服…');await next();
    worker=await task('ImageSegmenter','selfie.tflite',{runningMode:'IMAGE',outputCategoryMask:true,outputConfidenceMasks:false},progress,cpu);
    let mask;worker.segment(canvas,r=>{mask=copyMask(r);});worker.close();worker=null;
    const face=dominant(data,(x,y)=>maskAt(mask,x,y)===3);
    if(!face.length)return null;
    s.kind='person';s.skin=face[0].hex;
    const hair=dominant(data,(x,y)=>maskAt(mask,x,y)===1);if(hair.length)s.hair=hair[0].hex;
    progress('辨識肩膀、腰與手腳…');await next();
    worker=await task('PoseLandmarker','pose.task',{runningMode:'IMAGE',numPoses:1},progress,cpu);
    const landmarks=worker.detect(canvas).landmarks[0];worker.close();worker=null;
    const valid=i=>landmarks&&landmarks[i].visibility>.45;
    const hip=valid(23)&&valid(24)?(landmarks[23].y+landmarks[24].y)/2:.62;
    const shoulder=valid(11)&&valid(12)?(landmarks[11].y+landmarks[12].y)/2:.36;
    const top=dominant(data,(x,y)=>maskAt(mask,x,y)===4&&y<hip);
    const pants=dominant(data,(x,y)=>maskAt(mask,x,y)===4&&y>=hip);
    if(top.length)s.top=top[0].hex;if(pants.length)s.pants=pants[0].hex;
    let lowHair=0,allHair=0;for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++)if(mask.data[y*mask.width+x]===1){allHair++;if(y/mask.height>shoulder)lowHair++;}
    s.hairstyle=allHair&&lowHair/allHair>.06?'long':'short';
    if(landmarks) {
      const sleeves=[13,14].filter(valid).map(i=>maskAt(mask,Math.max(0,Math.min(.999,landmarks[i].x)),Math.max(0,Math.min(.999,landmarks[i].y))));
      s.shirt=sleeves.length&&sleeves.filter(v=>v===4).length>sleeves.length/2?'long':'short';
      if(valid(25)&&valid(26)) {
        const y=(landmarks[25].y+landmarks[26].y)/2, x=(landmarks[25].x+landmarks[26].x)/2;
        s.bottom=y>hip&&y<1&&x>0&&x<1&&maskAt(mask,x,y)===4?'skirt':'pants';
      }
      const shoes=dominant(data,(x,y)=>y>hip+.65*(1-hip)&&maskAt(mask,x,y)>0);if(shoes.length)s.shoe=shoes[0].hex;
    }
    return {look:s,note:landmarks?'已做好人偶初稿！髮型、袖長與裙褲可以再調整。':'已取出膚色和髮色；照片未拍到完整身體，請調整衣服。'};
  } catch(error) {
    worker?.close();worker=null;
    if(!cpu){progress('改用 CPU 再試一次…');await next();return recognize(canvas,current,progress,point,true);}
    throw error;
  } finally {worker?.close();}
}
