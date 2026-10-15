import {expect,renderTest,worldTest} from '@gameengine/test';
import campaign from '../data/levels.json';
import sprites from '../data/sprites.json';
import {pixelRect} from '../src/arcade/pixel-renderer/index';
import {arcadeDrawPlan,referenceFrame} from '../src/arcade/presentation';
import {canonicalState,createGame} from '../src/arcade/game';
import type {Level} from '../src/arcade/types';
import {ResetArcade} from '../src/arcade/arcade.cheats';
import {session} from '../src/arcade/session';
import {desktopSaveState} from '../src/desktop/save';
import {desktopState} from '../src/desktop/state';
import {DesktopIntent} from '../src/schema.gen';

const scene='scenes/arcade.scene.json';
const skins=['green','blue','red','yellow'] as const;
const states=['walk','jump','shoot','dead'] as const;

worldTest('dragon skins selected player one survives co-op while player two stays blue',()=>{
 const game=createGame(campaign as Level[],42,2),player=game.Players[0]!;
 const draws=arcadeDrawPlan(game,'blue');
 expect(draws.find(d=>!d.footer&&d.x===player.X&&d.y===player.Y+48&&d.w===48)!.image).toBe('reference/blue/jump/0');
 expect(draws.find(d=>d.footer&&d.x===20)!.image).toBe('reference/blue/walk/0');
 expect(draws.find(d=>d.footer&&d.x===126)!.image).toBe('reference/blue/walk/0');
},{scene});

worldTest('dragon skins cover every animation frame without changing gameplay',()=>{
 const animations=sprites as Record<string,string[]>;
 for(const players of [1,2]){
  const game=createGame(campaign as Level[],42,players);
  const player=game.Players[0]!;
  for(const p of game.Players)p.Invincible=0;
  Object.assign(player,{Invincible:0,Dir:1});
  for(const state of states){
   const count=state==='walk'?7:4;
   for(let frame=0;frame<count;frame++){
    Object.assign(player,{Ground:state==='walk',Shoot:state==='shoot'?12-frame*10:0,Dead:state==='dead'?90-frame*10:0,WalkFrame:frame*10});
    // Shoot only lasts12 ticks; its four source frames are still validated below.
    if(state==='shoot')player.Shoot=12-frame;
    game.Tick=frame*10;
    const before=canonicalState(game);
    for(const skin of skins){
     const name=`${skin}/${state}`;
     expect(animations[`${skin==='blue'?'blue':'green'}/${state}`]!.length).toBe(count);
     const sourceFrame=referenceFrame(name,frame*10);
     expect(sourceFrame).toBe(`reference/${skin}/${state}/${frame}`);
     expect(pixelRect(sourceFrame).slice(2)).toEqual(pixelRect(`reference/green/${state}/${frame}`).slice(2));
     expect(referenceFrame(name,count*10)).toBe(`reference/${skin}/${state}/0`);
     const draws=arcadeDrawPlan(game,skin);
     const actor=draws.find(d=>!d.footer&&d.x===player.X&&d.y===player.Y+48&&d.w===48)!;
     expect(actor.image).toBe(referenceFrame(name,state==='shoot'?frame:frame*10));
     expect(actor.flip).toBe(true);expect(actor.h).toBe(48);
     expect(draws.find(d=>d.footer&&d.x===20)!.image).toBe(referenceFrame(`${skin}/walk`,0));
     if(players===2){
      const other=game.Players[1]!;
      expect(draws.some(d=>!d.footer&&d.x===other.X&&d.image.startsWith('reference/blue/'))).toBe(true);
      expect(draws.find(d=>d.footer&&d.x===126)!.image).toBe('reference/blue/walk/0');
     }
     expect(canonicalState(game)).toEqual(before);
    }
   }
  }
 }
},{scene});

for(const skin of ['red','yellow'] as const)renderTest(`dragon skins settings selection reaches ${skin} gameplay`,async({input,step,render,ui,cheat})=>{
 input.view(768,720,1);await step(5);
 input.emit(DesktopIntent,{action:'settings'});await step(1);
 // Use the hit-tested Settings control, not a save mutation or avatar cheat.
 for(let presses=0;desktopSaveState.get().profiles[0]!.avatar!==skin&&presses<4;presses++){
  render.stats({width:768,height:720});
  const button=ui.interactables().find(b=>b.label.startsWith('DRAGON:'));
  if(!button?.id)throw new Error('Dragon settings control is not hit-testable');
  await ui.press(button.id);await step(1);
 }
 expect(desktopSaveState.get().profiles[0]!.avatar).toBe(skin);
 render.expectScreenshot('settings-preview',{width:768,height:720});
 input.emit(DesktopIntent,{action:'profiles'});await step(1);
 expect(desktopState.get().screen).toBe('profiles');
 render.expectScreenshot('profile-preview',{width:768,height:720});
 for(const players of [1,2]){
  await cheat(ResetArcade,{round:1,seed:42,players,ready:true});await step(1);
  expect(session.get().game!.Players.length).toBe(players);
  expect(desktopSaveState.get().profiles[0]!.avatar).toBe(skin);
  render.expectDrawCalls('<=',8,{width:768,height:720});
  render.expectScreenshot(players===1?'solo':'co-op',{width:768,height:720});
 }
},{scene});
