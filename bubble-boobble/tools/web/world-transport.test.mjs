import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from '../../.gameengine/engine/node_modules/esbuild/lib/main.js';
const result=await build({entryPoints:['src/online/world-transport.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'isolated-engine-contract',setup(api){
 api.onResolve({filter:/^@gameengine\/runtime$/},()=>({path:'runtime',namespace:'fixture'}));
 api.onResolve({filter:/desktop\/build-flags$/},()=>({path:'flags',namespace:'fixture'}));
 api.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='flags'?'export const WEB_BUILD=true;':'export const multiplayer={world:{connect(){throw new Error("Inject a test connection");}}};',loader:'js'}));
}}]});
const {openWorldTransport,browserWorldControls}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
function connection(){const sent=[];let handler;let unsubscribed=0,closed=0;return {sent,get handler(){return handler;},get closed(){return closed;},get unsubscribed(){return unsubscribed;},send(value){sent.push(value);},subscribe(value){handler=value;return()=>{handler=null;unsubscribed++;};},close(){closed++;},poll(){return[];}};}
test('world transport sends compact controls, changes and heartbeat without a fixed-seat identity',async()=>{
 const peer=connection(),events=[];let now=1000,options;
 const transport=await openWorldTransport({server:'wss://arena/socket',name:'Dragon',onEvent:e=>events.push(e)},{connect:async value=>{options=value;return peer;},now:()=>now});
 assert.deepEqual(options,{server:'wss://arena/socket',name:'Dragon'});
 const controls={move:1,jump:true,fire:false};assert.equal(transport.sendControls(controls),true);assert.equal(transport.sendControls(controls),false);
 now=1249;assert.equal(transport.sendControls(controls),false);now=1250;assert.equal(transport.sendControls(controls),true);
 transport.sendControls({move:-1,jump:false,fire:true});
 assert.deepEqual(peer.sent,[{action:'controls',...controls},{action:'controls',...controls},{action:'controls',move:-1,jump:false,fire:true}]);
 peer.handler({kind:'welcome',player:17,version:1});assert.equal(events[0].player,17);
 transport.releaseNeutral();assert.deepEqual(peer.sent.at(-1),{action:'controls',move:0,jump:false,fire:false});
 transport.close();transport.close();assert.equal(peer.closed,1);assert.equal(peer.unsubscribed,1);assert.equal(transport.sendControls(controls),false);
});
test('world transport clamps malformed local controls and cleans up failed subscriptions',async()=>{
 const peer=connection(),transport=await openWorldTransport({server:'ws://local',name:'Dragon',onEvent:()=>{}},{connect:async()=>peer,now:()=>0});
 transport.sendControls({move:Infinity,jump:1,fire:true,player:99});assert.deepEqual(peer.sent[0],{action:'controls',move:0,jump:false,fire:true});
 transport.sendControls({move:-3,jump:false,fire:false});assert.equal(peer.sent[1].move,-1);
 const failed=connection();failed.subscribe=()=>{throw new Error('subscription failed');};
 await assert.rejects(()=>openWorldTransport({server:'ws://local',name:'Dragon',onEvent:()=>{}},{connect:async()=>failed}),/subscription failed/);assert.equal(failed.closed,1);
});
test('browser capability drains bounded intent batches and never injects actor identity',()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'parent');
 try{
  Object.defineProperty(globalThis,'parent',{configurable:true,value:{__bubbleBrowser:{protocol:1,worldControls:()=>[{move:8,jump:true,fire:false,player:6}]}}});
  assert.deepEqual(browserWorldControls(),[{move:1,jump:true,fire:false}]);
  globalThis.parent.__bubbleBrowser.worldControls=()=>Array(65).fill({move:1,jump:true,fire:true});assert.deepEqual(browserWorldControls(),[{move:0,jump:false,fire:false}]);
 }finally{if(original)Object.defineProperty(globalThis,'parent',original);else delete globalThis.parent;}
});
