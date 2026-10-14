// Opt-in editor probe: temporarily changes this harness's circle color, then restores it.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
function cli(args) {
  const r = spawnSync('gameengine', [...args, '--json'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) throw new Error(r.error?.message ?? r.stdout + r.stderr);
  const result = JSON.parse(r.stdout);
  if (result.ok === false) throw new Error(JSON.stringify(result));
  return result;
}
function call(method, params = {}) { return cli(['editor', 'call', method, '--role', 'game', '--params', JSON.stringify(params)]).value; }
function entities() { return call('world.query', { components: ['Bubble', 'Shape', 'LocalTransform'] }).entities; }
function color() { return entities()[0]?.components.Shape.color; }
async function waitReload(since) {
  const start = performance.now();
  while (performance.now() - start < 10000) {
    const result = cli(['editor', 'console', '--since', String(since), '--limit', '100']);
    const entries = result.entries.filter(e => e.id > since);
    const error = entries.find(e => e.level === 'error');
    if (error) throw new Error(error.message);
    if (entries.some(e => e.category === 'hot-reload' && e.message === 'reloaded: src/harness.cheats.ts')) return performance.now() - start;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('No game hot-reload confirmation within 10 seconds');
}
async function main() {
  const file = 'src/harness.cheats.ts';
  const original = readFileSync(file, 'utf8');
  const marker = "color: '#6bc5ff'";
  if (original.split(marker).length !== 2) throw new Error('Harness color anchor differs; refusing to edit');
  const state = cli(['editor', 'state']).value;
  if (!state.editEngine.running) throw new Error('Editor edit engine is not running');
  if (!state.playing) cli(['editor', 'play']);
  if (state.paused) throw new Error('Resume editor Play before running this probe');
  call('cheat.run', { id: 'harness.reset', args: { scenario: 'starter-tap' } });
  const beforeEntities = entities();
  const before = beforeEntities[0]?.components.Shape.color;
  if (!before) throw new Error('Named scenario has not spawned');
  let restored = false;
  let changedMs;
  let restoredMs;
  try {
    const since = cli(['editor', 'console', '--limit', '1']).next;
    const started = performance.now();
    writeFileSync(file, original.replace(marker, "color: '#ffd36b'"));
    await waitReload(since);
    changedMs = performance.now() - started;
    const retained = entities();
    if (JSON.stringify(retained) !== JSON.stringify(beforeEntities)) throw new Error('Reload did not preserve entity identity, transform and starter state');
    call('cheat.run', { id: 'harness.reset', args: { scenario: 'starter-tap' } });
    const changed = color();
    if (!changed || JSON.stringify(changed) === JSON.stringify(before)) throw new Error('Reset did not execute the reloaded code');
    const restoreSince = cli(['editor', 'console', '--limit', '1']).next;
    const restoreStarted = performance.now();
    writeFileSync(file, original);
    await waitReload(restoreSince);
    restoredMs = performance.now() - restoreStarted;
    call('cheat.run', { id: 'harness.reset', args: { scenario: 'starter-tap' } });
    if (JSON.stringify(color()) !== JSON.stringify(before)) throw new Error('Restored reset did not restore the original color');
    restored = true;
  } finally {
    // Restore only our own probe edit, even on timeout/failure.
    if (!restored) writeFileSync(file, original);
  }
  const result = { changedMs, restoredMs, worldRetained: true, reloadedCodeExecuted: true, sourceRestored: true };
  mkdirSync('artifacts', { recursive: true });
  writeFileSync('artifacts/hot-reload-timing.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  if (Math.max(changedMs, restoredMs) > 2000) throw new Error('Editor hot reload exceeds the 2-second feedback target');
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
