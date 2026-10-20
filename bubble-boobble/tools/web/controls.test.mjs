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
