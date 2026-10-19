import { worldTest, expect } from '@gameengine/test';
import { ActionState } from '@gameengine/runtime';
import { createPartyPads, reducePartyPadInput, readPartyAction, applyPartyAction, partyPads } from '../src/arcade/party-input';

declare const __gameengine_host: (op:string,arg:string)=>string;
const inject=(events:unknown[])=>__gameengine_host('test.input',JSON.stringify(events));
worldTest('party recorded raw events support all six pad indices',async({world,step})=>{
 for(let pad=0;pad<6;pad++){
  inject([{type:'gamepadAxis',pad,axis:0,value:pad%2?-1:1},{type:'gamepadButton',pad,button:0,down:true}]);
  await step(1);
  const pads=partyPads.get().pads;
  for(let slot=0;slot<6;slot++){
   expect(pads[slot]!.axis).toBe(slot===pad?(pad%2?-1:1):0);
   expect(pads[slot]!.jump).toBe(slot===pad);
  }
  inject([{type:'gamepadAxis',pad,axis:0,value:0},{type:'gamepadButton',pad,button:0,down:false}]);
  await step(1);
 }
},{scene:'scenes/arcade.scene.json'});
worldTest('party six pad isolation held input and edge controls',async()=>{
 let frame=reducePartyPadInput(createPartyPads(),Array.from({length:6},(_,pad)=>({type:'gamepadButton',pad,button:0,down:true})));
 expect(frame.inputs.slice(0,6).map(p=>p.Jump)).toEqual([true,true,true,true,true,true]);
 frame=reducePartyPadInput(frame.pads,[{type:'gamepadAxis',pad:5,axis:0,value:-0.8},{type:'gamepadButton',pad:4,button:2,down:true},{type:'gamepadButton',pad:5,button:6,down:true},{type:'gamepadButton',pad:2,button:0,down:false}]);
 expect(frame.inputs.slice(0,6).map(p=>p.Move)).toEqual([0,0,0,0,0,-0.8]);
 expect(frame.inputs.slice(0,6).map(p=>p.Fire)).toEqual([false,false,false,false,true,false]);
 expect(frame.inputs.slice(0,6).map(p=>p.Jump)).toEqual([true,true,false,true,true,true]);
 expect(frame.joinedSlots).toEqual([5]);expect(frame.pause).toBe(true);
 frame=reducePartyPadInput(frame.pads,[]);
 expect(frame.inputs[5]!.Move).toBe(-0.8);expect(frame.inputs[4]!.Fire).toBe(true);
 expect(frame.joinedSlots).toEqual([]);expect(frame.pause).toBe(false);
 frame=reducePartyPadInput(frame.pads,[{type:'gamepadButton',pad:5,button:6,down:true}]);
 expect(frame.pause).toBe(false);
 frame=reducePartyPadInput(frame.pads,[{type:'gamepadButton',pad:5,button:6,down:false},{type:'gamepadButton',pad:5,button:6,down:true}]);
 expect(frame.pause).toBe(true);
});
worldTest('party dpad deadzone and invalid pad safety',async()=>{
 const original=createPartyPads();
 const frame=reducePartyPadInput(original,[{type:'gamepadAxis',pad:0,axis:0,value:0.2},{type:'gamepadButton',pad:1,button:13,down:true},{type:'gamepadButton',pad:10,button:0,down:true},{type:'gamepadButton',pad:-1,button:0,down:true},{type:'gamepadAxis',pad:3,axis:0,value:NaN}]);
 expect(frame.inputs[0]!.Move).toBe(0);expect(frame.inputs[1]!.Move).toBe(-1);
 expect(frame.inputs[3]!.Move).toBe(0);expect(original[1]!.left).toBe(false);
});
worldTest('party named actions preserve keyboard and combine with pad',async()=>{
 const inputs=reducePartyPadInput(createPartyPads(),[{type:'gamepadButton',pad:0,button:0,down:true}]).inputs;
 for(const action of [readPartyAction('partyMove1',1,true,true),readPartyAction('partyJump1',0,false,false),readPartyAction('partyFire6',1,true,true)]){
  if(action)applyPartyAction(inputs,action);
 }
 expect(inputs[0]).toEqual({Move:1,Jump:true,Fire:false});expect(inputs[5]!.Fire).toBe(true);
 for(const name of ['move','partyMove0','partyMove11','partyMove01','partyFire1extra','partyUnknown1'])expect(readPartyAction(name,1,true,true)).toBe(null);
});
worldTest('party menus accept recorded controller input and keyboard fallback',async({world,step,input})=>{
 inject([{type:'gamepadAxis',pad:5,axis:1,value:1},{type:'gamepadButton',pad:5,button:1,down:true}]);
 input.key(4,true);await step(1); // Engine physical D
 const states=world.entities(ActionState).map(e=>world.get(e,ActionState));
 expect(partyPads.get().pads[5]!.axisY).toBe(1);
 expect(partyPads.get().pads[5]!.back).toBe(true);
 expect(states.find(a=>a.name==='partyMove1')!.value).toBe(1);
 expect(states.find(a=>a.name==='partyMove6')!.value).toBe(0);
},{scene:'scenes/arcade.scene.json'});

worldTest('party menu stick edges ignore neutral pads and preserve negative directions',async()=>{
 let f=reducePartyPadInput(createPartyPads(),[{type:'gamepadAxis',pad:0,axis:0,value:0},{type:'gamepadAxis',pad:5,axis:0,value:-1},{type:'gamepadAxis',pad:4,axis:1,value:-1}]);
 expect(f.menuXEdge).toBe(-1);expect(f.menuYEdge).toBe(-1);
 f=reducePartyPadInput(f.pads,[]);expect(f.menuXEdge).toBe(0);expect(f.menuYEdge).toBe(0);
 f=reducePartyPadInput(f.pads,[{type:'gamepadAxis',pad:5,axis:0,value:1},{type:'gamepadButton',pad:4,button:12,down:true}]);
 expect(f.menuXEdge).toBe(1);expect(f.menuYEdge).toBe(1);
});

worldTest('party menu confirm back edges isolate pads and short taps',async()=>{
 let f=reducePartyPadInput(createPartyPads(),[{type:'gamepadButton',pad:5,button:0,down:true},{type:'gamepadButton',pad:3,button:1,down:true}]);
 expect(f.menuConfirm).toBe(true);expect(f.menuBack).toBe(true);
 f=reducePartyPadInput(f.pads,[]);expect(f.menuConfirm).toBe(false);expect(f.menuBack).toBe(false);
 f=reducePartyPadInput(f.pads,[{type:'gamepadButton',pad:5,button:0,down:true},{type:'gamepadButton',pad:3,button:1,down:true}]);
 expect(f.menuConfirm).toBe(false);expect(f.menuBack).toBe(false);
 f=reducePartyPadInput(f.pads,[{type:'gamepadButton',pad:5,button:0,down:false},{type:'gamepadButton',pad:5,button:0,down:true},{type:'gamepadButton',pad:5,button:0,down:false}]);
 expect(f.menuConfirm).toBe(true);expect(f.inputs[5]!.Jump).toBe(false);
});
