import { PartyReset, PartyBossDuel, PartyVictory } from '../src/arcade/party.cheats';
import { FeelShowcase } from '../src/arcade/juice.cheats';
import {expect,renderTest} from '@gameengine/test';
import {DesktopIntent} from '../src/schema.gen';
import {ResetArcade} from '../src/arcade/arcade.cheats';
import {session} from '../src/arcade/session';
import {desktopState} from '../src/desktop/state';
import {desktopSaveState} from '../src/desktop/save';

// One recorded route covers the distinct sprite/material/UI flows for warm-up.
renderTest('desktop complete presentation flows',async({input,step,cheat,render,app})=>{
 input.view(768,720,1);await step(30);
 let peak=0;
 const shot=(name:string)=>{
  const draws=render.stats({width:768,height:720}).drawCalls;
  console.log(`presentation ${name}: ${draws} draws`);peak=Math.max(peak,draws);
  render.expectScreenshot(name,{width:768,height:720});
 };
 shot('title');
 for(const page of ['menu','profiles','scores','settings','help','credits','editor']){
  input.emit(DesktopIntent,{action:'navigate',value:page});await step(1);shot(page);await step(3);
 }
 await cheat(ResetArcade,{round:1,seed:42,players:1,ready:true});shot('ready');await step(3);
 await cheat(ResetArcade,{round:24,seed:42,players:2,ready:false});
 input.action('fire',1);input.action('move',1);await step(90);
 expect(session.get().game!.Tick).toBe(90);shot('round24-combat');
 input.action('fire',0);input.action('move',0);
 input.emit(DesktopIntent,{action:'pause'});await step(1);
 expect(session.get().game!.Paused).toBe(true);shot('pause');await step(3);
 input.emit(DesktopIntent,{action:'resume'});await step(1);
 for(const scenario of ['boundary-bubble-chain','boundary-element-fire','boundary-element-water','boundary-element-thunder']){
  await cheat(ResetArcade,{scenario});await step(1);shot(scenario);await step(3);
 }
 await cheat(ResetArcade,{round:1,seed:42,ready:false});
 input.action('move',1);
 let elapsed=0;
 while(!session.get().game!.Players[0]!.Dead&&elapsed<900){await step(1);elapsed++;}
 expect(session.get().game!.Players[0]!.Dead).toBeGreaterThan(0);shot('death');await step(3);
 input.action('move',0);
 await cheat(ResetArcade,{scenario:'boundary-campaign-win'});await step(1);
 expect(session.get().game!.State).toBe(4);expect(desktopState.get().screen).toBe('result');shot('win');await step(3);
 app.background();await step(1);expect(desktopState.get().screen).toBe('result');app.foreground();
 // Append palette flows after the original route so its17captures retain phase.
 input.emit(DesktopIntent,{action:'settings'});await step(1);
 for(const skin of ['red','yellow']){
  for(let presses=0;desktopSaveState.get().profiles[desktopSaveState.get().active]!.avatar!==skin&&presses<4;presses++){
   input.emit(DesktopIntent,{action:'avatar'});await step(1);
  }
  expect(desktopSaveState.get().profiles[desktopSaveState.get().active]!.avatar).toBe(skin);
  shot(`skin-${skin}-settings`);await step(6);
 }
 await cheat(ResetArcade,{round:1,seed:42,players:2,ready:false});
 input.action('fire',1);input.action('fire2',1);await step(1);
 input.action('fire',0);input.action('fire2',0);await step(33);
 const bubbles=session.get().game!.Bubbles;
 expect(bubbles.length).toBe(2);expect(bubbles.map(b=>b.Shooter)).toEqual([0,1]);
 expect(bubbles.every(b=>b.Age>=30)).toBe(true);
 const colors=render.probe({width:768,height:720,points:bubbles.map(b=>[Math.floor(b.X+22),Math.floor(b.Y+48+44*9.5/17)] as [number,number])}).points;
 expect(colors.map(p=>p.rgba)).toEqual([[255,220,0,255],[0,170,255,255]]);
 shot('bubbles-yellow-blue');await step(6);
 // The warm-up replay also visits the party feedback and UI particle pipeline.
 await cheat(PartyReset,{humans:6});await step(2);await cheat(FeelShowcase,{});shot('party-feel');await step(6);
 await cheat(PartyReset,{wave:10,humans:6});await step(2);await cheat(PartyBossDuel,{captured:true});shot('party-capture');await step(3);
 await cheat(PartyVictory,{});await step(18);shot('party-victory');await step(60);
 expect(peak).toBeLessThanOrEqual(14);
},{scene:'scenes/arcade.scene.json'});
