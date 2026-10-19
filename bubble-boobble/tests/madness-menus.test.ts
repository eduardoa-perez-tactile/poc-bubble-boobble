import { renderTest, worldTest, expect } from '@gameengine/test';
import { DesktopIntent } from '../src/schema.gen';
import { desktopState } from '../src/desktop/state';
import { sceneDraws } from '../src/arcade/presentation';
import { menuDragon } from '../src/desktop/animation';
import { partyColors } from '../src/arcade/party-config';
import { session } from '../src/arcade/session';
const scene='scenes/arcade.scene.json';
renderTest('madness release menu and mode cards fit and launch both modes',async({input,step,render,ui})=>{
 input.view(768,720,1);await step(4);render.stats({width:768,height:720});await step(2);
 input.emit(DesktopIntent,{action:'development-menu',index:0});input.emit(DesktopIntent,{action:'menu'});await step(2);
 render.stats({width:768,height:720});expect(ui.interactables().map(b=>b.label).sort()).toEqual(['QUIT','SETTINGS','START GAME']);
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
renderTest('madness menu stays simple with development enabled',async({input,step,render,ui})=>{
 input.view(768,720,1);await step(4);render.stats({width:768,height:720});await step(2);
 input.emit(DesktopIntent,{action:'development-menu',index:1});input.emit(DesktopIntent,{action:'menu'});await step(2);render.stats({width:768,height:720});
 expect(ui.interactables().map(b=>b.label).sort()).toEqual(['START GAME','SETTINGS','QUIT'].sort());
 for(const [width,height] of [[768,720],[1680,720],[640,960],[2160,720]]){
  input.view(width!,height!,1);await step(1);render.stats({width:width!,height:height!});
  const buttons=ui.interactables();expect(buttons.length).toBe(3);
  for(const b of buttons)expect(b.rect.x>=0&&b.rect.y>=0&&b.rect.x+b.rect.width<=width!&&b.rect.y+b.rect.height<=height!).toBe(true);
  const portraits=sceneDraws(0).images.filter(d=>partyColors.some(c=>d.image.startsWith(`reference/${c}/walk/`)));
  expect(portraits.length).toBe(10);expect(portraits.every(d=>d.x>=0&&d.x+d.w<=768&&d.y+d.h<678)).toBe(true);
  render.expectDrawCalls('<=',14,{width:width!,height:height!});
  render.expectScreenshot(`simple_menu_${width}x${height}`,{width:width!,height:height!});
 }
 input.view(768,720,1);await step(1);render.stats({width:768,height:720});
 render.expectScreenshot('development_menu',{width:768,height:720});
 const buttonsBefore=ui.interactables().map(b=>({label:b.label,rect:b.rect}));
 const before=sceneDraws(14).images;
 await step(24);
 expect(JSON.stringify(sceneDraws(38).images)===JSON.stringify(before)).toBe(false);
 render.expectScreenshot('dragon_hop',{width:768,height:720});
 render.stats({width:768,height:720});
 expect(ui.interactables().map(b=>({label:b.label,rect:b.rect}))).toEqual(buttonsBefore);
 for(let frame=0;frame<360;frame++)for(let index=0;index<10;index++){
  const d=menuDragon(index,frame);
  expect(d.x>=36+index*70&&d.x<=44+index*70&&d.y>=570&&d.y<=596).toBe(true);
 }
 input.emit(DesktopIntent,{action:'effects'});await step(1);
 const reduced=sceneDraws(0).images;await step(60);
 expect(sceneDraws(60).images).toEqual(reduced);
 render.expectScreenshot('reduced_motion',{width:768,height:720});
 const settings=ui.interactables().find(b=>b.label==='SETTINGS')!;await ui.press(settings.id!);await step(2);expect(desktopState.get().screen).toBe('settings');
},{scene});
