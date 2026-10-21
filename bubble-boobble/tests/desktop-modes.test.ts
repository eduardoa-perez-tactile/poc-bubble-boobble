import { expect, worldTest, renderTest } from '@gameengine/test';
import { DesktopIntent } from '../src/schema.gen';
import { desktopState, desktopGameRequest, initialDesktopState } from '../src/desktop/state';
import { getDesktopButtons, desktopModel } from '../src/desktop/model';
import { initialDesktopSave } from '../src/desktop/save';
import { desktopButtonRect, modeGridSelection } from '../src/desktop/layout';
const scene='scenes/arcade.scene.json';
declare const __gameengine_host:(op:string,arg:string)=>string;
worldTest('desktop main menu has only start settings and quit in every build',async({input,step})=>{
 const menu={...initialDesktopState,screen:'menu' as const};
 expect(getDesktopButtons(menu,initialDesktopSave).map(b=>b.key)).toEqual(['choose-mode','settings','quit']);
 expect(desktopButtonRect(menu,initialDesktopSave,2)).toEqual({x:218,y:448,width:332,height:44});
 expect(desktopButtonRect(menu,initialDesktopSave,3)).toBe(null);
 expect(desktopModel(menu,initialDesktopSave).developmentMenu).toBe(false);
 await step(5);input.emit(DesktopIntent,{action:'menu'});await step(1);
 input.emit(DesktopIntent,{action:'development-menu',index:1});await step(1);
 expect(desktopState.get().developmentMenu).toBe(true);
 expect(getDesktopButtons(desktopState.get(),initialDesktopSave).map(b=>b.key)).toEqual(['choose-mode','settings','quit']);
 input.emit(DesktopIntent,{action:'development-menu',index:0});await step(1);
 expect(getDesktopButtons(desktopState.get(),initialDesktopSave).map(b=>b.key)).toEqual(['choose-mode','settings','quit']);
},{scene});
worldTest('desktop mode chooser records classic and madness requests and returns to menu',async({input,step})=>{
 await step(5);input.emit(DesktopIntent,{action:'choose-mode'});await step(1);
 expect(desktopState.get().screen).toBe('modes');
 expect(getDesktopButtons(desktopState.get(),initialDesktopSave).map(b=>b.key)).toEqual(['classic-mode','madness-mode','online-mode','mode-back']);
 input.emit(DesktopIntent,{action:'mode-back'});await step(1);expect(desktopState.get().screen).toBe('menu');
 input.emit(DesktopIntent,{action:'choose-mode'});await step(1);
 input.emit(DesktopIntent,{action:'classic-mode'});await step(1);expect(desktopGameRequest.get().action).toBe('start');expect(desktopState.get().screen).toBe('play');
 input.emit(DesktopIntent,{action:'choose-mode'});await step(1);input.emit(DesktopIntent,{action:'madness-mode'});await step(1);expect(desktopState.get().screen).toBe('party');
},{scene});
worldTest('desktop mode cards support recorded keyboard and controller navigation',async({input,step})=>{
 await step(5);input.emit(DesktopIntent,{action:'choose-mode'});await step(1);
 input.action('menuX',1);await step(1);expect(desktopState.get().selected).toBe(1);
 input.action('menuX',0);input.action('menuY',1);await step(1);expect(desktopState.get().selected).toBe(3);
 input.action('menuY',0);await step(1);input.action('menuY',-1);await step(1);expect(desktopState.get().selected).toBe(0);
 input.action('menuY',0);await step(1);
 __gameengine_host('test.input',JSON.stringify([{type:'gamepadAxis',pad:5,axis:0,value:1}]));await step(1);expect(desktopState.get().selected).toBe(1);
 __gameengine_host('test.input',JSON.stringify([{type:'gamepadButton',pad:5,button:0,down:true}]));await step(1);expect(desktopState.get().screen).toBe('party');
 expect(modeGridSelection(3,0,-1)).toBe(0);expect(modeGridSelection(1,1,0)).toBe(2);expect(modeGridSelection(2,1,0)).toBe(0);expect(modeGridSelection(0,-1,0)).toBe(2);
},{scene});

worldTest('desktop third online card opens game setup without starting an offline run',async({input,step})=>{
 await step(5);input.emit(DesktopIntent,{action:'choose-mode'});await step(1);
 input.action('menuX',1);await step(1);input.action('menuX',0);await step(1);
 input.action('menuX',1);await step(1);input.action('menuX',0);await step(1);
 expect(desktopState.get().selected).toBe(2);
 const before=desktopGameRequest.get().sequence;
 input.action('confirm',1);await step(1);input.action('confirm',0);await step(1);
 expect(desktopState.get().screen).toBe('online');expect(desktopGameRequest.get().sequence).toBe(before);
 const modes={...initialDesktopState,screen:'modes' as const};
 for(let index=0;index<3;index++)expect(desktopButtonRect(modes,initialDesktopSave,index)).toEqual({x:30+index*240,y:168,width:228,height:380});
},{scene});
renderTest('desktop online mode is a full third card and opens setup through its document',async({input,step,render,ui})=>{
 input.view(768,720,1);await step(5);input.emit(DesktopIntent,{action:'choose-mode'});await step(1);render.stats({width:768,height:720});
 const cards=ui.interactables().filter(button=>button.id?.endsWith('-mode'));
 expect(cards.length).toBe(3);
 const online=cards.find(button=>button.id?.endsWith('online-mode'))!;
 expect(online.rect.height).toBe(380);expect(online.rect.width).toBe(228);expect(Math.abs(online.rect.x-510)).toBeLessThan(1);
 await ui.press(online.id!);await step(1);expect(desktopState.get().screen).toBe('online');
},{scene});
