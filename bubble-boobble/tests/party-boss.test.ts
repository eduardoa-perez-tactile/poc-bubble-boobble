import { worldTest, renderTest, expect } from '@gameengine/test';
import { arcadeDrawPlan, referenceFrame } from '../src/arcade/presentation';
import { partyColors } from '../src/arcade/party-config';
import campaign from '../data/levels.json';
import { createPartyGame, preparePartyWave } from '../src/arcade/party';
import { stepGame, copyGame } from '../src/arcade/game';
import { bubble, effect, shootBubble, updateEffects, updateBubbles } from '../src/arcade/bubbles';
import { applyPower, checkPowerSpawns } from '../src/arcade/items';
import { checkPlayerHit, hurtPlayer } from '../src/arcade/player';
import { ArcadeVisual } from '../src/schema.gen';
import { body, State, EnemyState } from '../src/arcade/types';
const idle={Move:0,Jump:false,Fire:false};
function bossGame(team=6){
 const g=createPartyGame(campaign,42,Array.from({length:6},(_,i)=>i<team?'human':'empty'));
 g.Party!.Wave=10;preparePartyWave(g);g.Party!.Timer=1;stepGame(g,idle);return g;
}
worldTest('party boss moves diagonally bounces and throws a bounded bottle fan',()=>{
 const g=bossGame(),b=g.Party!.Boss!,x=b.X,y=b.Y;
 stepGame(g,idle);expect(b.X!==x&&b.Y!==y).toBe(true);
 let sawFan=false;
 for(let tick=0;tick<600;tick++){
  for(const p of g.Players)p.Invincible=2;
  stepGame(g,idle);sawFan ||= g.Projectiles.filter(p=>p.Bottle).length===7;expect(b.X>=48&&b.X<=624&&b.Y>=24&&b.Y<=504).toBe(true);
 }
 expect(sawFan).toBe(true);
 Object.assign(b,{X:624,Y:504,VX:2.25,VY:2.25,Mode:'moving',Timer:100});stepGame(g,idle);expect(b.VX<0&&b.VY<0).toBe(true);
 expect(g.Projectiles.length).toBeLessThanOrEqual(21);expect(g.Enemies.length).toBe(0);
});
worldTest('party boss needs popped thunder bubbles and each bolt hits only once',()=>{
 const g=bossGame(),b=g.Party!.Boss!,hp=b.HP;
 g.Counters.Thunder=120;g.Pending=['clock'];checkPowerSpawns(g);expect(g.Items.some(i=>i.Power==='clock')).toBe(false);
 Object.assign(b,{X:350,Y:450,Tick:100});Object.assign(g.Players[0]!,{X:260,Y:556,Dir:1});
 g.Bubbles=[{...bubble(350,450),Age:1,Speed:1,Dir:1,MaxDistance:100}];stepGame(g,idle);expect(b.HP).toBe(hp);
 applyPower(g,'thunder_potion',0);shootBubble(g,0);
 expect(g.Bubbles.some(v=>v.Element==='thunder'&&v.ThunderShot)).toBe(true);
 const bolt={...effect(b.X-2,b.Y+24),Element:'thunder',Dir:1,Life:90};g.Effects=[bolt];
 updateEffects(g);expect(b.HP).toBe(hp-1);expect(g.Effects.length).toBe(0);
 g.Effects=[{...effect(b.X,b.Y),Element:'thunder',Dir:1,Life:90},{...effect(b.X,b.Y),Element:'thunder',Dir:1,Life:90}];
 updateEffects(g);expect(b.HP).toBe(hp-3);
 g.Party!.Phase='prepare';g.Effects=[{...effect(b.X,b.Y),Element:'thunder',Dir:1,Life:90}];updateEffects(g);expect(b.HP).toBe(hp-3);g.Party!.Phase='boss';
 g.Projectiles=[{...body(200,400),Bottle:true,Laser:false,Age:0,Removed:false}];
 g.Effects=[{...effect(190,400),Element:'thunder',Dir:1,Life:90}];updateEffects(g);
 expect(g.Projectiles[0]!.Removed).toBe(true);
});
worldTest('party boss captures before victory and a dragon must pop the giant bubble',()=>{
 const g=bossGame(),b=g.Party!.Boss!;
 Object.assign(b,{X:320,Y:500,HP:1});g.Effects=[{...effect(320,520),Element:'thunder',Dir:1,Life:90}];
 updateEffects(g);expect(b.Mode).toBe('captured');expect(g.State).toBe(State.Playing);
 expect(g.Projectiles.length).toBe(0);expect(g.Bubbles.length).toBe(0);
 for(let t=0;t<40;t++)stepGame(g,idle);
 Object.assign(g.Players[0]!,{X:b.X,Y:b.Y,Invincible:0});
 stepGame(g,idle);expect(g.State).toBe(State.Won);
});
worldTest('party boss body hurts dragons but preparation and captured states are safe',()=>{
 const g=bossGame(),b=g.Party!.Boss!,p=g.Players[0]!;
 Object.assign(p,{X:b.X,Y:b.Y,Invincible:0});checkPlayerHit(g,0);expect(p.Downed).toBe(true);
 p.Downed=false;p.Lives=1;g.Party!.Phase='prepare';checkPlayerHit(g,0);expect(p.Downed).toBe(false);
 g.Party!.Phase='boss';b.Mode='captured';checkPlayerHit(g,0);expect(p.Downed).toBe(false);
});
worldTest('party boss replaces lost thunder pickups and snapshots reproduce the fight',()=>{
 const g=bossGame();expect(g.Players.filter(p=>p.Power.Thunder).length).toBe(6);
 applyPower(g,'thunder_potion',0);g.Players[0]!.Invincible=0;hurtPlayer(g,0);
 expect(g.Players[0]!.Power.Thunder).toBe(undefined);
 g.Items=[];g.Players[1]!.Power.Thunder=false;const a=copyGame(g),b=copyGame(g);
 for(let t=0;t<130;t++)for(const v of [a,b]){for(const p of v.Players)p.Invincible=2;stepGame(v,idle);}
 expect(a.Items.some(i=>i.Power==='thunder_potion')||a.Players[1]!.Power.Thunder===true).toBe(true);expect(JSON.stringify(a)).toBe(JSON.stringify(b));
});
worldTest('party empty bubbles expire quickly without removing trapped enemies',()=>{
 const g=createPartyGame(campaign,42,Array.from({length:6},()=> 'human'));g.Party!.Timer=1;stepGame(g,idle);
 const enemy=g.Enemies[0]!;enemy.State=EnemyState.Trapped;
 g.Bubbles=[{...bubble(360,48),Floating:true,Age:179},{...bubble(500,200),EnemyID:enemy.ID,Floating:true,Age:179}];
 stepGame(g,idle);stepGame(g,idle);expect(g.Bubbles.length).toBe(1);expect(g.Bubbles[0]!.EnemyID).toBe(enemy.ID);
});
worldTest('party boss five bots can complete the moving fight and pop the finale',()=>{
 const g=createPartyGame(campaign,42);g.Party!.Wave=10;preparePartyWave(g);g.Party!.Timer=1;
 for(let tick=0;tick<18000&&g.State!==State.Won;tick++){
  for(const p of g.Players)p.Invincible=2;
  stepGame(g,idle);
 }
 expect(g.Party!.Boss!.HP).toBe(0);expect(g.State).toBe(State.Won);
});
import { PartyReset, PartyBossDuel, PartyBossSoak } from '../src/arcade/party.cheats';
import { session } from '../src/arcade/session';
import { desktopState } from '../src/desktop/state';
worldTest('party boss recorded thunder shot capture and finishing pop',async({cheat,input,step})=>{
 await cheat(PartyReset,{wave:10,humans:6});await step(2);await cheat(PartyBossDuel,{});
 input.action('partyFire1',1);await step(1);input.action('partyFire1',0);
 expect(session.get().game!.Bubbles.some(b=>b.ThunderShot)).toBe(true);
 await step(21);input.action('partyMove1',1);
 let captured=false;
 for(let t=0;t<180&&desktopState.get().screen!=='result';t++){
  input.action('partyMove1',1);await step(1);captured ||= session.get().game!.Party!.Boss!.Mode==='captured';
 }
 input.action('partyMove1',0);
 expect(captured).toBe(true);expect(desktopState.get().screen).toBe('result');expect(desktopState.get().won).toBe(true);
},{scene:'scenes/arcade.scene.json'});
renderTest('party boss moving art bottle warning and capture stay readable',async({cheat,step,input,render,ui})=>{
 input.view(768,720,1);await step(3);await cheat(PartyReset,{wave:10,humans:6});
 for(let t=0;t<200&&session.get().game!.Party!.Boss!.Mode!=='windup';t++)await step(1);
 expect(session.get().game!.Party!.Boss!.Mode).toBe('windup');
 render.expectScreenshot('bottle_warning',{width:768,height:720});
 await step(32);expect(session.get().game!.Projectiles.some(p=>p.Bottle)).toBe(true);
 render.expectScreenshot('bottle_fan',{width:768,height:720});render.expectDrawCalls('<=',14,{width:768,height:720});
 await cheat(PartyBossDuel,{captured:true});await step(1);expect(session.get().game!.Party!.Boss!.Mode).toBe('captured');
 render.expectScreenshot('giant_bubble',{width:768,height:720});
 for(const [width,height] of [[768,720],[1680,720],[640,960]]){
  input.view(width!,height!,1);await step(1);render.stats({width:width!,height:height!});
  const panel=ui.rect('desktop-hud.banner')!;
  for(const name of ['banner-title','banner-hint','party-detail']){
   const label=ui.rect(`desktop-hud.${name}`)!;
   expect(label.x>=panel.x&&label.x+label.width<=panel.x+panel.width&&label.y>=panel.y&&label.y+label.height<=panel.y+panel.height).toBe(true);
  }
 }
},{scene:'scenes/arcade.scene.json'});
declare const __gameengine_host:(op:string,arg:string)=>string;
renderTest('party boss six firing dragons stay bounded on phone low',async({cheat,step,input,render})=>{
 input.view(768,720,1);await step(3);await cheat(PartyReset,{wave:10,humans:6});
 let drawCalls=0,bubbles=0,projectiles=0,shots=0,effects=0;
 __gameengine_host('test.input',JSON.stringify(Array.from({length:6},(_,pad)=>({type:'gamepadButton',pad,button:2,down:true}))));
 for(let t=0;t<300;t++){
  await step(1);const g=session.get().game!;
  shots+=g.Sounds.filter(s=>s==='shoot').length;effects=Math.max(effects,g.Effects.length);
  bubbles=Math.max(bubbles,g.Bubbles.length);projectiles=Math.max(projectiles,g.Projectiles.length);
  if(t%30===0)drawCalls=Math.max(drawCalls,render.stats({width:768,height:720}).drawCalls);
 }
 expect(shots).toBeGreaterThan(60);expect(bubbles).toBeLessThanOrEqual(108);expect(projectiles).toBeLessThanOrEqual(21);expect(drawCalls).toBeLessThanOrEqual(14);
 console.log(JSON.stringify({peakDrawCalls:drawCalls,peakBubbles:bubbles,peakBottles:projectiles,peakLightning:effects,shots}));
},{scene:'scenes/arcade.scene.json',memory:'phone-low'});

renderTest('party boss ten dragons sustain a long lightning fight without growing visual pools',async({cheat,step,input,render,world})=>{
 input.view(768,720,1);await step(3);await cheat(PartyReset,{wave:10,team:10,humans:1});await step(2);await cheat(PartyBossSoak,{});
 input.action('partyFire1',1);
 let warmPool=0,peakPool=0,peakDraws=0,peakBubbles=0;
 for(let t=0;t<12000;t+=120){
  await step(120);const g=session.get().game!;
  expect(g.Party!.Phase).toBe('boss');
  const pool=world.all(ArcadeVisual).length;peakPool=Math.max(peakPool,pool);
  if(t===1200)warmPool=pool;
  peakBubbles=Math.max(peakBubbles,g.Bubbles.length);
  if(t%600===0)peakDraws=Math.max(peakDraws,render.stats({width:768,height:720}).drawCalls);
 }
 expect(peakPool).toBeLessThanOrEqual(warmPool+256);
 expect(peakBubbles).toBeLessThanOrEqual(180);expect(peakDraws).toBeLessThanOrEqual(14);
 console.log(JSON.stringify({warmPool,peakPool,peakBubbles,peakDraws,ticks:12000}));
 render.expectScreenshot('boss_soak',{width:768,height:720});
},{scene:'scenes/arcade.scene.json',memory:'phone-low'});

worldTest('party boss jumping into your own lightning bubble releases a bolt and damages the boss',()=>{
 for(let slot=0;slot<10;slot++){
  const g=createPartyGame(campaign,42,Array.from({length:10},()=> 'human'));
  g.Party!.Wave=10;preparePartyWave(g);g.Party!.Phase='boss';
  const p=g.Players[slot]!;Object.assign(p,{X:200,Y:300,VY:0,Dir:1});
  const boss=g.Party!.Boss!;Object.assign(boss,{X:235,Y:330});const hp=boss.HP;
  g.Bubbles=[{...bubble(200,336),ID:100,Shooter:slot,Element:'thunder',ThunderShot:true,Floating:true,Age:30}];
  const inputs=Array.from({length:10},()=>idle);inputs[slot]={...idle,Jump:true};
  updateBubbles(g,inputs);
  expect(g.Bubbles.length).toBe(0);expect(g.Effects.length).toBe(1);
  expect(g.Effects[0]!.Owner).toBe(slot);expect(g.Effects[0]!.Element).toBe('thunder');
  updateEffects(g);expect(boss.HP).toBe(hp-1);
 }
});
worldTest('party boss lightning shots preserve every shooter color',()=>{
 const g=createPartyGame(campaign,42,Array.from({length:10},()=> 'human'));
 g.Party!.Wave=10;preparePartyWave(g);
 g.Bubbles=partyColors.map((_,slot)=>({...bubble(100+slot*70,300),ID:100+slot,Shooter:slot,Element:'thunder',ThunderShot:true,Age:30}));
 const draws=arcadeDrawPlan(g);
 for(const [slot,color] of partyColors.entries())
  expect(draws.some(d=>d.image===referenceFrame(`${color}/bubble`,30)&&Math.abs(d.x-g.Bubbles[slot]!.X)<8)).toBe(true);
});

renderTest('party boss ten dragons fire identifiable lightning bubbles',async({cheat,step,input,render})=>{
 input.view(768,720,1);await step(3);await cheat(PartyReset,{wave:10,team:10,humans:10});await step(2);
 expect(session.get().game!.Players.every(p=>p.Power.Thunder)).toBe(true);
 __gameengine_host('test.input',JSON.stringify(Array.from({length:10},(_,pad)=>({type:'gamepadButton',pad,button:2,down:true}))));
 await step(1);
 const g=session.get().game!;
 expect(new Set(g.Bubbles.filter(b=>b.ThunderShot).map(b=>b.Shooter)).size).toBe(10);
 for(const [width,height] of [[768,720],[1680,720],[640,960]]){
  input.view(width!,height!,1);await step(1);
  render.expectDrawCalls('<=',14,{width:width!,height:height!});
  render.expectScreenshot(`colored_lightning_${width}x${height}`,{width:width!,height:height!});
 }
},{scene:'scenes/arcade.scene.json',memory:'phone-low'});
