import { worldTest, renderTest, expect } from '@gameengine/test';
import campaign from '../data/levels.json';
import { createPartyGame, partyWaveBudget, preparePartyWave } from '../src/arcade/party';
import { copyGame, stepGame } from '../src/arcade/game';
import { hurtPlayer } from '../src/arcade/player';
import { applyPower } from '../src/arcade/items';
import { EnemyState, State, type PartySlot } from '../src/arcade/types';
import { blocked } from '../src/arcade/physics';
import { DesktopIntent } from '../src/schema.gen';
import { session } from '../src/arcade/session';
import { desktopState } from '../src/desktop/state';
import { PartyReset, PartyClear, PartyVictory } from '../src/arcade/party.cheats';
const idle={Move:0,Jump:false,Fire:false};
const humans:PartySlot[]=Array.from({length:6},()=> 'human');
function game(){return createPartyGame(campaign,42,humans);}
function start(g:ReturnType<typeof game>){for(let i=0;i<180;i++)stepGame(g,[idle]);}
worldTest('party waves six spawn areas and safe preparation',()=>{
 const g=game();expect(g.Players.map(p=>p.X)).toEqual([72,192,312,432,552,672]);
 expect(g.Players.map(p=>p.Skin)).toEqual(['green','blue','red','yellow','purple','orange']);
 const formation=g.Enemies.map(e=>[e.X,e.Y,e.Age]);
 expect(formation.length).toBe(partyWaveBudget(1,6));
 for(const e of g.Enemies)expect(blocked(g,e.X,e.Y,44)).toBe(false);
 for(let i=0;i<179;i++)stepGame(g,[{Move:1,Jump:true,Fire:true}]);
 expect(g.Party!.Phase).toBe('prepare');expect(g.Enemies.map(e=>[e.X,e.Y,e.Age])).toEqual(formation);expect(g.Bubbles.length).toBeGreaterThan(0);expect(g.Enemies.every(e=>e.State===EnemyState.Active)).toBe(true);
 expect(g.Players[0]!.X).toBe(72);expect(g.Players[0]!.Lives).toBe(1);
 stepGame(g,idle);expect(g.Party!.Phase).toBe('combat');expect(g.Party!.ToSpawn).toBe(0);
 stepGame(g,idle);expect(g.Enemies.some((e,i)=>e.X!==formation[i]![0]||e.Y!==formation[i]![1])).toBe(true);
 expect(partyWaveBudget(2,6)).toBeGreaterThan(partyWaveBudget(1,6));
});
worldTest('party waves increase whole formations and mix every unlocked monster type',()=>{
 for(const team of [1,6]) {
  const g=createPartyGame(campaign,42,humans.map((_,i)=>i<team?'human':'empty'));
  let previous=0;
  for(let wave=1;wave<10;wave++) {
   expect(g.Party!.Phase).toBe('prepare');expect(g.Enemies.length).toBe(partyWaveBudget(wave,team));
   expect(g.Enemies.length).toBeGreaterThan(previous);previous=g.Enemies.length;
   expect(new Set(g.Enemies.map(e=>e.Kind)).size).toBe(Math.min(6,wave+1));
   expect(new Set(g.Enemies.map(e=>`${e.X},${e.Y}`)).size).toBe(g.Enemies.length);
   expect(Math.max(...g.Enemies.map(e=>e.X))-Math.min(...g.Enemies.map(e=>e.X))).toBeGreaterThan(300);
   for(const e of g.Enemies)expect(blocked(g,e.X,e.Y,44)).toBe(false);
   start(g);expect(g.Party!.Phase).toBe('combat');expect(g.Party!.ToSpawn).toBe(0);
   g.Enemies=[];stepGame(g,idle);expect(g.Party!.Phase).toBe('rest');
   for(let tick=0;tick<120;tick++)stepGame(g,idle);
  }
 }
});
worldTest('party waves five second break preserves upgrades and recovers downed teammates',()=>{
 const g=game();start(g);g.Players[0]!.Power.Shoes=true;g.Players[1]!.Invincible=0;hurtPlayer(g,1);
 g.Players[1]!.X=650;g.Players[1]!.Y=100;
 g.Party!.ToSpawn=0;g.Party!.Telegraphs=[];g.Enemies=[];
 stepGame(g,idle);expect(g.Party!.Phase).toBe('rest');expect(g.Players[1]!.Downed).toBe(false);
 expect(g.Projectiles.length).toBe(0);const wave=g.Party!.Wave;
 for(let i=0;i<119;i++)stepGame(g,[{Move:0,Jump:false,Fire:true}]);
 expect(g.Party!.Wave).toBe(wave);expect(g.Bubbles.length).toBeGreaterThan(0);
 expect(g.Bubbles.some(b=>b.Age>1)).toBe(true);expect(g.Counters.Blown).toBeGreaterThan(0);
 stepGame(g,idle);expect(g.Party!.Wave).toBe(wave+1);expect(g.Party!.Phase).toBe('prepare');expect(g.Enemies.length).toBe(partyWaveBudget(wave+1,6));expect(g.Players[0]!.Power.Shoes).toBe(true);
 for(let i=0;i<179;i++)stepGame(g,[{Move:0,Jump:false,Fire:true}]);
 expect(g.Party!.Phase).toBe('prepare');stepGame(g,idle);expect(g.Party!.Phase).toBe('combat');
});
worldTest('party waves contact rescue team wipe pause and campaign item isolation',()=>{
 const g=game();start(g);const p=g.Players[1]!;p.Invincible=0;hurtPlayer(g,1);p.X=g.Players[0]!.X+40;p.Y=g.Players[0]!.Y;
 stepGame(g,idle);expect(g.Players[1]!.Downed).toBe(false);expect(g.Players[1]!.Invincible).toBeGreaterThan(0);
 const wave=g.Party!.Wave;applyPower(g,'purple_parasol',0);expect(g.Party!.Wave).toBe(wave);expect(g.State).toBe(State.Playing);
 g.Sounds=[];g.Paused=true;const frozen=JSON.stringify(g);stepGame(g,idle);expect(JSON.stringify(g)).toBe(frozen);g.Paused=false;
 for(let i=0;i<6;i++){g.Players[i]!.Invincible=0;hurtPlayer(g,i);}stepGame(g,idle);expect(g.State).toBe(State.GameOver);
});
worldTest('party waves snapshot isolation includes boss slots telegraphs and bots',()=>{
 const g=game();start(g);g.Party!.Telegraphs=[{X:192,Y:196,Ticks:60}];const a=copyGame(g),b=copyGame(g);a.Party!.Slots[0]='ai';a.Party!.Telegraphs[0]!.Ticks=1;
 expect(g.Party!.Slots[0]).toBe('human');expect(g.Party!.Telegraphs[0]!.Ticks).toBeGreaterThan(1);
 for(let i=0;i<30;i++){stepGame(g,idle);stepGame(b,idle);}expect(JSON.stringify(g)).toBe(JSON.stringify(b));
});
worldTest('party waves lobby starts restarts and leaves through engine intents',async({input,step})=>{
 await step(3);input.emit(DesktopIntent,{action:'party'});await step(1);expect(desktopState.get().screen).toBe('party');
 input.emit(DesktopIntent,{action:'start-party'});await step(1);expect(session.get().game!.Players.length).toBe(10);expect(session.get().game!.Party!.Slots.filter(s=>s==='ai').length).toBe(9);
 input.emit(DesktopIntent,{action:'pause'});await step(1);const tick=session.get().game!.Tick;await step(10);expect(session.get().game!.Tick).toBe(tick);
 input.emit(DesktopIntent,{action:'restart'});await step(1);expect(session.get().game!.Party!.Wave).toBe(1);expect(session.get().game!.Paused).toBe(false);
 input.emit(DesktopIntent,{action:'leave'});await step(1);expect(session.get().active).toBe(false);expect(desktopState.get().screen).toBe('menu');
},{scene:'scenes/arcade.scene.json'});
worldTest('party recorded wave clear rest boss and results',async({cheat,step})=>{
 await cheat(PartyReset,{wave:1,humans:6});await step(2);expect(session.get().game!.Party!.Phase).toBe('combat');
 await cheat(PartyClear,{});await step(1);expect(session.get().game!.Party!.Phase).toBe('rest');
 await step(300);expect(session.get().game!.Party!.Wave).toBe(2);
 await cheat(PartyReset,{wave:10,humans:6});await step(2);expect(session.get().game!.Party!.Phase).toBe('boss');
 await cheat(PartyVictory,{});await step(1);expect(desktopState.get().screen).toBe('result');expect(desktopState.get().won).toBe(true);
},{scene:'scenes/arcade.scene.json'});
renderTest('party wave lobby buttons fit desktop extremes and launch actual game',async({input,step,render,ui})=>{
 await step(3);input.emit(DesktopIntent,{action:'party'});await step(1);
 for(const [w,h] of [[768,720],[1680,720],[640,960]]){input.view(w!,h!,1);await step(1);render.stats({width:w!,height:h!});const buttons=ui.interactables();expect(buttons.length).toBe(12);for(const b of buttons){expect(b.rect.x>=0&&b.rect.y>=0&&b.rect.x+b.rect.width<=w!&&b.rect.y+b.rect.height<=h!).toBe(true);}}
 input.view(768,720,1);await step(1);render.stats({width:768,height:720});render.expectDrawCalls('<=',14,{width:768,height:720});render.expectScreenshot('lobby',{width:768,height:720});
 const start=ui.interactables().find(b=>b.label==='START SURVIVAL')!;await ui.press(start.id!);await step(2);expect(session.get().game!.Party!.Wave).toBe(1);
},{scene:'scenes/arcade.scene.json'});
renderTest('party actual six dragon arena and rest HUD',async({cheat,step,input,render})=>{
 input.view(768,720,1);await step(3);await cheat(PartyReset,{wave:1,humans:6});await step(12);expect(render.probe({width:768,height:720,points:[[1,49]]}).points[0]!.rgba.slice(0,3)).toEqual([36,67,87]);await render.expectScreenshot('six_dragons',{width:768,height:720});
 await cheat(PartyClear,{});await step(2);await render.expectScreenshot('rest',{width:768,height:720});
 await cheat(PartyReset,{wave:10,humans:6});await step(108);await render.expectScreenshot('boss',{width:768,height:720});
},{scene:'scenes/arcade.scene.json'});

renderTest('party whole wave preview and late mixed formation stay within render budget',async({cheat,step,input,render})=>{
 input.view(768,720,1);await step(3);await cheat(PartyReset,{wave:1,humans:6,countdown:180});await step(12);
 expect(session.get().game!.Party!.Phase).toBe('prepare');expect(session.get().game!.Enemies.length).toBe(15);
 render.expectScreenshot('formation_preview',{width:768,height:720});
 await cheat(PartyReset,{wave:9,humans:6,countdown:180});await step(12);
 expect(session.get().game!.Enemies.length).toBe(31);expect(new Set(session.get().game!.Enemies.map(e=>e.Kind)).size).toBe(6);
 render.expectDrawCalls('<=',14,{width:768,height:720});render.expectScreenshot('late_formation',{width:768,height:720});
 await step(180);expect(session.get().game!.Party!.Phase).toBe('combat');
 for(let frame=0;frame<8;frame++){await step(15);render.expectDrawCalls('<=',14,{width:768,height:720});}
},{scene:'scenes/arcade.scene.json'});

declare const __gameengine_host:(op:string,arg:string)=>string;
worldTest('party six actual controllers move separate humans and operate menus',async({cheat,step,input})=>{
 await cheat(PartyReset,{wave:1,humans:6});await step(3);
 const xs=session.get().game!.Players.map(p=>p.X);
 __gameengine_host('test.input',JSON.stringify(Array.from({length:6},(_,pad)=>({type:'gamepadAxis',pad,axis:0,value:pad%2?-1:1}))));
 await step(5);
 const after=session.get().game!.Players.map(p=>p.X);
 for(let i=0;i<6;i++)expect((after[i]!-xs[i]!)*(i%2?-1:1)).toBeGreaterThan(0);
 __gameengine_host('test.input',JSON.stringify([{type:'gamepadButton',pad:5,button:6,down:true}]));await step(1);expect(desktopState.get().screen).toBe('pause');
 const tick=session.get().game!.Tick;await step(4);expect(session.get().game!.Tick).toBe(tick);
 __gameengine_host('test.input',JSON.stringify([{type:'gamepadButton',pad:5,button:0,down:true}]));await step(1);expect(desktopState.get().screen).toBe('play');
 input.emit(DesktopIntent,{action:'leave'});await step(1);input.emit(DesktopIntent,{action:'party'});await step(1);
 // Start on a previously bot-controlled pad joins that exact slot without starting the run.
 __gameengine_host('test.input',JSON.stringify([{type:'gamepadButton',pad:5,button:6,down:false},{type:'gamepadButton',pad:5,button:6,down:true}]));await step(1);
 expect(desktopState.get().partySlots[5]).toBe('human');expect(desktopState.get().screen).toBe('party');
},{scene:'scenes/arcade.scene.json'});

worldTest('party team setup switches humans bots and empty slots without restarting waves',async({input,step})=>{
 await step(3);input.emit(DesktopIntent,{action:'start-party'});await step(2);await step(185);
 const wave=session.get().game!.Party!.Wave;
 input.emit(DesktopIntent,{action:'pause'});await step(1);input.emit(DesktopIntent,{action:'party'});await step(1);
 expect(desktopState.get().partyEditing).toBe(true);
 input.emit(DesktopIntent,{action:'party-slot:1'});await step(1); // AI -> empty
 input.emit(DesktopIntent,{action:'party-slot:2'});await step(1);input.emit(DesktopIntent,{action:'party-slot:2'});await step(1); // AI -> empty -> human
 input.emit(DesktopIntent,{action:'start-party'});await step(2);
 const g=session.get().game!;
 expect(g.Party!.Wave).toBe(wave);expect(g.Paused).toBe(false);expect(g.Party!.Slots[1]).toBe('empty');expect(g.Players[1]!.Lives).toBe(0);expect(g.Companions![1]).toBe(null);
 expect(g.Party!.Slots[2]).toBe('human');expect(g.Companions![2]).toBe(null);
},{scene:'scenes/arcade.scene.json'});

worldTest('party five bots naturally clear a complete wave before the rest',()=>{
 const g=createPartyGame(campaign,42);
 for(let tick=0;tick<9000&&g.Party!.Phase!=='rest';tick++){
   for(const p of g.Players)p.Invincible=2;
   stepGame(g,idle);
 }
 expect(g.Party!.Phase).toBe('rest');expect(g.Party!.ToSpawn).toBe(0);expect(g.Party!.Telegraphs.length).toBe(0);expect(g.Enemies.length).toBe(0);
 expect(g.Counters.Popped).toBeGreaterThan(0);
});

worldTest('party dragon grid navigates rows and columns before configuring and starting',async({input,step})=>{
 await step(3);input.emit(DesktopIntent,{action:'party'});await step(1);expect(desktopState.get().selected).toBe(0);
 input.action('menuX',1);await step(1);expect(desktopState.get().selected).toBe(1);
 input.action('menuX',0);await step(1);input.action('menuY',1);await step(1);expect(desktopState.get().selected).toBe(6);
 input.action('menuY',0);input.action('confirm',1);await step(1);expect(desktopState.get().partySlots[6]).toBe('empty');
 input.action('confirm',0);await step(1);input.action('menuY',1);await step(1);expect(desktopState.get().selected).toBe(11);
 input.action('menuY',0);input.action('menuX',1);await step(1);input.action('menuX',0);input.action('confirm',1);await step(1);expect(session.get().game!.Party!.Slots[6]).toBe('empty');expect(desktopState.get().screen).toBe('play');
},{scene:'scenes/arcade.scene.json'});

renderTest('party dragon cards change their own slot through real pointer presses',async({input,step,ui,render})=>{
 input.view(768,720,1);await step(3);input.emit(DesktopIntent,{action:'party'});await step(2);render.stats({width:768,height:720});
 const cards=ui.interactables().filter(b=>b.rect.height===214);
 expect(cards.length).toBe(10);
 for(let i=0;i<10;i++){
   const card=cards.find(b=>Math.abs(b.rect.x-(24+i%5*146))<1&&Math.abs(b.rect.y-(132+Math.floor(i/5)*230))<1)!;
   expect(!!card).toBe(true);await ui.press(card.id!);await step(1);render.stats({width:768,height:720});
   expect(desktopState.get().partySlots[i]).toBe(i===0?'ai':'empty');
 }
 render.expectScreenshot('open_slots',{width:768,height:720});
},{scene:'scenes/arcade.scene.json'});

worldTest('party dragon grid accepts a controller selecting the pink dragon',async({input,step})=>{
 await step(3);input.emit(DesktopIntent,{action:'party'});await step(1);
 const pad=(events:unknown[])=>__gameengine_host('test.input',JSON.stringify(events));
 pad([{type:'gamepadAxis',pad:5,axis:0,value:1}]);await step(1);
 pad([{type:'gamepadAxis',pad:5,axis:0,value:0},{type:'gamepadAxis',pad:5,axis:1,value:1}]);await step(1);
 pad([{type:'gamepadAxis',pad:5,axis:1,value:0},{type:'gamepadAxis',pad:5,axis:0,value:1}]);await step(1);
 expect(desktopState.get().selected).toBe(7);
 pad([{type:'gamepadAxis',pad:5,axis:0,value:0},{type:'gamepadButton',pad:5,button:0,down:true}]);await step(1);
 expect(desktopState.get().partySlots[7]).toBe('empty');expect(desktopState.get().partySlots[4]).toBe('ai');
},{scene:'scenes/arcade.scene.json'});
