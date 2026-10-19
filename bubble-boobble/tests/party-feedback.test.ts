import { PartyReset, PartyFinalPop } from '../src/arcade/party.cheats';
import { session } from '../src/arcade/session';
import { createBoss, stepBoss } from '../src/arcade/boss';
import { expect, worldTest, renderTest } from '@gameengine/test';
import campaign from '../data/levels.json';
import { createPartyGame, preparePartyWave } from '../src/arcade/party';
import { copyGame, stepGame } from '../src/arcade/game';
import { arcadeDrawPlan, referenceFrame } from '../src/arcade/presentation';
import { bubble, popBubble, releaseElement, hitWithElement, carryOnWater, updateEffects } from '../src/arcade/bubbles';
import { applyPower } from '../src/arcade/items';
import { hudModel } from '../src/desktop/hud.view';
import { initialDesktopSave } from '../src/desktop/save';
import { EnemyState } from '../src/arcade/types';
const idle={Move:0,Jump:false,Fire:false};
const game=()=>createPartyGame(campaign,42);
worldTest('party feedback countdown holds every dragon until a visible GO and then releases movement',()=>{
 const g=game(),starts=g.Players.map(p=>[p.X,p.Y]);
 expect(hudModel(g,initialDesktopSave).startCue).toBe('3');
 for(let tick=1;tick<=180;tick++){
  stepGame(g,[{Move:1,Jump:true,Fire:false}]);
  expect(g.Players.map(p=>[p.X,p.Y])).toEqual(starts);
  if(tick===60)expect(hudModel(g,initialDesktopSave).startCue).toBe('2');
  if(tick===120)expect(hudModel(g,initialDesktopSave).startCue).toBe('1');
 }
 const hud=hudModel(g,initialDesktopSave);
 expect(hud.startCue).toBe('GO!');expect(hud.showStartCue).toBe(true);
 stepGame(g,[{Move:1,Jump:false,Fire:false}]);expect(g.Players[0]!.X).toBeGreaterThan(starts[0]![0]!);
});
worldTest('party feedback start protection keeps dragons visible while rescue protection can still blink',()=>{
 const g=game();g.Party!.Phase='combat';g.LevelTicks=0;
 for(const p of g.Players){p.Ground=true;p.Invincible=6;}
 let plan=arcadeDrawPlan(g);
 for(const p of g.Players)expect(plan.some(d=>!d.footer&&d.image===referenceFrame(`${p.Skin}/walk`,0))).toBe(true);
 g.LevelTicks=200;plan=arcadeDrawPlan(g);
 expect(plan.some(d=>!d.footer&&d.image===referenceFrame('green/walk',0))).toBe(false);
});
worldTest('party feedback final pop credits the popper rather than shooter and shows a temporary colored award',()=>{
 const g=game();g.Party!.Phase='combat';g.LevelTicks=121;
 const e=g.Enemies[0]!;g.Enemies=[e];Object.assign(e,{State:EnemyState.Trapped,X:g.Players[9]!.X,Y:g.Players[9]!.Y});
 g.Bubbles=[{...bubble(e.X,e.Y),EnemyID:e.ID,Age:30,Floating:true,Shooter:0}];
 popBubble(g,0,9);expect(g.Party!.LastKill!.Slot).toBe(9);
 stepGame(g,idle);expect(g.Party!.Phase).toBe('rest');
 const hud=hudModel(g,initialDesktopSave);
 expect(hud.banner).toBe('FLINT - LAST KILL!');expect(hud.celebrationColor).toBe('slate');
 const label=arcadeDrawPlan(g).find(d=>!d.footer&&d.text==='FLINT LAST KILL!')!;
 expect(label.color).toEqual([110,135,165]);
 const points=arcadeDrawPlan(g).find(d=>d.text==='100')!;expect(label.y).toBeLessThan(points.y-points.size-2);
 const copy=copyGame(g);copy.Party!.LastKill!.Slot=0;expect(g.Party!.LastKill!.Slot).toBe(9);
 for(let i=0;i<120;i++)stepGame(g,idle);
 expect(arcadeDrawPlan(g).some(d=>d.text.includes('LAST KILL'))).toBe(false);
});
worldTest('party feedback elemental and dynamite finishes retain the responsible dragon',()=>{
 for(const Element of ['thunder','fire','water']){
  const g=game();g.Party!.Phase='combat';const e=g.Enemies[0]!;g.Enemies=[e];
  releaseElement(g,{...bubble(e.X,e.Y),Element},8);const fx=g.Effects[0]!;fx.Ground=true;
  hitWithElement(g,fx,44,44);
  if(Element==='water'){e.CarryTicks=179;carryOnWater(g,fx);}
  expect(g.Party!.LastKill!.Slot).toBe(8);
 }
 const g=game();g.Party!.Phase='combat';applyPower(g,'dynamite',7);
 expect(g.Party!.LastKill!.Slot).toBe(7);
 const fire=game();fire.Party!.Phase='combat';fire.Enemies=[];
 releaseElement(fire,{...bubble(242,216),Element:'fire'},6);updateEffects(fire);
 expect(fire.Effects.length).toBeGreaterThan(1);expect(fire.Effects.every(e=>e.Owner===6)).toBe(true);
});

worldTest('party feedback final chain and boss touch each award exactly one responsible dragon',()=>{
 const g=game();g.Party!.Phase='combat';const base=g.Enemies[0]!;
 g.Enemies=[0,1].map(i=>({...base,ID:900+i,X:300+i*28,Y:200,State:EnemyState.Trapped}));
 g.Bubbles=g.Enemies.map((e,i)=>({...bubble(e.X,e.Y),ID:910+i,EnemyID:e.ID,Age:30,Floating:true,Shooter:9}));
 popBubble(g,0,0);expect(g.Party!.LastKill!.Slot).toBe(0);
 popBubble(g,1,4);expect(g.Party!.LastKill!.Slot).toBe(0);
 const boss=game();boss.Party!.Wave=10;boss.Party!.Phase='boss';boss.Enemies=[];
 boss.Party!.Boss={...createBoss(10,boss.Level),Mode:'captured',HP:0,Timer:29};
 for(const p of boss.Players){p.X=72;p.Y=0;}
 boss.Players[8]!.X=boss.Party!.Boss.X+10;boss.Players[8]!.Y=boss.Party!.Boss.Y+10;
 stepBoss(boss);expect(boss.Party!.LastKill!.Slot).toBe(8);
 const hud=hudModel(boss,initialDesktopSave,'result');
 expect(hud.banner).toBe('PEARL - LAST KILL!');expect(hud.showBanner).toBe(true);
});

renderTest('party feedback ready GO and last kill fit every window',async({input,step,cheat,render})=>{
 for(const [width,height] of [[768,720],[1680,720],[640,960]]){
  input.view(width!,height!,1);await step(3);await cheat(PartyReset,{team:10,humans:1,wave:1,countdown:180});await step(1);
  const starts=session.get().game!.Players.map(p=>[p.X,p.Y]);input.action('partyMove1',1);
  for(const n of [3,2,1]){
   expect(hudModel(session.get().game!,initialDesktopSave).startCue).toBe(String(n));
   expect(session.get().game!.Players.map(p=>[p.X,p.Y])).toEqual(starts);
   render.expectScreenshot(`ready_${n}_${width}x${height}`,{width:width!,height:height!});
   if(n>1)await step(60);
  }
  await step(session.get().game!.Party!.Timer);
  expect(hudModel(session.get().game!,initialDesktopSave).startCue).toBe('GO!');
  render.expectScreenshot(`go_${width}x${height}`,{width:width!,height:height!});
  input.action('partyMove1',1);await step(1);expect(session.get().game!.Players[0]!.X).toBeGreaterThan(starts[0]![0]!);input.action('partyMove1',0);
  await cheat(PartyReset,{team:10,humans:10,wave:9,countdown:1});await step(2);await cheat(PartyFinalPop,{slot:9});await step(2);
  expect(session.get().game!.Party!.LastKill!.Slot).toBe(9);
  render.expectDrawCalls('<=',14,{width:width!,height:height!});
  render.expectScreenshot(`flint_last_kill_${width}x${height}`,{width:width!,height:height!});
  await step(120);expect(session.get().game!.Party!.Phase).toBe('prepare');
  const before=session.get().game!.Players[0]!;const x=before.X,y=before.Y;
  input.action('partyMove1',1);input.action('partyJump1',1);await step(1);
  expect(session.get().game!.Players[0]!.X).toBeGreaterThan(x);
  expect(session.get().game!.Players[0]!.Y).toBeLessThan(y);
  expect(hudModel(session.get().game!,initialDesktopSave).startHint).toBe('MOVE, JUMP AND SHOOT');
  render.expectScreenshot(`between_waves_movement_${width}x${height}`,{width:width!,height:height!});
  input.action('partyMove1',0);input.action('partyJump1',0);
 }
},{scene:'scenes/arcade.scene.json',memory:'phone-low'});

worldTest('party feedback later wave countdowns allow moving jumping shooting and active AI',()=>{
 for(const wave of [2,5,9,10]){
  const g=game();g.Party!.Wave=wave;preparePartyWave(g);
  const x=g.Players[0]!.X,enemies=g.Enemies.map(e=>[e.X,e.Y,e.Age]);
  for(let tick=0;tick<10;tick++)stepGame(g,[{Move:1,Jump:true,Fire:true}]);
  expect(g.Party!.Phase).toBe('prepare');expect(g.Players[0]!.X).toBeGreaterThan(x);
  expect(g.Counters.Jumps).toBeGreaterThan(0);expect(g.Counters.Blown).toBeGreaterThan(0);
  expect(g.Companions!.slice(1).some(ai=>!!ai?.Goal)).toBe(true);
  expect(g.Enemies.map(e=>[e.X,e.Y,e.Age])).toEqual(enemies);
  const hud=hudModel(g,initialDesktopSave);expect(hud.startHint).toBe('MOVE, JUMP AND SHOOT');
  expect(hud.detail).toBe('MOVE, JUMP AND SHOOT');
 }
});

worldTest('party feedback movement stays enabled across the rest to preparation boundary',()=>{
 const g=game();for(let i=0;i<180;i++)stepGame(g,idle);
 g.Enemies=[];stepGame(g,idle);expect(g.Party!.Phase).toBe('rest');
 for(let i=0;i<119;i++)stepGame(g,idle);
 const x=g.Players[0]!.X;
 stepGame(g,[{Move:1,Jump:false,Fire:false}]);expect(g.Party!.Phase).toBe('prepare');
 expect(g.Party!.Wave).toBe(2);expect(g.Players[0]!.X).toBeGreaterThan(x);
 const after=g.Players[0]!.X;
 stepGame(g,[{Move:1,Jump:true,Fire:true}]);
 expect(g.Players[0]!.X).toBeGreaterThan(after);expect(g.Counters.Jumps).toBeGreaterThan(0);
});
