/** Deploy the exact tested static artifact. No engine or source toolchain is uploaded. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateReleaseEvidence } from './release-evidence.mjs';
const project=fileURLToPath(new URL('../..',import.meta.url));
process.chdir(project);
const run=(command,args)=>{const r=spawnSync(command,args,{encoding:'utf8',maxBuffer:8*1024*1024});if(r.status!==0)throw Error(r.stderr||r.stdout||`${command} failed`);return r.stdout.trim();};
const sha=run('git',['rev-parse','HEAD']);
assert.equal(run('git',['status','--porcelain']),'','Commit the finished web version before publishing.');
const build=JSON.parse(readFileSync('build/web/site/playtest-build.json'));
const evidence=Object.fromEntries(['native','parity','browser'].map(lane=>[lane,JSON.parse(readFileSync(`build/web-evidence/${lane}.json`))]));
const {browserDeferred}=validateReleaseEvidence({sha,build,...evidence,deferBrowserPlaytest:process.argv.includes('--defer-browser-playtest')});
if(browserDeferred)console.warn('Browser gameplay acceptance DEFERRED:',evidence.browser.reason);
const repo='eduardoa-perez-tactile/poc-bubble-boobble',tag=`web-${sha.slice(0,12)}`;
run('tar',['-czf','build/bubble-madness-web.tar.gz','-C','build/web/site','.']);
try{run('gh',['api',`repos/${repo}/pages`]);}catch{run('gh',['api','--method','POST',`repos/${repo}/pages`,'-f','build_type=workflow']);}
let exists=false;try{run('gh',['release','view',tag,'--repo',repo]);exists=true;}catch{}
if(!exists){writeFileSync('build/web-release-notes.txt',`Bubble Madness WebGPU playtest with arcade loading splash and dragon result podiums.\n\nCommit: ${sha}\nNative engine checks and V8/WebAssembly tests passed for this exact clean commit.\n${browserDeferred?'Browser gameplay acceptance DEFERRED: '+evidence.browser.reason:'Browser acceptance passed for this commit.'}\nKeyboard and standard controllers; desktop WebGPU browser required.\n`);run('gh',['release','create',tag,'--repo',repo,'--target',sha,'--prerelease','--title','Bubble Madness web playtest','--notes-file','build/web-release-notes.txt']);}
run('gh',['release','upload',tag,'build/bubble-madness-web.tar.gz','--repo',repo,'--clobber']);
run('gh',['workflow','run','web-playtest.yml','--repo',repo,'-f',`release_tag=${tag}`]);
console.log('Deploying https://eduardoa-perez-tactile.github.io/poc-bubble-boobble/');
