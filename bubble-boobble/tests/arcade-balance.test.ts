import {expect,worldTest} from '@gameengine/test';
import campaign from '../data/levels.json';
import {copyGame,createGame,loadLevel,stepGame} from '../src/arcade/game';
import {productionPlayerBalance,referencePlayerBalance} from '../src/arcade/balance';
import {shootBubble} from '../src/arcade/bubbles';
import {updatePlayer} from '../src/arcade/player';
import {applyPower,item} from '../src/arcade/items';
import {State,Tile} from '../src/arcade/types';
import type {GameState,Input,Level} from '../src/arcade/types';

const scene='scenes/arcade.scene.json';
const idle:Input={Move:0,Jump:false,Fire:false};
const fire:Input={...idle,Fire:true};
function arena(){
 const level:Level={number:1,player:{col:4,row:25},power_spawn:{col:10,row:25},food_spawn:{col:16,row:25},enemies:[{kind:'zenchan',col:26,row:25}],special:'',special_count:0,
  tiles:Array.from({length:26},(_,row)=>Array.from({length:32},(_,col)=>col<2||col>=30||row===0||row===25?1:0))};
 const game=createGame([level],42);
 game.State=State.Playing;game.Freeze=10000;
 return game;
}

worldTest('arcade balance fresh solo and co-op players have no hidden powers',()=>{
 for(const count of [1,2])for(const round of [0,2,24]){
  const game=createGame(campaign.slice(round),42,count);
  for(const player of game.Players){
   expect(player.Power).toEqual({Pink:false,Blue:false,Yellow:false,Shoes:false,Crystal:false,Amethyst:false,Ruby:false,WalkPoints:0});
   expect(player.Cooldown).toBe(0);
  }
 }
},{scene});

worldTest('arcade balance walking and shoes retain responsive fixed-step movement',()=>{
 for(const shoes of [false,true]){
  const game=arena(),player=game.Players[0]!,start=player.X;
  if(shoes)applyPower(game,'shoes',0);
  for(let tick=0;tick<10;tick++)stepGame(game,[{...idle,Move:1}]);
  expect(player.X-start).toBeCloseTo(shoes?35:25,10);
  for(let tick=0;tick<10;tick++)stepGame(game,[{...idle,Move:-1}]);
  expect(player.X).toBeCloseTo(start,10);expect(player.Dir).toBe(-1);
  const stopped=player.X;stepGame(game,[idle]);expect(player.X).toBe(stopped);
  stepGame(game,[{...idle,Jump:true}]);
  expect(player.VY).toBe(shoes?-12:-6);expect(game.Counters.Jumps).toBe(1);
 }
},{scene});

worldTest('arcade balance held fire follows baseline and yellow cadence without early shots',()=>{
 for(const yellow of [false,true]){
  const game=arena(),shots:number[]=[];
  if(yellow)applyPower(game,'yellow_candy',0);
  for(let tick=1;tick<=73;tick++){
   const before=game.Counters.Blown;stepGame(game,[fire]);
   if(game.Counters.Blown!==before)shots.push(tick);
  }
  expect(shots).toEqual(yellow?[1,13,25,37,49,61,73]:[1,25,49,73]);
  expect(game.Counters.Blown).toBe(shots.length);
 }
},{scene});

worldTest('arcade balance all blue and pink combinations travel exact range before floating',()=>{
 for(const blue of [false,true])for(const pink of [false,true]){
  const game=arena(),player=game.Players[0]!,start=player.X+18;
  if(blue)applyPower(game,'blue_candy',0);
  if(pink)applyPower(game,'pink_candy',0);
  stepGame(game,[fire]);
  const shot=game.Bubbles[0]!,speed=blue?9:6,range=pink?240:160;
  expect(shot.Distance).toBe(speed);expect(shot.X).toBe(start+speed);
  const flightTicks=blue?(pink?27:18):(pink?40:27);
  for(let tick=1;tick<flightTicks-1;tick++){
   stepGame(game,[idle]);expect(shot.Floating).toBe(false);
  }
  expect(shot.Age).toBe(flightTicks-1);
  stepGame(game,[idle]);
  expect(shot.Age).toBe(flightTicks);expect(shot.Floating).toBe(true);
  expect(shot.Distance).toBe(range);expect(shot.X).toBe(start+range);
  expect(game.Counters.Blown).toBe(1);
  // Slower shots still pass the age21 bounce/pop grace before base/combined flight ends.
  if(blue===pink)expect(shot.Age).toBe(27);
 }
},{scene});

worldTest('arcade balance candy pickup preserves existing shots and pending cooldown',()=>{
 const game=arena(),player=game.Players[0]!;
 stepGame(game,[fire]);const original=game.Bubbles[0]!;
 game.Items=['blue_candy','pink_candy','yellow_candy'].map(Power=>({...item(player.X,player.Y),Power,Stationary:true}));
 stepGame(game,[idle]);
 expect(game.Items.length).toBe(0);
 expect(player.Power.Blue&&player.Power.Pink&&player.Power.Yellow).toBe(true);
 expect(original.Speed).toBe(6);expect(original.MaxDistance).toBe(160);expect(original.Distance).toBe(12);
 expect(player.Cooldown).toBe(23);
 while(game.Tick<24){stepGame(game,[fire]);expect(game.Counters.Blown).toBe(1);}
 stepGame(game,[fire]);
 expect(game.Tick).toBe(25);expect(game.Counters.Blown).toBe(2);
 const upgraded=game.Bubbles.find(b=>b.ID!==original.ID)!;
 expect(upgraded.Speed).toBe(9);expect(upgraded.MaxDistance).toBe(240);expect(upgraded.Distance).toBe(9);
 expect(player.Cooldown).toBe(12);
 expect(original.Speed).toBe(6);expect(original.MaxDistance).toBe(160);
 while(game.Tick<36){stepGame(game,[fire]);expect(game.Counters.Blown).toBe(2);}
 stepGame(game,[fire]);expect(game.Counters.Blown).toBe(3);
 expect(player.X).toBe(4*Tile);
},{scene});

worldTest('arcade balance numeric profiles copy independently and survive level changes',()=>{
 const game=createGame(campaign,42),copy=copyGame(game);
 expect(game.PlayerBalance).toEqual(productionPlayerBalance);
 expect(copy.PlayerBalance===game.PlayerBalance).toBe(false);
 copy.PlayerBalance.MoveSpeed=1;
 expect(game.PlayerBalance.MoveSpeed).toBe(2.5);
 game.PlayerBalance.MoveSpeed=2.75;
 loadLevel(game,1);
 expect(game.PlayerBalance.MoveSpeed).toBe(2.75);
 expect(productionPlayerBalance.MoveSpeed).toBe(2.5);
 // The explicit source profile must drive actual rules, not only metadata.
 const reference=arena(),start=reference.Players[0]!.X;
 reference.PlayerBalance={...referencePlayerBalance};
 stepGame(reference,[{...fire,Move:1}]);
 expect(reference.Players[0]!.X-start).toBe(3);
 expect(reference.Players[0]!.Cooldown).toBe(18);
 expect(reference.Bubbles[0]!.Distance).toBe(8);
 expect(reference.Bubbles[0]!.MaxDistance).toBe(200);
},{scene});

worldTest('arcade balance old sessions without configuration use playable defaults',()=>{
 const legacy=arena();delete (legacy as Partial<GameState>).PlayerBalance;
 const restored=copyGame(legacy);
 expect(restored.PlayerBalance).toEqual(productionPlayerBalance);
 const start=legacy.Players[0]!.X;
 updatePlayer(legacy,0,{...idle,Move:1});
 expect(legacy.Players[0]!.X-start).toBeCloseTo(2.5,10);
 shootBubble(legacy,0);
 expect(legacy.Bubbles[0]!.Speed).toBe(6);expect(legacy.Bubbles[0]!.MaxDistance).toBe(160);
 updatePlayer(legacy,0,fire);
 expect(legacy.Players[0]!.Cooldown).toBe(24);
},{scene});
