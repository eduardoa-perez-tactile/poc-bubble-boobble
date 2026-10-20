/** Deploy the exact tested static artifact. No engine or source toolchain is uploaded. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const project=fileURLToPath(new URL('../..',import.meta.url));
process.chdir(project);
const run=(command,args)=>{const r=spawnSync(command,args,{encoding:'utf8',maxBuffer:8*1024*1024});if(r.status!==0)throw Error(r.stderr||r.stdout||`${command} failed`);return r.stdout.trim();};
const sha=run('git',['rev-parse','HEAD']);
assert.equal(run('git',['status','--porcelain']),'','Commit the finished web version before publishing.');
const build=JSON.parse(readFileSync('build/web/site/playtest-build.json'));
assert.equal(build.sha,sha,'Rebuild this commit before publishing');assert.equal(build.dirty,false);
for(const lane of ['native','parity','browser']){
 const evidence=JSON.parse(readFileSync(`build/web-evidence/${lane}.json`));
 assert.equal(evidence.sha,sha,`${lane} evidence is stale`);assert.equal(evidence.ok,true,`${lane} did not pass`);
}
const repo='eduardoa-perez-tactile/poc-bubble-boobble',tag=`web-${sha.slice(0,12)}`;
run('tar',['-czf','build/bubble-madness-web.tar.gz','-C','build/web/site','.']);
try{run('gh',['api',`repos/${repo}/pages`]);}catch{run('gh',['api','--method','POST',`repos/${repo}/pages`,'-f','build_type=workflow']);}
let exists=false;try{run('gh',['release','view',tag,'--repo',repo]);exists=true;}catch{}
if(!exists){writeFileSync('build/web-release-notes.txt','Shareable Bubble Madness WebGPU playtest. Native engine checks, V8/WebAssembly tests and browser acceptance passed for this commit. Keyboard and standard controllers; desktop WebGPU browser required. Level generator is outside this release scope.\n');run('gh',['release','create',tag,'--repo',repo,'--target',sha,'--prerelease','--title','Bubble Madness web playtest','--notes-file','build/web-release-notes.txt']);}
run('gh',['release','upload',tag,'build/bubble-madness-web.tar.gz','--repo',repo,'--clobber']);
run('gh',['workflow','run','web-playtest.yml','--repo',repo,'-f',`release_tag=${tag}`]);
console.log('Deploying https://eduardoa-perez-tactile.github.io/poc-bubble-boobble/');
