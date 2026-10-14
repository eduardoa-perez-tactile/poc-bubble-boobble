// Opt-in live movement probe: change a dev-only reset's facing, prove execution, restore.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
function cli(args) {
  const r = spawnSync('gameengine', [...args, '--json'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stdout + r.stderr);
  const out = JSON.parse(r.stdout); if (out.ok === false) throw new Error(r.stdout); return out;
}
const call = (method, params = {}) => cli(['editor','call',method,'--role','game','--params',JSON.stringify(params)]).value;
const state = () => call('world.resources').resources;
const reset = () => call('cheat.run', { id: 'port.movement', args: {} });
const file = 'src/movement.cheats.ts', original = readFileSync(file,'utf8');
const marker = 'const p = initialPlayer();';
async function reload(text) {
  const since = cli(['editor','console','--limit','1']).next, start = performance.now();
  writeFileSync(file,text);
  while (performance.now() - start < 10000) {
    const entries = cli(['editor','console','--since',String(since),'--limit','100']).entries;
    if(entries.some(e => e.level === 'error')) throw new Error(JSON.stringify(entries));
    if(entries.some(e => e.category === 'hot-reload' && e.message === `reloaded: ${file}`)) return performance.now()-start;
    await new Promise(resolve => setTimeout(resolve,50));
  }
  throw new Error('Reload timed out');
}
try {
  const editor = cli(['editor','state']).value;
  if (!editor.playing || editor.paused || !editor.editEngine.running) throw new Error('Running editor Play session required');
  if (original.split(marker).length !== 2) throw new Error('Reset marker changed');
  reset(); const before = state();
  const changedMs = await reload(original.replace(marker, marker+' p.dir = -1;'));
  const retained = state();
  if (retained.PortPlayer.dir !== 1 || retained.PortMatch.tick <= before.PortMatch.tick) throw new Error('World not retained');
  reset(); if(state().PortPlayer.dir !== -1) throw new Error('Reloaded reset did not execute');
  const restoredMs = await reload(original);
  reset(); if(state().PortPlayer.dir !== 1) throw new Error('Restored reset did not execute');
  const result = {changedMs,restoredMs,worldRetained:true,reloadedCodeExecuted:true};
  writeFileSync('artifacts/movement-hot-reload-timing.json',JSON.stringify(result,null,2)+'\n');
  console.log(result);
  if(Math.max(changedMs,restoredMs)>2000) throw new Error('Reload exceeds 2 seconds');
} finally { if(readFileSync(file,'utf8') !== original) writeFileSync(file,original); }
