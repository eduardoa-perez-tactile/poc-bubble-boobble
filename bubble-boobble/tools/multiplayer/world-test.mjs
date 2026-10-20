#!/usr/bin/env node
// Actual cooked engine authoritative world + raw Node protocol peers. No game rules run here.
// This is transport/server evidence, not a compiled browser client or browser acceptance.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {worldMessages} from '../../.gameengine/engine/packages/runtime/src/world-wire.ts';

const project=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const room=(document,id)=>document?.rooms?.find(value=>value.id===id);
const actor=(game,index)=>Object.fromEntries((game?.actors?.Players?.fields??[]).map((field,i)=>[field,game.actors.Players.rows[index]?.[i]]));
const publicDocument=value=>{
 if(value?.version!==1||!Array.isArray(value.rooms)||!Array.isArray(value.peers))throw new Error('Expected version1 public world with rooms and peers.');
 return value;
};
class Peer {
 constructor(socket,name){this.socket=socket;this.name=name;this.player=null;this.document=null;this.tick=-1;this.history=new Map();this.sequence=0;this.error=null;this.waiters=new Set();this.controls=null;this.controlTimer=null;this.closed=false;this.receivedBytes=0;this.packets=0;this.snapshotCount=0;this.maxWebSocketPayloadBytes=0;this.maxDocumentBytes=0;this.startedAt=performance.now();socket.binaryType='arraybuffer';
  socket.addEventListener('message',event=>{
   try{const frame=typeof event.data==='string'?new TextEncoder().encode(event.data):new Uint8Array(event.data);this.receivedBytes+=frame.byteLength;this.packets++;this.maxWebSocketPayloadBytes=Math.max(this.maxWebSocketPayloadBytes,frame.byteLength);for(const bytes of worldMessages(frame)){const value=JSON.parse(new TextDecoder().decode(bytes));
    if(value.kind==='welcome')this.player=value.player;
    else if(value.kind==='snapshot'){this.snapshotCount++;this.maxDocumentBytes=Math.max(this.maxDocumentBytes,Buffer.byteLength(JSON.stringify(value.document)));this.document=publicDocument(value.document);this.tick=value.tick;this.history.set(this.tick,hash(this.document));while(this.history.size>40)this.history.delete(this.history.keys().next().value);}
    else if(value.kind==='ping')this.packet({kind:'ping'});
    else if(value.kind==='error')this.error=new Error(value.error);
   }}catch(error){this.error=error;}this.changed();
  });
  socket.addEventListener('error',()=>{this.error=new Error(`${this.name} WebSocket error`);this.changed();});
  socket.addEventListener('close',()=>{this.closed=true;this.changed();});
 }
 changed(){for(const check of [...this.waiters])check();}
 packet(data){this.socket.send(new TextEncoder().encode(JSON.stringify(data)));}
 send(data){this.packet({kind:'input',sequence:++this.sequence,data});}
 wait(predicate,label,timeout=20000){return new Promise((accept,reject)=>{const timer=setTimeout(()=>finish(new Error(`${this.name}: timed out ${label}; tick=${this.tick}`)),timeout);const finish=(error,value)=>{clearTimeout(timer);this.waiters.delete(check);error?reject(error):accept(value);};const check=()=>{try{if(this.error)return finish(this.error);if(predicate(this))return finish(null,this);if(this.closed)finish(new Error(`${this.name} closed while ${label}`));}catch(error){finish(error);}};this.waiters.add(check);check();});}
 hold(controls){this.stopControls();this.controls=controls;this.send({action:'controls',...controls});this.controlTimer=setInterval(()=>{if(!this.closed&&this.socket.readyState===WebSocket.OPEN)this.send({action:'controls',...controls});},200);}
 stopControls(){if(this.controlTimer)clearInterval(this.controlTimer);this.controlTimer=null;this.controls=null;}
 close(){this.stopControls();if(!this.closed)this.socket.close(1000,'Transport test complete');}
}
function processStats(pid){const r=spawnSync('ps',['-p',String(pid),'-o','cputime=','-o','rss='],{encoding:'utf8'});if(r.status!==0)return null;const [time,rss]=r.stdout.trim().split(/\s+/),parts=time?.split(':').map(Number);if(!parts?.length||parts.some(v=>!Number.isFinite(v)))return null;return{cpuMillis:parts.reduce((sum,v)=>sum*60+v,0)*1000,rssKiB:Number(rss)};}
async function connect(ready,name){const socket=new WebSocket(ready.listening),peer=new Peer(socket,name);await new Promise((accept,reject)=>{const timeout=setTimeout(()=>reject(new Error('WebSocket open timed out')),10000);socket.addEventListener('open',()=>{clearTimeout(timeout);accept();},{once:true});socket.addEventListener('error',()=>{clearTimeout(timeout);reject(new Error('WebSocket open failed'));},{once:true});});peer.packet({kind:'hello',version:1,game:ready.game,build:ready.build,name});await peer.wait(value=>value.player!==null&&!!value.document,'world welcome and first snapshot');return peer;}
async function startServer(host,cooked,out){let stdout='',stderr='';const child=spawn(host,['--mode=server','--project',project,'--cooked',cooked,'--authority','server','--listen','127.0.0.1:0'],{cwd:project,stdio:['ignore','pipe','pipe']});child.stderr.on('data',bytes=>{stderr=(stderr+bytes).slice(-128000);});let ready;try{ready=await new Promise((accept,reject)=>{let settled=false;const done=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):accept(value);};const timer=setTimeout(()=>done(new Error(`Cooked world startup timed out: ${stderr}`)),30000);child.once('error',error=>done(error));child.once('exit',code=>done(new Error(`Cooked world exited ${code}: ${stderr}`)));child.stdout.on('data',bytes=>{stdout=(stdout+bytes).slice(-128000);for(const line of stdout.split('\n'))try{const value=JSON.parse(line);if(value.ok&&value.world===true&&value.listening&&value.build)done(null,value);}catch{}});});}catch(error){child.kill('SIGTERM');writeFileSync(join(out,'server.stdout.txt'),stdout);writeFileSync(join(out,'server.stderr.txt'),stderr);throw error;}return{child,ready,logs(){writeFileSync(join(out,'server.stdout.txt'),stdout);writeFileSync(join(out,'server.stderr.txt'),stderr);}};}
export async function runWorldTest({cooked,host,out}){
 if(!existsSync(join(cooked,'code.gpak'))||!existsSync(join(cooked,'manifest.json')))throw new Error('Supply a real complete cooked game directory. This runner does not cook or change engine configuration.');
 mkdirSync(out,{recursive:true});let server;const peers=[];const checks=[];
 const record=(name,data)=>{checks.push({name,...data});console.log(JSON.stringify(checks.at(-1)));};
 try{
  server=await startServer(host,cooked,out);record('actual-cooked-world-startup',{game:server.ready.game,build:server.ready.build});
  const first=await connect(server.ready,'World test 1');peers.push(first);first.send({action:'create'});
  await first.wait(value=>value.document.rooms.some(r=>r.owners?.includes(value.player)),'solo room starts immediately');
  const initial=first.document.rooms.find(r=>r.owners.includes(first.player)),id=initial.id,initialTick=first.tick;
  assert.equal(initial.humans,1);assert.equal(initial.owners[0],first.player);assert.ok(initial.game);assert.equal(initial.game.data.Party.Slots[0],'human');
  record('solo-start-without-waiting',{room:id,player:first.player,tick:first.tick,gameTick:initial.game.data.Tick});
  first.hold({move:1,jump:false,fire:true});
  await first.wait(value=>value.tick>=initialTick+30&&room(value.document,id)?.phase==='combat'&&(room(value.document,id).game?.actors.Enemies.rows.length??0)>0,'solo enters actual active enemy combat',20000);
  const combatTick=first.tick,combatShots=room(first.document,id).game.data.Counters.Blown;record('solo-real-enemy-combat',{tick:combatTick,gameTick:room(first.document,id).game.data.Tick,enemies:room(first.document,id).game.actors.Enemies.rows.length});
  const late=await connect(server.ready,'World test 2');peers.push(late);late.send({action:'join',room:id});
  await first.wait(value=>room(value.document,id)?.humans===2,'late join during existing game');
  assert.ok(room(first.document,id).game.data.Tick>initial.game.data.Tick);assert.ok(room(first.document,id).owners.includes(late.player));
  assert.equal(room(first.document,id).phase,'combat');record('late-join-without-world-reset',{room:id,phase:room(first.document,id).phase,tick:first.tick,gameTick:room(first.document,id).game.data.Tick});
  for(let i=2;i<10;i++){const next=await connect(server.ready,`World test ${i+1}`);peers.push(next);next.send({action:'join',room:id});}
  await Promise.all(peers.map(peer=>peer.wait(value=>room(value.document,id)?.humans===10,'ten humans share the existing arena')));
  assert.equal(new Set(room(first.document,id).owners).size,10);assert.ok(room(first.document,id).game.data.Party.Slots.every(value=>value==='human'));
  await first.wait(()=>[...first.history.keys()].some(tick=>peers.every(peer=>peer.history.get(tick)===first.history.get(tick))),'same authoritative snapshot reaches all ten peers');
  const sharedTick=[...first.history.keys()].find(tick=>peers.every(peer=>peer.history.get(tick)===first.history.get(tick)));
  assert.equal(room(first.document,id).phase,'combat');record('ten-real-socket-peers',{room:id,phase:room(first.document,id).phase,humans:10,sharedSnapshotTick:sharedTick,snapshotSha256:first.history.get(sharedTick)});
  const tenPeerProcess=processStats(server.child.pid);
  const overflow=await connect(server.ready,'World test room full');peers.push(overflow);const beforeOverflowTick=overflow.tick;overflow.send({action:'join',room:id});
  await overflow.wait(value=>value.tick>beforeOverflowTick&&value.document.peers.some(p=>p.player===value.player&&p.room===null)&&room(value.document,id)?.humans===10,'full room keeps eleventh peer outside');
  record('room-capacity-enforced',{humans:room(overflow.document,id).humans,extraPlayer:overflow.player});
  await first.wait(value=>(room(value.document,id)?.game?.data.Counters?.Blown??0)>combatShots,'real game applies fire controls',20000);
  record('authoritative-control-gameplay',{blown:room(first.document,id).game.data.Counters.Blown,walked:room(first.document,id).game.data.Counters.Walked,player0:actor(room(first.document,id).game,0)});
  first.hold({move:0,jump:false,fire:false});
  const departing=peers[9],slot=room(first.document,id).owners.indexOf(departing.player);departing.close();
  await first.wait(value=>room(value.document,id)?.humans===9&&room(value.document,id).owners[slot]===null&&room(value.document,id).game.data.Party.Slots[slot]==='ai','disconnect converts the dragon to AI');
  assert.ok(room(first.document,id).notices.some(notice=>notice.kind==='leave'&&notice.slot===slot));
  record('disconnect-replaced-by-ai',{room:id,slot,humans:9});
  overflow.send({action:'join',room:id});await first.wait(value=>room(value.document,id)?.owners[slot]===overflow.player,'fresh participant takes AI slot');
  assert.equal(room(first.document,id).game.data.Party.Slots[slot],'human');record('fresh-late-join-takes-ai-slot',{room:id,slot,player:overflow.player});
  late.send({action:'create'});await late.wait(value=>value.document.rooms.length>=2&&value.document.peers.some(p=>p.player===value.player&&p.room!==id&&p.room!==null),'second room appears in live browser catalogue');
  const secondId=late.document.peers.find(p=>p.player===late.player).room;assert.notEqual(secondId,id);
  await first.wait(value=>!!room(value.document,secondId)&&room(value.document,id)?.humans===9,'first room continues beside independent room');
  assert.equal(room(first.document,id).game.data.Party.Slots[1],'ai');assert.equal(room(first.document,secondId).humans,1);
  record('live-room-list-and-independent-games',{rooms:first.document.rooms.map(r=>({id:r.id,humans:r.humans,wave:r.wave,phase:r.phase})),tick:first.tick});
  const measurements={elapsedMillis:performance.now()-first.startedAt,worldTick:first.tick,peers:peers.map(peer=>({player:peer.player,receivedBytes:peer.receivedBytes,packets:peer.packets,snapshots:peer.snapshotCount,maxWebSocketPayloadBytes:peer.maxWebSocketPayloadBytes,maxDocumentBytes:peer.maxDocumentBytes,meanReceivedPayloadBytesPerSecond:peer.receivedBytes/((performance.now()-peer.startedAt)/1000)})),serverProcessAtTenPeers:tenPeerProcess,serverProcessAtEnd:processStats(server.child.pid),serverSimulationMillisPerTick:null,limits:'Packet payload sizes exclude WebSocket/TCP headers. Process CPU/RSS are coarse OS samples including startup/networking, not isolated sim timings. World protocol exposes no per-tick simulation profiler.'};
  const report={ok:true,measurements,scope:'Actual cooked engine authoritative world with ten raw Node WebSocket protocol peers; no Node gameplay simulation',compiledBrowserClientVerified:false,browserAcceptance:false,game:server.ready.game,build:server.ready.build,checks};
  writeFileSync(join(out,'summary.json'),JSON.stringify(report,null,2)+'\n');writeFileSync(join(out,'final-public-snapshot.json'),JSON.stringify(first.document,null,2)+'\n');return report;
 }catch(error){writeFileSync(join(out,'summary.json'),JSON.stringify({ok:false,error:String(error),checks},null,2)+'\n');throw error;}
 finally{for(const peer of peers)peer.close();if(server){server.logs();if(server.child.exitCode===null){server.child.kill('SIGTERM');await new Promise(done=>{const timer=setTimeout(()=>{server.child.kill('SIGKILL');done();},3000);server.child.once('exit',()=>{clearTimeout(timer);done();});});}}}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const args={};for(let at=2;at<process.argv.length;at+=2){if(!['--cooked','--host','--out'].includes(process.argv[at])||!process.argv[at+1])throw new Error('Usage: world-test.mjs --cooked ACTUAL_COOKED_DIRECTORY [--host ENGINE_HOST] [--out EVIDENCE_DIRECTORY]');args[process.argv[at].slice(2)]=process.argv[at+1];}if(!args.cooked)throw new Error('Explicit --cooked is required; ask the coordinator for the generated world export.');const report=await runWorldTest({cooked:resolve(args.cooked),host:resolve(args.host??process.env.GAMEENGINE_HOST??join(project,'.gameengine/engine/target/release/gameengine-host')),out:resolve(args.out??join(project,'.gameengine/world-evidence'))});console.log(JSON.stringify(report,null,2));}
 catch(error){console.error(`Authoritative world socket test: ${error.message}`);process.exitCode=1;}
}
