// No-GPU controller regression: a healthy HTTP service with a failed music backend.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {spawn,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {setTimeout as delay} from 'node:timers/promises';
import {build} from '../../.gameengine/engine/node_modules/esbuild/lib/main.js';
import {guardRequest} from './bridge-http.mjs';
const launchId='a'.repeat(64),token='b'.repeat(64);
let error='helper startup failed',revision=0,acks=0,polls=0,healthRequests=0,host,client,log='',address;
const server=createServer(guardRequest(async(req,res)=>{
 res.setHeader('content-type','application/json');
 if(req.url==='/health'){
  await delay(120);
  if(++healthRequests===1){res.writeHead(503);res.end('{}');return;}
  res.end(JSON.stringify({bundleId:'bubbleboobble.desktop',protocol:1,launchId,token}));return;}
 assert.equal(req.headers.authorization,`Bearer ${token}`);
 if(req.url==='/state'){for await(const chunk of req){}await delay(120);acks++;res.end(JSON.stringify({ok:true,revision:++revision}));return;}
 if(req.url==='/status'){polls++;res.end(JSON.stringify({launchId,revision,error,windowReady:true,adapterActive:true,focused:false}));return;}
 res.writeHead(404);res.end('{}');
}));
try{
 server.listen(47681,'127.0.0.1');await once(server,'listening');
 mkdirSync('.cache/desktop',{recursive:true});
 const bundle=JSON.parse(execFileSync('gameengine',['bundle','--json'],{encoding:'utf8'})).path;
 const path=resolve('.cache/desktop/bridge-failure-game.js');
 writeFileSync(path,`Object.defineProperty(globalThis,'__bubbleDesktopLaunch',{value:Object.freeze({launchId:'${launchId}'}),writable:false,configurable:false});\n`+readFileSync(bundle,'utf8'));
 await build({entryPoints:['.gameengine/engine/packages/protocol-client/src/index.ts'],outfile:'.cache/desktop/bridge-failure-protocol.cjs',bundle:true,platform:'node',format:'cjs',target:'es2022'});
 const {GameEngineClient}=createRequire(import.meta.url)(resolve('.cache/desktop/bridge-failure-protocol.cjs'));
 host=spawn(resolve('.gameengine/engine/target/release/gameengine-host'),['--mode','headless','--project',process.cwd(),'--bundle',path,'--serve','127.0.0.1:0','--paused','--no-gpu','--ui-layout'],{stdio:['ignore','pipe','pipe']});
 host.stdout.on('data',d=>{log+=d;for(const line of log.split('\n'))try{const value=JSON.parse(line);if(value.ws&&value.token)address=value;}catch{}});host.stderr.on('data',d=>log+=d);
 for(let i=0;i<200&&!address;i++)await delay(25);assert.ok(address,log);
 client=await GameEngineClient.connect(address,{client:'desktop-backend-failure-regression'});
 const observed=[];
 async function pump(steps,expected){
  for(let i=0;i<steps;i++){
   await client.api.engine.step({n:1,frames:true});await delay(10);
   const audio=(await client.api.world.resources({})).resources.ArcadeAudio;
   observed.push(!!audio.native);
   if(expected!==undefined)assert.equal(!!audio.native,expected,`step ${i}, ACKs ${acks}, polls ${polls}`);
  }
 }
 await pump(420,false);assert.ok(acks>=3,`Expected repeated ACKs, got ${acks}`);assert.ok(polls>0,`No native status polls: ACKs ${acks}`);
 error='';
 for(let i=0;i<100&&!observed.at(-1);i++)await pump(1);
 assert.equal(observed.at(-1),true,'Healthy backend did not recover');await pump(30,true);
 error='Stateful music source ended unexpectedly';
 for(let i=0;i<100&&observed.at(-1);i++)await pump(1);
 assert.equal(observed.at(-1),false,'Failed backend did not restore fallback');
 const before=acks;await pump(260,false);assert.ok(acks>=before+2);
 error='';
 for(let i=0;i<100&&!observed.at(-1);i++)await pump(1);
 assert.equal(observed.at(-1),true,'Second recovery was not observed');
 console.log(JSON.stringify({pass:true,scope:'actual immutable-launch controller in UI-pumped no-GPU host, mock authenticated native backend',healthRequests,acks,polls,steps:observed.length}));
}finally{
 client?.close();
 if(host&&host.exitCode===null){host.kill('SIGTERM');await once(host,'exit');}
 server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
}
