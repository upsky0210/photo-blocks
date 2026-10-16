const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('assert/strict');const fs=require('fs');
async function reveal(page,selector){const section=await page.locator(selector).first().evaluate(e=>e.closest('[data-figure-section]')?.dataset.figureSection);if(section)await page.locator(`[data-figure-section-button="${section}"]`).click();}
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXE?{executablePath:process.env.BROWSER_EXE}:{})});
 try {
  const page=await browser.newPage({viewport:{width:1200,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:5180');
  const analysis=await page.evaluate(async()=>{
   const {illustrationColors,visibleLowerBody}=await import('./js/figure/recognize.js');const cv=document.createElement('canvas');cv.width=256;cv.height=512;const c=cv.getContext('2d');
   c.fillStyle='#ffffff';c.fillRect(0,0,256,512);c.fillStyle='#a36835';c.fillRect(64,5,128,250);c.fillStyle='#efcea5';c.fillRect(96,50,64,120);c.fillStyle='#eee2ce';c.fillRect(48,210,36,150);c.fillRect(172,210,36,150);c.fillStyle='#3e3b38';c.fillRect(84,210,88,180);
   const look=illustrationColors(c.getImageData(0,0,256,512),{originX:32,originY:0,width:192,height:500});
   const full=Array.from({length:33},()=>({x:.5,y:.5,visibility:1}));const clipped=structuredClone(full);clipped[27].y=1.1;const hidden=structuredClone(full);hidden[28].visibility=.1;
   return {look,full:visibleLowerBody(full),clipped:visibleLowerBody(clipped),hidden:visibleLowerBody(hidden),missing:visibleLowerBody()};
  });
  assert.equal(analysis.look.hairstyle,'long');assert.equal(analysis.look.shirt,'layered');assert.equal(analysis.look.hair,'#a36835');assert.equal(analysis.full,true);assert.equal(analysis.clipped,false);assert.equal(analysis.hidden,false);assert.equal(analysis.missing,false);
  await reveal(page,'#btnSample');await page.locator('#btnSample').click();await page.waitForFunction(()=>__pb.figure&&!__pb.figure.working,{timeout:90000});
  const options=await page.locator('[data-look="bottom"] option').allTextContents();assert.deepEqual(options,['長褲','長裙','短裙','短褲']);
  const geometry=await page.evaluate(async()=>{
   const {defaults,createFigure,sanitize}=await import('./js/figure/model.js'),{buildFigureSolid}=await import('./js/figure/solid.js'),T=await import('three');const out=[];
   for(const bottom of ['pants','skirt','shortSkirt','shorts']){
    const figure=createFigure({...defaults,bottom,shirt:'layered'});const parts=[];figure.traverse(o=>{if(o.name)parts.push({name:o.name,height:o.geometry?.parameters.height});});
    const root=new T.Group(),base=new T.Mesh(new T.BoxGeometry(1.7,.16,1.7),new T.MeshLambertMaterial());base.position.y=-.08;root.add(base,figure);const g=buildFigureSolid(root);out.push({bottom,parts,triangles:g.attributes.position.count/3});
   }
   return {out,old:sanitize({...defaults,bottom:'skirt',sleeve:undefined})};
  });
  for(const row of geometry.out)assert(row.triangles>0);
  assert(geometry.out[2].parts.some(p=>p.name==='短裙'&&p.height===.32));assert(!geometry.out[2].parts.some(p=>p.name==='長褲'));assert(geometry.out[3].parts.some(p=>p.name==='短褲'&&p.height===.28));assert.equal(geometry.old.bottom,'skirt');
  for(const value of ['pants','skirt','shortSkirt','shorts']){await reveal(page,'[data-look="bottom"]');await page.locator('[data-look="bottom"]').selectOption(value);assert.equal(await page.evaluate(()=>__pb.figure.look.bottom),value);}
  await reveal(page,'[data-look="top"]');await page.locator('[data-look="top"]').fill('#f0e4d0');await reveal(page,'[data-look="top"]');await page.locator('[data-look="top"]').dispatchEvent('change');assert.equal(await page.evaluate(()=>__pb.figure.look.top),'#f0e4d0');
  console.log('程式產生插畫取色、畫面外腳踝、四種下半身實體、舊角色檔與上衣調色：通過');
  if(process.env.REFERENCE_IMAGE){
   const url='data:image/png;base64,'+fs.readFileSync(process.env.REFERENCE_IMAGE).toString('base64');
   await page.evaluate(async url=>{const im=new Image();im.src=url;await im.decode();const cv=document.createElement('canvas');cv.width=356;cv.height=768;cv.getContext('2d').drawImage(im,1745,294,585,1270,0,0,356,768);__pb.setSource(cv,cv.width,cv.height);},url);
   await page.waitForFunction(()=>__pb.figure.working);await page.waitForFunction(()=>!__pb.figure.working,{timeout:90000});
   const look=await page.evaluate(()=>__pb.figure.look);assert.equal(look.hairstyle,'long');assert.equal(look.shirt,'layered');assert.equal(look.bottom,'pants');assert.equal(look.pants,'#161616');assert.notEqual(look.hair,'#403028');assert.notEqual(look.top,'#438db5');
   await reveal(page,'#figureRotate');await page.locator('#figureRotate').uncheck();await reveal(page,'#figureReset');await page.locator('#figureReset').click();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'tests/reference-after.png'});console.log('使用者提供插畫：棕髮、長髮、疊穿長袖、黑色長褲通過',look.hair,look.top,look.sleeve);
  }
  await page.setViewportSize({width:768,height:1024});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),768);assert.deepEqual(errors,[]);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
