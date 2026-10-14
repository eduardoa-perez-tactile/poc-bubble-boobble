// Optional live numerical study; cached V8 tests remain the normal quick lane.
import { build } from "../../.gameengine/engine/node_modules/esbuild/lib/main.js";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
await build({ stdin: { contents: "export * from './src/arcade/trig.ts'; export * from './src/arcade/rng.ts';", resolveDir: process.cwd(), loader: "ts" }, outfile: ".cache/numerics-study.mjs", bundle: true, format: "esm", platform: "node", target: "es2022" });
const { goSin, goCos, goFMA, createRNG, uint64, float64, intN } = await import(pathToFileURL(resolve(".cache/numerics-study.mjs")));
function oracle(scenario) {
  const result = spawnSync(resolve(".cache/port-oracle"), [], { cwd: ".cache/reference", input: JSON.stringify(scenario), encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || String(result.error));
  return JSON.parse(result.stdout);
}
const rng = createRNG(23), bits = new DataView(new ArrayBuffer(8)), angles = [];
for (let i = 0; i < 1e4; i++) {
  bits.setBigUint64(0, uint64(rng));
  const x = bits.getFloat64(0);
  if (Number.isFinite(x)) angles.push(x);
}
for (const { state: s } of oracle({ mode: "math", angles })) {
  if (goSin(s.X) !== s.Sin || goCos(s.X) !== s.Cos) throw new Error(`trig differs at ${s.X}`);
}
const fmas = [], fmaRng = createRNG(23);
for (let i = 0; i < 1e4; i++) {
  const next = () => (float64(fmaRng) * 2 - 1) * 2 ** (intN(fmaRng, 1200) - 600);
  const v = [next(), next(), next()];
  if (Number.isFinite(v[0] * v[1] + v[2])) fmas.push(v);
}
for (const { state: s } of oracle({ mode: "fma", fmas })) {
  if (goFMA(s.A, s.B, s.C) !== s.Result) throw new Error(`FMA differs at ${JSON.stringify(s)}`);
}
console.log(`Exact live Go matches: ${angles.length} finite raw-bit trig samples; ${fmas.length} finite-result FMA samples.`);
