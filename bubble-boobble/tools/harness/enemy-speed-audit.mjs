// CPU-only enemy audit against a freshly rebuilt, pinned Go oracle. No engine
// host, renderer, OS surface, tuning changes or fixture regeneration is involved.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { build } from '../../.gameengine/engine/node_modules/esbuild/lib/main.js';
const root = fileURLToPath(new URL('../..', import.meta.url));
process.chdir(root);
const lock = JSON.parse(readFileSync('tools/harness/reference.lock.json', 'utf8'));
const checkout = resolve('.cache/reference');
function command(exe, args, options = {}) {
  const r = spawnSync(exe, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${exe} failed (${r.status}): ${r.stderr}`);
  return r.stdout;
}
const sha = data => createHash('sha256').update(data).digest('hex');
const revision = command('git', ['rev-parse', 'HEAD'], { cwd: checkout }).trim();
if (revision !== lock.revision) throw new Error('Cached Go reference is not pinned');
// Require every upstream simulation implementation to be unchanged except the
// already documented RNG handle anchor; the adapter adds state export only.
const sourceHashes = {};
const sourcePaths = command('git', ['ls-tree', '-r', '--name-only', 'HEAD', 'internal/game'], { cwd: checkout }).trim().split('\n').filter(p => p.endsWith('.go') && !p.endsWith('_test.go'));
for (const path of sourcePaths) {
  let expected = command('git', ['show', `HEAD:${path}`], { cwd: checkout });
  if (path === 'internal/game/game.go') expected = expected.replace('rand.New(rand.NewPCG(seed, seed^0xa0761d6478bd642f))', 'oracleRandom(seed)');
  const actual = readFileSync(resolve(checkout, path), 'utf8');
  if (actual !== expected) throw new Error(`Reference simulation changed: ${path}`);
  sourceHashes[path] = sha(actual);
}
for (const [local, cached] of [['adapter.go', 'internal/game/oracle_harness.go'], ['main.go', 'cmd/port-oracle/main.go']]) {
  if (!readFileSync(`tools/harness/oracle/${local}`).equals(readFileSync(resolve(checkout, cached)))) throw new Error(`Oracle overlay changed: ${cached}`);
}
const levelsRaw = readFileSync('data/levels.json');
if (sha(levelsRaw) !== lock.levelsSha256 || sha(readFileSync(resolve(checkout, 'resources/levels.json'))) !== lock.levelsSha256) throw new Error('Campaign provenance changed');
const go = process.env.HARNESS_GO ?? resolve('.cache/toolchains/go/bin/go');
const env = { ...process.env, GOTOOLCHAIN: 'local' };
const version = command(go, ['version'], { env }).trim();
if (!version.includes(` ${lock.go.version} `)) throw new Error('Unpinned Go compiler');
const binary = resolve('.cache/enemy-speed-oracle');
command(go, ['build', '-o', binary, './cmd/port-oracle'], { cwd: checkout, env });
await build({ stdin: { contents: "export * from './src/arcade/game.ts'; export * from './src/arcade/balance.ts'; export * from './src/arcade/enemies.ts';", resolveDir: root, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile: '.cache/enemy-speed-port.mjs', logLevel: 'silent' });
const { createGame, referencePlayerBalance, stepGame, canonicalState, updateEnemies } = await import(pathToFileURL(resolve('.cache/enemy-speed-port.mjs')).href + `?audit=${process.pid}`);
const levels = JSON.parse(levelsRaw);
const idle = { Move: 0, Jump: false, Fire: false };
const cases = Array.from({ length: 5 }, (_, i) => ({ name: `idle-round-${i + 1}`, round: i + 1, seed: 42, players: 1, spans: [{ ticks: 360, players: [idle], paused: false }] }));
cases.push({ name: 'freeze-hurry-boundary', round: 1, seed: 42, players: 1, setup: { State: 1, LevelTicks: 1798, Freeze: 2 }, spans: [{ ticks: 1, players: [idle], paused: true }, { ticks: 4, players: [idle], paused: false }] });
const rows = [];
for (const scenario of cases) {
  const frames = JSON.parse(command(binary, [], { cwd: checkout, input: JSON.stringify(scenario) }));
  const g = createGame(levels.slice(scenario.round - 1), scenario.seed, 1);
  g.NormalEnemySpeedScale = 1;
  g.PlayerBalance = {...referencePlayerBalance};
  Object.assign(g, scenario.setup ?? {});
  const samples = [];
  for (let i = 0; i < frames.length; i++) {
    if (i) { g.Paused = frames[i].input.paused; stepGame(g, frames[i].input.players); }
    const actual = JSON.parse(JSON.stringify(canonicalState(g)));
    if (!isDeepStrictEqual(actual, frames[i].state)) throw new Error(`${scenario.name} frame ${i}: canonical state differs`);
    if ((i < 6 && scenario.setup) || [0,60,61,120,360].includes(i)) samples.push({ frame: i, State: g.State, LevelTicks: g.LevelTicks, enemies: g.Enemies.map(e => ({ Kind: e.Kind, X: e.X, Y: e.Y, Dir: e.Dir, Age: e.Age, Angry: e.Angry })) });
  }
  rows.push({ profile: { NormalEnemySpeedScale: 1, PlayerBalance: referencePlayerBalance }, scenario, frames: frames.length, samples });
  console.log(`${scenario.name}: ${frames.length} source-speed-profile canonical states exactly match pinned Go`);
}
// Production is intentionally different. Compare locomotion against original
// Go in a collision-free one-tick arena, rather than pretending the resulting
// normal-speed match stays canonically identical after wall/combat interactions.
const velocityRows = [];
for (const angry of [false,true]) for (const kind of ['zenchan','mighta','banebou','monsta','pulpul','invader']) {
  const level = JSON.parse(JSON.stringify(levels[0]));
  level.tiles = level.tiles.map((row,y) => row.map((_,x) => x < 2 || x >= 30 || y === 0 || y === 25 ? 1 : 0));
  const g = createGame([level],42,1);
  g.Enemies = [g.Enemies[0]];
  const e = g.Enemies[0];
  Object.assign(e,{Kind:kind,X:200,Y:200,VX:0,VY:0,Ground:false,Dir:1,Vertical:1,Angry:angry,Age:0,Cooldown:180,Shoot:0,Phase:0.5});
  const scenario = {name:`velocity-${kind}-${angry}`,round:1,seed:42,players:1,setup:{State:1,Level:level,Enemies:[e]},spans:[{ticks:1,players:[idle],paused:false}]};
  const oracle = JSON.parse(command(binary,[],{cwd:checkout,input:JSON.stringify(scenario)}));
  const expected = oracle[1].state.Snapshot.Enemies[0];
  updateEnemies(g);
  if (g.NormalEnemySpeedScale !== 0.8) throw new Error('Production normal-speed tuning changed');
  if (angry) {
    if (!isDeepStrictEqual(e,expected)) throw new Error(`${kind}: angry movement differs from Go`);
  } else {
    const dx = e.X - 200, dy = e.Y - 200;
    const flying = kind === 'monsta' || kind === 'pulpul';
    if (Math.abs(dx - (expected.X - 200) * 0.8) >= 1e-12 || Math.abs(dy - (expected.Y - 200) * (flying ? 0.8 : 1)) >= 1e-12) throw new Error(`${kind}: normal movement is not 20% slower`);
    for (const field of Object.keys(expected).filter(k => k !== 'X' && k !== 'Y')) if (!isDeepStrictEqual(e[field],expected[field])) throw new Error(`${kind}: non-locomotion field changed: ${field}`);
  }
  velocityRows.push({kind,angry,productionScale:g.NormalEnemySpeedScale,goEnemy:expected,productionEnemy:e});
}
console.log('Production profile: all six normal kinds move 20% slower; all six angry kinds match Go exactly; gravity and non-locomotion fields unchanged.');
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/enemy-speed-audit.json', JSON.stringify({ reference: { repository: lock.repository, revision, version, levelsSha256: sha(levelsRaw), sourceHashes }, scope: 'CPU-only explicit original-speed profile canonical comparisons; production default 0.8 has intentional normal locomotion deltas, not full-state Go parity. Collision-free production position checks allow 1e-12 for movement-substep rounding. No wall-clock pacing or pixel claims.', rows, velocityRows }, null, 2) + '\n');
