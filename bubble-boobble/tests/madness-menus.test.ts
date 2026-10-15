import { renderTest, worldTest, expect } from '@gameengine/test';
import { DesktopIntent } from '../src/schema.gen';
import { desktopState } from '../src/desktop/state';
import { session } from '../src/arcade/session';
const scene='scenes/arcade.scene.json';
renderTest('madness release menu and mode cards fit and launch both modes',async({input,step,render,ui})=>{
 input.view(768,720,1);await step(4);render.stats({width:768,height:720});await step(2);
 input.emit(DesktopIntent,{action:'development-menu',index:0});input.emit(DesktopIntent,{action:'menu'});await step(2);
 render.stats({width:768,height:720});expect(ui.interactables().map(b=>b.label).sort()).toEqual(['SETTINGS','START GAME']);
 render.expectScreenshot('release_menu',{width:768,height:720});
 const start=ui.interactables().find(b=>b.label==='START GAME')!;await ui.press(start.id!);await step(2);expect(desktopState.get().screen).toBe('modes');
 for(const [width,height] of [[768,720],[1680,720],[640,960]]) {
  input.view(width!,height!,1);await step(1);render.stats({width:width!,height:height!});
  const cards=ui.interactables().filter(b=>b.rect.height>200*Math.min(width!/768,height!/720));expect(cards.length).toBe(2);
  for(const b of ui.interactables())expect(b.rect.x>=0&&b.rect.y>=0&&b.rect.x+b.rect.width<=width!&&b.rect.y+b.rect.height<=height!).toBe(true);
 }
 input.view(768,720,1);await step(1);render.stats({width:768,height:720});render.expectDrawCalls('<=',14,{width:768,height:720});render.expectScreenshot('classic_card',{width:768,height:720});
 const classic=ui.interactables().find(b=>b.rect.x===100)!;await ui.press(classic.id!);await step(2);expect(session.get().game!.Party).toBe(undefined);expect(desktopState.get().screen).toBe('play');
 input.emit(DesktopIntent,{action:'leave'});input.emit(DesktopIntent,{action:'choose-mode'});input.emit(DesktopIntent,{action:'select',index:1});await step(2);render.stats({width:768,height:720});render.expectScreenshot('madness_card',{width:768,height:720});
 const madness=ui.interactables().find(b=>b.rect.x===396)!;await ui.press(madness.id!);await step(2);expect(desktopState.get().screen).toBe('party');
},{scene});
renderTest('madness development menu retains tools with recorded capability',async({input,step,render,ui})=>{
 input.view(768,720,1);await step(4);render.stats({width:768,height:720});await step(2);
 input.emit(DesktopIntent,{action:'development-menu',index:1});input.emit(DesktopIntent,{action:'menu'});await step(2);render.stats({width:768,height:720});
 expect(ui.interactables().map(b=>b.label).sort()).toEqual(['START GAME','SETTINGS','PROFILES','HIGH SCORES','LEVEL EDITOR','HOW TO PLAY','CREDITS','QUIT'].sort());
 render.expectScreenshot('development_menu',{width:768,height:720});
 const settings=ui.interactables().find(b=>b.label==='SETTINGS')!;await ui.press(settings.id!);await step(2);expect(desktopState.get().screen).toBe('settings');
},{scene});
