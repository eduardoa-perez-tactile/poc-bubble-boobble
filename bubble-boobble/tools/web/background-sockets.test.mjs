// Pure configured engine transport tests: no browser, WASM, renderer, or game simulation.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createWorldBackgroundTransport} from '../../web/online-background.mjs';
const project=fileURLToPath(new URL('../..',import.meta.url));
const {engineRoot}=JSON.parse(readFileSync(resolve(project,'.gameengine/web-toolchain.json'),'utf8'));
const {BrowserSockets,SOCKET_LIMITS}=await import(pathToFileURL(resolve(engineRoot,'platform/web/sockets.ts')).href);
const {worldMessages}=await import(pathToFileURL(resolve(engineRoot,'packages/runtime/src/world-wire.ts')).href);
const encoder=new TextEncoder(),decoder=new TextDecoder(),encode=value=>encoder.encode(JSON.stringify(value));
const snapshot=(tick,size=14*1024)=>encode({kind:'snapshot',tick,document:{payload:'x'.repeat(size-100)}});
function batch(messages){const result=[0];for(const message of messages){let length=message.length;do{let byte=length&127;length>>>=7;if(length)byte|=128;result.push(byte);}while(length);for(const byte of message)result.push(byte);}return new Uint8Array(result);}
function fixture(adapt=false){
 let hidden=true;const closed=[],sent=[];
 const socket={readyState:1,bufferedAmount:0,binaryType:'',onopen:null,onmessage:null,onerror:null,onclose:null,
  send(data){sent.push(typeof data==='string'?encoder.encode(data):new Uint8Array(data).slice());},close(code,reason){closed.push({code,reason});this.readyState=3;}};
 const adapter=adapt?createWorldBackgroundTransport({factory:()=>socket,hidden:()=>hidden,decode:worldMessages}):null;
 const clock={setTimeout:()=>1,clearTimeout(){}};
 const transport=new BrowserSockets(adapter?adapter.create:()=>socket,clock),owner=transport.create();
 assert.equal(transport.open(owner,1,'wss://example.invalid',[]),0);socket.onopen();assert.equal(transport.take(owner).kind,1);
 return {socket,adapter,transport,owner,closed,sent,setHidden(value){hidden=value;},
  packet(data){socket.onmessage?.({data:data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)});},
  hello(){const data=encode({kind:'hello',version:1,game:'bubble',build:'hash',name:'dragon'});assert.equal(transport.send(owner,1,data,true),0);},
  dispose(){adapter?.dispose();transport.dispose();}};
}
const take=f=>f.transport.take(f.owner);

test('pinned engine hidden socket without polling overflows in about seven seconds',()=>{
 const f=fixture();let received=0;
 while(!f.closed.length&&received<300){f.packet(new Uint8Array(14*1024));received++;}
 assert.equal(received,Math.floor(SOCKET_LIMITS.queueBytes/(14*1024))+1);assert.ok(received*50>=7000&&received*50<8000);
 const close=take(f);assert.equal(close.kind,4);assert.equal(close.code,1013);
 assert.match(decoder.decode(close.data),/Receive limit exceeded.*E_OVERFLOW/);assert.deepEqual(f.closed,[{code:1000,reason:'Transport ended'}]);f.dispose();
});

test('hidden world survives one minute at twenty maximum snapshots per second without any WASM polling',()=>{
 const f=fixture(true);f.hello();let latest;
 for(let tick=1;tick<=1200;tick++){latest=snapshot(tick,240*1024);f.packet(latest);if(tick%100===0)f.packet(encode({kind:'ping'}));}
 assert.equal(f.closed.length,0);assert.equal(take(f),undefined,'hidden snapshots never enter the engine queue');
 assert.equal(f.sent.length,13);for(const reply of f.sent.slice(1))assert.deepEqual(JSON.parse(decoder.decode(reply)),{kind:'ping'});
 // Foreground flush is one exact latest packet, never a fabricated document or clock.
 f.setHidden(false);f.adapter.flush();const resumed=take(f);assert.equal(resumed.kind,3);assert.deepEqual(resumed.data,latest);assert.equal(take(f),undefined);
 f.adapter.flush();assert.equal(take(f),undefined);f.dispose();
});

test('mixed world batches preserve controls while caching snapshots and answering heartbeat',()=>{
 const f=fixture(true);f.hello();const latest=snapshot(40),welcome=encode({kind:'welcome',player:3,version:1}),unknown=encode({kind:'unexpected',value:42});
 f.packet(batch([welcome,snapshot(39),encode({kind:'ping'}),latest,unknown]));
 assert.deepEqual(take(f).data,welcome);assert.deepEqual(take(f).data,unknown);assert.equal(take(f),undefined);
 assert.deepEqual(JSON.parse(decoder.decode(f.sent.at(-1))),{kind:'ping'});
 f.setHidden(false);f.adapter.flush();assert.deepEqual(take(f).data,latest);f.dispose();
});

test('malformed batches pass through intact for SDK validation and oversized input keeps engine bounds',()=>{
 const f=fixture(true);f.hello();const malformed=batch([snapshot(1),encoder.encode('{bad json')]);f.packet(malformed);
 assert.deepEqual(take(f).data,malformed);f.setHidden(false);f.adapter.flush();assert.equal(take(f),undefined,'malformed packet cannot secretly cache its first snapshot');
 f.setHidden(true);f.packet(new Uint8Array(256*1024+1));const close=take(f);assert.equal(close.kind,4);assert.match(decoder.decode(close.data),/E_TOO_LARGE/);f.dispose();
});

test('generic sockets retain original engine overflow behavior and actual close discards cached world state',()=>{
 const generic=fixture(true);for(let i=0;i<147;i++)generic.packet(new Uint8Array(14*1024));assert.equal(take(generic).code,1013);generic.dispose();
 const world=fixture(true);world.hello();world.packet(snapshot(8));world.socket.onclose({code:1006,reason:'Connection lost'});
 assert.equal(take(world).kind,4);world.setHidden(false);world.adapter.flush();assert.equal(take(world),undefined);world.dispose();
});
