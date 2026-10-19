import { partyNames } from '../src/arcade/party-config';
import { worldTest, renderTest, expect } from '@gameengine/test';
import { WorldView, ViewInfo } from '@gameengine/runtime';
import campaign from '../data/levels.json';
import { buildCompanionGraph, warmPartyNavigation, companionInput } from '../src/arcade/companion';
import { copyGame, stepGame, createGame, validateLevel } from '../src/arcade/game';
import { createPartyGame, preparePartyWave } from '../src/arcade/party';
import { arenaWidth, arenaHeight, body } from '../src/arcade/types';
import { movePlayer, moveFlying, startPlayerJump } from '../src/arcade/physics';
import { bubble, updateBubbles } from '../src/arcade/bubbles';
import { spawnFood, checkPowerSpawns } from '../src/arcade/items';
import { updateProjectiles } from '../src/arcade/enemies';
import { stepBoss } from '../src/arcade/boss';
import { arenaLayout } from '../src/arcade/arena-layout';
import { sceneDraws } from '../src/arcade/presentation';
import { PartyReset } from '../src/arcade/party.cheats';
import { session } from '../src/arcade/session';
import { orderedArrays,orderedCapacity } from '../src/arcade/pixel-renderer/ordered';
const scene='scenes/arcade.scene.json',idle={Move:0,Jump:false,Fire:false};
worldTest('courtyard has 44 columns and 30 rows while campaign retains original bounds',()=>{
 const g=createPartyGame(campaign,42);expect(arenaWidth(g)).toBe(1056);expect(arenaHeight(g)).toBe(720);
 expect(g.Level.tiles.length).toBe(30);expect(g.Level.tiles.every(row=>row.length===44)).toBe(true);validateLevel(g.Level);
 const classic=createGame(campaign,42);expect(arenaWidth(classic)).toBe(768);expect(arenaHeight(classic)).toBe(624);
 const changed={...campaign[0]!,tiles:g.Level.tiles};let rejected=false;
 try{validateLevel(changed);}catch{rejected=true;}expect(rejected).toBe(true);
});
worldTest('courtyard dragons enemies bubbles and bottles use the extra right and bottom space',()=>{
 const g=createPartyGame(campaign,42),p=g.Players[0]!;
 Object.assign(p,{X:900,Y:640,VY:3,Ground:false});movePlayer(g,p,3);
 expect(p.X).toBeGreaterThan(768);expect(p.Y).toBeGreaterThan(624);expect(p.Y).toBeLessThanOrEqual(652);
 Object.assign(p,{X:964,Y:652,VY:0,Ground:true});movePlayer(g,p,20);expect(p.X).toBe(964);
 const e=g.Enemies.find(e=>e.Kind==='monsta')!;Object.assign(e,{X:950,Y:640,Vertical:1});moveFlying(g,e,3,2);expect(e.X).toBe(953);expect(e.Y).toBeCloseTo(642,8);
 g.Enemies=[];g.Bubbles=[{...bubble(900,380),Floating:true,Age:40}];updateBubbles(g,[idle]);expect(g.Bubbles[0]!.X).toBeGreaterThan(850);
 g.Projectiles=[{...body(900,640),VX:1,VY:1,Bottle:true,Laser:false,Age:0,Removed:false}];updateProjectiles(g);expect(g.Projectiles.length).toBe(1);
 g.Projectiles[0]!.X=1009;updateProjectiles(g);expect(g.Projectiles.length).toBe(0);
});
worldTest('courtyard rewards and boss patrol cover the larger arena',()=>{
 const g=createPartyGame(campaign,42);spawnFood(g,950,660);expect(g.Items[0]!.X).toBe(950);expect(g.Items[0]!.Y).toBe(660);
 const locations=new Set<number>();
 for(let i=0;i<80;i++){g.Items=[];g.Pending=['pink_candy'];checkPowerSpawns(g);if(g.Items[0])locations.add(g.Items[0]!.X);}
 expect([...locations].some(x=>x>768)).toBe(true);
 g.Party!.Wave=10;preparePartyWave(g);g.Party!.Phase='boss';const b=g.Party!.Boss!;
 Object.assign(b,{X:912,Y:600,VX:2.25,VY:2.25,Timer:150});stepBoss(g);
 expect(b.X).toBe(912);expect(b.Y).toBe(600);expect(b.VX<0&&b.VY<0).toBe(true);
 b.Mode='captured';b.Timer=0;b.Y=590;stepBoss(g);expect(b.Y).toBeGreaterThan(590);
});
worldTest('courtyard fit preserves readable badges and uses wide windows without clipping geometry',()=>{
 const g=createPartyGame(campaign,42),p=g.Players[0]!;
 Object.assign(p,{X:14*24,Y:4*24-44,Ground:true,VY:0});startPlayerJump(g,p);
 let highest=p.Y;for(let tick=0;tick<60;tick++){movePlayer(g,p,0);highest=Math.min(highest,p.Y);}
 for(const [width,height] of [[768,720],[1680,720],[640,960],[2560,1080]]){
  const view={width:width!,height:height!,safeArea:[0,0,0,0]},l=arenaLayout(g.Level,view);
  const unit=Math.max(768/width!,720/height!);
  const left=384-width!*unit/2,right=384+width!*unit/2;
  expect(l.x).toBeGreaterThanOrEqual(left);expect(l.x+1056*l.scale).toBeLessThanOrEqual(right);
  expect(l.y+highest*l.scale).toBeGreaterThanOrEqual(48);expect(l.y+720*l.scale).toBeLessThanOrEqual(672.01);
 }
 expect(arenaLayout(g.Level,{width:1680,height:720,safeArea:[0,0,0,0]}).scale).toBeGreaterThan(arenaLayout(g.Level).scale);
 const q=[{image:'solid/#00ff00',x:-60,y:100,w:30,h:30},{image:'solid/#ff0000',x:800,y:100,w:30,h:30}];
 const clip={left:-74,top:0,right:842,bottom:720};expect(orderedCapacity(q,clip)).toBe(2);
 const a=orderedArrays(q,1,0,0,clip);expect(a.vertices).toBe(8);expect(a.arrays.positions[0]).toBe(-60);
});
worldTest('courtyard navigation warms bounded batches without mutating earlier snapshots',()=>{
 const g=createPartyGame(campaign,42),x=g.Players[0]!.X;
 stepGame(g,[{...idle,Move:1}]);expect(g.Players[0]!.X).toBe(x);
 const partial=g.Companions![1]!.Graph!;expect(partial.BuildIndex).toBe(4);
 g.Party!.Phase='combat';const bot=g.Players[1]!;bot.Dir=1;g.Enemies=[{...g.Enemies[0]!,X:bot.X+100,Y:bot.Y}];
 expect(companionInput(g,1).Fire).toBe(true);expect(partial.BuildIndex).toBe(4);
 const before=JSON.stringify(g),a=copyGame(g),b=copyGame(g);
 warmPartyNavigation(a);expect(a.Companions![1]!.Graph!.BuildIndex).toBe(8);expect(JSON.stringify(g)).toBe(before);
 warmPartyNavigation(b);expect(JSON.stringify(a)).toBe(JSON.stringify(b));
 let ticks=0;
 while(a.Companions![1]!.Graph!.BuildIndex!==undefined&&ticks++<180)warmPartyNavigation(a);
 expect(ticks).toBeLessThan(180);
 const graph=a.Companions![1]!.Graph!;
 expect(graph).toEqual(buildCompanionGraph(a,a.PlayerBalance.MoveSpeed,1));
 for(const ai of a.Companions!.filter(Boolean))expect(ai!.Graph===graph).toBe(true);
 // A rescued bot may retain an older partial snapshot; it must not roll back ready teammates.
 a.Companions![1]!.Graph=partial;warmPartyNavigation(a);expect(a.Companions![1]!.Graph===graph).toBe(true);
 a.Players[2]!.Power.Shoes=true;const normal=JSON.stringify(graph);warmPartyNavigation(a);
 expect(a.Companions![2]!.Graph!.BuildIndex).toBe(4);expect(JSON.stringify(a.Companions![1]!.Graph)).toBe(normal);
 while(a.Companions![2]!.Graph!.BuildIndex!==undefined)warmPartyNavigation(a);
 expect(a.Companions![2]!.Graph).toEqual(buildCompanionGraph(a,a.PlayerBalance.ShoesSpeed,2));
});
renderTest('courtyard full arena and ten identities fit native wide tall and ultrawide windows',async({cheat,step,input,world,render})=>{
 for(const [width,height] of [[768,720],[1680,720],[640,960],[2560,1080]]){
  input.view(width!,height!,1);await step(3);await cheat(PartyReset,{team:10,humans:10,wave:1,countdown:90});await step(3);
  const before=JSON.stringify(session.get().game),view=world.resource(ViewInfo),plan=sceneDraws(0,undefined,view);
  expect(JSON.stringify(session.get().game)).toBe(before);
  expect(plan.texts.filter(d=>!d.footer&&partyNames.some(name=>name===d.text)).length).toBe(10);
  const enemies=plan.images.filter(d=>d.image.startsWith('reference/zenchan/')||d.image.startsWith('reference/monsta/'));
  expect(enemies.length).toBe(17);for(const e of enemies)expect(e.y).toBeGreaterThanOrEqual(124);
  for(const d of plan.texts.filter(d=>!d.footer&&partyNames.some(name=>name===d.text))){expect(d.size).toBeGreaterThanOrEqual(9.9);expect(d.y).toBeLessThan(672);}
  const native=world.resource(WorldView);expect(native.center).toEqual([384,360]);
  const g=session.get().game!,layout=arenaLayout(g.Level,view),unit=Math.max(768/width!,720/height!);
  // Probe both outer walls: the pixel compositor must draw the wide-window gutters.
  const points=[layout.x+12*layout.scale,layout.x+1044*layout.scale].map(x=>[Math.floor((x-384)/unit+width!/2),Math.floor((layout.y+350*layout.scale-360)/unit+height!/2)] as [number,number]);
  const pixels=render.probe({width:width!,height:height!,points}).points;
  // Installed desktop/mobile tiers quantize the wall channels slightly differently.
  for(const p of pixels)for(let channel=0;channel<3;channel++)expect(Math.abs(p.rgba[channel]!-[36,67,87][channel]!)).toBeLessThanOrEqual(3);
  expect(pixels[0]!.rgba).toEqual(pixels[1]!.rgba);
  render.expectDrawCalls('<=',14,{width:width!,height:height!});
  render.expectScreenshot(`courtyard_${width}x${height}`,{width:width!,height:height!});
 }
},{scene,memory:'phone-low'});
