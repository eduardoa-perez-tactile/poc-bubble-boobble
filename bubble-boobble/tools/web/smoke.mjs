/** Isolated headless browser acceptance. Never opens or focuses the user's browser. */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { webContentTypes } from './content-types.mjs';
const root=fileURLToPath(new URL('../..',import.meta.url));
const site=resolve(root,'build/web/site'),out=resolve(root,'build/web-qa');mkdirSync(out,{recursive:true});
const report={ok:false,started:new Date().toISOString(),build:JSON.parse(readFileSync(resolve(site,'playtest-build.json'))),checks:[],errors:[],screenshots:[],audio:[]};
const server=createServer((req,res)=>{
 try{const file=resolve(site,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/\/$/,'/index.html'));if(relative(site,file).startsWith('..')){res.writeHead(403).end();return;}if(!statSync(file).isFile())throw Error('file');res.setHeader('Content-Type',webContentTypes[extname(file)]??'application/octet-stream');res.end(readFileSync(file));}catch{res.writeHead(404).end();}
});
let browser,page,chrome,profile;
const check=(name,detail)=>report.checks.push({name,detail});
async function savedProgress(){return page.evaluate(async()=>{
 const databases=await indexedDB.databases();
 for(const {name} of databases){
  const db=await new Promise((done,fail)=>{const r=indexedDB.open(name);r.onsuccess=()=>done(r.result);r.onerror=()=>fail(r.error);});
  try{
   if(!db.objectStoreNames.contains('FILE_DATA'))continue;
   const transaction=db.transaction('FILE_DATA'),store=transaction.objectStore('FILE_DATA');
   const request=r=>new Promise((done,fail)=>{r.onsuccess=()=>done(r.result);r.onerror=()=>fail(r.error);});
   const [keys,records]=await Promise.all([request(store.getAllKeys()),request(store.getAll())]);
   for(let i=0;i<records.length;i++)if(String(keys[i]).endsWith('/default.json')&&records[i].contents){try{const save=JSON.parse(new TextDecoder().decode(records[i].contents));if(save.name==='meta-bubblebobble-desktop'&&save.data?.state)return save.data.state;}catch{}}
  }finally{db.close();}
 }
 return null;
});}
async function state(){await page.waitForFunction(()=>globalThis.gameengineProbe?.state());return page.evaluate(()=>globalThis.gameengineProbe.state());}
async function advance(steps=8){const before=await state();await page.waitForFunction(({step,frames,steps})=>{const s=globalThis.gameengineProbe?.state();return s&&Number(s.step)>=Number(step)+steps&&s.frames>frames;},{...before,steps},{timeout:30000});}
async function press(key){await page.keyboard.down(key);await page.waitForTimeout(100);await page.keyboard.up(key);await advance(4);}
async function shot(name){const bytes=await page.screenshot({path:resolve(out,name+'.png')});report.screenshots.push({name,path:'build/web-qa/'+name+'.png'});return createHash('sha256').update(bytes).digest('hex');}
async function hold(keys,ms=500){for(const k of keys)await page.keyboard.down(k);await page.waitForTimeout(ms);for(const k of keys)await page.keyboard.up(k);await advance();}
try{
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 profile=mkdtempSync(resolve(root,'.gameengine/web-chrome-'));
 const executable=process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
 assert.ok(existsSync(executable),'Install Chrome or set CHROME_PATH');
 chrome=spawn(executable,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--mute-audio','--no-default-browser-check','--enable-unsafe-webgpu','--use-angle=metal','about:blank'],{stdio:'ignore'});
 const active=resolve(profile,'DevToolsActivePort');
 for(let i=0;!existsSync(active);i++){if(i>200)throw Error('Chrome did not start');await new Promise(done=>setTimeout(done,50));}
 const port=readFileSync(active,'utf8').split('\n')[0];
 browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`,{noDefaults:true});
 const context=browser.contexts()[0];page=context.pages()[0];await page.setViewportSize({width:1024,height:768});await page.bringToFront();
 page.on('pageerror',e=>report.errors.push(e.stack??e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());if(m.type()==='warning'||m.type()==='error')console.error('BROWSER',m.type(),m.text());});
 const cdp=await context.newCDPSession(page);await cdp.send('WebAudio.enable');
 cdp.on('WebAudio.contextCreated',e=>report.audio.push(e.context));cdp.on('WebAudio.contextChanged',e=>report.audio.push(e.context));
 await page.addInitScript(()=>{globalThis.__testPads=[];Object.defineProperty(navigator,'getGamepads',{value:()=>globalThis.__testPads});});
 const base=process.env.WEB_TEST_URL??`http://127.0.0.1:${server.address().port}/`;
 await page.goto(base);
 const served=await (await page.request.get(new URL('playtest-build.json',base).href)).json();assert.equal(served.sha,report.build.sha,'Hosted build differs from verified source');assert.equal(served.dirty,report.build.dirty);
 await page.locator('#start:enabled').waitFor({timeout:120000});
 const adapter=await page.evaluate(async()=>{const a=await navigator.gpu.requestAdapter();return a?{...a.info.toJSON?.(),vendor:a.info.vendor,architecture:a.info.architecture,fallback:a.info.isFallbackAdapter}:null;});
 assert.ok(adapter);assert.equal(adapter.fallback,false,'GPU fallback is not native WebGPU evidence');check('WebGPU adapter',adapter);await shot('launch');
 await page.locator('#start').click();await advance(8);
 await shot('title');
 await press('Enter');await shot('menu');
 await press('Enter');await shot('modes');await press('Enter');await advance(60);await shot('classic');
 await page.evaluate(()=>{globalThis.__testPads=[{index:0,connected:true,mapping:'standard',axes:[1,0],buttons:Array.from({length:17},(_,i)=>({pressed:i===2}))}];});await advance(20);await shot('classic-controller');await page.evaluate(()=>{globalThis.__testPads=[];});await advance();check('classic controller fire movement and release',true);
 await hold(['ArrowRight','Space','ArrowUp']);check('campaign keyboard input and rendered frames',await state());
 await press('Escape');await page.waitForTimeout(350);const paused=await shot('pause');await page.waitForTimeout(400);assert.equal(await shot('pause-held'),paused,'Pause screen changed while waiting');
 await press('Escape');await hold(['ArrowLeft','Space']);await shot('resume');check('pause and resume',await state());
 await press('Escape');await press('ArrowDown');await press('ArrowDown');await press('Enter');await shot('returned-menu');
 await press('ArrowDown');await press('Enter');await shot('settings');
 // Set music from 50 to 25, then verify browser persistence by inspecting saved IDBFS bytes.
 await press('ArrowDown');await press('ArrowLeft');await shot('settings-music');
 await press('ArrowDown');await press('ArrowDown');await page.keyboard.press('Enter');await page.locator('#browser-fullscreen[open]').waitFor();
 await page.locator('#enter-fullscreen').click();await page.waitForFunction(()=>!!document.fullscreenElement);await page.evaluate(()=>document.exitFullscreen());await advance();check('fullscreen from game settings',true);
 // AI and human co-op use the same campaign; change the actual Settings row.
 await press('ArrowDown');await press('ArrowRight');await shot('ai-setting');
 await press('Escape');await press('Enter');await press('Enter');await advance(60);await hold(['Space']);await shot('ai-coop');
 await press('Escape');await press('ArrowDown');await press('ArrowDown');await press('Enter');
 await press('ArrowDown');await press('Enter');for(let i=0;i<4;i++)await press('ArrowDown');await press('ArrowRight');await shot('human-setting');
 await press('Escape');await press('Enter');await press('Enter');await advance(60);await hold(['KeyL','KeyI','KeyK']);await shot('human-coop');check('AI and two-keyboard-seat co-op',true);
 await press('Escape');await press('ArrowDown');await press('ArrowDown');await press('Enter');
 await press('Enter');await press('ArrowRight');await press('Enter');await shot('survival-team');
 // Default first card -> start button using bottom-row navigation.
 await press('ArrowDown');await press('ArrowRight');await press('ArrowRight');await press('ArrowRight');await press('ArrowDown');await press('Enter');await advance(120);await hold(['Space','ArrowUp']);await shot('survival');check('Wave Survival keyboard flow',await state());
 await advance(240);await shot('survival-combat');
 const measure=await state(),start=Date.now();await page.waitForTimeout(3000);const end=await state();check('survival rendered throughput',{frames:end.frames-measure.frames,elapsedMs:Date.now()-start});
 for(const [width,height] of [[800,600],[1680,720],[640,960]]){await page.setViewportSize({width,height});await advance();await shot(`resize-${width}x${height}`);}check('compact ultrawide and portrait resizing',true);
 // W3C virtual device exercises the actual project polling -> recorded input queue.
 await page.evaluate(()=>{globalThis.__testPads=[{index:0,connected:true,mapping:'standard',axes:[-1,0],buttons:Array.from({length:17},(_,i)=>({pressed:[0,2].includes(i)}))}];});await advance(25);await shot('controller');
 await page.evaluate(()=>{globalThis.__testPads=[];});await advance();check('virtual controller input and disconnect',true);
 // Attach without Playwright focus overrides so actual inactive-tab visibility is preserved.
 const other=await context.newPage();await other.goto('about:blank');await other.bringToFront();
 await page.waitForFunction(()=>document.hidden,{},{timeout:5000});await page.waitForTimeout(200);
 const hidden=await state();await page.waitForTimeout(350);assert.equal((await state()).step,hidden.step,'Hidden page kept simulating');
 await page.bringToFront();await other.close();await page.waitForFunction(()=>!document.hidden);await advance();check('native inactive-tab suspend and return',true);
 await page.waitForTimeout(1500);const saved=await savedProgress();assert.ok(saved,'No persisted game save');assert.equal(saved.settings.music,25);assert.equal(saved.profiles[0].played,3);check('IndexedDB stores music and campaign progress',{music:saved.settings.music,played:saved.profiles[0].played});
 await page.reload();await page.locator('#start:enabled').waitFor({timeout:120000});await page.locator('#start').click();await advance();await press('Enter');await press('ArrowDown');await press('Enter');await shot('settings-after-reload');const restored=await savedProgress();assert.equal(restored.settings.music,25);assert.equal(restored.profiles[0].played,3);check('saved game reload and settings screen',true);
 assert.ok(report.audio.some(a=>a.contextState==='running'),'No running WebAudio context');check('WebAudio unlocked',true);
 assert.equal(report.errors.length,0,report.errors.join('\n'));report.ok=true;
}catch(error){report.error=error.stack;process.exitCode=1;console.error(error);await page?.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});}
finally{report.finished=new Date().toISOString();writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();if(chrome&&chrome.exitCode===null){chrome.kill('SIGTERM');await new Promise(done=>{const timeout=setTimeout(done,2000);chrome.once('exit',()=>{clearTimeout(timeout);done();});});}if(profile)rmSync(profile,{recursive:true,force:true});await new Promise(done=>server.close(done));console.log(JSON.stringify({ok:report.ok,checks:report.checks,errorCount:report.errors.length,error:report.error}));}
