import { worldTest, renderTest, expect } from '@gameengine/test';
import { DesktopIntent } from '../src/schema.gen';
import campaign from '../data/levels.json';
import { createPartyGame, preparePartyWave, partyWaveBudget } from '../src/arcade/party';
import { partyColors, partyNames, partySize } from '../src/arcade/party-config';
import { buildCompanionGraph } from '../src/arcade/companion';
import { stepGame, copyGame } from '../src/arcade/game';
import { blocked } from '../src/arcade/physics';
import { createPartyPads, reducePartyPadInput, readPartyAction, partyPads } from '../src/arcade/party-input';
import { dragonBadges } from '../src/arcade/juice';
import { arcadeDrawPlan } from '../src/arcade/presentation';
import { ensureThunderPickups } from '../src/arcade/boss';
import { hurtPlayer } from '../src/arcade/player';
import { PartyReset, PartyHit, PartyProtect } from '../src/arcade/party.cheats';
import { desktopState } from '../src/desktop/state';
import { partyCardRect, partyGridSelection } from '../src/desktop/layout';
import { session } from '../src/arcade/session';
import type { PartySlot } from '../src/arcade/types';
const idle={Move:0,Jump:false,Fire:false};
const humans:PartySlot[]=partyColors.map(()=> 'human');
const scene='scenes/arcade.scene.json';
declare const __gameengine_host:(op:string,arg:string)=>string;
const inject=(events:unknown[])=>__gameengine_host('test.input',JSON.stringify(events));

worldTest('ten dragons spawn safely on two tiers without modifying campaign geometry',()=>{
 const before=JSON.stringify(campaign[0]);const g=createPartyGame(campaign,42,humans);
 expect(g.Players.length).toBe(10);expect(g.Players.map(p=>p.Skin)).toEqual([...partyColors]);
 expect(new Set(g.Players.map(p=>p.Y)).size).toBe(2);
 expect(new Set(g.Players.map(p=>`${p.X},${p.Y}`)).size).toBe(10);
 for(const p of g.Players){expect(blocked(g,p.X,p.Y,44)).toBe(false);expect(blocked(g,p.X,p.Y+1,44)).toBe(true);}
 for(let wave=1;wave<=9;wave++){
  g.Party!.Wave=wave;preparePartyWave(g);
  expect(g.Enemies.length).toBe(partyWaveBudget(wave,10));expect(g.Enemies.length).toBeLessThanOrEqual(32);
  expect(new Set(g.Enemies.map(e=>`${e.X},${e.Y}`)).size).toBe(g.Enemies.length);
  for(const e of g.Enemies){
   expect(blocked(g,e.X,e.Y,44)).toBe(false);
   expect(g.Players.some(p=>Math.abs(p.X-e.X)<44&&Math.abs(p.Y-e.Y)<44)).toBe(false);
  }
 }
 expect(partyWaveBudget(1,10)).toBe(17);expect(partyWaveBudget(5,10)).toBe(25);expect(partyWaveBudget(9,10)).toBe(32);
 expect(JSON.stringify(campaign[0])).toBe(before);
 const six=createPartyGame(campaign,42,humans.slice(0,6));expect(six.Level.tiles).toEqual(campaign[0]!.tiles);
});
worldTest('ten arena every platform is reachable from every start without upgrades',()=>{
 const g=createPartyGame(campaign,42,humans),graph=buildCompanionGraph(g,g.PlayerBalance!.MoveSpeed,0);
 for(const p of g.Players){
  expect(p.Power.Shoes).toBe(false);
  const first=graph.Nodes.findIndex(n=>n.Y===p.Y&&Math.abs(n.X-p.X)<=24);expect(first).toBeGreaterThanOrEqual(0);
  const seen=new Set([first]),queue=[first];
  for(let at=0;at<queue.length;at++)for(const edge of graph.Nodes[queue[at]!]!.Links)if(!seen.has(edge.To)){seen.add(edge.To);queue.push(edge.To);}
  expect(seen.size).toBe(graph.Nodes.length);
 }
});
worldTest('ten dragon identities remain unique in grayscale and blinking presentation',()=>{
 const g=createPartyGame(campaign,42,humans);
 for(let i=0;i<10;i++){
  Object.assign(g.Players[i]!,{X:340,Y:400,Invincible:6});
 }
 expect(new Set(partyNames).size).toBe(10);
 const badges=dragonBadges(g);expect(badges.map(b=>b.text)).toEqual([...partyNames]);
 for(let i=0;i<badges.length;i++)for(let j=i+1;j<badges.length;j++){
  const a=badges[i]!,b=badges[j]!;
  expect(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y).toBe(false);
 }
 const plan=arcadeDrawPlan(g);
 for(const name of partyNames){
  const above=plan.find(d=>!d.footer&&d.text===name)!,roster=plan.find(d=>d.footer&&d.text===name)!;
  expect(above.color).toEqual(roster.color);
 }
 expect(plan.some(d=>/^P(?:[1-9]|10)(?: |$)/.test(d.text))).toBe(false);expect(plan.filter(d=>!d.footer&&d.text==='FLINT').length).toBe(1);
 expect(plan.filter(d=>d.footer&&d.text==='FLINT').length).toBe(1);
 for(const b of badges){expect(b.y).toBeGreaterThanOrEqual(64);expect(b.y+b.h).toBeLessThanOrEqual(656);}
});
worldTest('dragon names are text only and disappear when the wave starts while rescue calls remain',()=>{
 const g=createPartyGame(campaign,42,humans);g.Party!.Timer=2;
 const badges=dragonBadges(g),plan=arcadeDrawPlan(g);
 expect(badges.length).toBe(10);
 for(const b of badges){
  expect(plan.some(d=>!d.footer&&d.text===b.text&&d.x===b.x)).toBe(true);
  expect(plan.some(d=>d.image.startsWith('solid/')&&d.x===b.x&&d.y===b.y&&d.w===b.w)).toBe(false);
 }
 stepGame(g,[idle]);expect(dragonBadges(g).length).toBe(10);
 stepGame(g,[idle]);expect(g.Party!.Phase).toBe('combat');expect(dragonBadges(g).length).toBe(0);
 expect(arcadeDrawPlan(g).filter(d=>!d.footer&&partyNames.some(name=>d.text===name)).length).toBe(0);
 expect(arcadeDrawPlan(g).filter(d=>d.footer&&partyNames.some(name=>d.text===name)).length).toBe(10);
 g.Players[9]!.Invincible=0;hurtPlayer(g,9);
 expect(dragonBadges(g).map(b=>b.text)).toEqual(['FLINT HELP']);
 const rescue=arcadeDrawPlan(g).filter(d=>d.text==='FLINT HELP');
 expect(rescue.length).toBe(2);for(const d of rescue)expect(d.color).toEqual([110,135,165]);
 g.Players[0]!.X=g.Players[9]!.X;g.Players[0]!.Y=g.Players[9]!.Y;stepGame(g,[idle]);
 expect(g.Players[9]!.Downed).toBe(false);expect(dragonBadges(g).length).toBe(0);
 preparePartyWave(g);expect(dragonBadges(g).length).toBe(10);
});
worldTest('ten named actions reject malformed suffixes and pad ten stays isolated',async({step,input})=>{
 await step(3);
 for(let slot=0;slot<10;slot++){
  expect(readPartyAction(`partyFire${slot+1}`,1,true,true)!.slot).toBe(slot);
  inject([{type:'gamepadAxis',pad:slot,axis:0,value:1}]);await step(1);
  expect(partyPads.get().pads.map(p=>p.axis)).toEqual(Array.from({length:10},(_,i)=>i===slot?1:0));
  const g=reducePartyPadInput(createPartyPads(),[{type:'gamepadButton',pad:slot,button:2,down:true}]);
  expect(g.inputs.filter(i=>i.Fire).length).toBe(1);expect(g.inputs[slot]!.Fire).toBe(true);
  inject([{type:'gamepadAxis',pad:slot,axis:0,value:0}]);await step(1);
 }
 for(const suffix of ['0','11','01','1x','1.0','+1',''])expect(readPartyAction('partyMove'+suffix,1,true,true)).toBe(null);
 input.emit(DesktopIntent,{action:'party'});await step(1);
 inject([{type:'gamepadButton',pad:9,button:6,down:true}]);await step(1);
 expect(desktopState.get().partySlots[9]).toBe('human');
 input.emit(DesktopIntent,{action:'start-party'});await step(2);
 await step(session.get().game!.Party!.Timer);
 const before=session.get().game!.Players.map(p=>p.X);
 inject([{type:'gamepadAxis',pad:9,axis:0,value:-1},{type:'gamepadButton',pad:9,button:2,down:true}]);await step(3);
 expect(session.get().game!.Players[9]!.X).toBeLessThan(before[9]!);
 expect(session.get().game!.Bubbles.some(b=>b.Shooter===9)).toBe(true);
},{scene});
worldTest('ten boss pickups cover both tiers and every last survivor can rescue',()=>{
 const g=createPartyGame(campaign,42,humans);g.Party!.Wave=10;preparePartyWave(g);
 for(const p of g.Players)p.Power.Thunder=false;
 g.Items=[];ensureThunderPickups(g);expect(g.Items.length).toBe(10);
 const enemy=createPartyGame(campaign,43,humans).Enemies[0]!;
 expect(new Set(g.Items.map(i=>`${i.X},${i.Y}`)).size).toBe(10);
 expect(new Set(g.Items.map(i=>i.Y)).size).toBe(2);
 for(let survivor=0;survivor<10;survivor++){
  const v=copyGame(g);v.Party!.Phase='combat';delete v.Party!.Boss;v.Enemies=[{...enemy,X:360,Y:24}];
  for(let i=0;i<10;i++)if(i!==survivor){v.Players[i]!.Invincible=0;hurtPlayer(v,i);}
  const other=(survivor+1)%10;v.Players[survivor]!.X=v.Players[other]!.X;v.Players[survivor]!.Y=v.Players[other]!.Y;
  stepGame(v,[idle]);expect(v.Players[other]!.Downed).toBe(false);expect(v.Party!.Phase).toBe('combat');expect(v.Players.filter(p=>p.Downed).length).toBe(8);
 }
});
worldTest('ten bot snapshots stay deterministic through busy late wave combat',()=>{
 const a=createPartyGame(campaign,42);a.Party!.Wave=9;preparePartyWave(a);a.Party!.Timer=1;
 const b=copyGame(a);
 for(let tick=0;tick<600;tick++)for(const g of [a,b]){for(const p of g.Players)p.Invincible=2;stepGame(g,idle);}
 expect(JSON.stringify(a)).toBe(JSON.stringify(b));expect(a.Bubbles.length).toBeLessThanOrEqual(160);
 expect(a.Companions!.filter(Boolean).length).toBe(9);
});
renderTest('ten dragon lobby all real cards and portraits fit native wide and tall screens',async({input,step,ui,render})=>{
 for(const [width,height] of [[768,720],[1680,720],[640,960]]){
  input.view(width!,height!,1);await step(3);input.emit(DesktopIntent,{action:'party'});await step(2);
  render.stats({width:width!,height:height!});
  const cards=ui.interactables().filter(b=>b.id?.includes('dragon-'));
  expect(cards.length).toBe(10);
  for(const c of cards){expect(c.rect.x).toBeGreaterThanOrEqual(0);expect(c.rect.y).toBeGreaterThanOrEqual(0);expect(c.rect.x+c.rect.width).toBeLessThanOrEqual(width!+1);expect(c.rect.y+c.rect.height).toBeLessThanOrEqual(height!+1);}
  render.expectScreenshot(`lobby_${width}x${height}`,{width:width!,height:height!});
 }
 input.view(768,720,1);await step(2);render.stats({width:768,height:720});
 for(let i=0;i<10;i++){
  const r=partyCardRect(i);const c=ui.interactables().find(b=>Math.abs(b.rect.x-r.x)<1&&Math.abs(b.rect.y-r.y)<1)!;
  await ui.press(c.id!);await step(1);expect(desktopState.get().partySlots[i]).toBe(i===0?'ai':'empty');
 }
 input.emit(DesktopIntent,{action:'party-join',index:9});await step(1);
 render.expectScreenshot('p10_human_label',{width:768,height:720});
 expect(partyGridSelection(9,0,1)).toBe(partySize);expect(partyGridSelection(9,1,0)).toBe(5);
},{scene});
renderTest('ten dragons firing and rescue remain bounded on phone low',async({cheat,input,step,render})=>{
 input.view(768,720,1);await step(3);await cheat(PartyReset,{team:10,humans:10,wave:9,countdown:180});await step(2);
 render.expectScreenshot('arena_prepare',{width:768,height:720});
 await step(180);await cheat(PartyProtect,{});await step(1);
 inject(Array.from({length:10},(_,pad)=>({type:'gamepadButton',pad,button:2,down:true})));
 let peak=0,shots=0;const owners=new Set<number>();
 for(let i=0;i<20;i++){
  await step(15);for(const b of session.get().game!.Bubbles)if(b.Shooter!==undefined)owners.add(b.Shooter);peak=Math.max(peak,render.stats({width:768,height:720}).drawCalls);shots=Math.max(shots,session.get().game!.Bubbles.length);
 }
 expect(owners.size).toBe(10);expect(peak).toBeLessThanOrEqual(14);expect(shots).toBeGreaterThan(0);expect(shots).toBeLessThanOrEqual(160);
 render.expectScreenshot('arena_firing',{width:768,height:720});
 await cheat(PartyHit,{slot:9});await step(1);render.expectScreenshot('ivory_slate_rescue',{width:768,height:720});
 await cheat(PartyReset,{team:10,humans:10,wave:10,countdown:1});await step(2);await cheat(PartyProtect,{});await step(1);
 for(let i=0;i<20;i++){
  await step(15);for(const b of session.get().game!.Bubbles)if(b.Shooter!==undefined)owners.add(b.Shooter);peak=Math.max(peak,render.stats({width:768,height:720}).drawCalls);shots=Math.max(shots,session.get().game!.Bubbles.length);
 }
 expect(peak).toBeLessThanOrEqual(14);expect(shots).toBeLessThanOrEqual(160);
 render.expectScreenshot('ten_boss_firing',{width:768,height:720});
 console.log(`Ten-dragon late wave: peak ${peak} draw calls, ${shots} bubbles`);
},{scene,memory:'phone-low'});
