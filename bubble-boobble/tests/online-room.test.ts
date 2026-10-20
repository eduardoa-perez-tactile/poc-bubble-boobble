import { expect, worldTest, renderTest } from '@gameengine/test';
import { multiplayer, type MatchStatus, type MatchEvent, type JoinOptions } from '@gameengine/runtime';
import campaign from '../data/levels.json';
import { session } from '../src/arcade/session';
import { createOnlineWaveGame } from '../src/online/rules';
import { DesktopIntent, ArcadeControl } from '../src/schema.gen';
import { desktopState, desktopGameRequest } from '../src/desktop/state';
import { parseInvitation, invitationLink, officeArcadeSocket, validRoom, validHumans, onlineError } from '../src/online/room';
const scene='scenes/arcade.scene.json';
worldTest('online room invitations preserve room human count and same-origin arcade socket',async()=>{
 const page='https://webgames.tactilews.com/bubble-madness-mp/index.html?old=1#game';
 expect(officeArcadeSocket(page)).toBe('wss://webgames.tactilews.com/bubble-madness-mp/socket');
 expect(officeArcadeSocket('https://someone.example/bubble/')).toBe(undefined);
 expect(officeArcadeSocket('https://webgames.tactilews.com.evil.example/game/')).toBe(undefined);
 expect(invitationLink(page,'123456',10)).toBe('https://webgames.tactilews.com/bubble-madness-mp/?room=123456&humans=10');
 expect(parseInvitation(page+'&room=123456&humans=10')).toBe(null);
 expect(parseInvitation('https://webgames.tactilews.com/bubble/?room=123456&humans=10')).toEqual({room:'123456',humans:10});
 for(const link of ['?room=123456&humans=0','?room=123456&humans=11','?room=abc&humans=2','?room=%zz&humans=2','?room=123456&humans=2.0'])expect(parseInvitation(link)).toBe(null);
 expect(validRoom('012345')).toBe(true);expect(validRoom('1234567')).toBe(false);expect(validHumans(2.5)).toBe(false);
 expect(onlineError('E_BUILD_MISMATCH').includes('version')).toBe(true);
 expect(onlineError('E_MISMATCH').includes('human count')).toBe(true);
 expect(onlineError('E_CONNECT').includes('reconnecting')).toBe(true);
},{scene});
worldTest('online mode opens without starting offline gameplay and exits cleanly',async({input,step})=>{
 await step(5);input.emit(DesktopIntent,{action:'online-mode'});await step(1);
 expect(desktopState.get().screen).toBe('online');expect(desktopGameRequest.get().sequence).toBe(0);
 input.emit(DesktopIntent,{action:'start-party'});await step(1);expect(desktopGameRequest.get().sequence).toBe(0);
 input.emit(DesktopIntent,{action:'online-exit'});await step(1);
 expect(desktopState.get().screen).toBe('online');expect(desktopGameRequest.get().action).toBe('quit');
 input.emit(DesktopIntent,{action:'online-exit',index:1});await step(1);expect(desktopState.get().screen).toBe('menu');
},{scene});
renderTest('online room documents expose touch room entry human count and back',async({input,step,render,ui})=>{
 await step(5);input.emit(DesktopIntent,{action:'online-mode'});await step(1);render.stats({width:768,height:720});
 let buttons=ui.interactables();expect(buttons.some(b=>b.label==='CREATE / JOIN')).toBe(true);
 expect(buttons.filter(b=>/^[0-9]$/.test(b.label)).length).toBe(10);
 for(const label of ['DELETE','1','2','3','4','5','6']){buttons=ui.interactables();await ui.press(buttons.find(b=>b.label===label)!.id!);await step(1);render.stats({width:768,height:720});}
 await ui.press(ui.interactables().find(b=>b.label==='BACK')!.id!);await step(2);
 expect(desktopState.get().screen).toBe('menu');render.stats({width:768,height:720});expect(ui.interactables().some(b=>b.label==='START GAME')).toBe(true);
},{scene});

// Transport methods and snapshot readers are stubbed only within each test. The engine still
// mounts OnlineUI and dispatches real document button presses; no socket/server is simulated.
for(const terminal of [3,4])renderTest(`online results ${terminal} start a fresh room without reopening a retained terminal snapshot`,async({world,step,render,ui})=>{
 await step(5);world.setResource(ArcadeControl,{active:false});
 const game=createOnlineWaveGame(campaign,{players:2,mode:'realtime',seed:'42'});game.State=terminal;
 let current={active:true,mode:'online',game};
 let status:MatchStatus={phase:'running',room:'wave-123456',players:2,player:0};
 const original={status:multiplayer.status,leave:multiplayer.leave,events:multiplayer.events,get:session.get};
 try{
  multiplayer.status=()=>status;multiplayer.events=()=>[];session.get=()=>current;
  multiplayer.leave=()=>{status={phase:'idle'};current={...current,active:false};};
  await step(2);render.stats({width:768,height:720});
  const again=ui.interactables().find(button=>button.label==='NEW ONLINE ROOM');expect(!!again).toBe(true);
  await ui.press(again!.id!);await step(3);render.stats({width:768,height:720});
  expect(current.active).toBe(false);expect(current.game.State).toBe(terminal);
  expect(ui.interactables().some(button=>button.label==='CREATE / JOIN')).toBe(true);
  expect(ui.interactables().some(button=>button.label==='NEW ONLINE ROOM')).toBe(false);
  // The next presentation frame must keep the lobby despite the retained game document.
  await step(3);render.stats({width:768,height:720});expect(ui.interactables().some(button=>button.label==='CREATE / JOIN')).toBe(true);
 }finally{multiplayer.status=original.status;multiplayer.leave=original.leave;multiplayer.events=original.events;session.get=original.get;}
},{scene});
for(const withEvent of [true,false])renderTest(`online disconnect ${withEvent?'event':'status'} clears the stale engine match and retains only local reconnect credentials`,async({world,step,render,ui})=>{
 await step(5);world.setResource(ArcadeControl,{active:false});
 const game=createOnlineWaveGame(campaign,{players:2,mode:'realtime',seed:'42'});
 let current={active:true,mode:'online',game};
 let status:MatchStatus={phase:'running',server:'wss://webgames.tactilews.com/test/socket',room:'wave-123456',players:2,player:0,seat:'test-seat-token'};
 let pending:MatchEvent[]=[],leaves=0,joined:JoinOptions|undefined;
 const original={status:multiplayer.status,leave:multiplayer.leave,join:multiplayer.join,events:multiplayer.events,get:session.get};
 try{
  multiplayer.status=()=>status;multiplayer.events=()=>{const next=pending;pending=[];return next;};session.get=()=>current;
  multiplayer.leave=()=>{leaves++;status={phase:'idle'};current={...current,active:false};};
  multiplayer.join=options=>{joined=options;status={phase:'waiting',players:2,player:0};};
  await step(2);
  status={...status,phase:'closed'};pending=withEvent?[{type:'closed',reason:'socket lost'}]:[];
  await step(2);render.stats({width:768,height:720});
  expect(leaves).toBe(1);expect(current.active).toBe(false);expect(status.phase).toBe('idle');
  const reconnect=ui.interactables().find(button=>button.label==='RECONNECT');expect(!!reconnect).toBe(true);
  await ui.press(reconnect!.id!);await step(1);
  expect(joined).toEqual({server:'wss://webgames.tactilews.com/test/socket',room:'wave-123456',players:2,seat:'test-seat-token',mode:'realtime',sync:'input'});
 }finally{multiplayer.status=original.status;multiplayer.leave=original.leave;multiplayer.join=original.join;multiplayer.events=original.events;session.get=original.get;}
},{scene});
