import { expect, worldTest, renderTest } from '@gameengine/test';
import { Text2D } from '@gameengine/runtime';
import campaign from '../data/levels.json';
import { createPartyGame } from '../src/arcade/party';
import { createGame, copyGame } from '../src/arcade/game';
import { checkPowerSpawns } from '../src/arcade/items';
import { blocked, solid } from '../src/arcade/physics';
import { position, intersects, Tile } from '../src/arcade/types';
import { arcadeDrawPlan } from '../src/arcade/presentation';
import { PartyPower, PartyReset } from '../src/arcade/party.cheats';
import { session } from '../src/arcade/session';

worldTest('party powerups randomize safe supported locations and reproduce from snapshots',()=>{
 const g=createPartyGame(campaign,42), locations:string[]=[];
 for(let drop=0;drop<40;drop++) {
  g.Items=[];g.Pending=['pink_candy','clock'];const snapshot=copyGame(g);
  checkPowerSpawns(g);checkPowerSpawns(snapshot);
  expect(g.Items).toEqual(snapshot.Items);expect(g.RNG).toBe(snapshot.RNG);
  expect(g.Items.length).toBe(1);expect(g.Pending).toEqual(['clock']);
  const p=g.Items[0]!;locations.push(`${p.X},${p.Y}`);
  expect(blocked(g,p.X,p.Y,32)).toBe(false);
  expect(solid(g,Math.floor(p.X/Tile),(p.Y+32)/Tile)).toBe(true);
  expect(solid(g,Math.floor((p.X+31)/Tile),(p.Y+32)/Tile)).toBe(true);
  expect(g.Players.some(d=>intersects(d.X,d.Y,44,44,p.X,p.Y,32,32))).toBe(false);
  const rng=g.RNG;checkPowerSpawns(g);expect(g.Items.length).toBe(1);expect(g.RNG).toBe(rng);
 }
 expect(new Set(locations).size).toBeGreaterThan(8);
 expect(new Set(locations.map(s=>s.split(',')[1])).size).toBeGreaterThan(1);
 const other=createPartyGame(campaign,123);other.Pending=['pink_candy'];checkPowerSpawns(other);
 expect(`${other.Items[0]!.X},${other.Items[0]!.Y}`).not.toBe(locations[0]);
 g.Items=[];g.Pending=['clock'];g.Level.tiles=g.Level.tiles.map(row=>row.map(()=>1));const rng=g.RNG;
 checkPowerSpawns(g);expect(g.Items.length).toBe(0);expect(g.Pending).toEqual(['clock']);expect(g.RNG).toBe(rng);
});

worldTest('party powerup alert marks benefits only and classic keeps its authored spawn',()=>{
 const g=createPartyGame(campaign,42);g.Pending=['shoes'];checkPowerSpawns(g);
 const power=g.Items[0]!,draws=arcadeDrawPlan(g);
 const alert=draws.find(d=>d.text==='RUN')!;
 expect(!!alert).toBe(true);expect(alert.y).toBeLessThan(power.Y+48);expect(alert.color).toEqual([100,255,130]);
 power.Power='';power.Food=1;expect(arcadeDrawPlan(g).some(d=>d.text==='RUN')).toBe(false);
 g.Items=[];expect(arcadeDrawPlan(g).some(d=>d.text==='RUN')).toBe(false);
 const classic=createGame(campaign,42),rng=classic.RNG;classic.Pending=['shoes'];checkPowerSpawns(classic);
 const [x,y]=position(classic.Level.power_spawn,32);
 expect([classic.Items[0]!.X,classic.Items[0]!.Y]).toEqual([x,y]);expect(classic.RNG).toBe(rng);
 expect(arcadeDrawPlan(classic).some(d=>d.text==='RUN')).toBe(false);
});

renderTest('party randomized powerup has a small green benefit alert in the arena',async({cheat,step,input,world,render})=>{
 input.view(768,720,1);await step(3);await cheat(PartyReset,{wave:1,humans:6,countdown:180});await cheat(PartyPower,{});await step(2);
 expect(session.get().game!.Items.some(i=>i.Power==='pink_candy')).toBe(true);
 const labels=world.all(Text2D).map(row=>row.value).filter(row=>row.visible&&row.text==='RNG');
 expect(labels.length).toBe(1);
 // The host reads Text2D colors back as linear RGBA.
 const color=labels[0]!.color as unknown as number[];
 expect(color[1]).toBe(1);expect(color[0]).toBeLessThan(.3);expect(color[2]).toBeLessThan(.3);
 render.expectDrawCalls('<=',14,{width:768,height:720});render.expectScreenshot('powerup_alert',{width:768,height:720});
},{scene:'scenes/arcade.scene.json'});
