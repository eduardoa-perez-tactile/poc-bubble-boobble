// Cold live-viewport regression. Offscreen screenshots can initialize the 3D
// renderer and hide a missing world mesh, so this tool never requests one.
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {deflateSync} from 'node:zlib';
import {build} from '../../.gameengine/engine/node_modules/esbuild/lib/main.js';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)),'../..'));
mkdirSync('.cache/harness',{recursive:true});mkdirSync('artifacts',{recursive:true});
await build({entryPoints:['.gameengine/engine/packages/protocol-client/src/index.ts'],outfile:'.cache/harness/viewport-protocol.cjs',bundle:true,platform:'node',format:'cjs',target:'es2022'});
const {GameEngineClient}=createRequire(import.meta.url)(resolve('.cache/harness/viewport-protocol.cjs'));
const bundle=JSON.parse(execFileSync('gameengine',['bundle','--json'],{encoding:'utf8'})).path;
const host=spawn(resolve('.gameengine/engine/target/release/gameengine-host'),['--mode','headless','--project',process.cwd(),'--bundle',bundle,'--serve','127.0.0.1:0','--paused','--ui-layout'],{stdio:['ignore','pipe','pipe']});
let log='',address,client,last,viewport,frames=0;
const report={ok:false,scope:'cold live readback viewport; no offscreen render or preload'};
const watchdog=setTimeout(()=>{report.error='Cold viewport exceeded 30 seconds';host.kill('SIGTERM');},30000);
host.stdout.on('data',d=>{log+=d;for(const line of log.split('\n'))try{const p=JSON.parse(line);if(p.ws&&p.token)address=p;}catch{}});
host.stderr.on('data',d=>log+=d);
function png(frame){
 const width=frame.meta.width,height=frame.meta.height,rgba=frame.payload;
 const crc=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;};
 const chunk=(kind,data)=>{const type=Buffer.from(kind),body=Buffer.concat([type,data]),head=Buffer.alloc(4),tail=Buffer.alloc(4);head.writeUInt32BE(data.length);tail.writeUInt32BE(crc(body));return Buffer.concat([head,body,tail]);};
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
 const rows=Buffer.alloc(height*(width*4+1));for(let y=0;y<height;y++)rows.set(rgba.subarray(y*width*4,(y+1)*width*4),y*(width*4+1)+1);
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
function count(frame,rect,predicate){
 const width=frame.meta.width,height=frame.meta.height,scale=Math.min(width/768,height/720),ox=(width-768*scale)/2,oy=(height-720*scale)/2;
 let found=0,total=0;
 for(let y=Math.ceil(oy+rect[1]*scale);y<Math.floor(oy+rect[3]*scale);y++)for(let x=Math.ceil(ox+rect[0]*scale);x<Math.floor(ox+rect[2]*scale);x++){
  const i=(y*width+x)*4;total++;if(predicate(frame.payload[i],frame.payload[i+1],frame.payload[i+2]))found++;
 }
 return {found,total};
}
try{
 for(let i=0;i<200&&!address;i++){if(host.exitCode!==null)throw new Error('Cold viewport host exited before ready');await delay(25);}
 assert.ok(address,'Cold viewport host did not start');
 client=await GameEngineClient.connect(address,{client:'cold-viewport-smoke'});
 report.assetsBefore=await client.api.script.eval({code:'JSON.parse(__gameengine_host("assets.stats","{}"))'});
 client.onFrame(frame=>{if(frame.kind===1&&frame.meta.viewportId===viewport?.viewportId){last=frame;frames++;void client.api.viewport.frameConsumed({viewportId:frame.meta.viewportId,slot:frame.meta.slot}).catch(()=>{});}});
 viewport=await client.api.viewport.create({width:1920,height:1080,mode:'readback'});
 assert.equal(viewport.mode,'readback');
 await client.api.engine.step({n:2,frames:true});
 await client.api.cheat.run({id:'arcade.reset',args:{round:1,seed:42,ready:false}});
 // Several actual viewport frames allow ordinary asynchronous asset loading,
 // without calling render.screenshot, render.stats(render:true), or a preview.
 for(let i=0;i<20;i++){await client.api.engine.step({n:1,frames:true});await delay(40);}
 assert.ok(last,'No live viewport pixels arrived');assert.equal(last.meta.format,'rgba8');
 assert.equal(last.payload.length,last.meta.width*last.meta.height*4);
 writeFileSync('artifacts/viewport-smoke.png',png(last));
 const tile=count(last,[2,50,766,70],(r,g,b)=>r>160&&b>160);
 const player=count(last,[64,560,160,672],(r,g,b)=>g>150&&g>r*1.4&&g>b*1.4);
 const stats=await client.api.render.stats({});
 report.assetsAfter=await client.api.script.eval({code:'JSON.parse(__gameengine_host("assets.stats","{}"))'});
 Object.assign(report,{width:last.meta.width,height:last.meta.height,frames,frameIndex:last.meta.frameIndex,tile,player,drawCalls:stats.drawCalls,triangles:stats.triangles});
 assert.ok(tile.found>tile.total*.8,`World tile band missing: ${tile.found}/${tile.total} pixels`);
 assert.ok(player.found>20,`Player sprite missing: ${player.found} green pixels`);
 assert.ok(stats.triangles>500,`World mesh did not contribute triangles: ${stats.triangles}`);
 report.ok=true;
}catch(error){report.error=String(error);process.exitCode=1;}
finally{
 clearTimeout(watchdog);client?.close();if(host.exitCode===null){host.kill('SIGTERM');await once(host,'exit');}
 writeFileSync('artifacts/viewport-smoke.json',JSON.stringify(report,null,2)+'\n');writeFileSync('artifacts/viewport-smoke.log',log);console.log(JSON.stringify(report));
}
