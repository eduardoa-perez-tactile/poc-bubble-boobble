import { expect, worldTest, renderTest } from '@gameengine/test';
import { TextInput, Time } from '@gameengine/runtime';
import { ResetArcade } from '../src/arcade/arcade.cheats.ts';
import { DesktopIntent } from '../src/schema.gen.ts';
import { desktopState, desktopGameRequest, desktopSaveState, desktopSave, initialDesktopSave, paintLevel, validateLevel, cloneLevel, validateName, desktopModel, initialDesktopState, menuBubble } from '../src/desktop/index.ts';
import levels from '../data/levels.json';
import type { Level } from '../src/arcade/types.ts';
const scene='scenes/arcade.scene.json';
worldTest('desktop profile validation, slots and stable leaderboard statistics',async()=>{
 let s=initialDesktopSave;
 for(let i=1;i<=7;i++){const r=desktopSave.apply(s,'create',`P${i}`);expect(r.ok).toBe(true);if(r.ok)s=r.state;}
 expect(s.profiles.length).toBe(8);
 expect(desktopSave.apply(s,'create','NINTH').ok).toBe(false);
 expect(desktopSave.apply(initialDesktopSave,'create','player1').ok).toBe(false);
 const reason=(name:string)=>{const r=desktopSave.apply(initialDesktopSave,'create',name);return r.ok?'':r.reason;};
 expect(reason('')).toBe('use 1 to 16 characters');
 expect(reason('12345678901234567')).toBe('use 1 to 16 characters');
 expect(reason('BAD!')).toBe('use letters, numbers, spaces, - or _');
 expect(reason('ß')).toBe('use letters, numbers, spaces, - or _');
 expect(validateName('É'.repeat(9))).toBe('use 1 to 16 characters');
 expect(desktopModel({...initialDesktopState,status:'use 1 to 16 characters'},initialDesktopSave).status).toBe('USE 1 TO 16 CHARACTERS');
 expect(desktopSave.apply(initialDesktopSave,'create','12345678901234567').ok).toBe(false);
 const loss=desktopSave.apply(initialDesktopSave,'record',{won:false,score:100,round:3});expect(loss.ok).toBe(true);if(!loss.ok)return;
 const win=desktopSave.apply(loss.state,'record',{won:true,score:90,round:1});expect(win.ok).toBe(true);if(!win.ok)return;
 expect(win.state.profiles[0]!.xp).toBe(100);expect(win.state.profiles[0]!.played).toBe(2);expect(win.state.profiles[0]!.high_score).toBe(100);expect(win.state.profiles[0]!.best_round).toBe(25);expect(win.state.profiles[0]!.won).toBe(1);expect(win.state.profiles[0]!.lost).toBe(1);
},{scene});
worldTest('desktop recorded intents create profiles and change settings',async({input,step})=>{
 await step(5);expect(desktopSaveState.loaded()).toBe(true);
 input.emit(DesktopIntent,{action:'new-profile'});await step(1);
 input.emit(DesktopIntent,{action:'name',value:' BUB '});await step(1);
 input.emit(DesktopIntent,{action:'create-profile'});await step(1);
 expect(desktopSaveState.get().profiles[1]!.name).toBe('BUB');expect(desktopSaveState.get().active).toBe(1);
 input.emit(DesktopIntent,{action:'avatar'});await step(1);expect(desktopSaveState.get().profiles[1]!.avatar).toBe('blue');
 input.emit(DesktopIntent,{action:'music',index:-1});await step(1);expect(desktopSaveState.get().settings.music).toBe(25);
 input.emit(DesktopIntent,{action:'profile:0'});await step(1);expect(desktopSaveState.get().active).toBe(0);expect(desktopState.get().screen).toBe('menu');
},{scene});
worldTest('desktop editor exact feet coordinates, closed walls and validation',async()=>{
 const source=levels[0] as Level;const wall=paintLevel(source,0,5,1);expect(wall).toBe(source);
 const player=paintLevel(source,4,10,2);expect(player.player.row).toBe(12);expect(player.player.col).toBe(4);expect(source.player.row===12&&source.player.col===4).toBe(false);
 const blank=cloneLevel(source);blank.enemies=[];expect(validateLevel(blank)).toBe('place between 1 and 32 enemies');
 const add=paintLevel(blank,8,5,5);expect(add.enemies[0]!.kind).toBe('zenchan');expect(add.enemies[0]!.row).toBe(7);expect(validateLevel(add)).toBe('');
 expect(paintLevel(add,8,5,1).enemies.length).toBe(0);
},{scene});
worldTest('desktop editor copy, undo, save/load and playtest requests',async({input,step})=>{
 await step(5);
 input.emit(DesktopIntent,{action:'editor'});await step(1);
 input.emit(DesktopIntent,{action:'template-next'});input.emit(DesktopIntent,{action:'template'});await step(1);expect(desktopState.get().level.number).toBe(2);
 input.emit(DesktopIntent,{action:'paint',x:8,y:8});await step(1);expect(desktopState.get().level.tiles[8]![8]).toBe(2);
 input.emit(DesktopIntent,{action:'undo'});await step(1);expect(desktopState.get().level.tiles).toEqual((levels[1] as Level).tiles);
 input.emit(DesktopIntent,{action:'save-level'});await step(1);expect(desktopSaveState.get().custom_level!.number).toBe(2);
 input.emit(DesktopIntent,{action:'new'});await step(1);expect(desktopState.get().level.enemies.length).toBe(0);
 input.emit(DesktopIntent,{action:'test-level'});await step(1);expect(desktopState.get().status).toBe('place between 1 and 32 enemies');
 input.emit(DesktopIntent,{action:'load-level'});await step(1);input.emit(DesktopIntent,{action:'test-level'});await step(1);
 expect(desktopGameRequest.get().action).toBe('playtest');expect(desktopGameRequest.get().customLevel!.number).toBe(2);expect(desktopState.get().screen).toBe('play');
},{scene});
worldTest('desktop save envelope round trip and background flush',async({input,step,app,services})=>{
 await step(5);expect(desktopSaveState.loaded()).toBe(true);
 input.emit(DesktopIntent,{action:'new-profile'});await step(1);input.emit(DesktopIntent,{action:'name',value:'SAVED'});await step(1);input.emit(DesktopIntent,{action:'create-profile'});await step(1);
 const state=desktopSaveState.get();const loaded=desktopSave.load(JSON.parse(JSON.stringify(desktopSave.store(state))));expect(loaded.profiles[1]!.name).toBe('SAVED');expect(loaded.active).toBe(1);
 app.background();await step(1);expect(services.calls('storage.write').length).toBeGreaterThan(0);
 let rejected=false;try{desktopSave.load({v:999,state});}catch{rejected=true;}expect(rejected).toBe(true);
},{scene});
worldTest('desktop new profile keyboard back and repeated deletion',async({input,step})=>{
 await step(5);input.emit(DesktopIntent,{action:'new-profile'});await step(1);input.emit(DesktopIntent,{action:'name',value:'ABCDE'});await step(1);
 input.emit(TextInput,{text:'ß'});await step(1);expect(desktopState.get().name).toBe('ABCDE');
 for(let i=0;i<34;i++){input.action('delete',1);await step(1);}expect(desktopState.get().name).toBe('ABC');
 input.action('delete',0);input.action('back',1);await step(1);expect(desktopState.get().screen).toBe('profiles');
},{scene});

renderTest('desktop account buttons match reference hit rectangles',async({input,step,render,ui})=>{
 input.view(768,720,1);await step(5);input.emit(DesktopIntent,{action:'profiles'});await step(1);render.stats({width:768,height:720});
 const profile=ui.interactables().find(b=>b.label==='* PLAYER1')!;expect(profile.rect.x).toBe(164);expect(profile.rect.y).toBe(132);expect(profile.rect.width).toBe(440);expect(profile.rect.height).toBe(36);
 const create=ui.interactables().find(b=>b.label==='NEW PROFILE')!;expect(create.rect.x).toBe(164);expect(create.rect.y).toBe(532);expect(create.id!==null).toBe(true);await ui.press(create.id!);await step(1);render.stats({width:768,height:720});
 const keys=ui.interactables();for(const [label,x,y,width] of [['A',104,252,48],['J',608,252,48],['4',104,396,48],['SPACE',440,396,104],['DEL',552,396,104],['CREATE PROFILE',164,520,440],['CANCEL',164,570,440]] as const){const b=keys.find(b=>b.label===label)!;expect(b.rect.x).toBe(x);expect(b.rect.y).toBe(y);expect(b.rect.width).toBe(width);expect(b.rect.height).toBe(38);}
 const key=keys.find(b=>b.label==='B')!;await ui.press(key.id!);await step(1);expect(desktopState.get().name).toBe('B');expect(desktopState.get().selected).toBe(1);
 render.expectScreenshot('name',{width:768,height:720});
 await ui.press(keys.find(b=>b.label==='DEL')!.id!);await step(1);await ui.press(keys.find(b=>b.label==='CREATE PROFILE')!.id!);await step(1);
 expect(desktopState.get().status).toBe('use 1 to 16 characters');
 const model=desktopModel(desktopState.get(),desktopSaveState.get(),0,false);
 expect(model.buttons.find(b=>b.key==='create-profile')!.selected).toBe(true);
 expect(model.keys.find(b=>b.key==='delete-char')!.selected).toBe(false);
 render.expectScreenshot('invalid-name',{width:768,height:720});
},{scene});
renderTest('desktop title animation uses reference global phase and wraps',async({input,step,render,ui,world})=>{
 input.view(768,720,1);await step(5);render.stats({width:768,height:720});const b=menuBubble(1,world.resource(Time).step);const first=render.probe({width:768,height:720,points:[[b.x+b.radius,b.y]]}).points[0]!.rgba;expect(first[1]).toBeGreaterThan(12);
 await step(60);render.stats({width:768,height:720});const moved=menuBubble(1,world.resource(Time).step);const later=render.probe({width:768,height:720,points:[[b.x+b.radius,b.y],[moved.x+moved.radius,moved.y]]}).points;expect(later[0]!.rgba).toEqual([8,12,27,255]);expect(later[1]!.rgba).toEqual(first);
 input.emit(DesktopIntent,{action:'menu'});await step(1);render.stats({width:768,height:720});const start=ui.interactables().find(b=>b.label==='START GAME')!;expect(start.rect.x).toBe(218);expect(start.rect.y).toBe(328);expect(start.rect.width).toBe(332);expect(start.rect.height).toBe(44);
 render.expectScreenshot('menu',{width:768,height:720});
},{scene});

// Engine physical key codes observed through ActionState: letters A=1..Z=26,
// Ctrl L/R=44/45, Meta L/R=48/49 and F5=58. These tests use raw key events,
// not injected semantic actions, to prove the real input.json path.
for(const [modifier,label] of [[44,'ControlLeft'],[45,'ControlRight'],[48,'MetaLeft'],[49,'MetaRight']] as const){
 worldTest(`desktop editor physical ${label} undo save and F5`,async({input,step})=>{
  await step(5);input.emit(DesktopIntent,{action:'editor'});await step(1);
  const before=desktopState.get().level.tiles[5]![5];input.emit(DesktopIntent,{action:'paint',x:5,y:5});await step(1);expect(desktopState.get().history.length).toBe(1);
  input.key(26,true);await step(1);expect(desktopState.get().history.length).toBe(1);input.key(26,false);await step(1);
  input.key(19,true);await step(1);expect(desktopSaveState.get().custom_level).toBe(null);expect(desktopState.get().selected).toBe(0);input.key(19,false);await step(1);
  input.key(modifier,true);await step(1);input.key(26,true,modifier<48?2:8);await step(1);expect(desktopState.get().history.length).toBe(0);expect(desktopState.get().level.tiles[5]![5]).toBe(before);
  input.key(26,false);input.key(modifier,false);await step(1);
  input.emit(DesktopIntent,{action:'theme'});await step(1);expect(desktopState.get().level.number).toBe(2);
  input.key(modifier,true);await step(1);input.key(19,true,modifier<48?2:8);await step(1);expect(desktopSaveState.get().custom_level!.number).toBe(2);expect(desktopState.get().selected).toBe(0);
  input.key(19,false);input.key(modifier,false);await step(1);
  input.key(58,true);await step(1);expect(desktopGameRequest.get().action).toBe('playtest');expect(desktopState.get().screen).toBe('play');
 },{scene});
}
worldTest('desktop editor P F B preserve pinned reference no-op semantics',async({input,step})=>{
 await step(5);input.emit(DesktopIntent,{action:'editor'});await step(1);const level=desktopState.get().level;
 // The source footer advertises these keys, but updateEditor has no such handlers.
 for(const code of [16,6,2]){input.key(code,true);await step(1);input.key(code,false);await step(1);expect(desktopState.get().tool).toBe(0);expect(desktopState.get().selected).toBe(0);expect(desktopState.get().level).toEqual(level);}
},{scene});
worldTest('desktop fullscreen capability notice stays in presentation model',async({input,step})=>{
 await step(5);input.emit(DesktopIntent,{action:'settings'});await step(1);input.emit(DesktopIntent,{action:'fullscreen'});await step(1);
 const s=desktopState.get(),p=desktopSaveState.get();expect(p.settings.fullscreen).toBe(true);expect(s.status).toBe('');
 expect(desktopModel(s,p,0,false).status).toBe('FULLSCREEN REQUIRES ENGINE WINDOW SUPPORT');expect(desktopModel(s,p,0,true).status).toBe('');
},{scene});

renderTest('desktop reference popup and banner layouts',async({input,step,cheat,render,ui})=>{
 input.view(768,720,1);await step(5);await cheat(ResetArcade,{round:1,seed:1,ready:true});render.stats({width:768,height:720});
 const banner=ui.rect('desktop-hud.banner')!;expect(banner.x).toBe(108);expect(banner.y).toBe(240);expect(banner.width).toBe(552);expect(banner.height).toBe(82);expect(ui.rect('desktop-hud.banner-title')!.y).toBe(255);expect(ui.rect('desktop-hud.banner-hint')!.y).toBe(293);render.expectScreenshot('ready',{width:768,height:720});
 input.emit(DesktopIntent,{action:'pause'});await step(1);render.stats({width:768,height:720});const pause=ui.rect('desktop-shell.pause-panel')!;expect(pause.x).toBe(124);expect(pause.y).toBe(210);expect(pause.width).toBe(520);expect(pause.height).toBe(310);expect(ui.rect('desktop-shell.title')!.y).toBe(252);render.expectScreenshot('pause',{width:768,height:720});
 await cheat(ResetArcade,{scenario:'boundary-clear-full-campaign'});render.stats({width:768,height:720});expect(ui.rect('desktop-hud.banner')!.y).toBe(84);expect(ui.rect('desktop-hud.banner-title')!.y).toBe(99);expect(ui.rect('desktop-hud.banner-hint')!.y).toBe(137);render.expectScreenshot('clear',{width:768,height:720});
 await cheat(ResetArcade,{scenario:'boundary-campaign-win'});await step(1);render.stats({width:768,height:720});expect(ui.rect('run-results.result-score')!.y).toBe(169);const stats=ui.rect('run-results.result-stats')!;expect(stats.y).toBe(370);expect(stats.height).toBeLessThanOrEqual(16);render.expectScreenshot('win',{width:768,height:720});
},{scene});
