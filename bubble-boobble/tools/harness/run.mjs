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
const measurements = [];
const hash = data => createHash('sha256').update(data).digest('hex');
const read = path => readFileSync(path, 'utf8');
function run(command, args, options = {}) {
  const start = performance.now();
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: 'pipe', maxBuffer: 64 * 1024 * 1024, ...options });
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
  const testCases = args[0] === 'test' ? Object.values(output.results ?? {}).flatMap(results => Array.isArray(results) ? results : []) : [];
  if (testCases.length) console.log(`${testCases.length} selected test cases passed`);
  measurements.push({ command: `gameengine ${args.join(' ')}`, wallMs: result.wallMs, ...(testCases.length ? { tests: testCases.length } : {}) });
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
  const inputs = JSON.parse(read('data/harness-scenarios.json'));
  const names = readdirSync('tests/scenarios').filter(name => name.startsWith('boundary-') && name.endsWith('.json')).map(name => name.slice(0,-5)).sort();
  if (JSON.stringify(Object.keys(inputs).sort()) !== JSON.stringify(names)) throw new Error('Controlled input aggregate names differ from canonical scenarios');
  for (const name of names) if (JSON.stringify(inputs[name]) !== JSON.stringify(JSON.parse(read(`tests/scenarios/${name}.json`)))) throw new Error(`Controlled input aggregate is stale: ${name}`);

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
// The installed replay CLI drops the test's recorded scene. Supply it to the host.
const replays = [
  {path:'tests/replays/party_boss_ten_dragons_fire_identifiable_lightning_bubbles.greplay',scene:'scenes/arcade.scene.json',filter:'party boss ten dragons fire identifiable lightning bubbles',tier:'t1'},
  {path:'tests/replays/wave_fruit_real_final_pops_show_a_different_reward_each_wave.greplay',scene:'scenes/arcade.scene.json',filter:'wave fruit real final pops show a different reward each wave',tier:'t1'},
  {path:'tests/replays/party_feedback_ready_go_and_last_kill_fit_every_window.greplay',scene:'scenes/arcade.scene.json',filter:'party feedback ready GO and last kill fit every window',tier:'t1'},
  {path:'tests/replays/courtyard_full_arena_and_ten_identities_fit_native_wide_tall_and_ultrawide_windows.greplay',scene:'scenes/arcade.scene.json',filter:'courtyard full arena and ten identities fit native wide tall and ultrawide windows',tier:'t1'},
  {path:'tests/replays/ten_named_actions_reject_malformed_suffixes_and_pad_ten_stays_isolated.greplay',scene:'scenes/arcade.scene.json',filter:'ten named actions reject malformed suffixes and pad ten stays isolated'},
  {path:'tests/replays/ten_dragons_firing_and_rescue_remain_bounded_on_phone_low.greplay',scene:'scenes/arcade.scene.json',filter:'ten dragons firing and rescue remain bounded on phone low',tier:'t1'},
  {path:'tests/replays/feedback_shooting_space_cannot_restart_a_defeated_boss_run.greplay',scene:'scenes/arcade.scene.json',filter:'feedback shooting Space cannot restart a defeated boss run'},
  {path:'tests/replays/feedback_results_require_release_and_a_fresh_controller_confirmation_after_the_guard.greplay',scene:'scenes/arcade.scene.json',filter:'feedback results require release and a fresh controller confirmation after the guard'},
  {path:'tests/replays/feedback_jump_dust_grounded_shadows_nameplates_and_guarded_results_remain_readable.greplay',scene:'scenes/arcade.scene.json',filter:'feedback jump dust grounded shadows nameplates and guarded results remain readable',tier:'t1'},
  {path:'tests/replays/feel_six_player_capture_chain_rescue_boss_and_results_fit_every_aspect.greplay',scene:'scenes/arcade.scene.json',filter:'feel six player capture chain rescue boss and results fit every aspect',tier:'t1'},
  {path:'tests/replays/party_boss_recorded_thunder_shot_capture_and_finishing_pop.greplay',scene:'scenes/arcade.scene.json',filter:'party boss recorded thunder shot capture and finishing pop'},
  {path:'tests/replays/party_last_standing_only_shows_defeat_when_the_final_bot_falls_through_recorded_engine_inputs.greplay',scene:'scenes/arcade.scene.json',filter:'party last standing only shows defeat when the final bot falls through recorded engine inputs'},
  {path:'tests/replays/party_pacing_five_second_countdown_preparation_shooting_and_red_last_enemy.greplay',scene:'scenes/arcade.scene.json',filter:'party pacing five second countdown preparation shooting and red last enemy',tier:'t1'},
  {path:'tests/replays/party_polish_readable_countdown_falling_enemies_and_rest_practice_shots.greplay',scene:'scenes/arcade.scene.json',filter:'party polish readable countdown falling enemies and rest practice shots',tier:'t1'},
  {path:'tests/replays/party_polish_six_real_pops_coalesce_while_classic_cues_retain_their_original_mix.greplay',scene:'scenes/arcade.scene.json',filter:'party polish six real pops coalesce while classic cues retain their original mix'},
  {path:'tests/replays/party_randomized_powerup_has_a_small_green_benefit_alert_in_the_arena.greplay',scene:'scenes/arcade.scene.json',filter:'party randomized powerup has a small green benefit alert in the arena',tier:'t1'},
  {path:'tests/replays/party_recorded_wave_clear_rest_boss_and_results.greplay',scene:'scenes/arcade.scene.json',filter:'party recorded wave clear rest boss and results'},
  {path:'tests/replays/party_six_actual_controllers_move_separate_humans_and_operate_menus.greplay',scene:'scenes/arcade.scene.json',filter:'party six actual controllers move separate humans and operate menus'},
  { path: 'tests/replays/harness_reset_and_tap.greplay', scene: 'scenes/main.scene.json', filter: 'harness reset and tap' },
  { path: 'tests/replays/movement_physical_keyboard_hold_release_and_jump.greplay', scene: 'scenes/round1.scene.json', filter: 'movement physical keyboard hold release and jump' },
  { path: 'tests/replays/arcade_engine_input_full_go_parity_reference_round1_smoke.greplay', scene: 'scenes/arcade.scene.json', filter: 'arcade engine input full Go parity reference-round1-smoke' },
  { path: 'tests/replays/player_traversal_engine_input_wraps_round_three_and_preserves_upward_re_entry.greplay', scene: 'scenes/arcade.scene.json', filter: 'player traversal engine input wraps round three and preserves upward re-entry' },
  { path: 'tests/replays/desktop_complete_presentation_flows.greplay', scene: 'scenes/arcade.scene.json', filter: 'desktop complete presentation flows', tier: 't1' },
  { path: 'tests/replays/dragon_skins_settings_selection_reaches_red_gameplay.greplay', scene: 'scenes/arcade.scene.json', filter: 'dragon skins settings selection reaches red gameplay', tier: 't1' },
  { path: 'tests/replays/dragon_skins_settings_selection_reaches_yellow_gameplay.greplay', scene: 'scenes/arcade.scene.json', filter: 'dragon skins settings selection reaches yellow gameplay', tier: 't1' },
  { path: 'tests/replays/bubble_skins_actual_fire_input_all_solo_colors.greplay', scene: 'scenes/arcade.scene.json', filter: 'bubble skins actual fire input all solo colors', tier: 't1' },
  { path: 'tests/replays/bubble_skins_actual_fire_input_simultaneous_co_op_colors.greplay', scene: 'scenes/arcade.scene.json', filter: 'bubble skins actual fire input simultaneous co-op colors', tier: 't1' },
  { path: 'tests/replays/arcade_player_motion_real_engine_fall_inputs_shoes_false.greplay', scene: 'scenes/arcade.scene.json', filter: 'arcade player motion real engine fall inputs shoes false' },
  { path: 'tests/replays/arcade_player_motion_real_engine_fall_inputs_shoes_true.greplay', scene: 'scenes/arcade.scene.json', filter: 'arcade player motion real engine fall inputs shoes true' },
  { path: 'tests/replays/arcade_player_motion_real_engine_jump_pause_and_co_op_phases.greplay', scene: 'scenes/arcade.scene.json', filter: 'arcade player motion real engine jump pause and co-op phases' },
  { path: 'tests/replays/arcade_scoring_real_engine_pops_and_fruit_pickups_update_hud_and_animate_points.greplay', scene: 'scenes/arcade.scene.json', filter: 'arcade scoring real engine pops and fruit pickups update HUD and animate points' },
  { path: 'tests/replays/companion_modes_start_restart_pause_and_preserve_human_co_op_controls.greplay', scene: 'scenes/arcade.scene.json', filter: 'companion modes start restart pause and preserve human co-op controls' },
  { path: 'tests/replays/desktop_physical_enter_tap_between_simulation_steps_is_not_dropped.greplay', scene: 'scenes/arcade.scene.json', filter: 'desktop physical Enter tap between simulation steps is not dropped' },
];
function verifyReplays(selected = replays) {
  const bundle = engine(['bundle']).output.path;
  const doctor = JSON.parse(run('gameengine', ['doctor', '--json']).stdout);
  const host = doctor.checks.find(check => check.name === 'gameengine-host (V8)' && check.ok)?.detail;
  if (!host) throw new Error('V8 host unavailable');
  for (const replay of selected) {
    const result = run(host, ['--mode','headless','--project',root,'--bundle',bundle,'--js','v8','--scene',replay.scene,'--verify',resolve(replay.path)]);
    if (JSON.parse(result.stdout).ok !== true) throw new Error(result.stdout);
    measurements.push({ command: `replay ${replay.path} scene=${replay.scene}`, wallMs: result.wallMs });
    console.log(`Replay ${replay.path}, scene ${replay.scene}: ${(result.wallMs / 1000).toFixed(3)} s`);
  }
}
function recordReplays() {
  for (const replay of replays) engine(['test', '--js', 'v8', ...(replay.tier ? ['--tier', replay.tier, '--gpu-tier', 'desktop'] : []), '--record-replays', '--filter', replay.filter]);
}
function reset() {
  const probe = spawnSync('gameengine', ['editor', 'state', '--json'], { encoding: 'utf8' });
  if (probe.status === 0 && JSON.parse(probe.stdout).ok) {
    const state = JSON.parse(probe.stdout).value;
    if (!state.playing) engine(['editor', 'play']);
    engine(['editor', 'call', 'cheat.run', '--role', 'game', '--params', JSON.stringify({ id: 'arcade.reset', args: { round: 1, seed: 42, players: 1, ready: false, quiet: false } })]);
    engine(['editor', 'call', 'engine.step', '--role', 'game', '--params', '{"n":1}']);
  } else {
    engine(['cheat', 'run', 'arcade.reset', 'round=1', 'seed=42', 'players=1', 'ready=false', 'quiet=false']); engine(['step', '1']);
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
    case 'quick':
      selftest();
      if (process.argv[3]) engine(['test', '--js', 'v8', '--filter', process.argv[3]]);
      // Keep confirmation and co-op regressions in the engine lane; never substitute OS playtesting.
      else for (const filter of ['*movement*', '*arcade engine input*', '*arcade Go*', 'desktop *', 'companion *', 'arcade player motion *', 'arcade scoring *']) engine(['test', '--js', 'v8', '--filter', filter]);
      break;
    case 'verify':
    case 'verify-full': {
      selftest();
      const bridgeHTTP = run(process.execPath, ['--test', 'tools/desktop/bridge-http.test.mjs']);
      console.log(bridgeHTTP.stdout.trim());
      measurements.push({ command: 'desktop bridge aborted-body regression', wallMs: bridgeHTTP.wallMs });
      // A fresh host captures its real live viewport before any offscreen
      // screenshot/probe can initialize 3D and hide a cold-start failure.
      const viewport = run(process.execPath, ['tools/harness/viewport-smoke.mjs']);
      console.log(viewport.stdout.trim());
      measurements.push({ command: 'cold live-viewport startup regression', wallMs: viewport.wallMs });
      engine(['test', '--js', 'v8']);
      // An explicit wildcard still selects every T1 test. It bypasses the
      // installed CLI's unrendered structural-replay lane, which stalls while
      // assets wait for GPU requests. The public-protocol check below replaces
      // that lane at material/checkpoint gates and requires every page/effect.
      engine(['test', '--js', 'v8', '--tier', 't1', '--gpu-tier', 'desktop', '--filter', '*']);
      if (command === 'verify-full') {
        const structural = run(process.execPath, ['tools/harness/record-pipelines.mjs', '--check']);
        console.log(structural.stdout.trim());
        measurements.push({ command: 'presentation replay structural check (explicit GPU probes)', wallMs: structural.wallMs });
      }
      verifyReplays();
      engine(['check']);
      const audio = run(process.execPath, ['tools/port/check-audio-assets.mjs']);
      console.log(audio.stdout.trim());
      measurements.push({ command: 'audio asset provenance and alias guard', wallMs: audio.wallMs });
      break;
    }
    case 'record': {
      if (process.argv[3]) {
        const known = replays.find(replay => replay.filter === process.argv[3]);
        engine(['test', '--js', 'v8', ...(known?.tier ? ['--tier', known.tier, '--gpu-tier', 'desktop'] : []), '--record-replays', '--filter', process.argv[3]]);
      } else recordReplays();
      break;
    }
    case 'replay': {
      if (!process.argv[3]) verifyReplays();
      else {
        const known = replays.find(replay => replay.path === process.argv[3]);
        const scene = process.argv[4] ?? known?.scene;
        if (!scene) throw new Error('Unknown replay: provide its recorded scene as the next argument');
        verifyReplays([{ path: process.argv[3], scene }]);
      }
      break;
    }
    case 'milestone': {
      selftest();
      const oracle = reference(); // Verify Go/revision/content/overlay and rebuild.
      console.log(oracle.version);
      console.log(run(oracle.go, ['test', './internal/game'], { cwd: oracle.checkout, env: oracle.env }).stdout.trim());
      for (const script of ['arcade-parity.mjs', 'numerics-study.mjs', 'arcade-study.mjs']) {
        const result = run(process.execPath, [`tools/harness/${script}`]);
        console.log(result.stdout.trim());
        measurements.push({ command: script, wallMs: result.wallMs });
      }
      break;
    }
    case 'reset': reset(); break;
    case 'coverage': console.log('IMPLEMENTED: cached exact full-state engine-input traces for rounds 1/10/24/25 and ready/fire/pause smoke; original movement boundaries and keyboard path; Go PCG/FMA/trig.\nMILESTONE: live independent initialization of all 25 rounds, 31,525 snapshots, plus random numerical studies. Run harness:milestone.\nLIMITS: fixed traces do not prove every bonus/enemy boundary or natural completion of all 25 rounds; semantic inputs do not prove every physical binding; Tactile goldens do not prove Go visual parity.\nCROSS-RUNTIME: Hermes host requires separate provisioning.\nEDITOR: run harness:hot-reload in an open running editor to verify this environment.'); break;
    default: throw new Error(`Unknown harness command: ${command}`);
  }
  const wallMs = performance.now() - start;
  mkdirSync('artifacts', { recursive: true });
  writeFileSync(`artifacts/${command}-timing.json`, JSON.stringify({ command, wallMs, measurements }, null, 2) + '\n');
  console.log(`Harness ${command}: ${(wallMs / 1000).toFixed(3)} s end-to-end. Exact parity claims are limited to the recorded scenarios; see docs/harness.md.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
