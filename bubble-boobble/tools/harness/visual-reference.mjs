// Capture the unchanged pinned Go app through LaunchServices, which gives GLFW
// the desktop session that a terminal child may lack on macOS.
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));process.chdir(root);
const lock=JSON.parse(readFileSync('tools/harness/reference.lock.json','utf8'));
const scene=process.argv[2]??'game',round=Number(process.argv[3]??1),frames=Number(process.argv[4]??1);
const scenes=['menu','game','coop','pause','win','gameover','editor','profiles','new-profile','settings','scores','help','credits'];
if(process.platform!=='darwin'||process.arch!=='arm64')throw new Error('Visual capture currently requires the macOS arm64 desktop.');
if(!scenes.includes(scene)||!Number.isInteger(round)||round<1||round>25||!Number.isInteger(frames)||frames<1||frames>600)throw new Error('Usage: node tools/harness/visual-reference.mjs SCENE ROUND FRAMES');
function run(command,args,options={}){const r=spawnSync(command,args,{encoding:'utf8',maxBuffer:8*1024*1024,timeout:120000,...options});if(r.error)throw r.error;if(r.status!==0)throw new Error(`${command}: ${r.stderr||r.stdout}`);return r.stdout.trim();}
const source=resolve('.cache/reference'),checkout=resolve('.cache/visual-reference');
if(!existsSync(resolve(source,'.git')))throw new Error('Run harness:milestone to provision the pinned reference first.');
if(!existsSync(resolve(checkout,'main.go')))run('git',['worktree','add','--detach',checkout,lock.revision],{cwd:source});
if(run('git',['rev-parse','HEAD'],{cwd:checkout})!==lock.revision||run('git',['status','--porcelain'],{cwd:checkout}))throw new Error('Visual reference checkout must be pristine at the pinned revision.');
const bundle=resolve('.cache/VisualReference.app'),contents=resolve(bundle,'Contents');mkdirSync(resolve(contents,'MacOS'),{recursive:true});
writeFileSync(resolve(contents,'Info.plist'),`<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleExecutable</key><string>VisualReference</string><key>CFBundleIdentifier</key><string>dev.codex.bubble-visual-reference</string><key>CFBundleName</key><string>Go Bubble Reference</string><key>CFBundlePackageType</key><string>APPL</string><key>NSHighResolutionCapable</key><true/></dict></plist>`);
const go=process.env.HARNESS_GO??resolve('.cache/toolchains/go/bin/go');
const version=run(go,['version']);if(!version.includes(` ${lock.go.version} `))throw new Error('Incorrect Go toolchain.');
run(go,['build','-o',resolve(contents,'MacOS/VisualReference'),'.'],{cwd:checkout,env:{...process.env,GOTOOLCHAIN:'local'}});
const out=resolve('artifacts/visual-reference');mkdirSync(out,{recursive:true});
const paths=[0,1].map(i=>resolve(out,`${scene}-r${round}-f${frames}-${i}.png`));
for(const path of paths)run('open',['-n','-W',bundle,'--args','-mute','-smoke-scene',scene,'-smoke-round',String(round),'-smoke-frames',String(frames),'-screenshot',path,'-data-dir',resolve('.cache/visual-reference-save')]);
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const hashes=paths.map(hash),same=hashes[0]===hashes[1];
const report={reference:lock.revision,pristine:true,version,scene,round,smokeFrames:frames,seed:1,paths,hashes,repeatedPngBytesEqual:same};
writeFileSync(resolve(out,`${scene}-r${round}-f${frames}.json`),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(!same)process.exitCode=1;
