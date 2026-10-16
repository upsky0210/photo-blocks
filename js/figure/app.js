import { choices, defaults, sanitize, npcLook } from './model.js';
import { FigureView } from './view.js';

const $=s=>document.querySelector(s);
const colorLabels={skin:'膚色',hair:'髮色',top:'上衣',pants:'褲子／裙子',shoe:'鞋子',accent:'配件',main:'主色',second:'第二色',third:'第三色'};
const labels={kind:'主角',species:'動物種類',hairstyle:'髮型',hat:'帽子',shirt:'上衣樣式',bottom:'褲子或裙子',holdL:'左手拿',holdR:'右手拿',expression:'表情',pattern:'花色'};
let look={...defaults},source,view,working=false,revision=0,pick=null,lastSource=0,queued=false;
const download=(blob,name)=>{const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);};
function status(text){$('#figureStatus').textContent=text;}
function update(){view?.update(look);for(const e of document.querySelectorAll('[data-look]')){const key=e.dataset.look;if(e.type==='checkbox')e.checked=look[key];else e.value=look[key];}$('#personControls').hidden=look.kind!=='person';$('#animalControls').hidden=look.kind!=='animal';$('#personColors').hidden=look.kind!=='person';$('#animalColors').hidden=look.kind!=='animal';}
function select(key){return `<label class="figure-field">${labels[key]}<select data-look="${key}" aria-label="${labels[key]}">${Object.entries(choices[key]).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label>`;}
function colors(keys){return keys.map(k=>`<div class="figure-color"><label>${colorLabels[k]} <input type="color" data-look="${k}" aria-label="${colorLabels[k]}"></label><button type="button" data-pick="${k}" aria-label="從照片吸取${colorLabels[k]}">吸色</button></div>`).join('');}
export function initFigure() {
  $('#figurePanel').innerHTML=`<h2>創作我的方塊人偶</h2><p class="small">照片留在裝置上，五官使用可愛像素模板。</p>${select('kind')}
    <div class="figure-actions"><button id="figureRecognize" type="button">重新自動辨識</button><button id="figureRandom" type="button">🎲 隨機搭配</button></div>
    <p id="figureStatus" role="status" aria-live="polite">可以先調整，也可以自動辨識照片。</p>
    <div id="personControls" class="figure-fields">${['hairstyle','hat','shirt','bottom','holdL','holdR'].map(select).join('')}<fieldset><legend>配件</legend>${Object.entries({scarf:'圍巾',bag:'背包',whistle:'哨子',glasses:'眼鏡'}).map(([k,l])=>`<label class="figure-check"><input type="checkbox" data-look="${k}">${l}</label>`).join('')}</fieldset></div>
    <div id="animalControls" class="figure-fields" hidden>${select('species')}${select('pattern')}</div>${select('expression')}
    <div id="personColors" class="figure-colors">${colors(['skin','hair','top','pants','shoe','accent'])}</div><div id="animalColors" class="figure-colors" hidden>${colors(['main','second','third'])}</div>
    <p id="figurePickHint" class="small">按「吸色」，再點一下上方原始照片。</p>
    <label class="figure-field">名字或暱稱（可以不填）<input id="figureName" maxlength="30" placeholder="我的方塊人偶"></label>
    <div class="figure-actions">${['png','glb','stl','usdz','json'].map((k,i)=>`<button type="button" data-figure-export="${k}">${['角色卡 PNG','GLB 模型','STL 列印','USDZ／AR','儲存角色 JSON'][i]}</button>`).join('')}<button type="button" id="figureOpen">開啟角色 JSON</button></div>
    <input type="file" id="figureFile" accept="application/json,.json" hidden><a id="figureAR" class="btn" rel="ar" hidden><img alt="">用 AR 擺在桌上看</a>
    <p class="small">STL 最長邊 100 mm，會合成封閉實體並加上必要支柱；細節以方塊呈現。JSON 只存角色設定，不存照片。</p>`;
  look.kind=$('#startKind').value;
  view=new FigureView($('#figureViewport'));update();
  $('#figurePanel').addEventListener('change',e=>{const key=e.target.dataset.look;if(!key)return;revision++;look[key]=e.target.type==='checkbox'?e.target.checked:e.target.value;update();});
  $('#figurePanel').addEventListener('click',async e=>{
    const button=e.target.closest('button');if(!button)return;
    if(button.dataset.pick){pick=button.dataset.pick;$('#figurePickHint').textContent=`現在點一下原始照片，取得「${colorLabels[pick]}」。`;$('#thumb').style.cursor='crosshair';return;}
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
    if(pick){const rgb=source.getContext('2d').getImageData(x,y,1,1).data;look[pick]='#'+[...rgb].slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join('');revision++;pick=null;$('#thumb').style.cursor='';$('#figurePickHint').textContent='顏色已套用！可以再按其他部位的吸色。';update();}
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
export function showFigure(visible){if(visible){view.resize();view.start();}else view.stop();}
export function inspectFigure(){return {look:{...look},view,working};}
