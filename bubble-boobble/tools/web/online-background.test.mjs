import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldBackgroundTransport} from '../../web/online-background.mjs';
const encode=value=>new TextEncoder().encode(JSON.stringify(value));
const parse=value=>JSON.parse(new TextDecoder().decode(value));
function fixture(){
 let hidden=true;const sent=[],received=[];
 const native={binaryType:'',readyState:1,bufferedAmount:0,send:value=>sent.push(value),close(){this.readyState=3;}};
 const adapter=createWorldBackgroundTransport({factory:()=>native,hidden:()=>hidden,decode:value=>[value]});
 const socket=adapter.create('wss://world',[]);socket.onmessage=event=>received.push(event.data);
 const hello=()=>socket.send(encode({kind:'hello',version:1,game:'bubble',build:'abc',name:'DRAGON'}));
 const receive=value=>native.onmessage({data:encode(value).buffer});
 return {adapter,native,socket,sent,received,hello,receive,show(){hidden=false;}};
}
test('world-only hidden snapshots retain latest exact bytes and leave welcome/error delivery to SDK',()=>{
 const f=fixture();f.hello();f.receive({kind:'welcome',player:7,version:1});
 const last=encode({kind:'snapshot',tick:99,document:{room:'unchanged'}});
 f.receive({kind:'snapshot',tick:12,document:{}});f.native.onmessage({data:last.buffer});f.receive({kind:'snapshot',tick:80,document:{}});
 f.receive({kind:'error',error:'unchanged'});assert.equal(f.received.length,2);
 f.adapter.flush();assert.equal(f.received.length,2);f.show();f.adapter.flush();
 assert.equal(f.received.length,3);assert.deepEqual(new Uint8Array(f.received[2]),last);f.adapter.flush();assert.equal(f.received.length,3);
});
test('background pings get legal binary SDK world heartbeat and never gameplay or leave input',()=>{
 const f=fixture();f.hello();f.receive({kind:'ping'});f.receive({kind:'pong'});
 assert.deepEqual(f.sent.map(parse),[{kind:'hello',version:1,game:'bubble',build:'abc',name:'DRAGON'},{kind:'ping'}]);
 assert.equal(f.received.length,0);f.native.bufferedAmount=1024*1024;f.receive({kind:'ping'});assert.equal(f.sent.length,2);
});
test('nonworld, malformed and unknown packets keep native SDK validation and limits',()=>{
 const f=fixture();f.receive({kind:'snapshot',tick:1,document:{}});assert.equal(f.received.length,1);
 f.hello();f.receive({kind:'snapshot',tick:-1,document:{}});f.receive({kind:'unknown'});
 f.native.onmessage({data:encode({kind:'snapshot',tick:2}).buffer});
 const oversized=new Uint8Array(256*1024+1);f.native.onmessage({data:oversized.buffer});
 assert.equal(f.received.length,5);assert.equal(f.received.at(-1),oversized.buffer);
});
test('actual close, explicit close and disposal discard cached snapshots without reconnecting',()=>{
 for(const mode of ['native','explicit','dispose']){
  const f=fixture();f.hello();f.receive({kind:'snapshot',tick:1,document:{}});
  let closes=0;f.socket.onclose=()=>closes++;
  if(mode==='native')f.native.onclose({code:1006});else if(mode==='explicit')f.socket.close(1000,'leave');else f.adapter.dispose();
  f.show();f.adapter.flush();f.receive({kind:'snapshot',tick:2,document:{}});assert.equal(f.received.length,0);assert.equal(closes,mode==='native'?1:0);
 }
});
