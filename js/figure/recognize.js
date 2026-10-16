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

// 插畫可能只被物件偵測器認出人物，沒有可靠的人像分割。
// 這時依人物框的頭部、衣服區域取色；不把這種近似結果當成成功的分割。
export function illustrationColors(data, box) {
  if(!box)return null;
  const bounds={x:box.originX/data.width,y:box.originY/data.height,w:box.width/data.width,h:box.height/data.height};
  const at=(x,y)=>{
    const i=(Math.min(data.height-1,Math.max(0,Math.floor(y*data.height)))*data.width+Math.min(data.width-1,Math.max(0,Math.floor(x*data.width))))*4;
    return [...data.data.slice(i,i+3)];
  };
  const relative=(x,y)=>[(x-bounds.x)/bounds.w,(y-bounds.y)/bounds.h];
  const inRegion=(x,y,x0,x1,y0,y1)=>{const [u,v]=relative(x,y);return u>x0&&u<x1&&v>y0&&v<y1;};
  const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
  const corners=[[0,0],[.999,0],[0,.999],[.999,.999]].map(([x,y])=>rgbToLab(...at(x,y)));
  const foreground=(x,y)=>{const lab=rgbToLab(...at(x,y));return !corners.some(c=>distance(lab,c)<5);};
  const warm=(x,y)=>{const [r,g,b]=at(x,y),l=rgbToLab(r,g,b)[0];return r>g+5&&g>b+8&&r-b>25&&l>56&&l<94;};
  const skins=dominant(data,(x,y)=>inRegion(x,y,.24,.76,.12,.4)&&warm(x,y),3);
  const skin=skins.filter(c=>c.n>skins.reduce((n,c)=>n+c.n,0)*.12).sort((a,b)=>b.lab[0]-a.lab[0])[0];
  if(!skin)return null;
  const hair=dominant(data,(x,y)=>{
    if(!inRegion(x,y,.08,.92,.02,.42)||!foreground(x,y))return false;
    const lab=rgbToLab(...at(x,y));return lab[0]<skin.lab[0]-10&&distance(lab,skin.lab)>20;
  })[0];
  if(!hair)return null;
  const top=dominant(data,(x,y)=>inRegion(x,y,.3,.7,.42,.66)&&foreground(x,y)&&distance(rgbToLab(...at(x,y)),skin.lab)>14)[0];
  const sleeve=dominant(data,(x,y)=>{
    const [u,v]=relative(x,y);
    return ((u>.1&&u<.27)||(u>.73&&u<.9))&&v>.4&&v<.62&&foreground(x,y)&&distance(rgbToLab(...at(x,y)),skin.lab)>12;
  })[0];
  let hairCount=0,lowHair=0;
  for(let y=0;y<data.height;y+=3)for(let x=0;x<data.width;x+=3){
    const nx=x/data.width,ny=y/data.height;
    if(!inRegion(nx,ny,.04,.96,.02,.64))continue;
    if(distance(rgbToLab(...at(nx,ny)),hair.lab)<22){hairCount++;if(relative(nx,ny)[1]>.38)lowHair++;}
  }
  return {skin:skin.hex,hair:hair.hex,hairstyle:hairCount&&lowHair/hairCount>.06?'long':'short',top:top?.hex,sleeve:sleeve?.hex,
    shirt:top&&sleeve&&distance(top.lab,sleeve.lab)>22?'layered':'long'};
}

export function visibleLowerBody(landmarks) {
  // 姿勢模型會猜測畫面外的腳；可見度高但座標在照片外也不能採用。
  return !!landmarks&&[23,24,25,26,27,28].every(i=>{
    const p=landmarks[i];return p&&p.visibility>.55&&p.x>.015&&p.x<.985&&p.y>.015&&p.y<.985;
  });
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
      if(!animal&&!point) {
        if(!cpu){progress('改用 CPU 確認辨識結果…');return recognize(canvas,current,progress,point,true);}
        return null;
      }
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
    const hair=dominant(data,(x,y)=>maskAt(mask,x,y)===1);
    const faceArea=mask.data.reduce((n,c)=>n+(c===3),0)/mask.data.length;
    const fallback=(!face.length||!hair.length||faceArea<.003)?illustrationColors(data,person?.boundingBox):null;
    // 有些 GPU 不報錯卻回傳空白區域；仍要用 CPU 再確認，不能直接留預設造型。
    if(!cpu&&!fallback&&(!face.length||!hair.length||faceArea<.003)){
      progress('改用 CPU 確認人物顏色…');return recognize(canvas,current,progress,point,true);
    }
    if(!face.length&&!fallback)return null;
    s.kind='person';if(face.length)s.skin=face[0].hex;if(hair.length)s.hair=hair[0].hex;
    progress('辨識肩膀、腰與手腳…');await next();
    let landmarks;
    for(const useCPU of cpu?[true]:[false,true]) {
      try {
        worker=await task('PoseLandmarker','pose.task',{runningMode:'IMAGE',numPoses:1},progress,useCPU);
        landmarks=worker.detect(canvas).landmarks[0];if(landmarks)break;
      } catch(error) {progress('姿勢不完整，保留已取出的顏色…');}
      finally {worker?.close();worker=null;}
    }
    const valid=i=>landmarks&&landmarks[i].visibility>.45;
    const hip=valid(23)&&valid(24)?(landmarks[23].y+landmarks[24].y)/2:.62;
    const shoulder=valid(11)&&valid(12)?(landmarks[11].y+landmarks[12].y)/2:.36;
    const top=dominant(data,(x,y)=>maskAt(mask,x,y)===4&&y<hip);
    const pants=dominant(data,(x,y)=>maskAt(mask,x,y)===4&&y>=hip);
    if(top.length)s.top=top[0].hex;
    // 半身照不能用衣服底端、背景或上次的裙褲來猜下半身。
    const fullBody=visibleLowerBody(landmarks);
    s.bottom='pants';s.pants='#161616';
    if(fullBody&&pants.length)s.pants=pants[0].hex;
    let lowHair=0,allHair=0;for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++)if(mask.data[y*mask.width+x]===1){allHair++;if(y/mask.height>shoulder)lowHair++;}
    s.hairstyle=allHair&&lowHair/allHair>.06?'long':'short';
    if(landmarks) {
      const sleeves=[13,14].filter(valid).map(i=>maskAt(mask,Math.max(0,Math.min(.999,landmarks[i].x)),Math.max(0,Math.min(.999,landmarks[i].y))));
      s.shirt=sleeves.length&&sleeves.filter(v=>v===4).length>sleeves.length/2?'long':'short';
      if(fullBody) {
        const y=(landmarks[25].y+landmarks[26].y)/2, x=(landmarks[25].x+landmarks[26].x)/2;
        s.bottom=y>hip&&y<1&&x>0&&x<1&&maskAt(mask,x,y)===4?'skirt':'pants';
      }
      const shoes=fullBody?dominant(data,(x,y)=>y>hip+.65*(1-hip)&&maskAt(mask,x,y)>0):[];if(shoes.length)s.shoe=shoes[0].hex;
    }
    if(fallback){for(const [key,value]of Object.entries(fallback))if(value)s[key]=value;}
    const lowerNote=fullBody?'下半身也可以改成長裙、長褲、短裙或短褲。':'照片沒有完整下半身，已先用黑色長褲；也可以改成裙子或短褲。';
    return {look:s,note:(fallback?'插畫分割不完整，已依人物區域近似取色，請再確認髮型與上衣。':'已做好人偶初稿！')+lowerNote};
  } catch(error) {
    worker?.close();worker=null;
    if(!cpu){progress('改用 CPU 再試一次…');await next();return recognize(canvas,current,progress,point,true);}
    throw error;
  } finally {worker?.close();}
}
