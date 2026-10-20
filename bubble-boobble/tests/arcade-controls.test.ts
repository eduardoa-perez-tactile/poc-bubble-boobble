import {worldTest,expect} from '@gameengine/test';
import {ArcadeControl,ArcadeInput,DesktopIntent} from '../src/schema.gen.ts';
import {ResetArcade} from '../src/arcade/arcade.cheats.ts';
import {session} from '../src/arcade/session.ts';
import {desktopState} from '../src/desktop/state.ts';
const scene='scenes/arcade.scene.json';
worldTest('arcade physical fire movement jump and pause bindings',async({input,step,cheat})=>{
 input.view(768,720,1);await step(2);
 input.emit(DesktopIntent,{action:'navigate',value:'play'});await step(1);
 await cheat(ResetArcade,{ready:false});
 input.key(37,true);await step(1); // Physical Space.
 expect(session.get().game!.Players[0]!.Shoot).toBe(12);
 expect(session.get().game!.Bubbles.length).toBe(1);
 input.key(37,false);input.key(51,true);await step(3);
 expect(session.get().game!.Players[0]!.X).toBeCloseTo(103.5,10);
 input.key(51,false);input.key(52,true);await step(1);
 expect(session.get().game!.Players[0]!.VY).toBe(-12);
 input.key(52,false);input.action('pause',1);await step(1);
 expect(session.get().game!.Paused).toBe(true);
 const tick=session.get().game!.Tick;
 input.action('pause',0);await step(5);
 expect(session.get().game!.Tick).toBe(tick);
 input.emit(DesktopIntent,{action:'resume'});await step(1);
 expect(session.get().game!.Paused).toBe(false);
 expect(session.get().game!.Tick).toBe(tick+1);
},{scene});
worldTest('arcade editor real pointer painting erasing and stroke undo',async({input,step})=>{
 input.view(768,720,1);await step(2);
 input.emit(DesktopIntent,{action:'editor'});await step(1);
 const before=desktopState.get().level.tiles[5]![5]!;
 input.pointer('down',112,234);await step(1);
 input.pointer('move',128,234);await step(1);
 input.pointer('up',128,234);await step(1);
 expect(desktopState.get().level.tiles[5]![5]).toBe(1);
 expect(desktopState.get().level.tiles[5]![6]).toBe(1);
 expect(desktopState.get().history.length).toBe(1);
 input.emit(DesktopIntent,{action:'undo'});await step(1);
 expect(desktopState.get().level.tiles[5]![5]).toBe(before);
 input.pointer('down',112,234,0,2);await step(1);
 input.pointer('up',112,234,0,2);await step(1);
 expect(desktopState.get().level.tiles[5]![5]).toBe(0);
},{scene});

worldTest('arcade physical Escape pauses and resumes once',async({input,step,cheat})=>{
 await step(2);await cheat(ResetArcade,{ready:false});
 input.key(39,true);await step(1);
 expect(session.get().game!.Paused).toBe(true);
 expect(desktopState.get().screen).toBe('pause');
 const tick=session.get().game!.Tick;
 input.key(39,false);await step(3);
 expect(session.get().game!.Tick).toBe(tick);
 input.key(39,true);await step(1);
 expect(session.get().game!.Paused).toBe(false);
 expect(desktopState.get().screen).toBe('play');
 expect(session.get().game!.Tick).toBe(tick+1);
},{scene});

worldTest('arcade semantic pause keeps desktop presentation synchronized',async({input,step,cheat})=>{
 await step(2);await cheat(ResetArcade,{ready:false});
 input.emit(ArcadeInput,{player:0,move:0,jump:false,fire:false,paused:true});await step(1);
 expect(session.get().game!.Paused).toBe(true);expect(desktopState.get().screen).toBe('pause');
 const tick=session.get().game!.Tick;
 input.emit(ArcadeInput,{player:0,move:0,jump:false,fire:false,paused:false});await step(1);
 expect(session.get().game!.Paused).toBe(false);expect(desktopState.get().screen).toBe('play');
 expect(session.get().game!.Tick).toBe(tick+1);
},{scene});

worldTest('arcade recorded controller moves fires and pauses classic campaign',async({input,step,cheat})=>{
 await step(2);await cheat(ResetArcade,{ready:false});
 const inject=(events:unknown[])=>(globalThis as unknown as {__gameengine_host:(op:string,arg:string)=>string}).__gameengine_host('test.input',JSON.stringify(events));
 const start=session.get().game!.Players[0]!.X;
 inject([{type:'gamepadAxis',pad:0,axis:0,value:1},{type:'gamepadButton',pad:0,button:2,down:true}]);await step(2);
 expect(session.get().game!.Players[0]!.X>start).toBe(true);
 expect(session.get().game!.Bubbles.length>0).toBe(true);
 inject([{type:'gamepadAxis',pad:0,axis:0,value:0},{type:'gamepadButton',pad:0,button:2,down:false},{type:'gamepadButton',pad:0,button:6,down:true}]);await step(1);
 expect(session.get().game!.Paused).toBe(true);expect(desktopState.get().screen).toBe('pause');
 const tick=session.get().game!.Tick;
 inject([{type:'gamepadButton',pad:0,button:6,down:false}]);await step(4);expect(session.get().game!.Tick).toBe(tick);
 inject([{type:'gamepadButton',pad:0,button:6,down:true}]);await step(1);
 expect(session.get().game!.Paused).toBe(false);expect(desktopState.get().screen).toBe('play');
},{scene});
