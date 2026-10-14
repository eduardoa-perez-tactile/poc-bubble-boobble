// Live pinned-oracle campaign audit. Build the cached oracle with harness:fixtures first.
import { build } from "../../.gameengine/engine/node_modules/esbuild/lib/main.js";
await build({ entryPoints: ["src/arcade/game.ts"], outfile: ".cache/arcade-parity.mjs", bundle: true, platform: "node", format: "esm", target: "es2022" });
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
const cwd = process.cwd();
const { createGame, canonicalState, stepGame } = await import(pathToFileURL(cwd + "/.cache/arcade-parity.mjs"));
const { difference } = await import(pathToFileURL(cwd + "/tools/harness/compare.mjs"));
const levels = JSON.parse(readFileSync("data/levels.json"));
mkdirSync("artifacts/campaign-study", { recursive: true });
let failed = 0;
for (let round = 1; round <= 25; round++) {
  const players = round % 2 + 1;
  const s = { name: "study-" + round, seed: 42, round, players, spans: [{ ticks: 60, players: [{ Move: 0, Jump: false, Fire: false }], paused: false }, ...Array.from({ length: 20 }, (_, i) => ({ ticks: 60, players: Array.from({ length: players }, (_2, p) => ({ Move: (i + p) % 2 ? 1 : -1, Jump: i % 3 !== 0, Fire: true })), paused: false }))] };
  const out = spawnSync(cwd + "/.cache/port-oracle", [], { cwd: ".cache/reference", input: JSON.stringify(s), encoding: "utf8", maxBuffer: 5e7 });
  if (out.status) throw new Error(out.stderr);
  const fs = JSON.parse(out.stdout);
  const g = createGame(levels.slice(round - 1), 42, players);
  let d;
  for (const f of fs) {
    if (f.input) {
      g.Paused = f.input.paused;
      stepGame(g, f.input.players);
    }
    d = difference(f.state, canonicalState(g));
    if (d) {
      d = { round, frame: f.frame, ...d, input: f.input };
      writeFileSync(`artifacts/campaign-study/round-${round}.json`, JSON.stringify(d, null, 2));
      console.log(JSON.stringify(d));
      failed++;
      break;
    }
  }
  if (!d) {
    rmSync(`artifacts/campaign-study/round-${round}.json`, { force: true });
    console.log("Round", round, "all", fs.length, "frames exact");
  }
}
console.log("failed rounds", failed);
process.exitCode = failed ? 1 : 0;
