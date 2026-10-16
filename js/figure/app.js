import { choices, defaults, sanitize, npcLook } from './model.js';
import { FigureView } from './view.js';

const $=s=>document.querySelector(s);
const colorLabels={skin:'膚色',hair:'髮色',top:'上衣顏色',sleeve:'疊穿袖子',pants:'下半身顏色',shoe:'鞋子',accent:'配件',main:'主色',second:'第二色',third:'第三色'};
const labels={kind:'主角',species:'動物種類',hairstyle:'髮型',hat:'帽子',shirt:'上衣樣式',bottom:'下半身',holdL:'左手拿',holdR:'右手拿',expression:'表情',pattern:'花色'};
let look={...defaults},source,view,working=false,revision=0,pick=null,lastSource=0,queued=false,pickSection='colors';
const download=(blob,name)=>{const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);};
function status(text){$('#figureStatus').textContent=text;}
function update(){
  view?.update(look);
  for(const e of document.querySelectorAll('[data-look]')){const key=e.dataset.look;if(e.type==='checkbox')e.checked=look[key];else e.value=look[key];}
  for(const e of document.querySelectorAll('[data-person]'))e.hidden=look.kind!=='person';
  for(const e of document.querySelectorAll('[data-animal]'))e.hidden=look.kind!=='animal';
  $('#glassesAdjust').hidden=look.kind!=='person'||!look.glasses;
  $('#glassesYOut').textContent=look.glassesY===0?'標準位置':look.glassesY>0?'往上':'往下';
}
function setSection(section){
  for(const panel of document.querySelectorAll('[data-figure-section]'))panel.hidden=panel.dataset.figureSection!==section;
  for(const button of document.querySelectorAll('[data-figure-section-button]')){const selected=button.dataset.figureSectionButton===section;button.classList.toggle('on',selected);button.setAttribute('aria-selected',String(selected));}
}

function select(key){return `<label class="figure-field">${labels[key]}<select data-look="${key}" aria-label="${labels[key]}">${Object.entries(choices[key]).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label>`;}
function colors(keys){return keys.map(k=>`<div class="figure-color"><label>${colorLabels[k]} <input type="color" data-look="${k}" aria-label="${colorLabels[k]}"></label><button type="button" data-pick="${k}" aria-label="從照片吸取${colorLabels[k]}">吸色</button></div>`).join('');}
export function initFigure() {
  $('#figurePanel').innerHTML=`<h2>人偶工作台</h2>
    <nav class="figure-section-tabs" role="tablist" aria-label="人偶調整分類">${Object.entries({photo:'照片',clothes:'服裝',head:'造型',props:'配件',colors:'配色',export:'匯出'}).map(([key,label])=>`<button type="button" role="tab" data-figure-section-button="${key}" aria-controls="figureSection-${key}">${label}</button>`).join('')}</nav>
    <div class="figure-actions figure-common"><button id="figureRecognize" type="button">重新辨識</button><button id="figureRandom" type="button">🎲 隨機搭配</button></div>
    <div class="figure-section-body">
      <section id="figureSection-photo" data-figure-section="photo" role="tabpanel">${select('kind')}<div id="figurePhotoSlot"></div><p id="figurePickHint" class="small">照片只在裝置上處理。按配色的「吸色」後，點照片取色。</p></section>
      <section id="figureSection-clothes" data-figure-section="clothes" role="tabpanel" hidden><div id="personControls" data-person><div class="figure-fields">${['shirt','bottom'].map(select).join('')}${colors(['top','pants'])}</div><p class="small">半身照先用黑色長褲；下半身樣式、顏色都能改。</p></div><div id="animalControls" data-animal class="figure-fields" hidden>${select('species')}${select('pattern')}</div></section>
      <section id="figureSection-head" data-figure-section="head" role="tabpanel" hidden><div data-person class="figure-fields">${['hairstyle','hat'].map(select).join('')}</div>${select('expression')}</section>
      <section id="figureSection-props" data-figure-section="props" role="tabpanel" hidden><div data-person><div class="figure-fields">${['holdL','holdR'].map(select).join('')}</div><fieldset class="figure-accessories"><legend>配件</legend>${Object.entries({scarf:'圍巾',bag:'背包',whistle:'哨子',glasses:'眼鏡'}).map(([k,l])=>`<label class="figure-check"><input type="checkbox" data-look="${k}">${l}</label>`).join('')}</fieldset><div id="glassesAdjust" hidden><label class="figure-field">眼鏡上下位置<input type="range" data-look="glassesY" min="-0.08" max="0.08" step="0.005" aria-label="眼鏡上下位置"><span class="small"><output id="glassesYOut">標準位置</output></span></label><button type="button" id="glassesAlign">對齊眼睛</button></div></div><p data-animal class="small" hidden>小動物可以在「造型」選表情，在「配色」改毛色。</p></section>
      <section id="figureSection-colors" data-figure-section="colors" role="tabpanel" hidden><div id="personColors" data-person class="figure-colors">${colors(['skin','hair','sleeve','shoe','accent'])}</div><div id="animalColors" data-animal class="figure-colors" hidden>${colors(['main','second','third'])}</div><p class="small">上衣與下半身的顏色在「服裝」。按吸色會切到照片，點完會回到原來的分類。</p></section>
      <section id="figureSection-export" data-figure-section="export" role="tabpanel" hidden><label class="figure-field">名字或暱稱（選填）<input id="figureName" maxlength="30" placeholder="我的方塊人偶"></label><div class="figure-actions">${['png','glb','stl','usdz','json'].map((k,i)=>`<button type="button" data-figure-export="${k}">${['角色卡 PNG','GLB 模型','STL 列印','USDZ／AR','儲存 JSON'][i]}</button>`).join('')}<button type="button" id="figureOpen">開啟 JSON</button></div><input type="file" id="figureFile" accept="application/json,.json" hidden><a id="figureAR" class="btn" rel="ar" hidden><img alt="">用 AR 擺在桌上看</a><p class="small">JSON 不含照片，可重新開啟修改。STL 最長邊 100 mm，會合成封閉實體並補強。</p></section>
    </div>
    <p id="figureStatus" role="status" aria-live="polite">可以先調整，也可以自動辨識照片。</p>`;
  $('#figurePanel').addEventListener('click',e=>{const section=e.target.closest('[data-figure-section-button]')?.dataset.figureSectionButton;if(section)setSection(section);});
  setSection('photo');
  look.kind=$('#startKind').value;
  view=new FigureView($('#figureViewport'));update();
  const changeLook=e=>{const key=e.target.dataset.look;if(!key)return;revision++;look[key]=e.target.type==='checkbox'?e.target.checked:e.target.type==='range'?Number(e.target.value):e.target.value;update();};
  $('#figurePanel').addEventListener('change',changeLook);
  $('#figurePanel').addEventListener('input',e=>{if(e.target.type==='range')changeLook(e);});
  $('#glassesAlign').onclick=()=>{revision++;look.glassesY=0;update();};
  $('#figurePanel').addEventListener('click',async e=>{
    const button=e.target.closest('button');if(!button)return;
    if(button.dataset.pick){pickSection=button.closest('[data-figure-section]').dataset.figureSection;setSection('photo');pick=button.dataset.pick;$('#figurePickHint').textContent=`現在點一下原始照片，取得「${colorLabels[pick]}」。`;$('#thumb').style.cursor='crosshair';return;}
    const kind=button.dataset.figureExport;if(!kind)return;
    button.disabled=true;
    try {
      const name=$('#figureName').value.trim(),filename=(name||'我的方塊人偶').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_');
      status(kind==='stl'?'正在合成並驗證封閉實體…':'正在準備匯出…');await new Promise(r=>setTimeout(r,40));
      const blob=kind==='json'?new Blob([JSON.stringify({format:'photo-blocks-figure',version:1,name,look,npcLook:look.kind==='person'?npcLook(look):undefined},null,2)],{type:'application/json'}):await view.export(kind,name);
      if(!blob)throw Error('無法產生檔案');download(blob,`${filename}.${kind}`);status('已匯出！');
      if(kind==='usdz'){const a=$('#figureAR');if(a.dataset.url)URL.revokeObjectURL(a.dataset.url);a.href=URL.createObjectURL(blob);a.dataset.url=a.href;a.hidden=false;}
    }catch(error){status(`匯出失敗：${error.message}`);}finally{button.disabled=false;}
  });
  $('#figureRecognize').onclick=()=>auto();
  $('#figureRandom').onclick=()=>{revision++;for(const key of ['hairstyle','hat','shirt','bottom','expression','pattern','species','holdL','holdR']){const values=Object.keys(choices[key]);look[key]=values[Math.floor(Math.random()*values.length)];}for(const key of Object.keys(colorLabels))look[key]='#'+Math.floor(Math.random()*0xffffff).toString(16).padStart(6,'0');update();status('新的搭配！還可以繼續改。');};
  $('#figureOpen').onclick=()=>$('#figureFile').click();
  $('#figureFile').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>100000)throw Error('角色檔太大');const json=JSON.parse(await file.text());if(json.format!=='photo-blocks-figure'||json.version!==1)throw Error('不是支援的角色檔');const next=sanitize(json.look);revision++;look=next;$('#figureName').value=typeof json.name==='string'?json.name.slice(0,30):'';update();status('已開啟角色，可以繼續修改。');}catch(error){status(`無法開啟：${error.message}`);}};
  $('#thumb').addEventListener('click',e=>{
    if(!source)return;const r=e.target.getBoundingClientRect(),x=Math.min(source.width-1,Math.floor((e.clientX-r.left)/r.width*source.width)),y=Math.min(source.height-1,Math.floor((e.clientY-r.top)/r.height*source.height));
    if(pick){const rgb=source.getContext('2d').getImageData(x,y,1,1).data;look[pick]='#'+[...rgb].slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join('');revision++;pick=null;$('#thumb').style.cursor='';$('#figurePickHint').textContent='顏色已套用！可以再按其他部位的吸色。';update();setSection(pickSection);}
    else if(look.kind==='animal')auto({x:x/source.width,y:y/source.height});
  });
  $('#figureWave').onclick=()=>view.animate('wave');$('#figureJump').onclick=()=>view.animate('jump');$('#figureReset').onclick=()=>view.reset();$('#figureRotate').onchange=e=>{view.controls.autoRotate=e.target.checked;};
}
export async function setFigureSource(canvas,id) {
  if(id===lastSource)return;source=canvas;revision++;lastSource=id;
  if(working){queued=true;return;}await auto();
}
async function auto(point) {
  if(working||!source)return;working=true;const rev=revision;$('#figureRecognize').disabled=true;$('#figureProgress').hidden=false;
  try{const {recognize}=await import('./recognize.js');const result=await recognize(source,look,text=>{status(text);$('#figureProgress').textContent=text;},point);if(revision!==rev){status('保留你剛才的調整；可再按重新自動辨識。');return;}if(result){look=result.look;update();status(result.note);}else status('沒有認出來，請自己調整。小動物可以點照片中的動物再試一次。');}
  catch(error){console.warn('本機辨識未完成',error);if(revision===rev)status('沒有認出來，請自己調整。模型可能載入失敗，可按重新自動辨識。');}
  finally{working=false;$('#figureRecognize').disabled=false;$('#figureProgress').hidden=true;if(queued){queued=false;auto();}}
}
export function showFigure(visible){
  if(visible){$('#figurePhotoSlot').append($('#srcCard'));view.resize();view.start();}
  else {$('#figurePanel').before($('#srcCard'));view.stop();}
}
export function inspectFigure(){return {look:{...look},view,working};}
