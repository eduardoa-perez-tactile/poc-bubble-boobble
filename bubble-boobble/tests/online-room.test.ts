import { expect, worldTest, renderTest } from '@gameengine/test';
import { DesktopIntent } from '../src/schema.gen';
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
