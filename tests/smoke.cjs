const {createRequire}=require('module');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXE?{executablePath:process.env.BROWSER_EXE}:{})});
 const page=await browser.newPage({viewport:{width:1200,height:900},acceptDownloads:true});
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('瀏覽器',m.text().slice(0,500));});page.on('request',r=>requests.push(r.url()));
 await page.goto('http://localhost:5180');await page.locator('#btnSample').click();
 await page.waitForFunction(()=>window.__pb.figure&&!window.__pb.figure.working,{timeout:120000});
 console.log(JSON.stringify({errors,status:await page.locator('#figureStatus').textContent(),external:requests.filter(u=>!u.startsWith('http://localhost:5180')&&!u.startsWith('blob:')&&!u.startsWith('data:'))}));
 await page.screenshot({path:'tests/figure-desktop.png',fullPage:true});
 await page.setViewportSize({width:768,height:1024});await page.screenshot({path:'tests/figure-ipad.png',fullPage:true});
 console.log('版面',await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth})));
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
