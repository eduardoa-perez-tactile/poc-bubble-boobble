// Pinned source import. Original pixels/audio are copied, never re-encoded here.
import {readFileSync,writeFileSync,readdirSync,existsSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const lock=JSON.parse(readFileSync('tools/harness/reference.lock.json','utf8'));
const source=resolve('.cache/reference'),target=resolve('assets/reference');
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'});
if(head.status!==0||head.stdout.trim()!==lock.revision)throw new Error('Pinned oracle checkout required');
if(sha(source+'/resources/levels.json')!==lock.levelsSha256)throw new Error('Campaign checksum mismatch');
const imported=[];
function copy(from,to,kind){mkdirSync(dirname(to),{recursive:true});copyFileSync(from,to);imported.push({source:relative(source,from),target:relative(resolve('.'),to),sha256:sha(from)});const meta=to+'.gmeta';if(!existsSync(meta)){const settings=kind==='texture'?'\n[settings]\natlas = "port"\ncompression = "none"\ntrim = false\n':kind==='audio'?'\n[settings]\nmono = true\nnormalize = false\ncodec = "pcm"\n':'';writeFileSync(meta,`guid = "${randomUUID()}"\nimporter = "${kind}"\n${settings}`);}}
function tree(from,to){for(const e of readdirSync(from,{withFileTypes:true})){const a=from+'/'+e.name,b=to+'/'+e.name;if(e.isDirectory())tree(a,b);else copy(a,b,e.name.endsWith('.png')?'texture':e.name.endsWith('.wav')?'audio':'blob');}}
tree(source+'/resources/sprites',target);tree(source+'/resources/tiles',target+'/tiles');tree(source+'/resources/audio',target+'/audio');
copy(source+'/resources/arcade.ttf',target+'/arcade.ttf','font');copy(source+'/resources/logo.png',target+'/logo.png','texture');
if(process.argv.includes('--music')){
 const dir=source+'/cmd/port-audio';mkdirSync(dir,{recursive:true});copyFileSync('tools/port/export-music.go',dir+'/main.go');const out=resolve('.cache/audio-export');mkdirSync(out,{recursive:true});
 const r=spawnSync(resolve('.cache/toolchains/go/bin/go'),['run','./cmd/port-audio',out],{cwd:source,encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr);console.log(r.stdout.trim());
 for(let i=1;i<=5;i++){
  const destination=`${target}/audio/music-bubble-${i}.wav`;
  copyFileSync(`${out}/music-bubble-${i}.wav`,destination);
  if(!existsSync(destination+'.gmeta'))writeFileSync(destination+'.gmeta',`guid = "${randomUUID()}"\nimporter = "audio"\n[settings]\nnormalize = false\ncodec = "opus"\nstream_after = 0\nbitrate = 128000\n`);
 }
}
const music=Array.from({length:5},(_,i)=>({file:`assets/reference/audio/music-bubble-${i+1}.wav`,sha256:sha(`${target}/audio/music-bubble-${i+1}.wav`)}));
writeFileSync('data/reference-assets.json',JSON.stringify({revision:lock.revision,imported:imported.sort((a,b)=>a.source.localeCompare(b.source)),music:{decoder:'unchanged upstream internal/ym.Stream, loop=false, 48000Hz stereo PCM16',exporterSha256:sha('tools/port/export-music.go'),library:'github.com/olivierh59500/ym-player@v0.0.0-20260913215440-3f73bdca82e5',files:music}},null,2)+'\n');
console.log(`Imported${imported.length} source files at${lock.revision}`);
