import { worldTest, expect } from '@gameengine/test';
import campaign from '../data/levels.json';
import { OnlineWorldSnapshot } from '../src/schema.gen';
import { applyWorldEvents, createWorldState } from '../src/online/world-rules';
import { isPublicWorld, projectWorld, publicBytes } from '../src/online/world-public';
import { clientWorldView } from '../src/online/world-system';
import { session } from '../src/arcade/session';
import { worldClientPayload } from '../src/online/world-client-payload';

// Measures the actual recorded-input decoder, public validator, hydration and document
// writer in each engine VM. It intentionally excludes gameplay, GPU and browser scheduling.
for(const roomCount of [1,2,4])worldTest(`online client snapshot performance ${roomCount} rooms 600 frames`,async({input,step})=>{
 let state=createWorldState();
 for(let owner=0;owner<roomCount;owner++)state=applyWorldEvents(state,[{kind:'join',player:owner,name:'PERF'},{kind:'input',player:owner,data:{action:'create'}}],campaign);
 for(const room of state.rooms){
  room.game.Bubbles=Array.from({length:96},(_,index)=>({X:80+index%16*32,Y:120+Math.floor(index/16)*48,VX:1,VY:-1,Ground:false,ID:index+1,Dir:1,Age:30,EnemyID:0,CapturedAge:0,Distance:100,MaxDistance:400,Speed:6,Floating:false,Removed:false,Element:''}));
 }
 const document=projectWorld(state),bytes=publicBytes(document);
 expect(bytes).toBeGreaterThan(roomCount*12000);expect(isPublicWorld(document)).toBe(true);
 for(let frame=0;frame<600;frame+=3){
  document.tick=frame+3;
  for(const room of document.rooms){
   room.game!.data.Tick=frame+3;
   const table=room.game!.actors.Bubbles,x=table.fields.indexOf('X'),age=table.fields.indexOf('Age');
   for(let index=0;index<table.rows.length;index++){table.rows[index]![x]=80+index%16*32+frame%24;table.rows[index]![age]=frame+30;}
  }
  // Matches the actual presentation validator and encoded input payload; the SDK's
  // WebSocket JSON parser is outside this test's deterministic VM input boundary.
  expect(isPublicWorld(document)).toBe(true);
  input.emit(OnlineWorldSnapshot,{$data:JSON.stringify({player:0,document:worldClientPayload(document,0,'room-1',true),playing:true})});
  await step(3);
 }
 expect(clientWorldView.get().tick).toBe(600);expect(session.get().active).toBe(true);expect(session.get().game!.Bubbles.length).toBe(96);expect(session.get().game!.Tick).toBe(600);
},{scene:'scenes/arcade.scene.json'});
