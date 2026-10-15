import {expect,worldTest} from '@gameengine/test';
import {createGame,stepGame} from '../src/arcade/game';
import {referencePlayerBalance} from '../src/arcade/balance';
import type {PlayerBalance} from '../src/arcade/balance';
import {checkPowerSpawns,item,updateItems} from '../src/arcade/items';
import {updatePlayer} from '../src/arcade/player';
import {State,Tile} from '../src/arcade/types';
import type {GameState,Level} from '../src/arcade/types';

const scene='scenes/arcade.scene.json';
const idle={Move:0,Jump:false,Fire:false};
function arena(players=1){
 const level:Level={number:1,player:{col:4,row:25},power_spawn:{col:24,row:25},food_spawn:{col:16,row:25},enemies:[{kind:'zenchan',col:26,row:25}],special:'',special_count:0,
  tiles:Array.from({length:26},(_,row)=>Array.from({length:32},(_,col)=>col<2||col>=30||row===0||row===25?1:0))};
 const game=createGame([level],42,players);
 game.State=State.Playing;game.Freeze=10000;
 return game;
}

worldTest('shoes progress real walking crosses9599 and preserves travel remainder',()=>{
 const game=arena(),player=game.Players[0]!;
 game.Counters.Walked=9599;
 checkPowerSpawns(game);expect(game.Items.length).toBe(0);
 const start=player.X;updatePlayer(game,0,{...idle,Move:1});checkPowerSpawns(game);
 expect(player.X-start).toBeCloseTo(2.5,10);
 expect(game.Items.map(i=>i.Power)).toEqual(['shoes']);
 expect(game.Counters.Walked).toBeCloseTo(1.5,10);
 checkPowerSpawns(game);expect(game.Items.length).toBe(1);expect(game.Pending).toEqual([]);
 // Exact threshold is eligible too, without requiring an overshoot.
 const exact=arena();exact.Counters.Walked=9600;checkPowerSpawns(exact);
 expect(exact.Items[0]!.Power).toBe('shoes');expect(exact.Counters.Walked).toBe(0);
},{scene});

worldTest('shoes progress queues behind existing power and preserves FIFO order',()=>{
 const game=arena(),player=game.Players[0]!;
 game.Items=[{...item(400,100),Power:'clock',Stationary:true}];
 game.Pending=['pink_candy'];game.Counters.Walked=9599;
 stepGame(game,[{...idle,Move:1}]);
 expect(game.Items.map(i=>i.Power)).toEqual(['clock']);
 expect(game.Pending).toEqual(['pink_candy','shoes']);
 expect(game.Counters.Walked).toBeCloseTo(1.5,10);
 for(const next of ['pink_candy','shoes']){
  Object.assign(game.Items[0]!,{X:player.X,Y:player.Y});
  updateItems(game);checkPowerSpawns(game);
  expect(game.Items.map(i=>i.Power)).toEqual([next]);
 }
 expect(game.Pending).toEqual([]);expect(player.Power.Shoes).toBe(false);
 expect(game.Counters.Walked).toBeCloseTo(1.5,10);
},{scene});

worldTest('shoes progress shares co-op distance but only collector gains speed',()=>{
 const game=arena(2),one=game.Players[0]!,two=game.Players[1]!;
 game.Counters.Walked=9597;
 updatePlayer(game,0,{...idle,Move:1});checkPowerSpawns(game);
 expect(game.Counters.Walked).toBeCloseTo(9599.5,10);expect(game.Items.length).toBe(0);
 updatePlayer(game,1,{...idle,Move:-1});checkPowerSpawns(game);
 expect(game.Counters.Walked).toBeCloseTo(2,10);expect(game.Items[0]!.Power).toBe('shoes');
 updateItems(game);
 expect(game.Items.length).toBe(0);expect(one.Power.Shoes).toBe(false);expect(two.Power.Shoes).toBe(true);
 const x1=one.X,x2=two.X;
 stepGame(game,[{...idle,Move:1},{...idle,Move:-1}]);
 expect(one.X-x1).toBeCloseTo(2.5,10);expect(x2-two.X).toBeCloseTo(3.5,10);
},{scene});

worldTest('shoes progress blocked movement cannot unlock reward',()=>{
 const game=arena(),player=game.Players[0]!;
 player.X=2*Tile;game.Counters.Walked=9599;
 for(let tick=0;tick<20;tick++)stepGame(game,[{...idle,Move:-1}]);
 expect(player.X).toBe(2*Tile);expect(game.Counters.Walked).toBe(9599);
 expect(game.Items.length).toBe(0);expect(game.Pending).toEqual([]);
 stepGame(game,[{...idle,Move:1}]);
 expect(game.Items[0]!.Power).toBe('shoes');expect(game.Counters.Walked).toBeCloseTo(1.5,10);
},{scene});

worldTest('shoes progress reference profile retains original threshold and old sessions use new default',()=>{
 const reference=arena();reference.PlayerBalance={...referencePlayerBalance};
 reference.Counters.Walked=9600;checkPowerSpawns(reference);expect(reference.Items.length).toBe(0);
 reference.Counters.Walked=11519;updatePlayer(reference,0,{...idle,Move:1});checkPowerSpawns(reference);
 expect(reference.Items[0]!.Power).toBe('shoes');expect(reference.Counters.Walked).toBe(2);
 for(const missing of ['field','config']){
  const legacy=arena();
  if(missing==='field')delete (legacy.PlayerBalance as Partial<PlayerBalance>).ShoesTravelThreshold;
  else delete (legacy as Partial<GameState>).PlayerBalance;
  legacy.Counters.Walked=9600;checkPowerSpawns(legacy);
  expect(legacy.Items[0]!.Power).toBe('shoes');expect(legacy.Counters.Walked).toBe(0);
 }
},{scene});
