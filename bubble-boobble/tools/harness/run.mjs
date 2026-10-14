import { spawnSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, unlinkSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { compareFiles } from './compare.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(root);
const lock = JSON.parse(readFileSync('tools/harness/reference.lock.json', 'utf8'));
const scenarioName = process.argv[3] ?? 'reference-round1-smoke';
const hash = data => createHash('sha256').update(data).digest('hex');
const read = path => readFileSync(path, 'utf8');
function run(command, args, options = {}) {
  const start = performance.now();
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: 'pipe', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (${result.status})\n${result.stdout ?? ''}${result.stderr ?? ''}`);
  return { stdout: result.stdout, stderr: result.stderr, wallMs: performance.now() - start };
}
function engine(args) {
  const result = run('gameengine', [...args, '--json']);
  const output = JSON.parse(result.stdout);
  if (output.ok === false) throw new Error(JSON.stringify(output));
  if (args[0] === 'test' && !Object.values(output.results ?? {}).some(results => Array.isArray(results) && results.length > 0)) throw new Error('Test filter matched no tests');
  for (const check of output.checks ?? []) if (check.warning) console.log(`Warning: ${check.detail}`);
  console.log(`gameengine ${args.join(' ')}: ${(result.wallMs / 1000).toFixed(3)} s`);
  return { ...result, output };
}
function goBinary() {
  const binary = process.env.HARNESS_GO ?? resolve('.cache/toolchains/go/bin/go');
  if (!existsSync(binary)) throw new Error('Go unavailable. Run npm run harness:setup, or set HARNESS_GO to a Go 1.26+ executable.');
  return binary;
}
async function setup() {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') throw new Error('Automatic Go provisioning is pinned for macOS arm64. Supply HARNESS_GO on other platforms.');
  const archive = resolve('.cache/toolchains', lock.go.archive);
  mkdirSync(dirname(archive), { recursive: true });
  if (!existsSync(archive)) {
    const response = await fetch(`https://go.dev/dl/${lock.go.archive}`);
    if (!response.ok) throw new Error(`Go download: ${response.status}`);
    writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
  }
  if (hash(readFileSync(archive)) !== lock.go.sha256) throw new Error('Go archive checksum mismatch');
  run('tar', ['-xzf', archive, '-C', resolve('.cache/toolchains')]);
  console.log(run(goBinary(), ['version']).stdout.trim());
}
function reference() {
  const checkout = resolve('.cache/reference');
  mkdirSync('.cache', { recursive: true });
  if (!existsSync(resolve(checkout, '.git'))) run('git', ['clone', '--depth', '1', '--no-checkout', lock.repository, checkout]);
  const available = spawnSync('git', ['cat-file', '-e', `${lock.revision}^{commit}`], { cwd: checkout });
  if (available.status !== 0) run('git', ['fetch', '--depth', '1', 'origin', lock.revision], { cwd: checkout });
  if (!existsSync(resolve(checkout, 'resources/levels.json'))) run('git', ['checkout', '--detach', lock.revision], { cwd: checkout });
  const head = run('git', ['rev-parse', 'HEAD'], { cwd: checkout }).stdout.trim();
  if (head !== lock.revision) throw new Error('Cached reference revision differs; use a fresh cache');
  const original = run('git', ['show', `${lock.revision}:internal/game/game.go`], { cwd: checkout }).stdout;
  if (hash(readFileSync(resolve(checkout, 'resources/levels.json'))) !== lock.levelsSha256) throw new Error('Reference level content checksum mismatch');
  const expression = 'rand.New(rand.NewPCG(seed, seed^0xa0761d6478bd642f))';
  if (original.split(expression).length !== 2) throw new Error('RNG instrumentation anchor changed');
  writeFileSync(resolve(checkout, 'internal/game/game.go'), original.replace(expression, 'oracleRandom(seed)'));
  copyFileSync('tools/harness/oracle/adapter.go', resolve(checkout, 'internal/game/oracle_harness.go'));
  mkdirSync(resolve(checkout, 'cmd/port-oracle'), { recursive: true });
  copyFileSync('tools/harness/oracle/main.go', resolve(checkout, 'cmd/port-oracle/main.go'));
  const env = { ...process.env, GOTOOLCHAIN: 'local' };
  const go = goBinary();
  const version = run(go, ['version'], { env }).stdout.trim();
  if (!version.includes(` ${lock.go.version} `)) throw new Error(`Fixture generation requires ${lock.go.version}; found ${version}`);
  const binary = resolve('.cache/port-oracle');
  run(go, ['build', '-o', binary, './cmd/port-oracle'], { cwd: checkout, env });
  return { checkout, binary, version, env, go };
}
function generate(name, context) {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error('Invalid scenario name');
  const path = `tests/scenarios/${name}.json`;
  const input = read(path);
  const scenario = JSON.parse(input);
  if (scenario.name !== name) throw new Error('Scenario name does not match filename');
  const frames = JSON.parse(run(context.binary, [], { cwd: context.checkout, input }).stdout);
  return {
    version: 1, scenario: name,
    reference: { repository: lock.repository, revision: lock.revision,
      levelsSha256: hash(readFileSync(resolve(context.checkout, 'resources/levels.json'))),
      scenarioSha256: hash(input), adapterSha256: hash(read('tools/harness/oracle/adapter.go')),
      driverSha256: hash(read('tools/harness/oracle/main.go')) },
    frames,
  };
}
function fixtures(checkOnly) {
  const context = reference();
  console.log(context.version);
  // One frame per line keeps fixture diffs readable and compact; diagnostics expand context.
  const serialize = trace => {
    const { frames, ...header } = trace;
    return JSON.stringify(header, null, 2).slice(0, -2) + ',\n  "frames": [\n' + frames.map(frame => '    ' + JSON.stringify(frame)).join(',\n') + '\n  ]\n}\n';
  };
  const first = serialize(generate(scenarioName, context));
  const second = serialize(generate(scenarioName, context));
  if (first !== second) throw new Error('Reference generation is nondeterministic');
  mkdirSync('tests/fixtures', { recursive: true });
  const path = `tests/fixtures/${scenarioName}.expected.json`;
  if (checkOnly) {
    if (first !== read(path)) throw new Error('Reference fixture is stale; review before regenerating');
    console.log('Two independent reference runs exactly match the committed fixture.');
  } else { writeFileSync(path, first); console.log(`Generated ${path}; repeat output identical.`); }
  console.log(run(context.go, ['test', './internal/game'], { cwd: context.checkout, env: context.env }).stdout.trim());
}
function selftest() {
  for (const file of readdirSync('tests/fixtures').filter(name => name.endsWith('.expected.json'))) {
    const fixture = JSON.parse(read(`tests/fixtures/${file}`));
    if (fixture.reference.revision !== lock.revision || fixture.reference.repository !== lock.repository || fixture.reference.levelsSha256 !== lock.levelsSha256 || fixture.reference.scenarioSha256 !== hash(read(`tests/scenarios/${fixture.scenario}.json`)) || fixture.reference.adapterSha256 !== hash(read('tools/harness/oracle/adapter.go')) || fixture.reference.driverSha256 !== hash(read('tools/harness/oracle/main.go'))) throw new Error(`Fixture provenance is stale: ${file}`);
  }
  if (hash(readFileSync('data/levels.json')) !== lock.levelsSha256) throw new Error('Imported campaign checksum differs from reference');
  const result = run(process.execPath, ['--test', 'tools/harness/compare.test.mjs']);
  console.log(result.stdout.trim());
}
function failureProbe() {
  const path = 'tests/harness-failure-probe.test.ts';
  if (existsSync(path)) throw new Error('Failure probe file already exists; refusing to overwrite it');
  try {
    writeFileSync(path, "import { expect, worldTest } from '@gameengine/test';\nworldTest('harness deliberate engine failure', async ({ step }) => { await step(1); expect(1).toBe(2); });\n");
    const result = spawnSync('gameengine', ['test', '--js', 'v8', '--filter', '*deliberate engine failure*', '--json'], { encoding: 'utf8' });
    if (result.error) throw result.error;
    const output = JSON.parse(result.stdout);
    const failure = output.results?.v8?.find(test => test.name === 'harness deliberate engine failure');
    if (result.status === 0 || output.ok !== false || !failure?.error?.includes('expected 1 to be 2')) throw new Error('Deliberate engine failure did not produce the expected assertion diagnostic');
    mkdirSync('artifacts', { recursive: true });
    writeFileSync('artifacts/engine-failure-probe.json', result.stdout);
    console.log(`Deliberate engine failure correctly returned exit ${result.status}: expected 1 to be 2`);
  } finally { unlinkSync(path); }
}
async function openEditor() {
  const current = spawnSync('gameengine', ['editor', 'state', '--json'], { encoding: 'utf8' });
  if (current.status === 0 && JSON.parse(current.stdout).ok) { console.log('Project is already open in the editor.'); return; }
  const binary = process.env.HARNESS_EDITOR ?? '/Applications/Tactile Game Engine.app/Contents/MacOS/Tactile Game Engine';
  if (!existsSync(binary)) throw new Error('Open this project in Tactile Game Engine, or set HARNESS_EDITOR to the installed editor executable.');
  const child = spawn(binary, ['--project', root], { detached: true, stdio: 'ignore' });
  let launchError;
  child.on('error', error => { launchError = error; });
  child.unref();
  const start = performance.now();
  while (performance.now() - start < 15000) {
    if (launchError) throw launchError;
    const state = spawnSync('gameengine', ['editor', 'state', '--json'], { encoding: 'utf8' });
    if (state.status === 0 && JSON.parse(state.stdout).value?.editEngine?.running) { console.log('Packaged editor opened this project; edit engine is running.'); return; }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Editor did not open this project. If another project is open, select this folder in the app.');
}
// The installed replay CLI omits --scene. Keep the starter replay on its recorded scene
// without mutating the project's default scene or rebuilding the bundled engine.
function starterReplay() {
  const bundle = engine(['bundle']).output.path;
  const doctor = JSON.parse(run('gameengine', ['doctor', '--json']).stdout);
  const host = doctor.checks.find(check => check.name === 'gameengine-host (V8)' && check.ok)?.detail;
  if (!host) throw new Error('V8 host unavailable');
  const result = run(host, ['--mode','headless','--project',root,'--bundle',bundle,'--js','v8','--scene','scenes/main.scene.json','--verify',resolve('tests/replays/harness_reset_and_tap.greplay')]);
  if (JSON.parse(result.stdout).ok !== true) throw new Error(result.stdout);
  console.log(`Starter replay, explicit recorded scene: ${(result.wallMs / 1000).toFixed(3)} s`);
}
function reset() {
  const probe = spawnSync('gameengine', ['editor', 'state', '--json'], { encoding: 'utf8' });
  if (probe.status === 0 && JSON.parse(probe.stdout).ok) {
    const state = JSON.parse(probe.stdout).value;
    if (!state.playing) engine(['editor', 'play']);
    engine(['editor', 'call', 'cheat.run', '--role', 'game', '--params', JSON.stringify({ id: 'port.movement', args: { ready: false } })]);
    engine(['editor', 'call', 'engine.step', '--role', 'game', '--params', '{"n":1}']);
  } else {
    engine(['cheat', 'run', 'port.movement']); engine(['step', '1']);
  }
}
async function main() {
  const start = performance.now();
  const command = process.argv[2] ?? 'quick';
  switch (command) {
    case 'setup': await setup(); break;
    case 'fixtures': fixtures(false); break;
    case 'reference-check': fixtures(true); break;
    case 'selftest': selftest(); break;
    case 'failure-probe': failureProbe(); break;
    case 'editor': await openEditor(); break;
    case 'compare':
      if (!process.argv[3] || !process.argv[4]) throw new Error('compare EXPECTED.json ACTUAL.json');
      process.exitCode = compareFiles(process.argv[3], process.argv[4]) ? 0 : 1; break;
    case 'quick': selftest(); engine(['test', '--js', 'v8', '--filter', process.argv[3] ?? '*movement*']); break;
    case 'verify': selftest(); engine(['test', '--js', 'v8']); engine(['test', '--js', 'v8', '--tier', 't1', '--gpu-tier', 'desktop']); starterReplay(); engine(['replay', 'verify', 'tests/replays/movement_physical_keyboard_hold_release_and_jump.greplay']); engine(['check']); break;
    case 'record': engine(['test', '--js', 'v8', '--record-replays', '--filter', '*harness*']); break;
    case 'replay': if (!process.argv[3]) starterReplay(); else engine(['replay', 'verify', process.argv[3]]); break;
    case 'reset': reset(); break;
    case 'coverage': console.log('BOOTSTRAP COVERAGE: comparator, Go oracle fixture, starter reset/replay infrastructure (run verify to check).\nIMPLEMENTED: round-one controlled movement traces (player fields, walked/jumps and jump events), keyboard path, desktop containment.\nPENDING: combat, enemies, bonuses, campaign progression, menus/audio/persistence; full-match/RNG and automated Go visual parity.\nCROSS-RUNTIME: Hermes host requires separate provisioning.\nEDITOR: run harness:hot-reload in an open, running editor to verify this environment.'); break;
    default: throw new Error(`Unknown harness command: ${command}`);
  }
  const wallMs = performance.now() - start;
  mkdirSync('artifacts', { recursive: true });
  writeFileSync(`artifacts/${command}-timing.json`, JSON.stringify({ command, wallMs }, null, 2) + '\n');
  console.log(`Harness ${command}: ${(wallMs / 1000).toFixed(3)} s end-to-end. Movement parity is scoped; full-match coverage remains pending.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
