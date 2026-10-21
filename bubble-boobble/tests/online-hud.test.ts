import { expect, worldTest, renderTest } from '@gameengine/test';
import { multiplayer, type WorldConnection, type WorldEvent } from '@gameengine/runtime';
import campaign from '../data/levels.json';
import { DesktopIntent } from '../src/schema.gen';
import { State, levelHeight, levelWidth } from '../src/arcade/types';
import { session } from '../src/arcade/session';
import { arenaLayout } from '../src/arcade/arena-layout';
import { applyWorldEvents, createWorldState } from '../src/online/world-rules';
import { projectWorld } from '../src/online/world-public';
import { onlineHudModel } from '../src/online/hud';
function fixture(){return applyWorldEvents(createWorldState(),[{kind:'join',player:7,name:'PLAYER'},{kind:'input',player:7,data:{action:'create'}},{kind:'join',player:8,name:'OTHER'},{kind:'input',player:8,data:{action:'join',room:'room-1'}}],campaign);}
worldTest('online HUD has one objective and distinguishes rescue pending AI and actual AI takeover',()=>{
 const state=fixture(),game=state.rooms[0]!.game;game.State=State.Playing;game.Party!.Phase='combat';
 let room=projectWorld(state).rooms[0]!,model=onlineHudModel(game,room,7,0);
 expect(model.wave).toBe('WAVE 1 / 10');expect(model.identity.includes('HUMANS 2/10')).toBe(true);expect(model.objective.includes('GO!')).toBe(false);
 game.Players[0]!.Downed=true;game.Players[0]!.Lives=0;model=onlineHudModel(game,room,7,0);expect(model.objective).toBe('YOU ARE DOWN / A TEAMMATE CAN RESCUE YOU');expect(game.State).toBe(State.Playing);
 room={...room,pendingTakeovers:[{slot:1,label:'P2 BOB',remainingTicks:121}],notices:[{id:2,tick:0,slot:1,label:'P2 BOB',kind:'leave'}]};model=onlineHudModel(game,room,7,0);expect(model.notice).toBe('P2 BOB: AI IN 3S');expect(model.notice.includes('STARTED')).toBe(false);
 game.Party!.Slots[1]='ai';room={...room,pendingTakeovers:[],notices:[{id:3,tick:300,slot:1,label:'P2 BOB',kind:'ai'}]};model=onlineHudModel(game,room,7,300);expect(model.notice).toBe('P2 BOB AI STARTED');expect(model.identity.includes('AI 1')).toBe(true);
 model=onlineHudModel(game,room,7,600);expect(model.notice).toBe('AI DRAGONS: P2 BOB');
});

for(const [width,height] of [[768,720],[1680,720],[640,960]])renderTest(`online HUD and staged defeat fit full scene ${width}x${height}`,async({input,step,ui,render})=>{
 input.view(width!,height!,1);const original=multiplayer.world.connect;let handler:((event:WorldEvent)=>void)|undefined;
 const connection:WorldConnection={send:()=>{},poll:()=>[],close:()=>{},subscribe:next=>{handler=next;next({kind:'welcome',player:7,version:1});return()=>{};}};
 try{
  multiplayer.world.connect=async()=>connection;await step(4);input.emit(DesktopIntent,{action:'online-mode'});await step(5);render.stats({width:width!,height:height!});
  await ui.press(ui.interactables().find(button=>button.label==='START GAME NOW')!.id!);await step(3);
  const state=fixture(),game=state.rooms[0]!.game;game.State=State.Playing;game.Party!.Phase='combat';state.tick=30;
  game.Players[0]!.Y=-74;game.Players[0]!.Ground=false;
  handler!({kind:'snapshot',tick:30,document:projectWorld(state)});await step(4);render.stats({width:width!,height:height!});
  expect(ui.rect('desktop-hud')).toBe(null);expect(ui.interactables().some(button=>button.label==='MENU')).toBe(true);
  const score=ui.rect('online-bar.score')!,wave=ui.rect('online-bar.wave')!,alive=ui.rect('online-bar.alive')!,identity=ui.rect('online-bar.identity')!,objective=ui.rect('online-bar.objective')!;
  expect(!!score&&!!wave&&!!alive&&!!identity&&!!objective).toBe(true);expect(score.x+score.width).toBeLessThanOrEqual(wave.x);expect(wave.x+wave.width).toBeLessThanOrEqual(alive.x);expect(score.y+score.height).toBeLessThanOrEqual(identity.y);expect(identity.y+identity.height).toBeLessThanOrEqual(objective.y);
  const hudProof=render.probe({width:width!,height:height!,regions:[[score.x,score.y,score.width,score.height],[objective.x,objective.y,objective.width,objective.height]]});expect(hudProof.regions[0]!.max[1]!).toBeGreaterThan(180);expect(hudProof.regions[1]!.max[2]!).toBeGreaterThan(180);
  for(const button of ui.interactables())expect(button.rect.x>=0&&button.rect.y>=0&&button.rect.x+button.rect.width<=width!+1&&button.rect.y+button.rect.height<=height!+1).toBe(true);
  const layout=arenaLayout(game.Level,{width:width!,height:height!,safeArea:[0,0,0,0]},120);
  expect(layout.y-96*layout.scale).toBeGreaterThanOrEqual(120);expect(layout.x).toBeGreaterThanOrEqual(layout.viewportLeft);expect(layout.x+levelWidth(game.Level)*layout.scale).toBeLessThanOrEqual(layout.viewportRight);expect(layout.y+levelHeight(game.Level)*layout.scale).toBeLessThanOrEqual(672+1);
  // A downed individual still sees gameplay/rescue, never a ranking or team defeat.
  game.Players[0]!.Downed=true;game.Players[0]!.Lives=0;state.tick=31;handler!({kind:'snapshot',tick:31,document:projectWorld(state)});await step(3);render.stats({width:width!,height:height!});
  expect(ui.interactables().some(button=>button.label==='MENU')).toBe(true);expect(ui.interactables().some(button=>button.label==='VIEW RESULTS')).toBe(false);
  game.State=State.GameOver;state.tick=32;handler!({kind:'snapshot',tick:32,document:projectWorld(state)});await step(3);render.stats({width:width!,height:height!});
  expect(ui.interactables().some(button=>button.label==='NEW GAME')).toBe(false);expect(ui.interactables().some(button=>button.label==='VIEW RESULTS')).toBe(false);
  await step(120);render.stats({width:width!,height:height!});expect(ui.interactables().some(button=>button.label==='VIEW RESULTS')).toBe(false);
  await step(70);render.stats({width:width!,height:height!});expect(ui.interactables().some(button=>button.label==='VIEW RESULTS')).toBe(true);expect(ui.interactables().some(button=>button.label==='NEW GAME')).toBe(false);
  const title=ui.rect('online-end.title')!;expect(!!title).toBe(true);const proof=render.probe({width:width!,height:height!,regions:[[title.x,title.y,title.width,title.height]]});expect(proof.regions[0]!.max[0]!).toBeGreaterThan(180);expect(proof.regions[0]!.max[1]!).toBeGreaterThan(150);
  const stats=ui.rect('online-end.stats')!,results=ui.rect('online-end.results')!,browse=ui.rect('online-end.end-leave')!;const textProof=render.probe({width:width!,height:height!,regions:[[stats.x,stats.y,stats.width,stats.height],[results.x,results.y,results.width,results.height],[browse.x,browse.y,browse.width,browse.height]]});expect(textProof.regions[0]!.max[1]!).toBeGreaterThan(180);expect(textProof.regions[1]!.max[0]!).toBeGreaterThan(180);expect(textProof.regions[2]!.max[0]!).toBeGreaterThan(180);
  await step(180);render.stats({width:width!,height:height!});expect(ui.interactables().some(button=>button.label==='NEW GAME')).toBe(false);
  // The authority deletes ended rooms after thirty seconds; that directory change must
  // not dismiss a team defeat or bypass the player's manual results decision.
  handler!({kind:'snapshot',tick:2000,document:{version:1,tick:2000,rooms:[],peers:[]}});await step(40);render.stats({width:width!,height:height!});expect(ui.interactables().some(button=>button.label==='VIEW RESULTS')).toBe(true);expect(ui.interactables().some(button=>button.label==='NEW GAME')).toBe(false);
  await ui.press(ui.interactables().find(button=>button.label==='VIEW RESULTS')!.id!);await step(2);render.stats({width:width!,height:height!});expect(ui.interactables().some(button=>button.label==='NEW GAME')).toBe(true);expect(session.get().game!.State).toBe(State.GameOver);
 }finally{multiplayer.world.connect=original;}
},{scene:'scenes/arcade.scene.json'});
