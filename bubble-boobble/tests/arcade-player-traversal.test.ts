import {expect,worldTest} from '@gameengine/test';
import campaign from '../data/levels.json';
import {createGame} from '../src/arcade/game';
import {bubble,updateBubbles} from '../src/arcade/bubbles';
import {moveActor} from '../src/arcade/physics';
import {updatePlayer} from '../src/arcade/player';
import {ActorSize,Height,Rows,Tile,body} from '../src/arcade/types';
import type {Level} from '../src/arcade/types';
import {PrepareTopTraversal} from '../src/arcade/traversal.cheats';
import {ArcadeInput} from '../src/schema.gen';
import {session} from '../src/arcade/session';
const idle={Move:0,Jump:false,Fire:false};
function setup(players=1){
 const level:Level={number:3,player:{col:10,row:24},power_spawn:{col:4,row:24},food_spawn:{col:16,row:24},enemies:[{kind:'zenchan',col:24,row:24}],special:'',special_count:0,tiles:Array.from({length:Rows},(_,row)=>Array.from({length:32},(_,col)=>col<2||col>=30||row===0||row===Rows-1?1:0))};
 for(const row of [0,Rows-1])for(let col=9;col<=12;col++)level.tiles[row]![col]=0;
 return createGame([level],42,players);
}
worldTest('player traversal keeps upward velocity above the old ceiling and through platform undersides',()=>{
 const g=setup(),p=g.Players[0]!;
 Object.assign(p,{X:10*Tile,Y:Tile+1,VY:-10,Ground:false});
 updatePlayer(g,0,idle);
 expect(p.Y).toBe(15.5);expect(p.VY).toBe(-9.5);
 Object.assign(p,{X:16*Tile,Y:Tile+1,VY:-10});
 updatePlayer(g,0,idle);expect(p.Y).toBe(15.5);expect(p.VY).toBe(-9.5);
 // Solid platforms retain the original one-way underside behavior.
 for(let col=8;col<14;col++)g.Level.tiles[4]![col]=1;
 Object.assign(p,{Y:4*Tile+5,VY:-10});
 updatePlayer(g,0,idle);
 expect(p.Y).toBe(4*Tile-4.5);expect(p.VY).toBe(-9.5);
 // Enemy/shared actor physics still uses the original clamp.
 const e={...body(10*Tile,Tile+1),VY:-10};moveActor(g,e,0,true);
 expect(e.Y).toBe(Tile);expect(e.VY).toBe(0);
});
worldTest('player traversal wraps only after full top exit and rises visibly from bottom',()=>{
 const g=setup(),p=g.Players[0]!;
 Object.assign(p,{X:10*Tile,Y:-ActorSize+4,VY:-4.5,Ground:false});
 updatePlayer(g,0,idle);
 expect(p.Y).toBe(-ActorSize);expect(p.VY).toBe(-4);
 updatePlayer(g,0,idle);
 expect(p.Y).toBe(Height-3.5);expect(p.VY).toBe(-3.5);expect(p.Ground).toBe(false);
 for(let i=0;i<5;i++)updatePlayer(g,0,idle);
 expect(p.Y).toBeLessThan(Height-3.5);expect(p.Y).toBeGreaterThan(Tile);
});
worldTest('player traversal requires matching full-width openings and preserves bottom wrap',()=>{
 for(const [x,blockedRow] of [[10*Tile,Rows-1],[9*Tile-1,-1],[12*Tile,-1],[2*Tile,-1]] as const){
  const g=setup(),p=g.Players[0]!;
  if(blockedRow>=0)g.Level.tiles[blockedRow]![10]=1;
  Object.assign(p,{X:x,Y:-ActorSize+1,VY:-5,Ground:false});
  updatePlayer(g,0,idle);
  expect(p.Y).toBe(-ActorSize-3.5);expect(p.VY).toBe(-4.5);
 }
 const g=setup(),p=g.Players[0]!;
 Object.assign(p,{X:10*Tile,Y:Height-1,VY:4,Ground:false});
 updatePlayer(g,0,idle);
 expect(p.Y).toBe(Tile);expect(p.VY).toBe(3);
});
worldTest('player traversal bubble boost crosses top opening without popping the bubble',()=>{
 const g=setup(),p=g.Players[0]!;
 Object.assign(p,{X:10*Tile,Y:10,VY:4,Ground:false});
 g.Bubbles=[{...bubble(10*Tile,52),ID:10,Age:30,Floating:true}];
 const jump={...idle,Jump:true};
 updateBubbles(g,[jump]);
 expect(p.VY).toBe(-6);expect(g.Bubbles.length).toBe(1);expect(g.Counters.Popped).toBe(0);
 for(let i=0;i<12&&p.Y<Height/2;i++)updatePlayer(g,0,jump);
 expect(p.Y).toBeGreaterThan(Height-ActorSize);expect(p.Y).toBeLessThanOrEqual(Height);expect(p.VY).toBeLessThan(0);
 for(let i=0;i<10;i++)updatePlayer(g,0,jump);
 expect(p.Y+ActorSize).toBeLessThan(Height);expect(p.VY).toBeLessThan(0);
});
worldTest('player traversal co-op wraps independently without changing jump-edge rules',()=>{
 const g=setup(2),p=g.Players[0]!,other=g.Players[1]!;
 Object.assign(p,{X:10*Tile,Y:-ActorSize+1,VY:-5,Ground:false});
 Object.assign(other,{X:16*Tile,Y:200,VY:0,Ground:false});
 const untouched={...other};updatePlayer(g,0,idle);
 expect(p.Y).toBe(Height-3.5);expect(other).toEqual(untouched);
 // Holding jump in mid-air does not create an ordinary jump or reset velocity.
 updatePlayer(g,1,{...idle,Jump:true});const vy=other.VY;
 updatePlayer(g,1,{...idle,Jump:true});
 expect(other.VY).toBe(vy);expect(g.Counters.Jumps).toBe(0);
});

worldTest('player traversal real campaign round three wraps through paired openings',()=>{
 const g=createGame((campaign as Level[]).slice(2),42),p=g.Players[0]!;
 Object.assign(p,{X:10*Tile,Y:-ActorSize+1,VY:-8,Ground:false});
 updatePlayer(g,0,idle);
 expect(p.Y).toBe(Height-6.5);expect(p.VY).toBe(-7.5);
 for(let i=0;i<10;i++)updatePlayer(g,0,idle);
 expect(p.Y+ActorSize).toBeLessThan(Height);expect(p.Ground).toBe(false);
});
worldTest('player traversal engine input wraps round three and preserves upward re-entry',async({step,input,cheat})=>{
 await step(1);
 await cheat(PrepareTopTraversal,{});
 const initial=session.get().game!;
 expect(initial.Level.number).toBe(3);expect(initial.Tick).toBe(0);
 expect(initial.Players[0]!.Y).toBe(-ActorSize+1);
 for(const [y,vy] of [[Height-6.5,-7.5],[Height-13.5,-7]] as const){
  input.emit(ArcadeInput,{player:0,move:0,jump:false,fire:false,paused:false});
  await step(1);
  const game=session.get().game!,player=game.Players[0]!;
  expect(game.Level.number).toBe(3);expect(player.X).toBe(10*Tile);
  expect(player.Y).toBe(y);expect(player.VY).toBe(vy);expect(player.Ground).toBe(false);
 }
 expect(session.get().game!.Tick).toBe(2);
},{scene:'scenes/arcade.scene.json'});
worldTest('player traversal real round one closed roof returns to visible platform',()=>{
 const g=createGame(campaign as Level[],42),p=g.Players[0]!;
 Object.assign(p,{X:10*Tile,Y:Tile+1,VY:-11.5,Ground:false});
 let above=false,wrapped=false;
 for(let i=0;i<120&&!p.Ground;i++){
  const old=p.Y;updatePlayer(g,0,idle);
  if(p.Y+ActorSize<0)above=true;
  if(old<0&&p.Y>Height/2)wrapped=true;
 }
 expect(above).toBe(true);expect(wrapped).toBe(false);
 expect(p.Ground).toBe(true);expect(p.Y).toBe(10*Tile-ActorSize);
 expect(p.Y).toBeGreaterThanOrEqual(0);expect(p.Y+ActorSize).toBeLessThanOrEqual(Height);
});
worldTest('player traversal bubble jump retains reference age and held-input rules',()=>{
 for(const [age,jump] of [[19,true],[30,false],[30,true]] as const){
  const g=setup(),p=g.Players[0]!;
  Object.assign(p,{X:10*Tile,Y:494,VY:4,Ground:false});
  g.Bubbles=[{...bubble(10*Tile,534),ID:10,Age:age,Floating:true}];
  updateBubbles(g,[{...idle,Jump:jump}]);
  expect(p.VY).toBe(age===30&&jump?-6:4);
  expect(g.Counters.Popped).toBe(age===30&&!jump?1:0);
 }
});
