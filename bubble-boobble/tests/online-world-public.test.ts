import { worldTest, expect } from '@gameengine/test';
import campaign from '../data/levels.json';
import { stepGame } from '../src/arcade/game';
import { preparePartyWave } from '../src/arcade/party';
import { arcadeDrawPlan } from '../src/arcade/presentation';
import { createOnlineWaveGame } from '../src/online/rules';
import { compactOnlineNavigation } from '../src/online/navigation';
import { PUBLIC_GAME_LIMIT, PUBLIC_WORLD_LIMIT, hydratePublicGame, isPublicWorld, projectWorld, publicBytes } from '../src/online/world-public';
import type { WorldState } from '../src/online/world-rules';

function fixture(count=1,humans=10): WorldState {
 const rooms=Array.from({length:count},(_,index)=>({id:`room-${index+1}`,title:`WAVE SURVIVAL ${index+1}`,owners:Array.from({length:10},(_,slot)=>slot<humans?index*10+slot:null),game:createOnlineWaveGame(campaign,{players:humans,mode:'realtime',seed:String(index+1)}),notices:[{id:1,tick:0,slot:0,kind:'join' as const,label:'P1 GREEN'}],nextNotice:2,createdTick:0,emptySince:null,endedTick:null,pendingTakeovers:[]}));
 return {tick:0,nextRoom:count+1,rooms,peers:rooms.flatMap(room=>room.owners.flatMap(owner=>owner===null?[]:[{player:owner,name:'PRIVATE PEER NAME',room:room.id,input:{Move:0,Jump:false,Fire:false},lastInputTick:0,jumpPulse:false,firePulse:false}]))};
}
worldTest('online public snapshots strip private simulation data and never mutate authoritative rooms',()=>{
 const state=fixture(1,1),room=state.rooms[0]!;
 stepGame(room.game,Array.from({length:10},()=>({Move:0,Jump:false,Fire:true})));compactOnlineNavigation(room.game);
 const before=JSON.stringify(state),wire=projectWorld(state),encoded=JSON.stringify(wire);
 expect(isPublicWorld(wire)).toBe(true);expect(JSON.stringify(state)).toBe(before);
 for(const key of ['Campaign','RNG','Companion','Companions','OnlineNavigationGraphs','OnlineNavigationGraphIndices'])expect(encoded.includes(`"${key}"`)).toBe(false);
 expect(encoded.includes('PRIVATE PEER NAME')).toBe(false);
 expect(publicBytes(wire)).toBeLessThan(PUBLIC_WORLD_LIMIT);
 const display=hydratePublicGame(wire.rooms[0]!.game!);
 expect(display.Campaign).toEqual([]);expect(display.RNG).toBe('1');expect(display.Companions!.map(ai=>!!ai)).toEqual([false,true,true,true,true,true,true,true,true,true]);
 expect(display.Companions!.every(ai=>!ai?.Graph)).toBe(true);
 expect(display.Companion).toBe(display.Companions![1]);
 display.Players[0]!.X=999;expect(state.rooms[0]!.game.Players[0]!.X===999).toBe(false);
});
worldTest('online public hydration preserves visible actor plans and boss state within subpixel precision',()=>{
 const state=fixture(1,2),game=state.rooms[0]!.game;
 game.Party!.Wave=game.Party!.BossWave;preparePartyWave(game);game.Party!.Timer=1;
 const inputs=Array.from({length:10},()=>({Move:0,Jump:false,Fire:false}));inputs[0]={Move:.3,Jump:false,Fire:true};
 for(let frame=0;frame<30;frame++)stepGame(game,inputs);
 const display=hydratePublicGame(projectWorld(state).rooms[0]!.game!);
 const original=arcadeDrawPlan(game),actual=arcadeDrawPlan(display);
 expect(actual.length).toBe(original.length);
 for(let index=0;index<original.length;index++){
  const a=original[index]!,b=actual[index]!;
  expect(b.image).toBe(a.image);expect(b.text).toBe(a.text);expect(b.flip).toBe(a.flip);expect(b.color).toEqual(a.color);
  for(const field of ['x','y','w','h','size'] as const)expect(Math.abs(b[field]-a[field])).toBeLessThan(.02);
 }
 expect(display.Party!.Boss!.HP).toBe(game.Party!.Boss!.HP);expect(display.Party!.Slots).toEqual(game.Party!.Slots);
});
worldTest('online public ten-dragon sustained fire remains bounded across bubble lifetimes',()=>{
 const state=fixture(),game=state.rooms[0]!.game;game.Party!.Timer=1;
 const inputs=Array.from({length:10},()=>({Move:0,Jump:false,Fire:true}));
 let peak=0,peakBubbles=0;
 for(let frame=0;frame<720;frame++){
  for(const player of game.Players)player.Invincible=600;
  stepGame(game,inputs);peakBubbles=Math.max(peakBubbles,game.Bubbles.length);
  if(frame%30===0){const wire=projectWorld(state);peak=Math.max(peak,publicBytes(wire));expect(!!wire.rooms[0]!.game).toBe(true);expect(publicBytes(wire.rooms[0]!.game!)).toBeLessThan(PUBLIC_GAME_LIMIT);}
 }
 expect(peakBubbles).toBeGreaterThan(10);expect(peak).toBeLessThan(PUBLIC_WORLD_LIMIT);
});
worldTest('online public pressure rotates full games while preserving every room roster',()=>{
 const state=fixture(4),template=state.rooms[0]!.game;
 // A dense but valid actor table makes four full games exceed one document; cosmetics
 // are expendable, whereas bubbles remain intact and every room still receives metadata.
 const source=template.Players[0]!;
 for(const room of state.rooms){
  room.game.Bubbles=Array.from({length:1200},(_,id)=>({X:source.X,Y:source.Y,VX:0,VY:0,Ground:false,ID:id+1,Dir:1,Age:1,EnemyID:0,CapturedAge:0,Distance:0,MaxDistance:400,Speed:6,Floating:false,Removed:false,Element:''}));
 }
 const before=JSON.stringify(state),seen=new Set<string>();let omitted=false;
 for(let rotation=0;rotation<4;rotation++){
  const wire=projectWorld({...state,tick:rotation*3});expect(isPublicWorld(wire)).toBe(true);expect(wire.rooms.length).toBe(4);expect(publicBytes(wire)).toBeLessThan(PUBLIC_WORLD_LIMIT+1);
  for(const room of wire.rooms){expect(room.humans).toBe(10);expect(room.owners.length).toBe(10);if(room.game)seen.add(room.id);else omitted=true;}
 }
 expect(omitted).toBe(true);expect([...seen].sort()).toEqual(['room-1','room-2','room-3','room-4']);expect(JSON.stringify(state)).toBe(before);
});
worldTest('online public snapshots reject malformed rosters packed tables and private data',()=>{
 const valid=projectWorld(fixture());expect(isPublicWorld(valid)).toBe(true);
 const copy=()=>JSON.parse(JSON.stringify(valid));
 let value=copy();value.rooms[0].owners.push(99);expect(isPublicWorld(value)).toBe(false);
 value=copy();value.rooms[0].humans=0;expect(isPublicWorld(value)).toBe(false);
 value=copy();value.rooms[0].game.data.RNG='secret';expect(isPublicWorld(value)).toBe(false);
 value=copy();value.rooms[0].game.actors.Players.rows[0].pop();expect(isPublicWorld(value)).toBe(false);
 value=copy();value.rooms[0].game.actors.Players.fields.push('__proto__');expect(isPublicWorld(value)).toBe(false);
 value=copy();value.rooms[0].phase='invalid';expect(isPublicWorld(value)).toBe(false);
 expect(publicBytes({text:'é🐲'})).toBe(JSON.stringify({text:'é🐲'}).length+3);
});
worldTest('online public pressure trims only copied cosmetic rows and bounds lobby errors',()=>{
 const state=fixture(),game=state.rooms[0]!.game;
 game.Particles=Array.from({length:6000},(_,index)=>({X:index%768,Y:100,VX:0,VY:0,Ground:false,Text:'SCORE BONUS',Life:45}));
 state.peers.push(...Array.from({length:100},(_,index)=>({player:100+index,name:'PRIVATE',room:null,input:{Move:0,Jump:false,Fire:false},lastInputTick:0,jumpPulse:false,firePulse:false,error:'busy'.repeat(50)})));
 const before=JSON.stringify(state),wire=projectWorld(state);
 expect(isPublicWorld(wire)).toBe(true);expect(!!wire.rooms[0]!.game).toBe(true);
 expect(wire.rooms[0]!.game!.actors.Particles.rows.length).toBeLessThan(6000);
 expect(wire.peers.length).toBe(74);expect(wire.peers.filter(peer=>peer.room!==null).length).toBe(10);
 expect(wire.peers.filter(peer=>peer.error).every(peer=>peer.error!.length===96)).toBe(true);
 expect(publicBytes(wire)).toBeLessThan(PUBLIC_WORLD_LIMIT);expect(JSON.stringify(state)).toBe(before);
});

worldTest('online public snapshots retain a complete burst of thirty-two roster notices',()=>{
 const state=fixture();state.rooms[0]!.notices=Array.from({length:32},(_,index)=>({id:index+1,tick:index,slot:index%10,kind:index%2?'leave':'join',label:`P${index%10+1} DRAGON`}));
 const wire=projectWorld(state);expect(isPublicWorld(wire)).toBe(true);expect(wire.rooms[0]!.notices.length).toBe(32);expect(wire.rooms[0]!.notices[31]!.id).toBe(32);
});

worldTest('online public snapshots bound and validate forty pending takeover countdowns',()=>{
 const state=fixture(4);state.tick=50;state.peers=[];
 for(const room of state.rooms){room.owners=Array(10).fill(null);room.pendingTakeovers=room.owners.map((_,slot)=>({slot,label:`P${slot+1} DRAGON`,takeoverTick:350}));}
 const wire=projectWorld(state);
 expect(isPublicWorld(wire)).toBe(true);expect(publicBytes(wire)).toBeLessThan(PUBLIC_WORLD_LIMIT);
 expect(wire.rooms.every(room=>room.pendingTakeovers.length===10&&room.pendingTakeovers.every(pending=>pending.remainingTicks===300))).toBe(true);
 const invalid=JSON.parse(JSON.stringify(wire));invalid.rooms[0].pendingTakeovers[0].remainingTicks=301;
 expect(isPublicWorld(invalid)).toBe(false);
 invalid.rooms[0].pendingTakeovers[0].remainingTicks=299;invalid.rooms[0].pendingTakeovers[1].slot=0;
 expect(isPublicWorld(invalid)).toBe(false);
});
