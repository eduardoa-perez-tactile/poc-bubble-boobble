// Verify live campaign save-to-reload and changed reset execution without restarting Play.
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
function cli(args){const r=spawnSync('gameengine',[...args,'--json'],{encoding:'utf8',maxBuffer:8*1024*1024});if(r.status!==0)throw new Error(r.stdout+r.stderr);const out=JSON.parse(r.stdout);if(out.ok===false)throw new Error(r.stdout);return out;}
const call=(method,params={})=>cli(['editor','call',method,'--role','game','--params',JSON.stringify(params)]).value;
const state=()=>call('script.eval',{code:'(()=>{const s=JSON.parse(__gameengine_host("doc.get",JSON.stringify({name:"arcade.session"})));const g=s.game;return g?{tick:g.Tick,dir:g.Players[0].Dir,x:g.Players[0].X}:null})()'}).value;
const reset=()=>call('cheat.run',{id:'arcade.reset',args:{round:1,seed:42,ready:false}});
const file='src/arcade/arcade.cheats.ts',original=readFileSync(file,'utf8'),marker='// LIVE_PROBE_ANCHOR';
async function reload(text){const since=cli(['editor','console','--limit','1']).next,start=performance.now();writeFileSync(file,text);while(performance.now()-start<10000){const entries=cli(['editor','console','--since',String(since),'--limit','100']).entries;if(entries.some(e=>e.level==='error'))throw new Error(JSON.stringify(entries));if(entries.some(e=>e.category==='hot-reload'&&e.message===`reloaded: ${file}`))return performance.now()-start;await new Promise(resolve=>setTimeout(resolve,50));}throw new Error('Reload exceeded10seconds');}
try{
 const e=cli(['editor','state']).value;if(!e.playing||e.paused||!e.editEngine.running)throw new Error('Running editorPlay required');
 if(original.split(marker).length!==2)throw new Error('Probe anchor changed');
 reset();const before=state();if(!before)throw new Error('No game after reset');
 const changedMs=await reload(original.replace(marker,'game.Players[0]!.Dir = -1;'));
 const retained=state();if(retained.tick<=before.tick||retained.dir!==1||retained.x!==before.x)throw new Error('World not retained across reload');
 reset();if(state().dir!==-1)throw new Error('Changed reset did not execute');
 const restoredMs=await reload(original);reset();if(state().dir!==1)throw new Error('Restored reset did not execute');
 const report={changedMs,restoredMs,worldRetained:true,reloadedCodeExecuted:true,sourceRestored:true};writeFileSync('artifacts/arcade-hot-reload-timing.json',JSON.stringify(report,null,2)+'\n');console.log(report);if(Math.max(changedMs,restoredMs)>2000)throw new Error('Reload exceeds2secondtarget');
}finally{if(readFileSync(file,'utf8')!==original)writeFileSync(file,original);}
