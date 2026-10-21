import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GamepadBridge } from '../../web/controls.mjs';
const pad=(index,buttons=[],axes=[0,0])=>({index,connected:true,mapping:'standard',axes,buttons:Array.from({length:17},(_,i)=>({pressed:buttons.includes(i)}))});
test('ten controllers map to separate engine seats and release on disconnect',()=>{
 const events=[];const bridge=new GamepadBridge(e=>events.push(e));
 assert.equal(bridge.poll(Array.from({length:10},(_,i)=>pad(i,[0,2,9],[i%2?-1:1,0]))),10);
 for(let i=0;i<10;i++){
  assert.ok(events.some(e=>e[0]===5&&e[1]===i&&e[5]===0&&e[7]===1));
  assert.ok(events.some(e=>e[0]===5&&e[1]===i&&e[5]===2&&e[7]===1));
  assert.ok(events.some(e=>e[0]===5&&e[1]===i&&e[5]===6&&e[7]===1));
 }
 events.length=0;bridge.poll([]);
 assert.equal(events.filter(e=>e[0]===5&&e[7]===0).length,30);
 assert.equal(events.filter(e=>e[0]===6&&e[3]===0).length,10);
});
test('seat assignment survives list reorder and suspension releases held input',()=>{
 const events=[];const bridge=new GamepadBridge(e=>events.push(e));
 bridge.poll([pad(2,[0]),pad(5,[2])]);
 events.length=0;bridge.poll([pad(5,[2]),pad(2,[0])]);assert.equal(events.length,0);
 bridge.poll([pad(2,[0]),pad(5,[2])],false);
 assert.equal(events.filter(e=>e[0]===5&&e[7]===0).length,2);
 events.length=0;bridge.poll([pad(2,[0]),pad(5,[2])],true,true);
 assert.ok(events.some(e=>e[1]===0&&e[5]===0&&e[7]===1));
 assert.ok(events.some(e=>e[1]===1&&e[5]===2&&e[7]===1));
});

import { VirtualPad } from '../../web/touch-controls.mjs';
test('virtual pad chords, duplicate fingers, short taps and cancellation preserve edges',()=>{
 const events=[]; const bridge=new GamepadBridge(e=>events.push(e)); const virtual=new VirtualPad();
 const poll=()=>bridge.poll([],true,false,virtual);
 virtual.press(1,13);poll(); virtual.press(2,0);poll(); virtual.press(3,2);poll();
 assert.deepEqual(events.map(e=>[e[5],e[7]]),[[13,1],[0,1],[2,1]]);
 events.length=0; virtual.press(4,2);poll();virtual.release(3);poll();assert.equal(events.length,0);
 virtual.release(4);poll();assert.deepEqual(events.map(e=>[e[5],e[7]]),[[2,0]]);
 events.length=0;virtual.reset();poll();assert.deepEqual(events.map(e=>[e[5],e[7]]),[[0,0],[13,0]]);
 events.length=0;virtual.press(5,6);poll();virtual.release(5);poll();
 assert.deepEqual(events.map(e=>[e[5],e[7]]),[[6,1],[6,0]]);
});
test('virtual and physical holds merge on seat zero and suspension releases both',()=>{
 const events=[];const bridge=new GamepadBridge(e=>events.push(e));const virtual=new VirtualPad();
 virtual.press(1,2);bridge.poll([pad(0,[2])],true,false,virtual);
 events.length=0;virtual.reset();bridge.poll([pad(0,[2])],true,false,virtual);assert.equal(events.length,0);
 virtual.press(2,13);bridge.poll([pad(0,[2])],true,false,virtual);
 events.length=0;bridge.poll([pad(0,[2])],false,false,virtual);
 assert.deepEqual(events.map(e=>[e[5],e[7]]),[[2,0],[13,0]]);
});

test('floating joystick anchors at touch, clamps travel and rejects a second owner',()=>{
 const virtual=new VirtualPad();
 assert.equal(virtual.beginStick(1,90,160),true);
 assert.equal(virtual.beginStick(2,20,20),false);
 assert.equal(virtual.moveStick(2,900,900),false);
 assert.equal(virtual.axis(0),0);
 virtual.moveStick(1,106,160);assert.equal(virtual.axis(0),.5);
 virtual.moveStick(1,-900,160);assert.equal(virtual.axis(0),-1);
 virtual.moveStick(1,90,190);assert.equal(virtual.axis(0),0);assert.equal(virtual.axis(1),0);
 assert.equal(virtual.stick.x,90);assert.equal(virtual.stick.y,160);
 virtual.press(2,0);virtual.press(3,2);virtual.release(2);
 assert.equal(virtual.stick.id,1);assert.equal(virtual.down(2),true);
 virtual.release(1);assert.equal(virtual.stick,null);assert.equal(virtual.axis(0),0);assert.equal(virtual.down(2),true);
 virtual.reset();assert.equal(virtual.down(2),false);
});
test('floating joystick sends recorded analog edges, deadzone, chords and neutral on release',()=>{
 const events=[];const bridge=new GamepadBridge(e=>events.push(e));const virtual=new VirtualPad();
 const poll=()=>bridge.poll([],true,false,virtual);
 virtual.beginStick(1,100,100);virtual.moveStick(1,104,100);poll();assert.equal(events.length,0);
 virtual.moveStick(1,116,100);virtual.press(2,0);virtual.press(3,2);poll();
 assert.ok(events.some(e=>e[0]===6&&e[1]===0&&e[5]===0&&e[3]===.5));
 assert.equal(events.filter(e=>e[0]===5&&e[7]===1).length,2);
 events.length=0;virtual.release(1);poll();
 assert.deepEqual(events.map(e=>[e[0],e[3]]),[[6,0]]);
 assert.equal(virtual.down(0),true);assert.equal(virtual.down(2),true);
 events.length=0;virtual.reset();poll();assert.equal(events.filter(e=>e[0]===5&&e[7]===0).length,2);
});
test('physical and floating joystick keep strongest movement and release on suspension',()=>{
 const events=[];const bridge=new GamepadBridge(e=>events.push(e));const virtual=new VirtualPad();
 virtual.beginStick(1,100,100);virtual.moveStick(1,68,100);
 bridge.poll([pad(0,[],[.5,0])],true,false,virtual);
 assert.ok(events.some(e=>e[0]===6&&e[3]===-1));
 events.length=0;virtual.release(1);bridge.poll([pad(0,[],[.5,0])],true,false,virtual);
 assert.ok(events.some(e=>e[0]===6&&e[3]===.5));
 events.length=0;bridge.poll([pad(0,[],[.5,0])],false,false,virtual);
 assert.ok(events.some(e=>e[0]===6&&e[3]===0));
});

test('touch overlay only captures gameplay, handles cancel and releases on screen/focus changes',async()=>{
 const {installTouchControls}=await import('../../web/touch-controls.mjs');
 class Element extends EventTarget {
  constructor(){super();this.hidden=false;this.style={};this.dataset={};this.classes=new Set();this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),toggle:(x,on)=>on?this.classes.add(x):this.classes.delete(x)};}
  setAttribute(){} setPointerCapture(){} focus(){}
  getBoundingClientRect(){return {left:0,top:72};}
 }
 const panel=new Element(),zone=new Element(),stick=new Element(),nub=new Element();
 const buttons=[6,0,2].map(button=>{const e=new Element();e.dataset.pad=String(button);return e;});
 panel.querySelector=selector=>({'.touch-zone':zone,'.touch-stick':stick,'.touch-nub':nub}[selector]);
 panel.querySelectorAll=()=>buttons;
 const launch={hidden:true},fullscreen={open:false},canvas=new Element(),doc=new EventTarget(),win=new EventTarget(),media=new EventTarget();
 doc.createElement=()=>panel;doc.body={append(){}};doc.hidden=false;
 doc.querySelector=selector=>selector==='#launch'?launch:fullscreen;media.matches=true;
 const originals=new Map();
 for(const [name,value] of Object.entries({document:doc,window:win,matchMedia:()=>media,MutationObserver:class{observe(){}}})){
  originals.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,configurable:true,writable:true});
 }
 const pointer=(element,type,values={})=>{const event=new Event(type,{cancelable:true});Object.assign(event,{button:0,pointerId:1,clientX:90,clientY:180},values);element.dispatchEvent(event);return event;};
 try{
  const touch=installTouchControls(canvas,()=>{});
  assert.equal(panel.hidden,true);
  pointer(zone,'pointerdown');assert.equal(touch.pad.stick,null);
  touch.setPlaying(true);assert.equal(panel.hidden,false);
  assert.equal(pointer(zone,'pointerdown').defaultPrevented,true);
  assert.equal(stick.hidden,false);assert.equal(stick.style.left,'90px');assert.equal(stick.style.top,'108px');
  pointer(zone,'pointermove',{clientX:122});assert.equal(touch.pad.axis(0),1);
  pointer(buttons[1],'pointerdown',{pointerId:2});pointer(buttons[2],'pointerdown',{pointerId:3});
  pointer(zone,'pointercancel');assert.equal(stick.hidden,true);assert.equal(touch.pad.axis(0),0);assert.equal(touch.pad.down(0),true);assert.equal(touch.pad.down(2),true);
  touch.setPlaying(false);assert.equal(panel.hidden,true);assert.equal(touch.pad.down(0),false);assert.equal(touch.pad.down(2),false);
  touch.setPlaying(true);pointer(zone,'pointerdown');win.dispatchEvent(new Event('blur'));assert.equal(stick.hidden,true);
  pointer(zone,'pointerdown');win.dispatchEvent(new Event('resize'));assert.equal(stick.hidden,true);
  pointer(zone,'pointerdown');doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(panel.hidden,true);assert.equal(touch.pad.stick,null);
  doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(panel.hidden,false);assert.equal(touch.pad.stick,null);
  fullscreen.open=true;doc.dispatchEvent(new Event('bubble-visibility'));assert.equal(panel.hidden,true);
 }finally{for(const [name,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}
});

import { OnlineControlGate } from '../../web/controls.mjs';
test('online local menu clears mapped controls and blocks held keys until release',()=>{
 let resets=0;const gate=new OnlineControlGate(()=>resets++);
 assert.equal(gate.key('ArrowDown',true),false); // Offline menu navigation remains available.
 gate.set(true,true);assert.equal(gate.key('Space',true),false);
 gate.set(true,false);assert.equal(resets,1);assert.equal(gate.key('Space',true),true);
 assert.equal(gate.key('KeyA',true),true);assert.equal(gate.key('F11',true),false);
 gate.set(true,true);assert.equal(gate.key('Space',true),true);assert.equal(gate.key('KeyA',true),true);
 gate.key('Space',false);assert.equal(gate.key('Space',true),false);
 gate.set(false,false);assert.equal(gate.key('ArrowDown',true),false);assert.equal(gate.key('KeyA',true),false);
});
test('online menu requires neutral controller before restoring input after resume',()=>{
 const gate=new OnlineControlGate(()=>{});const events=[];const bridge=new GamepadBridge(e=>events.push(e));
 gate.set(true,true);bridge.poll([pad(0,[0,2],[1,0])],gate.padsAllowed([pad(0,[0,2],[1,0])]));
 events.length=0;gate.set(true,false);bridge.poll([pad(0,[0,2],[1,0])],gate.padsAllowed([pad(0,[0,2],[1,0])]));
 assert.equal(events.filter(e=>e[0]===5&&e[7]===0).length,2);assert.ok(events.some(e=>e[0]===6&&e[3]===0));
 gate.set(true,true);assert.equal(gate.padsAllowed([pad(0,[0])]),false);
 assert.equal(gate.padsAllowed([pad(0,[],[0,0])]),true);assert.equal(gate.padsAllowed([pad(0,[0])]),true);
});
test('standard controller d-pad feeds the same engine stick used by online movement',()=>{
 const events=[];const bridge=new GamepadBridge(e=>events.push(e));
 bridge.poll([pad(0,[14])]);assert.ok(events.some(e=>e[0]===6&&e[1]===0&&e[5]===0&&e[3]===-1));
 events.length=0;bridge.poll([pad(0,[15])]);assert.ok(events.some(e=>e[0]===6&&e[5]===0&&e[3]===1));
 events.length=0;bridge.poll([pad(0,[])]);assert.ok(events.some(e=>e[0]===6&&e[5]===0&&e[3]===0));
});

import { WorldControlBuffer } from '../../web/controls.mjs';
test('world controls preserve keyboard and short touch edges with only local intent fields',()=>{
 const gate=new OnlineControlGate(()=>{}),world=new WorldControlBuffer(gate),virtual=new VirtualPad();gate.set(true,true);
 gate.key('KeyD',true);world.sample([],virtual,true);
 virtual.press(1,0);virtual.press(2,2);world.sample([],virtual,true);
 virtual.reset();world.sample([],virtual,true);
 assert.deepEqual(world.drain(),[{move:1,jump:false,fire:false},{move:1,jump:true,fire:true},{move:1,jump:false,fire:false}]);
 assert.deepEqual(world.drain(),[{move:1,jump:false,fire:false}]); // Current state is available for heartbeat.
 gate.key('KeyD',false);world.sample([],virtual,true);assert.equal(world.drain()[0].move,0);
});
test('world controls flush queued gameplay on menu and require fresh keyboard/pad input',()=>{
 const gate=new OnlineControlGate(()=>{}),world=new WorldControlBuffer(gate);gate.set(true,true);
 gate.key('Space',true);world.sample([pad(0,[0],[1,0])],null,true,true);
 gate.set(true,false);world.sample([],null,false,false);
 assert.deepEqual(world.drain(),[{move:0,jump:false,fire:false}]);
 gate.set(true,true);const held=[pad(0,[0],[1,0])];world.sample(held,null,true,gate.padsAllowed(held));assert.deepEqual(world.drain(),[{move:0,jump:false,fire:false}]);
 gate.key('Space',false);gate.key('Space',true);world.sample([],null,true,gate.padsAllowed([]));assert.equal(world.drain()[0].fire,true);
});
test('world primary standard controller is stable and merges strongest touch/keyboard input',()=>{
 const gate=new OnlineControlGate(()=>{}),world=new WorldControlBuffer(gate),virtual=new VirtualPad();gate.set(true,true);
 world.sample([pad(5,[0],[.5,0]),pad(9,[2],[-1,0])],null,true);assert.deepEqual(world.drain(),[{move:.5,jump:true,fire:false}]);
 world.sample([pad(9,[2],[-1,0]),pad(5,[0],[.5,0])],null,true);assert.deepEqual(world.drain(),[{move:.5,jump:true,fire:false}]);
 virtual.beginStick(1,100,100);virtual.moveStick(1,68,100);world.sample([pad(5,[0],[.5,0])],virtual,true);assert.equal(world.drain()[0].move,-1);
 world.sample([pad(9,[2],[-1,0])],null,true);assert.deepEqual(world.drain(),[{move:-1,jump:false,fire:true}]);
});
test('world control queue is bounded and overflow suspends held controls to neutral',()=>{
 const gate=new OnlineControlGate(()=>{}),world=new WorldControlBuffer(gate);gate.set(true,true);
 for(let i=0;i<65;i++)world.sample([pad(0,i%2?[]:[0])],null,true);
 assert.deepEqual(world.drain(),[{move:0,jump:false,fire:false}]);assert.equal(gate.padNeutral,true);
 world.sample([],null,false);const copy=world.drain();copy[0].fire=true;assert.equal(world.drain()[0].fire,false);
});
