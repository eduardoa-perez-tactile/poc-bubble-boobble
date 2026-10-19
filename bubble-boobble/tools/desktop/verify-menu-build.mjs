// Verify the exact code.gpak script. CLI run --cooked still supplies a loose/dev bundle.
import {readFileSync,writeFileSync,mkdirSync,openSync,closeSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {zstdDecompressSync} from 'node:zlib';
import {build} from '../../.gameengine/engine/node_modules/esbuild/lib/main.js';
const cooked=resolve(process.argv[2]??''),flavor=process.argv[3];
if(!['dev','release'].includes(flavor))throw new Error('Usage: node tools/desktop/verify-menu-build.mjs <cooked-game-directory> dev|release');
const project=process.cwd();mkdirSync('.cache',{recursive:true});mkdirSync('artifacts',{recursive:true});
const pack=readFileSync(resolve(cooked,'code.gpak'));
if(pack.toString('ascii',0,4)!=='GPAK')throw new Error('Invalid code.gpak');
const offset=Number(pack.readBigUInt64LE(8)),size=Number(pack.readBigUInt64LE(16));
const index=JSON.parse(zstdDecompressSync(pack.subarray(offset,offset+size)).toString());
const entry=index.entries.find(e=>e.key==='gameengine/bundle.js'&&e.kind==='script');
if(!entry)throw new Error('No shipped script');
const chunks=[];
for(let at=entry.offset;at<entry.offset+entry.size;){
 const i=Math.floor(at/65536),block=index.blocks[i];
 const raw=zstdDecompressSync(pack.subarray(block.file_offset,block.file_offset+block.compressed));
 const chunk=raw.subarray(at%65536,Math.min(raw.length,at%65536+entry.offset+entry.size-at));
 if(!chunk.length)throw new Error('Truncated shipped script');chunks.push(chunk);at+=chunk.length;
}
const bundle=resolve(`.cache/menu-proof-${flavor}.js`);writeFileSync(bundle,Buffer.concat(chunks));
await build({stdin:{contents:'export {GameEngineClient} from "./.gameengine/engine/packages/protocol-client/src/index.ts";',resolveDir:project,loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:'.cache/menu-proof-client.mjs',logLevel:'silent'});
const {GameEngineClient}=await import(resolve('.cache/menu-proof-client.mjs'));
const log=openSync(`artifacts/menu-build-${flavor}.log`,'w');
const child=spawn(process.env.GAMEENGINE_HOST??resolve('.gameengine/engine/target/release/gameengine-host'),['--mode','headless','--serve','127.0.0.1:0','--project',project,'--bundle',bundle,'--cooked',cooked,'--ui-layout','--paused','--json'],{stdio:['ignore','pipe',log]});
let client;
try{
 const address=await new Promise((accept,reject)=>{let output='';const timeout=setTimeout(()=>reject(new Error('Headless build verification timed out')),30000);child.on('error',e=>{clearTimeout(timeout);reject(e);});child.on('exit',code=>{clearTimeout(timeout);reject(new Error(`Host exited ${code}`));});child.stdout.on('data',bytes=>{output+=bytes;for(const line of output.split('\n'))if(line.startsWith('{'))try{const value=JSON.parse(line);if(value.ws){clearTimeout(timeout);accept(value);return;}}catch{}});});
 client=await GameEngineClient.connect(address,{client:'bubble-madness-build-menu-proof'});
 await client.call('engine.step',{n:5,frames:true});
 await client.call('render.probe',{width:768,height:720,points:[[0,0]]});
 await client.call('engine.step',{n:3,frames:true});
 await client.api.input.push({events:[{type:'event',name:'DesktopIntent',data:JSON.stringify({action:'menu'})}]});
 await client.call('engine.step',{n:3,frames:true});
 await client.call('render.probe',{width:768,height:720,points:[[0,0]]});
 await client.call('engine.step',{n:2,frames:true});
 const flag=await client.call('script.eval',{code:'JSON.parse(__gameengine_host("doc.get",JSON.stringify({name:"desktop-ui"}))).developmentMenu'});
 const buttons=await client.api.ui.interactables({width:768,height:720});
 const labels=buttons.elements.map(b=>b.label).sort();
 const expected=['START GAME','SETTINGS','QUIT'].sort();
 if(flag.value!==(flavor==='dev')||JSON.stringify(labels)!==JSON.stringify(expected))throw new Error(`Unexpected ${flavor} menu: flag=${flag.value}, labels=${JSON.stringify(labels)}`);
 const result={ok:true,flavor,scriptHash:entry.hash,scriptBytes:entry.size,developmentMenu:flag.value,labels,scope:'Exact shipped code.gpak script on diagnostic headless engine host; no standalone app launch'};
 writeFileSync(`artifacts/menu-build-${flavor}.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{client?.close();child.kill();closeSync(log);}
