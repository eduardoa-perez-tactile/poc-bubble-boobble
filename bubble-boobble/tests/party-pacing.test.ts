import { expect, worldTest, renderTest } from '@gameengine/test';
import campaign from '../data/levels.json';
import { createPartyGame } from '../src/arcade/party';
import { copyGame, stepGame } from '../src/arcade/game';
import { bubble, effect, updateBubbles, updateEffects } from '../src/arcade/bubbles';
import { item, updateItems } from '../src/arcade/items';
import { updateEnemies } from '../src/arcade/enemies';
import { EnemyState } from '../src/arcade/types';
import { arcadeDrawPlan, referenceFrame } from '../src/arcade/presentation';
import { PartyReset, PartyClear, PartyLastEnemy } from '../src/arcade/party.cheats';
import { session } from '../src/arcade/session';
const idle={Move:0,Jump:false,Fire:false};
const game=()=>createPartyGame(campaign,42,Array.from({length:6},()=> 'human'));

worldTest('party pacing break lasts five seconds including the next wave entrance with shooting throughout',()=>{
 const g=game();for(let t=0;t<180;t++)stepGame(g,idle);
 g.Enemies=[];stepGame(g,idle);expect(g.Party!.Timer).toBe(300);
 for(let t=0;t<299;t++) {
  stepGame(g,[{...idle,Fire:true}]);
  expect(g.Party!.Phase==='rest'||g.Party!.Phase==='prepare').toBe(true);
 }
 expect(g.Party!.Wave).toBe(2);expect(g.Party!.Phase).toBe('prepare');expect(g.Party!.Timer).toBe(1);
 expect(g.Bubbles.length).toBeGreaterThan(0);expect(g.Counters.Blown).toBeGreaterThan(10);
 stepGame(g,idle);expect(g.Party!.Phase).toBe('combat');expect(g.Enemies.every(e=>e.Age===0)).toBe(true);
 stepGame(g,idle);expect(g.Enemies.some(e=>e.Age>0)).toBe(true);
});

worldTest('party pacing preparation shots move and pop but cannot capture arriving enemies until combat',()=>{
 const g=game(),e=g.Enemies[0]!;
 Object.assign(g.Players[0]!,{X:e.X-60,Y:e.Y,Dir:1,Ground:true});
 stepGame(g,[{...idle,Fire:true}]);expect(g.Bubbles.length).toBe(1);const shot=g.Bubbles[0]!,x=shot.X;
 stepGame(g,idle);expect(shot.X).toBeGreaterThan(x);expect(e.State).toBe(EnemyState.Active);
 const hit=()=>({...bubble(e.X,e.Y),ID:1000,Speed:1,MaxDistance:300,Dir:1});
 g.Bubbles=[hit()];updateBubbles(g,[idle]);expect(e.State).toBe(EnemyState.Active);expect(g.Bubbles[0]!.EnemyID).toBe(0);
 g.Bubbles=[{...bubble(g.Players[0]!.X,g.Players[0]!.Y),Age:30,Floating:true}];updateBubbles(g,[idle]);expect(g.Bubbles.length).toBe(0);expect(g.Sounds.includes('pop')).toBe(true);
 g.Bubbles=[hit()];g.Party!.Phase='combat';updateBubbles(g,[idle]);expect(e.State).toBe(EnemyState.Trapped);expect(g.Bubbles[0]!.EnemyID).toBe(e.ID);
});

worldTest('party pacing preparation protects enemies from elements and delays offensive pickups',()=>{
 const g=game(),e=g.Enemies[0]!;
 g.Effects=[{...effect(e.X-1,e.Y),Element:'thunder',Dir:1,Life:90}];updateEffects(g);expect(e.State).toBe(EnemyState.Active);
 for(const Power of ['dynamite','clock']) {
  g.Items=[{...item(g.Players[0]!.X,g.Players[0]!.Y),Power}];updateItems(g);
  expect(g.Items.length).toBe(1);expect(g.Enemies.every(e=>e.State===EnemyState.Active)).toBe(true);expect(g.Freeze).toBe(0);
 }
 g.Party!.Phase='rest';updateItems(g);expect(g.Items.length).toBe(1);expect(g.Freeze).toBe(0);
 g.Party!.Phase='combat';updateItems(g);expect(g.Items.length).toBe(0);expect(g.Freeze).toBeGreaterThan(0);
});

renderTest('party pacing five second countdown preparation shooting and red last enemy',async({cheat,step,input,render})=>{
 input.view(768,720,1);await step(3);await cheat(PartyReset,{wave:1,humans:6});await step(2);await cheat(PartyClear,{});await step(1);
 render.expectScreenshot('five_second_break',{width:768,height:720});
 await step(150);input.action('partyFire1',1);await step(2);expect(session.get().game!.Party!.Phase).toBe('prepare');
 expect(session.get().game!.Bubbles.length).toBeGreaterThan(0);expect(session.get().game!.Enemies.every(e=>e.State===EnemyState.Active)).toBe(true);
 render.expectScreenshot('safe_preparation_shooting',{width:768,height:720});
 input.action('partyFire1',0);await step(session.get().game!.Party!.Timer);expect(session.get().game!.Party!.Phase).toBe('combat');await cheat(PartyLastEnemy,{});await step(1);
 expect(session.get().game!.Enemies.length).toBe(1);expect(session.get().game!.Enemies[0]!.Angry).toBe(true);
 render.expectDrawCalls('<=',14,{width:768,height:720});render.expectScreenshot('last_enemy_angry',{width:768,height:720});
},{scene:'scenes/arcade.scene.json'});

worldTest('party pacing last surviving enemy becomes angry red and faster after combat starts',()=>{
 const g=game();for(let t=0;t<180;t++)stepGame(g,idle);
 g.Enemies=g.Enemies.slice(0,1);const e=g.Enemies[0]!;Object.assign(e,{Kind:'monsta',X:300,Y:100,Dir:1,Vertical:1});
 const normal=copyGame(g);updateEnemies(normal);const normalDistance=normal.Enemies[0]!.X-e.X;
 stepGame(g,idle);expect(e.Angry).toBe(true);expect(e.X-300).toBeGreaterThan(normalDistance);
 expect(arcadeDrawPlan(g).some(d=>d.image===referenceFrame('monsta/angry',e.Age))).toBe(true);
 const multiple=game();multiple.Party!.Phase='combat';stepGame(multiple,idle);expect(multiple.Enemies.some(e=>e.Angry)).toBe(false);
 const preparing=game();preparing.Enemies=preparing.Enemies.slice(0,1);stepGame(preparing,idle);expect(preparing.Enemies[0]!.Angry).toBe(false);
});
