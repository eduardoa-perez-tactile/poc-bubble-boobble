// Public-protocol workaround: headless replay hosts need explicit render requests.
// Pumping probes keeps asset loading and pipeline capture inside the replay route.
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from '../../.gameengine/engine/node_modules/esbuild/lib/main.js';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));process.chdir(root);
const started=Date.now();
const record=!process.argv.includes('--check');
const tiers=record?['desktop','mobile','compat']:['desktop'];
mkdirSync('.cache',{recursive:true});mkdirSync('artifacts',{recursive:true});
await build({stdin:{contents:'export {GameEngineClient} from "./.gameengine/engine/packages/protocol-client/src/index.ts";',resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:'.cache/pipeline-client.mjs',logLevel:'silent'});
const {GameEngineClient}=await import(fileURLToPath(new URL('../../.cache/pipeline-client.mjs',import.meta.url)));
const budget=JSON.parse(readFileSync('tests/budgets/presentation.json','utf8'));
const replay=readFileSync(budget.replay).toString('base64');
const records={},rows=[];
const observationCode='(()=>{const u=JSON.parse(__gameengine_host("doc.get",JSON.stringify({name:"desktop-ui"})));const d=JSON.parse(__gameengine_host("doc.get",JSON.stringify({name:"arcade.session"})));const g=d?.game;return {screen:u?.screen??"loading",round:g?.Level.number,state:g?.State,party:!!g?.Party,bossMode:g?.Party?.Boss?.Mode??"",dead:!!g?.Players.some(p=>p.Dead>0),particles:g?.Particles.length??0,effects:g?.Effects.map(e=>e.Element)??[],bubbles:g?.Bubbles.filter(b=>b.Shooter!==undefined&&!b.Element&&!b.EnemyID&&b.Age>=30&&b.Age<=450).map(b=>({x:b.X,y:b.Y,shooter:b.Shooter}))??[]}})()';
function cli(args){const r=spawnSync('gameengine',[...args,'--json'],{encoding:'utf8',maxBuffer:8*1024*1024});if(r.error)throw r.error;if(r.status!==0)throw new Error(r.stdout+r.stderr);return JSON.parse(r.stdout);}
for(const tier of tiers){
 const tierStarted=Date.now();
 const address=cli(['run','--headless','--paused','--ui-layout','--scene','scenes/arcade.scene.json','--tier',tier]);
 let c;
 try{
  c=await GameEngineClient.connect(address,{client:'bubble-pipeline-recorder'});
  await c.call('engine.step',{n:2,frames:true});
  // The second point is inside the dragon body in every settings walk frame.
  // Read actual palette pixels as well as the selected UI label on every tier.
  const probe=()=>c.call('render.probe',{width:768,height:720,points:[[0,0],[374,523]]});
  for(let i=0;i<30;i++){await probe();if((await c.call('assets.status',{})).pending===0)break;if(i===29)throw new Error('Assets remained pending after explicit render requests');}
  const loaded=await c.call('replay.load',{data:replay});
  await c.call('perf.start',{});
  const seen=new Set(),marker=new Set();let peak=0,frames=0,finished=false,replaySteps=0;
  // The initial desktop document is lazy: doc.get is null until navigation.
  // Prove title coverage from its actually rendered, laid-out start label.
  await c.call('engine.step',{n:1,frames:true});
  await probe();frames++;
  const layout=await c.call('ui.layout',{width:768,height:720});
  const titleNodes=layout.nodes.filter(n=>n.text==='PRESS ENTER TO START'&&n.visible===true&&n.opacity>0&&n.drawn?.w>0&&n.drawn?.h>0);
  if(!titleNodes.length)throw new Error(`${tier} initial title label was not laid out`);
  seen.add('title');
  peak=(await c.call('render.stats',{})).drawCalls;
  let cursor=1;
  const deadline=Date.now()+60000;
  while(Date.now()<deadline){
   const advance=Math.min(3,loaded.steps-cursor);
   if(advance>0){await c.call('engine.step',{n:advance,frames:true});cursor+=advance;}
   const pixels=await probe();frames++;
   const [s,observation,status]=await Promise.all([c.call('render.stats',{}),c.call('script.eval',{code:observationCode}),c.call('replay.status',{})]);
   peak=Math.max(peak,s.drawCalls);
   const o=observation.value;
   if(o){seen.add(o.screen);if(o.party)marker.add('party');if(o.party&&o.bossMode==='captured')marker.add('bossCapture');if(o.party&&o.state===4)marker.add('partyVictory');if(o.round===24)marker.add('round24');if(o.state===0&&o.screen==='play')marker.add('ready');if(o.dead)marker.add('death');if(o.particles>0)marker.add('particles');for(const e of o.effects)marker.add(e);}
   if(o?.screen==='settings'){
    const settingsLayout=await c.call('ui.layout',{width:768,height:720});
    for(const [skin,rgb] of [['red',[255,0,0]],['yellow',[255,220,0]]]){
     const selected=settingsLayout.nodes.some(n=>n.text===`DRAGON: ${skin.toUpperCase()}`&&n.visible===true&&n.opacity>0&&n.drawn?.w>0&&n.drawn?.h>0);
     if(selected){
      const actual=pixels.points[1]?.rgba?.slice(0,3);
      if(JSON.stringify(actual)!==JSON.stringify(rgb))throw new Error(`${tier} ${skin} preview body pixel: ${JSON.stringify(actual)}`);
      marker.add(`skin:${skin}`);
     }
    }
   }
   // The route ends by shooting once with yellow P1 and blue P2. Read both
   // real bubble centers after their four-frame growth animation has settled.
   if(o?.screen==='play'&&marker.has('skin:yellow')&&o.bubbles?.length&&(!marker.has('bubble:yellow')||!marker.has('bubble:blue'))){
    const swatches=o.bubbles.filter(b=>b.shooter===0||b.shooter===1);
    const colors=await c.call('render.probe',{width:768,height:720,points:swatches.map(b=>[Math.floor(b.x+22),Math.floor(b.y+48+44*9.5/17)])});frames++;
    for(let i=0;i<swatches.length;i++){
     const blue=swatches[i].shooter===1,expected=blue?[0,170,255]:[255,220,0],actual=colors.points[i]?.rgba?.slice(0,3);
     if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error(`${tier} shooter ${swatches[i].shooter} bubble pixel: ${JSON.stringify(actual)}`);
     marker.add(blue?'bubble:blue':'bubble:yellow');
    }
   }
   if(status.diverged||status.divergence)throw new Error(`Replay divergence: ${JSON.stringify(status)}`);
   if(status.finished){finished=true;replaySteps=status.steps;break;}
  }
  if(!finished)throw new Error(`${tier} replay did not finish`);
  const required=['title','menu','profiles','scores','settings','help','credits','editor','play','pause','result'];
  const missing=required.filter(p=>!seen.has(p));
  const missingMarkers=['round24','ready','death','particles','fire','water','thunder','skin:red','skin:yellow','bubble:yellow','bubble:blue','party','bossCapture','partyVictory'].filter(p=>!marker.has(p));
  if(missing.length||missingMarkers.length)throw new Error(`${tier} missing rendered coverage: ${[...missing,...missingMarkers].join(', ')}; seen=${[...seen].join(',')} frames=${frames}`);
  if(peak>budget.structural.drawCallsMax)throw new Error(`${tier} peak ${peak} exceeds ${budget.structural.drawCallsMax}`);
  const perf=await c.call('perf.stats',{stop:true});
  const pipeline=await c.call('render.pipelines',{});
  if(pipeline.tier!==tier||!pipeline.pipelines?.length)throw new Error(`No actual ${tier} pipeline records`);
  records[tier]=pipeline.pipelines;
  rows.push({tier,wallMs:Date.now()-tierStarted,frames,replaySteps,initialTitle:titleNodes[0],peakDraws:peak,seen:[...seen],markers:[...marker],perf,pipelines:pipeline.pipelines.length});
  console.log(`${tier}: ${frames} explicit frames, peak ${peak} draws, all required pages/effects observed`);
 }finally{c?.close();try{process.kill(address.pid);}catch{}}
}
if(record)writeFileSync('pipelines.json',JSON.stringify(Object.fromEntries(Object.entries(records).sort()),null,1)+'\n');
const report={record,wallMs:Date.now()-started,rows,scope:'Public replay plus explicit GPU probes; assets warmed before playback, capture begins with a paused rendered title and continues through controlled three-step replay batches, every required page/effect observed. Probe-driven structural/CPU measurements do not establish real-time GPU frame-rate or mobile/compat Go image parity.'};
writeFileSync(`artifacts/pipeline-${record?'recording':'check'}.json`,JSON.stringify(report,null,2)+'\n');
