import { expect, worldTest, renderTest } from '@gameengine/test';
import { multiplayer, type WorldConnection, type WorldEvent } from '@gameengine/runtime';
import campaign from '../data/levels.json';
import { DesktopIntent, OnlineWorldInput, OnlineWorldSnapshot } from '../src/schema.gen';
import { session } from '../src/arcade/session';
import { desktopState } from '../src/desktop/state';
import { applyWorldEvents, createWorldState } from '../src/online/world-rules';
import { projectWorld } from '../src/online/world-public';
import { authoritativeWorld, clientWorldView, publicWorld } from '../src/online/world-system';
import { officeArcadeSocket } from '../src/online/room';
const scene='scenes/arcade.scene.json';
worldTest('online world URL uses the publication secure socket',()=>{
 expect(officeArcadeSocket('https://webgames.tactilews.com/bubble/game.html')).toBe('wss://webgames.tactilews.com/bubble/socket');
 expect(officeArcadeSocket('https://example.com/')).toBe(undefined);
});
worldTest('online authoritative marker creates a live room through recorded server input',async({input,step})=>{
 input.emit(OnlineWorldInput,{$data:JSON.stringify({events:[{kind:'start'},{kind:'join',player:9,name:'PLAYER'},{kind:'input',player:9,data:{action:'create'}}]})});
 await step(1);
 const state=authoritativeWorld.get().state;
 expect(state.rooms.length).toBe(1);expect(state.rooms[0]!.owners[0]).toBe(9);expect(state.rooms[0]!.game.Tick).toBe(1);
 expect(publicWorld.get().rooms[0]!.humans).toBe(1);
 await step(5);expect(authoritativeWorld.get().state.rooms[0]!.game.Tick).toBe(6);
},{scene});
worldTest('online clients apply snapshots without simulating rooms and can reset a restarted stream',async({input,step})=>{
 let state=applyWorldEvents(createWorldState(),[{kind:'join',player:7,name:'PLAYER'},{kind:'input',player:7,data:{action:'create'}}],campaign);
 state={...state,tick:100};const document=projectWorld(state),tick=state.rooms[0]!.game.Tick;
 input.emit(OnlineWorldSnapshot,{$data:JSON.stringify({player:7,document,playing:true})});await step(2);
 expect(session.get().mode).toBe('online');expect(session.get().active).toBe(true);expect(session.get().game!.Tick).toBe(tick);
 await step(20);expect(session.get().game!.Tick).toBe(tick);expect(authoritativeWorld.get().started).toBe(false);
 input.emit(OnlineWorldSnapshot,{$data:JSON.stringify({player:7,document:{version:1,tick:0,rooms:[],peers:[]},playing:false,reset:true})});await step(1);
 expect(session.get().active).toBe(false);expect(clientWorldView.get().tick).toBe(0);
},{scene});
renderTest('online setup starts immediately and live browsing joins a game through real buttons',async({input,step,ui,render})=>{
 input.view(768,720,1);const original=multiplayer.world.connect;let handler:((event:WorldEvent)=>void)|undefined;const sent:unknown[]=[];
 const connection:WorldConnection={send:value=>{sent.push(value);},poll:()=>[],subscribe:next=>{handler=next;next({kind:'welcome',player:7,version:1});return()=>{};},close:()=>{}};
 try{
  multiplayer.world.connect=async()=>connection;
  await step(4);input.emit(DesktopIntent,{action:'online-mode'});await step(5);render.stats({width:768,height:720});
  expect(desktopState.get().screen).toBe('online');expect(ui.interactables().some(button=>button.label==='START GAME NOW')).toBe(true);
  expect(ui.interactables().some(button=>button.label==='BROWSE GAMES')).toBe(true);
  await ui.press(ui.interactables().find(button=>button.label==='START GAME NOW')!.id!);await step(3);
  expect(sent.some(value=>(value as {action?:string}).action==='create')).toBe(true);
  const state=applyWorldEvents(createWorldState(),[{kind:'join',player:7,name:'PLAYER'},{kind:'input',player:7,data:{action:'create'}}],campaign);
  handler!({kind:'snapshot',tick:1,document:projectWorld(state)});await step(4);render.stats({width:768,height:720});
  expect(session.get().active).toBe(true);expect(session.get().game!.Party!.Slots.filter(slot=>slot!=='empty').length).toBe(1);
  expect(ui.interactables().some(button=>button.label==='MENU')).toBe(true);
  await ui.press(ui.interactables().find(button=>button.label==='MENU')!.id!);await step(2);render.stats({width:768,height:720});
  await ui.press(ui.interactables().find(button=>button.label==='LEAVE GAME')!.id!);await step(2);render.stats({width:768,height:720});
  expect(sent.some(value=>(value as {action?:string}).action==='leave')).toBe(true);expect(session.get().active).toBe(false);
  const next=applyWorldEvents(state,[{kind:'input',player:7,data:{action:'leave'}}],campaign);next.tick=2;
  handler!({kind:'snapshot',tick:2,document:projectWorld(next)});await step(3);render.stats({width:768,height:720});
  const join=ui.interactables().find(button=>button.id==='online-room.join:room-1');expect(!!join).toBe(true);
  await ui.press(join!.id!);await step(2);expect(sent.some(value=>(value as {action?:string}).action==='join')).toBe(true);
 }finally{multiplayer.world.connect=original;}
},{scene});
