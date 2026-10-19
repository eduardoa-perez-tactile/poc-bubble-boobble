import { expect, worldTest, renderTest } from '@gameengine/test';
import campaign from '../data/levels.json';
import { createGame } from '../src/arcade/game';
import { createPartyGame } from '../src/arcade/party';
import { spawnFood, rewardFood, updateItems, foodScore } from '../src/arcade/items';
import { bubble, popBubble } from '../src/arcade/bubbles';
import { EnemyState } from '../src/arcade/types';
import { arcadeDrawPlan } from '../src/arcade/presentation';
import { PartyReset, PartyFinalPop } from '../src/arcade/party.cheats';
import { session } from '../src/arcade/session';

worldTest('wave fruit enemy drops and bubble rewards use the wave fruit and preserve pickup scores',()=>{
 const g=createPartyGame(campaign,42),seen:number[]=[];
 for(let wave=1;wave<=9;wave++){
  g.Party!.Wave=wave;g.Items=[];g.Particles=[];g.Score=0;
  spawnFood(g,400,300);const food=rewardFood(g);seen.push(food);
  expect(g.Items[0]!.Food).toBe(food);
  const enemy=g.Enemies[0]!;enemy.State=EnemyState.Trapped;enemy.DeadTicks=0;
  g.Bubbles=[{...bubble(400,300),ID:1000,Age:30,EnemyID:enemy.ID}];
  popBubble(g,0,0);expect(g.Items.length).toBe(2);
  expect(g.Items.every(it=>it.Food===food)).toBe(true);
  expect(arcadeDrawPlan(g).filter(d=>d.image===`reference/food/${food}/0`).length).toBe(2);
  g.Items=[{...g.Items[0]!,X:g.Players[0]!.X,Y:g.Players[0]!.Y,Stationary:true}];
  const before=g.Score;updateItems(g);expect(g.Score-before).toBe(foodScore(g.Level.number));
 }
 expect(new Set(seen).size).toBe(8);
 expect(seen.every((food,i)=>i===0||food!==seen[i-1])).toBe(true);
});

worldTest('wave fruit rotation remains deterministic and classic keeps its original level rewards',()=>{
 const a=createPartyGame(campaign,42),b=createPartyGame(campaign,42);
 for(let wave=1;wave<=100;wave++){
  a.Party!.Wave=wave;b.Party!.Wave=wave;
  expect(rewardFood(a)).toBe(rewardFood(b));
  expect(rewardFood(a)>=13&&rewardFood(a)<=20).toBe(true);
 }
 const classic=createGame(campaign,42);
 for(let level=1;level<=25;level++){
  classic.Level={...classic.Level,number:level};classic.Items=[];spawnFood(classic,400,300);
  expect(classic.Items[0]!.Food).toBe(level);
 }
});

renderTest('wave fruit real final pops show a different reward each wave',async({input,step,cheat,render})=>{
 input.view(768,720,1);await step(5);
 for(let wave=1;wave<=8;wave++){
  await cheat(PartyReset,{wave,team:6,humans:6});await step(1);
  await cheat(PartyFinalPop,{slot:0});await step(1);
  const g=session.get().game!;
  expect(g.Party!.Phase).toBe('rest');
  expect(g.Items.some(i=>!i.Power&&i.Food===12+wave)).toBe(true);
  render.expectDrawCalls('<=',14,{width:768,height:720});
  render.expectScreenshot(`wave_${wave}_fruit`,{width:768,height:720});
 }
},{scene:'scenes/arcade.scene.json',memory:'phone-low'});
