// Bounded release-host CPU/structure probe on an existing paused arcade session.
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
process.chdir(resolve(fileURLToPath(new URL('../..',import.meta.url))));
function engine(args){const r=spawnSync('gameengine',[...args,'--json'],{encoding:'utf8',maxBuffer:8*1024*1024});if(r.error)throw r.error;if(r.status!==0)throw new Error(r.stdout+r.stderr);return JSON.parse(r.stdout);}
function call(method,params={}){return engine(['call',method,...Object.entries(params).flatMap(([k,v])=>['--'+k,JSON.stringify(v)])]);}
engine(['cheat','run','arcade.reset','round=25','seed=42','players=2','ready=false']);
call('engine.step',{n:1,frames:true});
const events=[];
for(let t=0;t<600;t++)for(let player=0;player<2;player++)events.push({type:'event',name:'ArcadeInput',delaySteps:t,data:JSON.stringify({player,move:(Math.floor(t/120)+player)%2?-1:1,jump:t%47<20,fire:true,paused:false})});
for(let i=0;i<events.length;i+=200)call('input.push',{events:events.slice(i,i+200)});
call('perf.start');call('engine.step',{n:600,frames:true});
const perf=call('perf.stats',{stop:true});
mkdirSync('artifacts',{recursive:true});engine(['screenshot',resolve('artifacts/perf-combat.png')]);
const render=call('render.stats');
if(!render.drawCalls||!render.instances)throw new Error('Requested combat render is empty.');
const observed=call('script.eval',{code:'(()=>{const d=JSON.parse(__gameengine_host("doc.get",JSON.stringify({name:"arcade.session"})));const g=d.game;return {tick:g.Tick,state:g.State,score:g.Score,bubbles:g.Bubbles.length,players:g.Players.map(p=>({x:p.X,lives:p.Lives}))}})()'}).value;
if(observed.tick!==600||observed.players.length!==2||!observed.bubbles)throw new Error('Combat scenario did not execute.');
const report={scenario:{round:25,players:2,seed:42,ticks:600,events:1200},observed,perf,render,limits:'Paused protocol capture: stepTimeMs measures simulation; presentationTimeMs is only sampled presentation frames; render.stats is the requested final render. Whole-frame timing does not establish real-time GPU performance.'};
mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/perf-combat.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({observed,stepTimeMs:perf.stepTimeMs,presentationTimeMs:perf.presentationTimeMs,memoryMB:perf.memoryMB,gcMaxMs:perf.gcMaxMs,drawCalls:render.drawCalls,instances:render.instances,limits:report.limits},null,2));
