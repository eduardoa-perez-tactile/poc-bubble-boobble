// Own-window Cocoa keys drive actual game inputs; the game's public net client
// reports a read-only UI projection alongside native preferences.
import {spawn} from 'node:child_process';
import {writeFileSync,mkdirSync,readFileSync,existsSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
mkdirSync('artifacts',{recursive:true});
const savePath='.gameengine/userdata/saves/meta-bubblebobble-desktop/default.json';
const savedPreferences=existsSync(savePath)?JSON.parse(readFileSync(savePath,'utf8')).data?.state?.settings:undefined;
const restoreFullscreen=process.argv.find(v=>v.startsWith('--restore-fullscreen='))?.split('=')[1];
if(restoreFullscreen!==undefined&&!['true','false'].includes(restoreFullscreen))throw new Error('Expected --restore-fullscreen=true or false');
const launcher=spawn(process.execPath,['tools/desktop/launch.mjs','--run-sec','180'],{stdio:['ignore','pipe','pipe']});
let log='',token,proof={savedPreferencesBefore:savedPreferences};launcher.stdout.on('data',d=>log+=d);launcher.stderr.on('data',d=>log+=d);
const endpoint='http://127.0.0.1:47681';
async function request(path,body){const r=await fetch(endpoint+path,{method:body?'POST':'GET',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw new Error(`${path}: HTTP ${r.status}`);return r.json();}
async function until(read,predicate,label,timeout=10000){let v;const end=Date.now()+timeout;while(Date.now()<end){try{v=await read();if(predicate(v))return v;}catch{}await delay(50);}throw new Error(`${label}: ${JSON.stringify(v)}`);}
const native=()=>request('/status'),game=()=>request('/game');
async function ensureFocused(){
 if(!(await native()).focused){await request('/input',{key:'foreground'});await until(native,v=>v.focused,'own-window focus before input',60000);}
}
async function key(key){if(key!=='foreground')await ensureFocused();await request('/input',{key});await delay(600);}
async function musicStep(){
 const previous=(await game()).desired.volume;await key('confirm');
 return until(game,v=>v.desired.volume!==previous,'observed music setting change');
}
async function restorePreferences(){
 await select(1);
 for(let i=0;i<5&&(await game()).desired.volume!==proof.restorationTarget.volume;i++)await musicStep();
 if((await game()).desired.fullscreen!==proof.restorationTarget.fullscreen){await select(3);await key('confirm');}
 const restored=await until(game,v=>v.desired.volume===proof.restorationTarget.volume&&v.desired.fullscreen===proof.restorationTarget.fullscreen,'restored game preferences');
 const restoredNative=await until(native,v=>v.fullscreen===proof.restorationTarget.fullscreen&&Math.abs(v.volume-proof.restorationTarget.volume)<1e-6,'restored native preferences');
 proof.restoredPreferences={desired:restored.desired,fullscreen:restoredNative.fullscreen,volume:restoredNative.volume};
}
async function screen(name,timeout=10000){return until(game,v=>v.observation?.screen===name,`screen ${name}`,timeout);}
async function transition(keyName,target){for(let i=0;i<3;i++){await key(keyName);try{return await screen(target,1200);}catch{}}return screen(target);}
async function select(index){await ensureFocused();for(let i=0;i<32;i++){const v=await game();(proof.inputTrace??=[]).push({target:index,...v.observation});if(v.observation.selected===index)return;await key('down');try{await until(game,next=>next.observation.selected!==v.observation.selected,'selection change',1000);}catch{}}throw new Error('Selection failed');}
try{
 const health=await until(async()=>(await fetch(endpoint+'/health')).json(),v=>!!v.pid,'launcher health');token=health.token;
 await until(native,v=>v.windowReady,'own window');
 proof.security={unauthorized:(await fetch(endpoint+'/status')).status,origin:(await fetch(endpoint+'/health',{headers:{origin:'https://example.invalid'}})).status,arbitraryTrack:(await fetch(endpoint+'/state',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({fullscreen:false,muted:false,paused:false,track:'../../etc/passwd',volume:1})})).status};
 console.log('Own game window ready; waiting for ordinary foreground activation if macOS declined it.');
 await until(native,v=>v.focused,'initial own-window focus',60000);
 if(savedPreferences)await until(game,v=>v.desired?.fullscreen===savedPreferences.fullscreen&&v.desired?.volume===savedPreferences.music/100,'loaded saved preferences');
 proof.initial=await until(game,v=>!!v.observation,'game bridge');
 proof.restorationTarget={...proof.initial.desired,...(restoreFullscreen!==undefined?{fullscreen:restoreFullscreen==='true'}:{})};
 proof.initialNative=await until(native,v=>v.revision>0,'applied initial preferences');
 if(proof.initial.observation.screen==='title')await transition('confirm','menu');await screen('menu');
 if(!process.argv.includes('--focus-only')){await select(4);for(let i=0;i<3&&(await game()).observation.screen!=='settings';i++)await key('confirm');await screen('settings');
 await select(3);
 const beforeFullscreen=(await game()).desired.fullscreen;await key('confirm');
 await until(game,v=>v.desired.fullscreen!==beforeFullscreen,'observed fullscreen setting change');
 proof.fullscreen=await until(native,v=>v.fullscreen===!beforeFullscreen,'fullscreen UI preference');
 await select(1);await musicStep();
 const changedVolume=((proof.restorationTarget.volume*100+25)%125)/100;
 proof.volume=await until(native,v=>Math.abs(v.volume-changedVolume)<1e-6,'music UI preference');
 await restorePreferences();
 await select(4);await key('confirm');await screen('menu');
 }await transition('confirm','play');await until(native,v=>v.track==='bubble-1'&&v.playing,'game-selected theme');
 await key('pause');await screen('pause');
 proof.paused=await until(native,v=>!v.playing&&v.pauseAcknowledged,'paused music');await delay(700);proof.stillPaused=await native();
 await key('confirm');await screen('play');
 proof.resumed=await until(native,v=>v.playing&&v.position>proof.paused.position,'resumed music position');proof.final=await game();
 await key('background');await until(native,v=>!v.focused,'own window focus lost');await screen('pause');
 proof.focusPaused=await until(native,v=>!v.playing&&v.pauseAcknowledged,'focus-loss music pause');await delay(700);proof.focusStillPaused=await native();
 await key('foreground');await until(native,v=>v.focused,'own window focus restored');await key('confirm');await screen('play');
 proof.focusResumed=await until(native,v=>v.playing&&v.position>proof.focusPaused.position,'focus resume');
 proof.musicDecodeWarning=log.includes('not a decodable file');
 proof.pass=!proof.musicDecodeWarning&&proof.focusPaused.position===proof.focusStillPaused.position&&proof.focusResumed.position>proof.focusPaused.position&&proof.security.unauthorized===403&&proof.security.origin===403&&proof.security.arbitraryTrack===400&&proof.initialNative.pid===health.pid&&(!proof.fullscreen||!proof.fullscreen.fullscreen||(proof.fullscreen.windowWidth===proof.fullscreen.screenWidth&&proof.fullscreen.windowHeight===proof.fullscreen.screenHeight))&&proof.paused.position===proof.stillPaused.position&&proof.resumed.position>proof.paused.position&&JSON.stringify(proof.final.desired)===JSON.stringify({...proof.restorationTarget,track:'bubble-1'});
 if(!proof.pass)throw new Error('Actual game/native integration assertions failed');console.log(JSON.stringify(proof,null,2));
}catch(error){proof.pass=false;proof.error=String(error);try{proof.errorNative=await native();}catch{}console.error(proof.error);process.exitCode=1;}
finally{
 try{
  if(proof.initial){
   if((await game()).observation.screen==='settings')await restorePreferences();
   const final=await game();const finalNative=await native();
   proof.preferencesRestored=final.desired.volume===proof.restorationTarget.volume&&final.desired.fullscreen===proof.restorationTarget.fullscreen&&finalNative.fullscreen===proof.restorationTarget.fullscreen&&Math.abs(finalNative.volume-proof.restorationTarget.volume)<1e-6;
   if(!proof.preferencesRestored)throw new Error('Original music/fullscreen preferences were not restored');
   proof.persistedPreferencesAfter=await until(async()=>JSON.parse(readFileSync(savePath,'utf8')).data.state.settings,v=>v.music===proof.restorationTarget.volume*100&&v.fullscreen===proof.restorationTarget.fullscreen&&(!savedPreferences||v.sound===savedPreferences.sound),'persisted preference restoration');
  }
 }catch(error){proof.pass=false;proof.restoreError=String(error);process.exitCode=1;}
 let own;try{own=await native();}catch{}
 launcher.kill('SIGTERM');
 const exitDeadline=Date.now()+5000;
 const running=pid=>{if(!pid)return false;try{process.kill(pid,0);return true;}catch{return false;}};
 while(Date.now()<exitDeadline&&(running(own?.pid)||running(own?.music?.helperPID)||launcher.exitCode===null))await delay(50);
 proof.launcherExited=launcher.exitCode!==null;
 proof.processesCleaned=proof.launcherExited&&!running(own?.pid)&&!running(own?.music?.helperPID);
 try{await fetch(endpoint+'/health');proof.endpointClosed=false;}catch{proof.endpointClosed=true;}
 if(!proof.processesCleaned||!proof.endpointClosed){proof.pass=false;process.exitCode=1;}
 writeFileSync('artifacts/desktop-platform-integration.json',JSON.stringify(proof,null,2)+'\n');writeFileSync('artifacts/desktop-platform-integration.log',log);console.log(JSON.stringify({pass:proof.pass,preferencesRestored:proof.preferencesRestored,processesCleaned:proof.processesCleaned,endpointClosed:proof.endpointClosed}));}
