import {expect,worldTest} from '@gameengine/test';
import campaign from '../data/levels.json';
import {createGame} from '../src/arcade/game';
import {updatePlayer} from '../src/arcade/player';
import {bubble,updateBubbles} from '../src/arcade/bubbles';
import {referencePlayerBalance} from '../src/arcade/balance';
import {ActorSize,Tile} from '../src/arcade/types';
import type {GameState,Level} from '../src/arcade/types';

const scene='scenes/main.scene.json';
const rightJump={Move:1,Jump:true,Fire:false};
const idle={Move:0,Jump:false,Fire:false};
function onPlatform(round:number,index:number,x:number,row:number,shoes=false){
 const g=createGame((campaign as Level[]).slice(round-1),42,2),p=g.Players[index]!;
 // Historical tuning traces retain the old ballistic profile explicitly.
 // Production arcade motion is covered by arcade-player-motion.test.ts.
 g.PlayerBalance.ArcadeMotion=false;
 Object.assign(p,{X:x,Y:row*Tile-ActorSize,VY:0,Ground:true,Invincible:0});
 p.Power.Shoes=shoes;
 return g;
}
function jumpToLanding(g:GameState,index:number,maxTicks:number){
 let airborne=false;
 for(let tick=1;tick<=maxTicks;tick++){
  updatePlayer(g,index,rightJump);
  const p=g.Players[index]!;
  if(!p.Ground)airborne=true;
  if(airborne&&p.Ground)return tick;
 }
 return 0;
}

// These fixtures retain actual campaign tiles. Only the player's starting pose
// is controlled; enemies are not advanced, so this proves movement reach rather
// than claiming that either route clears the campaign or avoids hostile actors.
worldTest('historical ballistic player traversal retains real five-tile and three-tile rises for both players',()=>{
 for(const index of [0,1])for(const route of [
  {round:1,x:96,startRow:25,targetRow:20,ticks:28,endX:166},
  {round:24,x:260,startRow:22,targetRow:19,ticks:38,endX:355},
 ]){
  const g=onPlatform(route.round,index,route.x,route.startRow),p=g.Players[index]!;
  const other={...g.Players[1-index]!,Power:{...g.Players[1-index]!.Power}};
  expect(g.PlayerBalance.MoveSpeed).toBe(2.5);
  expect(jumpToLanding(g,index,50)).toBe(route.ticks);
  expect(p.X).toBeCloseTo(route.endX,9);
  expect(p.Y).toBe(route.targetRow*Tile-ActorSize);
  expect(p.Ground).toBe(true);expect(p.VY).toBe(0);
  expect(g.Counters.Jumps).toBe(1);
  expect(g.Players[1-index]).toEqual(other);
 }
},{scene});

worldTest('historical ballistic player traversal shoes retain the eight-tile round seven horizontal gap',()=>{
 for(const index of [0,1]){
  const g=onPlatform(7,index,283,15,true),p=g.Players[index]!;
  // Left platform ends at col12; the next starts at col20:192 pixels.
  expect(g.Level.tiles[15]!.slice(12,20)).toEqual(Array(8).fill(0));
  expect(g.Level.tiles[15]![11]).not.toBe(0);
  expect(g.Level.tiles[15]![20]).not.toBe(0);
  expect(g.PlayerBalance.ShoesSpeed).toBe(3.5);
  expect(jumpToLanding(g,index,50)).toBe(45);
  expect(p.X).toBeCloseTo(440.5,9);
  expect(p.Y).toBe(15*Tile-ActorSize);expect(p.Ground).toBe(true);
  expect(p.X+ActorSize-4).toBeGreaterThan(20*Tile);
 }
},{scene});

worldTest('historical ballistic player traversal documents a lost shoes landing and a real bubble-assisted alternative',()=>{
 // Round3's row20 left island ends at col11; the right island starts at21.
 // Old shoes reach the upper-right row15 bridge. New shoes alone miss that
 // landing and descend into the gap; this deliberate shorter reach is retained.
 const old=onPlatform(3,0,259,20,true);
 old.PlayerBalance={...referencePlayerBalance};
 expect(old.Level.tiles[20]!.slice(11,21)).toEqual(Array(10).fill(0));
 expect(jumpToLanding(old,0,50)).toBe(28);
 expect(old.Players[0]!.X).toBeCloseTo(399,9);
 expect(old.Players[0]!.Y).toBe(15*Tile-ActorSize);
 const plain=onPlatform(3,0,259,20,true);
 for(let tick=0;tick<50;tick++)updatePlayer(plain,0,rightJump);
 expect(plain.Players[0]!.Ground).toBe(false);
 expect(plain.Players[0]!.Y+ActorSize).toBeGreaterThan(20*Tile+48);
 expect(plain.Players[0]!.X+ActorSize).toBeLessThan(21*Tile);

 // A mature ordinary floating bubble is a controlled world fixture, not an
 // assertion that the player can create this exact setup with one fresh shot.
 for(const index of [0,1]){
  const g=onPlatform(3,index,259,20,true),p=g.Players[index]!;
  g.Bubbles=[{...bubble(345,386),ID:999,Age:30,Floating:true}];
  let bounceTick=0,landingTick=0;
  for(let tick=1;tick<=80;tick++){
   updatePlayer(g,index,rightJump);
   const before=p.VY,inputs=[idle,idle];inputs[index]=rightJump;
   updateBubbles(g,inputs);
   if(before>=0&&p.VY===-10.5)bounceTick=tick;
   if(bounceTick&&p.Ground){landingTick=tick;break;}
  }
  expect(bounceTick).toBe(26);expect(landingTick).toBe(68);
  expect(p.X).toBeCloseTo(497,9);expect(p.Y).toBe(15*Tile-ActorSize);
  expect(p.Ground).toBe(true);expect(g.Bubbles.length).toBe(1);
  expect(g.Counters.Popped).toBe(0);expect(g.Counters.Jumps).toBe(1);
 }
},{scene});
