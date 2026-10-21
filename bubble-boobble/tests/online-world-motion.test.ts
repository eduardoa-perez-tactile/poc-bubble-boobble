import { worldTest, expect } from '@gameengine/test';
import campaign from '../data/levels.json';
import { createOnlineWaveGame } from '../src/online/rules';
import { captureWorldMotion, emptyWorldMotion, sampleWorldMotion, WORLD_MOTION_STEPS } from '../src/online/world-motion';
import { State, type GameState } from '../src/arcade/types';
function game(tick=0,x=tick):GameState{
 const g=createOnlineWaveGame(campaign,{players:1,mode:'realtime',seed:'42'});g.State=State.Playing;g.Tick=tick;g.Party!.Phase='combat';g.Players[0]!.X=x;g.Players[0]!.Invincible=0;
 g.Bubbles=[{X:x,Y:100,VX:1,VY:0,Ground:false,ID:7,Dir:1,Age:tick+20,EnemyID:0,CapturedAge:0,Distance:30,MaxDistance:400,Speed:6,Floating:false,Removed:false,Element:''}];return g;
}
worldTest('online motion turns twenty snapshots into sixty display positions and stops without extrapolation',()=>{
 let current=game(),motion=captureWorldMotion(null,current,emptyWorldMotion(),'room-1',1,0,0),previous=current;
 const positions:number[]=[];
 for(let frame=1;frame<=60;frame++){
  if(frame%3===0){previous=current;current=game(frame);motion=captureWorldMotion(previous,current,motion,'room-1',1,frame,frame);}
  const display=sampleWorldMotion(current,motion,frame);
  expect(display.Players[0]!.X).toBe(Math.max(0,frame-WORLD_MOTION_STEPS));positions.push(display.Players[0]!.X);
 }
 expect(new Set(positions).size).toBe(58);expect(current.Players[0]!.X).toBe(60);
 expect(sampleWorldMotion(current,motion,61,.5).Players[0]!.X).toBe(58.5);
 expect(sampleWorldMotion(current,motion,63).Players[0]!.X).toBe(60);expect(sampleWorldMotion(current,motion,600)).toBe(current);
});
worldTest('online motion never mutates authoritative state and shares stationary content',()=>{
 const before=game(),next=game(3),motion=captureWorldMotion(before,next,captureWorldMotion(null,before,emptyWorldMotion(),'room-1',1,0,0),'room-1',1,3,3),encoded=JSON.stringify(next);
 const display=sampleWorldMotion(next,motion,4,.5);
 expect(display.Players[0]!.X).toBe(1.5);expect(display.Bubbles[0]!.X).toBe(1.5);expect(display.Level).toBe(next.Level);expect(display.Items).toBe(next.Items);expect(display.Projectiles).toBe(next.Projectiles);expect(display.Particles).toBe(next.Particles);expect(JSON.stringify(next)).toBe(encoded);
});
worldTest('online motion snaps on stream room reset phase end teleport death and respawn',()=>{
 const before=game(),initial=captureWorldMotion(null,before,emptyWorldMotion(),'room-1',1,0,0);
 for(const change of ['room','player','reset','phase','wave','end','teleport','downed','dead','life','respawn'] as const){
  const next=game(3);let room='room-1',player=1,reset=false;
  if(change==='room')room='room-2';if(change==='player')player=2;if(change==='reset')reset=true;if(change==='phase')next.Party!.Phase='rest';if(change==='wave')next.Party!.Wave++;
  if(change==='end')next.State=State.GameOver;if(change==='teleport')next.Players[0]!.X=400;if(change==='downed')next.Players[0]!.Downed=true;if(change==='dead')next.Players[0]!.Dead=20;if(change==='life')next.Players[0]!.Lives--;if(change==='respawn')next.Players[0]!.Invincible=100;
  const motion=captureWorldMotion(before,next,initial,room,player,3,3,reset);expect(sampleWorldMotion(next,motion,3).Players[0]!.X).toBe(next.Players[0]!.X);
 }
});
worldTest('online motion stable actor ids reject reuse removals and newly spawned actors',()=>{
 const before=game(),initial=captureWorldMotion(null,before,emptyWorldMotion(),'room-1',1,0,0);
 const next=game(3);next.Bubbles[0]!.Age=1;next.Bubbles[0]!.X=50;
 next.Bubbles.push({...next.Bubbles[0]!,ID:8,X:60});
 const motion=captureWorldMotion(before,next,initial,'room-1',1,3,3);const display=sampleWorldMotion(next,motion,3);
 expect(display.Bubbles.map(b=>b.X)).toEqual([50,60]);
 next.Bubbles=[];const removed=captureWorldMotion(before,next,initial,'room-1',1,3,3);expect(sampleWorldMotion(next,removed,3).Bubbles).toEqual([]);
});

import { renderTest } from '@gameengine/test';
import { OnlineWorldSnapshot } from '../src/schema.gen';
import { projectWorld } from '../src/online/world-public';
import { applyWorldEvents, createWorldState } from '../src/online/world-rules';
import { session } from '../src/arcade/session';
import { worldMotion } from '../src/online/world-system';
import { sceneDraws } from '../src/arcade/presentation';
renderTest('online motion recorded snapshots drive the real presentation while canonical session stays current',async({input,step,render})=>{
 input.view(768,720,1);await step(3);
 const state=applyWorldEvents(createWorldState(),[{kind:'join',player:0,name:'DRAGON'},{kind:'input',player:0,data:{action:'create'}}],campaign),source=state.rooms[0]!.game;
 source.State=State.Playing;source.Party!.Phase='combat';source.Players[0]!.Invincible=0;source.Players[0]!.X=100;source.Tick=10;state.tick=10;
 input.emit(OnlineWorldSnapshot,{$data:JSON.stringify({player:0,document:projectWorld(state),playing:true})});await step(1);
 source.Tick=13;source.Players[0]!.X=112;state.tick=13;
 input.emit(OnlineWorldSnapshot,{$data:JSON.stringify({player:0,document:projectWorld(state),playing:true})});await step(1);
 const motion=worldMotion.get(),canonical=session.get().game!,display=sampleWorldMotion(canonical,motion,motion.receivedStep+1,.5);
 expect(canonical.Players[0]!.X).toBe(112);expect(display.Players[0]!.X).toBe(106);
 const originalPlan=sceneDraws(13,undefined,undefined),displayPlan=sceneDraws(13,undefined,undefined,display);
 expect(JSON.stringify(displayPlan.images)===JSON.stringify(originalPlan.images)).toBe(false);
 expect(session.get().game!.Players[0]!.X).toBe(112);
 const stats=render.stats({width:768,height:720});expect(stats.drawCalls).toBeLessThan(20);
},{scene:'scenes/arcade.scene.json'});
