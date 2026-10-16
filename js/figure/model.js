import * as THREE from 'three';
import { makeBlockNPC, canvasTex, NPC_FACES, faceDrawer } from './blocks.js';
import { makeCat, makeHamster, makeTurtle, makeGlider } from './campus-animals.js';
import { makeBird } from './bird.js';
import { PAPER_FACE } from './faces.js';

export const choices = {
  kind: { person: '人', animal: '小動物' },
  species: { cat: '貓', dog: '狗', rabbit: '兔子', bird: '鳥', hamster: '倉鼠', turtle: '烏龜', glider: '蜜袋鼯' },
  hairstyle: { short: '短髮', long: '長髮', spiky: '刺刺頭', bun: '髮髻' },
  hat: { none: '沒有', cap: '棒球帽', beret: '貝雷帽', beanie: '毛線帽' },
  shirt: { short: '短袖', long: '長袖', layered: '背心疊穿長袖', collar: '有領上衣', tie: '領帶', hoodie: '連帽外套', sleeveless: '無袖' },
  bottom: { pants: '長褲', skirt: '長裙', shortSkirt: '短裙', shorts: '短褲' },
  holdL: { none: '沒有', recorder: '直笛', racket: '球拍', shuttle: '羽毛球', brush: '水彩筆' },
  expression: Object.fromEntries(NPC_FACES.map((k,i) => [k,['平常','眨眼','開心笑','眨眼吐舌','驚訝','難過','想睡','吐舌頭'][i]])),
  pattern: { solid: '純色', tabby: '虎斑', patches: '色塊（三花）', spots: '斑點' }
};
choices.holdR = choices.holdL;
export const defaults = { kind:'person', species:'cat', skin:'#edbd96', hair:'#403028', top:'#438db5', sleeve:'#f2eadb', pants:'#161616', shoe:'#493c36', main:'#d99a53', second:'#f5e3bd', third:'#49382d', accent:'#db6650', hairstyle:'short', hat:'none', shirt:'short', bottom:'pants', holdL:'none', holdR:'none', expression:'normal', pattern:'solid', scarf:false, bag:false, whistle:false, glasses:false, glassesY:0 };
export function sanitize(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('角色檔格式不正確');
  const out = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const v = input[key];
    if (choices[key] && Object.hasOwn(choices[key],v)) out[key] = v;
    else if (key === 'glassesY' && typeof v === 'number' && Number.isFinite(v)) out[key] = Math.max(-.08,Math.min(.08,v));
    else if (typeof defaults[key] === 'boolean' && typeof v === 'boolean') out[key] = v;
    else if (typeof defaults[key] === 'string' && defaults[key].startsWith('#') && typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) out[key] = v;
  }
  return out;
}
export function npcLook(s) {
  // 所有角色共用新畫的臉模板，不使用照片五官或老師資料。
  return { skin:s.skin, hair:s.hair, top:s.top, pants:s.pants, shoe:s.shoe,
    face:PAPER_FACE, paperFace:true,
    pal:{ H:s.hair,h:s.hair,S:s.skin,N:s.skin,W:'#fff9ed',E:'#26232c',M:'#95414c' },
    shortHair:s.hairstyle==='short', longHair:s.hairstyle==='long', spiky:s.hairstyle==='spiky', bun:s.hairstyle==='bun',
    cap:s.hat==='cap'?{color:s.accent}:null, beret:s.hat==='beret'?{color:s.accent,letter:'#fff5de'}:null, beanie:s.hat==='beanie'?s.accent:null,
    longSleeve:['long','hoodie','layered'].includes(s.shirt), sleeve:s.shirt==='layered'?s.sleeve:null, sleeveless:s.shirt==='sleeveless', collar:s.shirt==='layered'?s.sleeve:['collar','tie'].includes(s.shirt)?'#fff5de':null,
    tie:s.shirt==='tie'?s.accent:null, hoodie:s.shirt==='hoodie'?'#fff5de':null, pocket:s.top,
    skirt:['skirt','shortSkirt'].includes(s.bottom)?s.pants:null, shortSkirt:s.bottom==='shortSkirt', shorts:s.bottom==='shorts', scarf:s.scarf?[s.accent,'#fff5de']:null, bag:s.bag?s.accent:null, whistle:s.whistle,
    holdL:s.holdL==='none'?null:s.holdL, holdR:s.holdR==='none'?null:s.holdR };
}
function box(g,w,h,d,color,x,y,z) {
  const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshLambertMaterial({color})); b.position.set(x,y,z);g.add(b);return b;
}
function newAnimal(s) {
  // 狗與兔子：比照校園貓的方塊比例，前面朝 -Z。
  const g=new THREE.Group(), rabbit=s.species==='rabbit';
  box(g,.38,.38,.53,s.main,0,.28,.02);
  box(g,.36,.32,.34,s.main,0,.58,-.2);
  for(const x of [-.12,.12]) {
    box(g,.13,.18,.2,s.main,x,.1,-.15); box(g,.15,.15,.23,s.main,x,.08,.2);
    box(g,rabbit?.10:.12,rabbit?.35:.3,.11,s.main,rabbit?x:x*1.8,rabbit?.89:.53,-.16);
    if(rabbit) box(g,.05,.26,.012,'#efa6b6',x,.9,-.22);
  }
  box(g,.13,.13,rabbit?.13:.26,s.second,0,.5,-.39);
  box(g,.08,.07,.06,'#513d3a',0,.54,-.53);
  box(g,.11,.13,rabbit?.12:.3,s.main,0,.28,.35);
  return g;
}
export function createFigure(s) {
  let g;
  if(s.kind==='person') {
    g=makeBlockNPC(npcLook(s));g.userData.setFace(s.expression);
    if(s.glasses) {
      const frames=new THREE.Group();frames.name='眼鏡';frames.position.set(0,1.58+(Number(s.glassesY)||0),-.26);g.add(frames);
      for(const x of [-.115,.115]) {
        for(const y of [-.065,.065]) box(frames,.19,.014,.018,'#252532',x,y,0);
        for(const dx of [-.095,.095]) box(frames,.014,.13,.018,'#252532',x+dx,0,0);
      }
      box(frames,.05,.014,.018,'#252532',0,.018,0); // 鼻橋只畫一份，避免重疊面。
      for(const side of [-1,1]){
        box(frames,.035,.014,.018,'#252532',side*.225,.052,0);
        box(frames,.014,.014,.24,'#252532',side*.24,.052,.11);
      }
    }
    if(s.bag) { box(g,.35,.43,.14,s.accent,0,1.02,.2); }
  } else {
    const make={cat:makeCat,hamster:makeHamster,turtle:()=>makeTurtle(s.main),glider:()=>makeGlider('grey'),bird:()=>makeBird('sparrow')};
    g=make[s.species]?make[s.species]():newAnimal(s);
    // 共用 16×16 毛色貼圖；保留眼睛、鼻子與腳掌的辨識細節。
    const fur=canvasTex(c=>{
      c.fillStyle=s.main;c.fillRect(0,0,16,16);c.fillStyle=s.second;
      if(s.pattern==='tabby') for(let y=2;y<16;y+=4)c.fillRect(0,y,16,2);
      if(s.pattern==='patches'){c.fillRect(0,0,7,8);c.fillStyle=s.third;c.fillRect(9,7,7,9);}
      if(s.pattern==='spots') for(const [x,y] of [[2,2],[9,4],[5,10],[12,13]])c.fillRect(x,y,3,2);
    },1,16,{smooth:false});
    const mats=new Set();
    g.traverse(o=>{ if(o.isMesh){for(const m of [].concat(o.material))mats.add(m);} });
    let i=0;for(const m of mats) { if(i++<2){m.map?.dispose();m.map=fur;m.color.set('#ffffff');m.needsUpdate=true;} }
    const b=new THREE.Box3().setFromObject(g),size=b.getSize(new THREE.Vector3());
    const scale=1.5/Math.max(size.x,size.y,size.z);g.scale.setScalar(scale);g.position.y=-b.min.y*scale;
    // 在頭部原本的前表面套用表情，避免臉片懸在模型外面。
    const template=npcLook({...s,skin:s.main,hair:s.main});
    template.face=template.face.map(row=>row.replaceAll('H','S'));
    const draw=faceDrawer(template),face=canvasTex(c=>draw(c,s.expression),1,16,{smooth:false});
    const widths={cat:.22,dog:.36,rabbit:.36,bird:.09,hamster:.085,turtle:.08,glider:.11};
    let found=false;
    g.traverse(o=>{
      if(!o.isMesh)return;
      const p=o.geometry.parameters;
      if(!found&&o.geometry.type==='BoxGeometry'&&Math.abs(p.width-widths[s.species])<.00001&&p.height>.05){
        const material=Array.isArray(o.material)?o.material[0]:o.material;
        o.material=[material,material,material,material,material,new THREE.MeshLambertMaterial({map:face})];found=true;
      }
      // 移除原有的小眼睛方塊，由像素模板統一畫表情。
      if(o.geometry.type==='BoxGeometry'&&p.width<=.036&&p.height<=.04){
        const m=Array.isArray(o.material)?o.material[0]:o.material;
        if(m.color&&m.color.r<.035&&m.color.g<.035&&m.color.b<.035)o.visible=false;
      }
    });
    if(!found)face.dispose();
  }
  return g;
}
