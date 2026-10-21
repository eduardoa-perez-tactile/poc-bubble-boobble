import {renderTest,worldTest,expect} from '@gameengine/test';
import campaign from '../data/levels.json';
import {ArcadeVisual,OnlineWorldSnapshot} from '../src/schema.gen';
import {advanceWorld,applyWorldEvents,createWorldState} from '../src/online/world-rules';
import {projectWorld} from '../src/online/world-public';
import {worldClientPayload} from '../src/online/world-client-payload';
import {session} from '../src/arcade/session';
import {sceneDraws} from '../src/arcade/presentation';
import {orderedArrays} from '../src/arcade/pixel-renderer/ordered';

// The authoritative fixture runs the real rules in the engine VM. Only encoded public
// snapshots reach the client systems under measurement; no Node-side game simulation.
for(const gpu of [false,true]){
 const define=gpu?renderTest:worldTest;
 define(`online enemy entry ${gpu?'render':'CPU'} transition 240 frames`,async({input,step,world,render})=>{
  input.view(768,720,1);
  let state=applyWorldEvents(createWorldState(),[{kind:'join',player:0,name:'ENTRY PROFILE'},{kind:'input',player:0,data:{action:'create'}}],campaign);
  const rows:Record<string,unknown>[]=[],sampleFrames=new Set([1,2,3,6,9,12,18,24,30,45,60,75,90,120,150,177,180,183,186,210,240]);
  let firstCapacity=0;
  for(let frame=1;frame<=240;frame++){
   state=advanceWorld(state,[],campaign);
   if(frame===1||frame%3===0){const document=projectWorld(state);input.emit(OnlineWorldSnapshot,{$data:JSON.stringify({player:0,document:worldClientPayload(document,0,'room-1',true),playing:true})});}
   const start=Date.now();await step(1);const stepMs=Date.now()-start;
   const g=session.get().game!;
   if(frame===1)firstCapacity=world.count(ArcadeVisual);
   // The descent and combat transition must reuse the warm pool rather than
   // spawning another mesh pool when the enemies arrive on their platforms.
   expect(world.count(ArcadeVisual)).toBe(firstCapacity);
   if(sampleFrames.has(frame)||stepMs>12){
    const stats=gpu?render.stats({width:768,height:720}):null;
    if(stats)expect(stats.drawCalls).toBeLessThanOrEqual(14);
    rows.push({frame,tick:g.Tick,phase:g.Party!.Phase,countdown:g.Party!.Timer,enemies:g.Enemies.length,visuals:world.count(ArcadeVisual),stepWallMs:stepMs,render:stats?{drawCalls:stats.drawCalls,instances:stats.instances,pipelines:stats.pipelinesCreatedThisFrame,textures:stats.texturesUploaded}:null});
   }
  }
  console.log('ENEMY_ENTRY_PROFILE '+JSON.stringify(rows));
  expect(session.get().game!.Party!.Phase).toBe('combat');expect(session.get().game!.Tick).toBe(240);
 },{scene:'scenes/arcade.scene.json'});
}

worldTest('online enemy entry presentation production path phases',async({input,step})=>{
 input.view(768,720,1);
 let state=applyWorldEvents(createWorldState(),[{kind:'join',player:0,name:'ENTRY PROFILE'},{kind:'input',player:0,data:{action:'create'}}],campaign);
 const rows:Record<string,unknown>[]=[];
 for(let tick=1;tick<=240;tick++){
  state=advanceWorld(state,[],campaign);
  if(![1,15,30,45,60,75,90,120,150,177,180,183,210,240].includes(tick))continue;
  const document=projectWorld(state);input.emit(OnlineWorldSnapshot,{$data:JSON.stringify({player:0,document:worldClientPayload(document,0,'room-1',true),playing:true})});await step(1);
  const g=session.get().game!,view={width:768,height:720,safeArea:[0,0,0,0]};
  let vertices=0,images=0,texts=0;
  const start=Date.now();
  for(let repeat=0;repeat<30;repeat++){
   const plan=sceneDraws(g.Tick,undefined,view,g),geometry=orderedArrays(plan.images,1,0,0,plan.clip);
   vertices=geometry.vertices;images=plan.images.length;texts=plan.texts.length;
  }
  rows.push({tick,phase:g.Party!.Phase,millisecondsPerPlan:(Date.now()-start)/30,vertices,images,texts});
 }
 console.log('ENEMY_ENTRY_PRESENTATION '+JSON.stringify(rows));
 expect(rows.length).toBe(14);
},{scene:'scenes/arcade.scene.json'});
