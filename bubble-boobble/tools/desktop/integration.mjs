// Own-window Cocoa keys drive actual game inputs; the game's public net client
// reports a read-only UI projection alongside native preferences.
import {spawn} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
mkdirSync('artifacts',{recursive:true});
const launcher=spawn(process.execPath,['tools/desktop/launch.mjs','--run-sec','90'],{stdio:['ignore','pipe','pipe']});
let log='',token,proof={};launcher.stdout.on('data',d=>log+=d);launcher.stderr.on('data',d=>log+=d);
const endpoint='http://127.0.0.1:47681';
async function request(path,body){const r=await fetch(endpoint+path,{method:body?'POST':'GET',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw new Error(`${path}: HTTP ${r.status}`);return r.json();}
async function until(read,predicate,label,timeout=10000){let v;const end=Date.now()+timeout;while(Date.now()<end){try{v=await read();if(predicate(v))return v;}catch{}await delay(50);}throw new Error(`${label}: ${JSON.stringify(v)}`);}
const native=()=>request('/status'),game=()=>request('/game');
async function key(key){await request('/input',{key});await delay(600);}
async function screen(name,timeout=10000){return until(game,v=>v.observation?.screen===name,`screen ${name}`,timeout);}
async function transition(keyName,target){for(let i=0;i<3;i++){await key(keyName);try{return await screen(target,1200);}catch{}}return screen(target);}
async function select(index){for(let i=0;i<32;i++){const v=await game();(proof.inputTrace??=[]).push({target:index,...v.observation});if(v.observation.selected===index)return;await key('down');try{await until(game,next=>next.observation.selected!==v.observation.selected,'selection change',1000);}catch{}}throw new Error('Selection failed');}
async function move(keyName,count){for(let i=0;i<count;i++)await key(keyName);}
try{
 const health=await until(async()=>(await fetch(endpoint+'/health')).json(),v=>!!v.pid,'launcher health');token=health.token;
 await until(native,v=>v.windowReady,'own window');
 proof.security={unauthorized:(await fetch(endpoint+'/status')).status,origin:(await fetch(endpoint+'/health',{headers:{origin:'https://example.invalid'}})).status,arbitraryTrack:(await fetch(endpoint+'/state',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({fullscreen:false,muted:false,paused:false,track:'../../etc/passwd',volume:1})})).status};
 console.log('Own game window ready; waiting for ordinary foreground activation if macOS declined it.');
 await until(native,v=>v.focused,'initial own-window focus',60000);
 proof.initial=await until(game,v=>!!v.observation,'game bridge');
 proof.initialNative=await until(native,v=>v.revision>0,'applied initial preferences');
 if(proof.initial.observation.screen==='title')await transition('confirm','menu');await screen('menu');
 if(!process.argv.includes('--focus-only')){await select(4);for(let i=0;i<3&&(await game()).observation.screen!=='settings';i++)await key('confirm');await screen('settings');
 await select(3);await key('confirm');
 proof.fullscreen=await until(native,v=>v.fullscreen===!proof.initial.desired.fullscreen,'fullscreen UI preference');
 await select(1);await key('confirm');
 const changedVolume=((proof.initial.desired.volume*100+25)%125)/100;
 proof.volume=await until(native,v=>Math.abs(v.volume-changedVolume)<1e-6,'music UI preference');
 await move('confirm',4); // Five volume positions; restore the original value.
 await select(3);await key('confirm');
 await until(native,v=>v.fullscreen===proof.initial.desired.fullscreen&&Math.abs(v.volume-proof.initial.desired.volume)<1e-6,'restored preferences');
 await select(4);await key('confirm');await screen('menu');
 }await transition('confirm','play');await until(native,v=>v.track==='bubble-1'&&v.playing,'game-selected theme');
 await key('pause');await screen('pause');
 proof.paused=await until(native,v=>!v.playing,'paused music');await delay(700);proof.stillPaused=await native();
 await key('confirm');await screen('play');
 proof.resumed=await until(native,v=>v.playing&&v.position>proof.paused.position,'resumed music position');proof.final=await game();
 await key('background');await until(native,v=>!v.focused,'own window focus lost');await screen('pause');
 proof.focusPaused=await until(native,v=>!v.playing,'focus-loss music pause');await delay(700);proof.focusStillPaused=await native();
 await key('foreground');await until(native,v=>v.focused,'own window focus restored');await key('confirm');await screen('play');
 proof.focusResumed=await until(native,v=>v.playing&&v.position>proof.focusPaused.position,'focus resume');
 proof.musicDecodeWarning=log.includes('not a decodable file');
 proof.pass=!proof.musicDecodeWarning&&proof.focusPaused.position===proof.focusStillPaused.position&&proof.focusResumed.position>proof.focusPaused.position&&proof.security.unauthorized===403&&proof.security.origin===403&&proof.security.arbitraryTrack===400&&proof.initialNative.pid===health.pid&&(!proof.fullscreen||!proof.fullscreen.fullscreen||(proof.fullscreen.windowWidth===proof.fullscreen.screenWidth&&proof.fullscreen.windowHeight===proof.fullscreen.screenHeight))&&proof.paused.position===proof.stillPaused.position&&proof.resumed.position>proof.paused.position&&JSON.stringify(proof.final.desired)===JSON.stringify({...proof.initial.desired,track:'bubble-1'});
 if(!proof.pass)throw new Error('Actual game/native integration assertions failed');console.log(JSON.stringify(proof,null,2));
}catch(error){proof.pass=false;proof.error=String(error);try{proof.errorNative=await native();}catch{}console.error(proof.error);process.exitCode=1;}
finally{
 try{if(proof.initial&&(await game()).observation.screen==='settings'){await select(1);for(let i=0;i<5&&(await game()).desired.volume!==proof.initial.desired.volume;i++)await key('confirm');await select(3);if((await game()).desired.fullscreen!==proof.initial.desired.fullscreen)await key('confirm');}}catch(error){proof.restoreError=String(error);process.exitCode=1;}
 launcher.kill('SIGTERM');await delay(250);writeFileSync('artifacts/desktop-platform-integration.json',JSON.stringify(proof,null,2)+'\n');writeFileSync('artifacts/desktop-platform-integration.log',log);}
