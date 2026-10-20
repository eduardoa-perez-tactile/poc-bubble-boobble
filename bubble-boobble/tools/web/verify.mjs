/** Exact-commit evidence for the native, wasm and browser delivery lanes. */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, openSync, closeSync, writeSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { browserDeferralReason, deferredBrowserCommand } from './release-evidence.mjs';
const project=fileURLToPath(new URL('../..',import.meta.url));process.chdir(project);
const git=args=>{const r=spawnSync('git',args,{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);return r.stdout.trim();};
const sha=git(['rev-parse','HEAD']);
const deferBrowserPlaytest=process.argv.includes('--defer-browser-playtest');
const clean=()=>!git(['status','--porcelain']);
if(!clean())throw Error('Commit the web changes before recording publishable verification.');
mkdirSync('build/web-evidence',{recursive:true});
async function run(lane,commands){
 const report={sha,ok:false,started:new Date().toISOString(),commands:[]};
 try{
  for(const [command,...args] of commands){
   const log=`build/web-evidence/${lane}-${report.commands.length+1}.log`,fd=openSync(log,'w');console.log(command,args.join(' '));
   const code=await new Promise((done,reject)=>{const child=spawn(command,args,{stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>writeSync(fd,b));child.stderr.on('data',b=>writeSync(fd,b));child.on('error',reject);child.on('close',done);}).finally(()=>closeSync(fd));
   report.commands.push({command:[command,...args],code,log});if(code!==0)throw Error(`${lane} failed; see ${log}`);
  }
  if(sha!==git(['rev-parse','HEAD'])||!clean())throw Error('Source changed during verification.');
  if(lane==='browser'){const result=JSON.parse(readFileSync('build/web-qa/report.json'));if(!result.ok||result.build.sha!==sha||result.build.dirty)throw Error('Browser evidence does not match the clean export.');}
  report.ok=true;
 }catch(e){report.error=e.message;throw e;}
 finally{report.finished=new Date().toISOString();writeFileSync(`build/web-evidence/${lane}.json`,JSON.stringify(report,null,2)+'\n');}
}
await run('native',[[process.execPath,'--test','tools/web/controls.test.mjs','tools/web/save-compat.test.mjs','tools/web/release-evidence.test.mjs'],['gameengine','check','--json'],['gameengine','test','--tier','t1','--gpu-tier','desktop','--js','v8'],['gameengine','test','--tier','t1','--gpu-tier','desktop','--js','v8','--memory-class','phone-low','--filter','feel six player capture chain rescue boss and results fit every aspect']]);
await run('parity',[[process.execPath,'tools/web/toolchain.mjs','parity']]);
if(deferBrowserPlaytest){
 await run('export',[[process.execPath,'tools/web/toolchain.mjs','export']]);
 const build=JSON.parse(readFileSync('build/web/site/playtest-build.json'));
 if(build.sha!==sha||build.dirty)throw Error('Export does not match the clean release commit.');
 writeFileSync('build/web-evidence/browser.json',JSON.stringify({sha,ok:false,status:'deferred',reason:browserDeferralReason,deferredCommand:deferredBrowserCommand,recorded:new Date().toISOString()},null,2)+'\n');
 console.log('Native checks, V8/WebAssembly tests and export passed for',sha,'; browser gameplay acceptance DEFERRED:',browserDeferralReason);
}else{
 await run('browser',[[process.execPath,'tools/web/toolchain.mjs','export'],[process.execPath,'tools/web/smoke.mjs']]);
 console.log('Native checks, V8/WebAssembly tests and browser checks passed for',sha);
}
