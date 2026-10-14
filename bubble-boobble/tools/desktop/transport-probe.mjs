// Actual application/native transport proof. Fixed presentation-state requests
// are deliberately separate from the input-driven GUI probe (requires unlock).
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {createHash} from 'node:crypto';
import {probeBridge} from './bridge-probe.mjs';
mkdirSync('artifacts',{recursive:true});
const endpoint='http://127.0.0.1:47681';
const report={scope:'Actual game app + native PCM transport; controlled presentation inputs, no GUI input proof',pass:false};
let active,token='',launchId='',log='',hostPID=0,helperPID=0;
function alive(pid){if(!pid)return false;try{process.kill(pid,0);return true;}catch{return false;}}
async function until(read,predicate,label,timeout=15000){let v;const end=Date.now()+timeout;while(Date.now()<end){try{v=await read();if(predicate(v))return v;}catch{}await delay(25);}throw new Error(`${label}: ${JSON.stringify(v)}`);}
async function request(path,body){const r=await fetch(endpoint+path,{method:body?'POST':'GET',headers:{authorization:`Bearer ${token}`,'content-type':'application/json',...(body?{'x-bubble-desktop-probe':launchId}:{})},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw new Error(`${path}: HTTP ${r.status}`);return r.json();}
async function state(overrides){const result=await request('/state',{fullscreen:false,track:'bubble-2',volume:.25,paused:false,muted:false,...overrides});return until(status,v=>v.revision>=result.revision,'native state acknowledgement');}
const status=()=>request('/status');
async function start(runSeconds=60){
 active=spawn(process.execPath,['tools/desktop/launch.mjs','--transport-probe','--run-sec',String(runSeconds)],{stdio:['ignore','pipe','pipe']});
 active.stdout.on('data',d=>log+=d);active.stderr.on('data',d=>log+=d);
 const health=await until(async()=>(await fetch(endpoint+'/health')).json(),v=>!!v.pid,'own app health',25000);
 token=health.token;launchId=health.launchId;hostPID=health.pid;
 if(health.controlledPresentation!==true)throw new Error("Expected explicit controlled native transport session");
 const s=await until(status,v=>v.windowReady&&v.pid===hostPID&&v.transport==='stateful-ym','own stateful app');
 if(!s.executablePath.endsWith('/BubbleBoobble.app/Contents/MacOS/BubbleBoobble-runtime'))throw new Error('Unexpected native executable identity');
 return {health,native:s};
}
function prefix(s,track){
 if(!s.pauseAcknowledged)throw new Error('PCM prefix requires acknowledged pause');
 const root=resolve('.cache/desktop/BubbleBoobble.app/Contents'),frames=s.music.consumedFrames;
 const r=spawnSync(resolve(root,'MacOS/BubbleBoobble-YM'),['--track',resolve(root,`Resources/music/${track}.ym`),'--loop=true','--frames',String(frames)],{maxBuffer:64*1024*1024});
 if(r.status!==0||r.stdout.length!==frames*4)throw new Error('Finite pinned helper prefix failed');
 let hash=14695981039346656037n;for(const b of r.stdout)hash=BigInt.asUintN(64,(hash^BigInt(b))*1099511628211n);
 const matches=hash.toString(16).padStart(16,'0')===s.music.pcmHash;
 if(!matches)throw new Error('Actual app consumed PCM differs from pinned source prefix');
 return {frames,fnv1a64:hash.toString(16).padStart(16,'0'),sha256:createHash('sha256').update(r.stdout).digest('hex'),matches};
}
async function stopNormally(){
 active.kill('SIGTERM');await until(async()=>alive(hostPID),v=>!v,'native host shutdown',5000);
 await until(async()=>alive(helperPID),v=>!v,'native helper shutdown',5000);
 await until(async()=>{try{await fetch(endpoint+'/health');return true;}catch{return false;}},v=>!v,'loopback closed',5000);
 active=null;
}
try{
 report.initial=await start();
 report.bridgeScope=await probeBridge(resolve(`.cache/desktop/session-${active.pid}/game.js`),report.initial.health.launchId);
 // Empty track clears any initial menu source before testing saved-control startup.
 await state({track:'',paused:true});await until(status,v=>!v.music?.running,'source cleared');
 await state({paused:true,muted:true});await delay(250);
 report.mutedStartup=await status();
 if(report.mutedStartup.music?.consumedFrames>0||report.mutedStartup.music?.helperPID)throw new Error('Muted startup created/consumed a source');
 await state({paused:true});
 report.pausedStartup=await until(status,v=>v.track==='bubble-2'&&v.pauseAcknowledged&&v.music.consumedFrames===0,'paused configured startup');
 helperPID=report.pausedStartup.music.helperPID;await delay(250);report.stillStartup=await status();
 if(report.stillStartup.music.consumedFrames!==0||report.stillStartup.music.volume!==.25)throw new Error('Configured paused startup advanced or lost volume');
 await state({});const playing=await until(status,v=>v.playing,'native playback');
 report.pastLoop=await until(status,v=>v.music?.consumedFrames>=600000&&v.adapterActive,'continuous menu source across loop',20000);
 if(report.pastLoop.revision!==playing.revision)throw new Error('UI wrote over controlled presentation state; proof requires isolated control');
 if(report.pastLoop.launcherHeartbeatUnixMs<=playing.launcherHeartbeatUnixMs+5000)throw new Error('Launcher liveness did not continue independently of UI writes');
 await state({paused:true});report.paused=await until(status,v=>v.pauseAcknowledged,'acknowledged loop pause');
 report.pausedPrefix=prefix(report.paused,'bubble-2');await delay(700);report.stillPaused=await status();
 if(report.paused.music.consumedFrames!==report.stillPaused.music.consumedFrames||report.paused.music.pcmHash!==report.stillPaused.music.pcmHash)throw new Error('Paused source cursor changed');
 await state({});await until(status,v=>v.music.consumedFrames>=report.paused.music.consumedFrames+4800,'native resume');
 await state({paused:true});report.resumed=await until(status,v=>v.pauseAcknowledged,'resumed acknowledged pause');report.resumedPrefix=prefix(report.resumed,'bubble-2');
 await state({muted:true,track:'bubble-3'});await delay(250);report.mutedDeferredTrack=await status();
 if(report.mutedDeferredTrack.track!=='bubble-2'||report.mutedDeferredTrack.music.helperPID!==helperPID||report.mutedDeferredTrack.music.consumedFrames!==report.resumed.music.consumedFrames)throw new Error('Mute changed track or source cursor');
 await state({paused:true,track:'bubble-3',volume:.5});
 report.newTrack=await until(status,v=>v.track==='bubble-3'&&v.pauseAcknowledged,'new track configured pause');
 if(report.newTrack.music.consumedFrames!==0||report.newTrack.music.volume!==.5)throw new Error('New track lost initial pause/volume');
 await until(async()=>alive(helperPID),v=>!v,'old track helper exit');helperPID=report.newTrack.music.helperPID;
 await state({track:'bubble-3',volume:.5});await until(status,v=>v.music.consumedFrames>=4800,'new track playback');
 await state({track:'bubble-3',paused:true,volume:.5});report.reset=await until(status,v=>v.pauseAcknowledged,'new track prefix pause');report.resetPrefix=prefix(report.reset,'bubble-3');
 for(const s of[report.pastLoop,report.paused,report.resumed,report.reset])if(s.music.underrunFrames!==0||s.music.bufferedFrames>s.music.capacityFrames)throw new Error('Underrun or unbounded PCM queue');
 await stopNormally();report.normalCleanup=true;
 // Kill only this launcher to prove native liveness loss stops its own helper,
 // then explicitly close this same known host PID. No other app is addressed.
 report.leaseInitial=await start();await state({});await until(status,v=>v.playing,'lease test source');
 const leaseStatus=await status();helperPID=leaseStatus.music.helperPID;
 const localStatus=resolve(`.cache/desktop/session-${active.pid}/status.json`);
 active.kill('SIGKILL');active=null;
 report.leaseExpired=await until(async()=>JSON.parse(readFileSync(localStatus,'utf8')),v=>!v.adapterActive&&!v.music?.running,'launcher death stops source',6000);
 await until(async()=>alive(helperPID),v=>!v,'lease helper exit');
 process.kill(hostPID,'SIGTERM');await until(async()=>alive(hostPID),v=>!v,'lease host cleanup');
 report.deadlineInitial=await start(1);
 await until(async()=>alive(hostPID),v=>!v,'finite diagnostic deadline',5000);
 await until(async()=>{try{await fetch(endpoint+'/health');return true;}catch{return false;}},v=>!v,'deadline loopback cleanup');active=null;report.finiteDeadline=true;
 const currentHash=createHash('sha256').update(readFileSync('.gameengine/engine/target/release/gameengine-host')).digest('hex');
 if(currentHash!==report.initial.health.originalRuntimeSha256)throw new Error('Installed runtime changed');
 if(log.includes('not a decodable file'))throw new Error('Unexpected music decoding warning');
 report.pass=true;console.log(JSON.stringify({pass:true,pausedPrefix:report.pausedPrefix,resumedPrefix:report.resumedPrefix,resetPrefix:report.resetPrefix,normalCleanup:true,launcherLeaseStoppedSource:true,finiteDiagnosticDeadline:true},null,2));
}catch(error){report.error=String(error);console.error(report.error);process.exitCode=1;}
finally{
 if(active)active.kill('SIGTERM');
 if(alive(hostPID))try{process.kill(hostPID,'SIGTERM');}catch{}
 await delay(200);
 writeFileSync('artifacts/desktop-ym-app-proof.json',JSON.stringify(report,null,2)+'\n');writeFileSync('artifacts/desktop-ym-app-proof.log',log);
}
