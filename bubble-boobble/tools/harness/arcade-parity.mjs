// Pure simulation parity; this does not exercise engine input or presentation.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { compareFiles } from "./compare.mjs";
import { build } from "../../.gameengine/engine/node_modules/esbuild/lib/main.js";
mkdirSync(".cache", { recursive: true });
await build({ stdin: { contents: "export * from './src/arcade/game.ts'; export * from './src/arcade/balance.ts'; export * from './src/arcade/scenarios.ts'; export * as movementPrototype from './src/movement.ts';", resolveDir: process.cwd(), loader: "ts" }, outfile: ".cache/arcade-parity.mjs", bundle: true, platform: "node", format: "esm", target: "es2022" });
const { createGame, referencePlayerBalance, stepGame, movementSetup, movementPrototype, canonicalState, scenarioGame } = await import(pathToFileURL(resolve(".cache/arcade-parity.mjs")).href + "?run=" + process.pid);
// Historical movement fixtures describe round1.scene's retained prototype,
// including its original ceiling. The arcade player now intentionally permits
// upward traversal. Exercise the actual prototype, without a production switch
// that silently restores the old arcade rules during a parity test.
function movementStep(g, input) {
  g.Sounds = [];
  if (g.Paused) return;
  const p = g.Players[0];
  if (Object.values(p.Power).some(Boolean)) throw new Error('Movement projection does not implement powers');
  const key = name => name === 'VX' ? 'vx' : name === 'VY' ? 'vy' : name[0].toLowerCase() + name.slice(1);
  const fields = Object.keys(p).filter(name => name !== 'Power');
  const projected = Object.fromEntries(fields.map(name => [key(name), p[name]]));
  const oldX = p.X;
  const jumped = movementPrototype.updatePlayer(projected, input.Move, input.Jump);
  for (const name of fields) p[name] = projected[key(name)];
  g.Tick++;
  g.Counters.Walked += Math.abs(p.X - oldX);
  if (jumped) { g.Counters.Jumps++; g.Sounds.push('jump'); }
}
const levels = JSON.parse(readFileSync("data/levels.json", "utf8"));
const names = process.argv.slice(2);
const selected = names.length ? names : readdirSync("tests/scenarios").filter((n) => n.endsWith(".json") && !n.startsWith("math-")).map((n) => n.slice(0, -5));
let failed = false;
for (const name of selected) {
  const setup = JSON.parse(readFileSync(`tests/scenarios/${name}.json`, "utf8"));
  if (setup.mode && setup.mode !== "movement") throw new Error(`unsupported pure sim mode ${setup.mode}`);
  const expected = JSON.parse(readFileSync(`tests/fixtures/${name}.expected.json`, "utf8"));
  const g = setup.setup ? scenarioGame(levels, setup) : createGame(levels.slice(setup.round - 1), setup.seed, setup.players);
  // Compare unchanged Go fixtures using explicit original player/enemy tuning.
  // The playable default is tested separately, not called exact Go parity.
  g.NormalEnemySpeedScale = 1;
  g.PlayerBalance = {...referencePlayerBalance};
  if (setup.mode === "movement") movementSetup(g, setup.player, setup.spawn);
  const snapshot = () => JSON.parse(JSON.stringify(canonicalState(g)));
  const frames = [{ frame: 0, input: null, state: snapshot() }];
  let frame = 0;
  for (const span of setup.spans) for (let i = 0; i < span.ticks; i++) {
    g.Paused = span.paused;
    if (setup.mode === "movement") movementStep(g, span.players[0]);
    else stepGame(g, span.players);
    frames.push({ frame: ++frame, input: { ...span, ticks: 1 }, state: snapshot() });
  }
  mkdirSync("artifacts/arcade", { recursive: true });
  const path = `artifacts/arcade/${name}.actual.json`;
  writeFileSync(path, JSON.stringify({ ...expected, frames }));
  if (!compareFiles(`tests/fixtures/${name}.expected.json`, path, `artifacts/arcade/${name}`)) failed = true;
  else console.log(`Pure sim ${name}: ${frames.length} frames exact.`);
}
if (failed) process.exitCode = 1;
