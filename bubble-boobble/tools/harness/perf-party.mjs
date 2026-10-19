import {spawnSync} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
process.chdir(resolve(fileURLToPath(new URL('../..',import.meta.url))));
function cli(args){const r=spawnSync('gameengine',[...args,'--json'],{encoding:'utf8',maxBuffer:16*1024*1024});if(r.status!==0)throw Error(r.stdout+r.stderr);return JSON.parse(r.stdout);}
function call(name,params={}){return cli(['call',name,...Object.entries(params).flatMap(([k,v])=>['--'+k,JSON.stringify(v)])]);}
const rows=[];
for(const team of [6,10]){
 const session=cli(['run','--headless','--paused','--tier','mobile','--scene','scenes/arcade.scene.json']);
 try{
  call('engine.step',{n:3,frames:true});
  call('render.probe',{width:768,height:720,points:[[0,0]]});
  call('perf.start');
  cli(['cheat','run','party.reset',`team=${team}`,'wave=10','humans=1','countdown=1']);
  call('engine.step',{n:2,frames:true});
  const startup=call('perf.stats',{stop:true});
  cli(['cheat','run','party.protect-team']);
  call('engine.step',{n:60,frames:true});
  call('input.push',{events:[{type:'gamepadButton',pad:0,button:2,down:true}]});
  call('render.probe',{width:768,height:720,points:[[0,0]]});
  call('perf.start');
  let peakDraws=0;
  for(let i=0;i<10;i++){
   call('engine.step',{n:60,frames:true});
   call('render.probe',{width:768,height:720,points:[[0,0]]});
   peakDraws=Math.max(peakDraws,call('render.stats').drawCalls);
  }
  const perf=call('perf.stats',{stop:true});
  const render=call('render.stats');
  const markers=call('profile.markers');
  const observed=call('script.eval',{code:'(()=>{const g=JSON.parse(__gameengine_host("doc.get",JSON.stringify({name:"arcade.session"}))).game;return {players:g.Players.length,alive:g.Players.filter(p=>p.Lives>0&&!p.Downed).length,bots:g.Companions.filter(Boolean).length,bubbles:g.Bubbles.length,enemies:g.Enemies.length,tick:g.Tick,phase:g.Party.Phase,bossHP:g.Party.Boss?.HP}})()'}).value;
  if(observed.players!==team||observed.alive!==team||observed.phase!=='boss')throw Error('Boss stress scenario did not remain active');
  if(peakDraws>14)throw Error('Party render exceeded 14 draws');
  rows.push({team,observed,startup,perf,render,markers,peakDraws});
  console.log(JSON.stringify({team,observed,startupStepMax:startup.stepTimeMs.max,stepP95:perf.stepTimeMs.p95,presentationP95:perf.presentationTimeMs.p95,memoryMB:perf.memoryMB,gcMaxMs:perf.gcMaxMs,peakDraws}));
 }finally{try{process.kill(session.pid);}catch{}}
}
mkdirSync('artifacts',{recursive:true});
writeFileSync('artifacts/ten-dragon-performance.json',JSON.stringify({rows,limits:'Release V8/Metal host; mobile rendering tier; one firing human, remaining slots bots, protected boss team, seed 42, 600 measured steps after 60-step warmup. Ten explicit render probes per team. CPU and structural comparison only; no real device GPU or thermal verdict.'},null,2)+'\n');
