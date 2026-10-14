import {expect,renderTest} from '@gameengine/test';
import {DesktopIntent} from '../src/schema.gen';
import {ResetArcade} from '../src/arcade/arcade.cheats';
import {session} from '../src/arcade/session';
import {desktopState} from '../src/desktop/state';

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
 expect(peak).toBeLessThanOrEqual(14);
},{scene:'scenes/arcade.scene.json'});
