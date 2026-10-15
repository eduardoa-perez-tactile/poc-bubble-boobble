// Live pinned-oracle campaign audit. Build the cached oracle with harness:fixtures first.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { difference } from './compare.mjs';

// A player may now rise above the original Y=24 clamp. Restore only that
// precise boundary's Y/VY in a COPY, then require every other canonical field
// to remain exact. Residual differences are reported, never causally excused.
export function inspectCeilingBoundary(expected, actual) {
  const ep = expected?.Snapshot?.Players, ap = actual?.Snapshot?.Players;
  if (!Array.isArray(ep) || !Array.isArray(ap) || ep.length !== ap.length) return null;
  const corrected = structuredClone(actual), players = [];
  for (let i = 0; i < ep.length; i++) {
    const e = ep[i], a = ap[i];
    if (e?.Y === 24 && e?.VY === 0 && Number.isFinite(a?.Y) && a.Y < 24 && Number.isFinite(a?.VY) && a.VY < 0) {
      players.push({ player: i, expected: { Y: e.Y, VY: e.VY }, actual: { Y: a.Y, VY: a.VY } });
      corrected.Snapshot.Players[i].Y = e.Y;
      corrected.Snapshot.Players[i].VY = e.VY;
    }
  }
  if (!players.length) return null;
  return { players, residual: difference(expected, corrected) };
}

// Stop at the FIRST difference, including a verified intentional boundary.
// The callback advances simulation only for frames actually compared; a suffix
// after that boundary is deliberately outside the audit's parity claim.
export function compareStudyPrefix(frames, actualForFrame) {
  if (!Array.isArray(frames) || !frames.length) throw new Error('Campaign audit requires an initial state and frames');
  let matchedFrames = 0;
  for (const f of frames) {
    const actual = actualForFrame(f), d = difference(f.state, actual);
    if (!d) { matchedFrames++; continue; }
    const candidate = inspectCeilingBoundary(f.state, actual);
    if (candidate && !candidate.residual) return {
      matchedFrames,
      boundary: { frame: f.frame, input: f.input, firstDifference: d, players: candidate.players },
      failure: null,
    };
    return { matchedFrames, boundary: null, failure: { frame: f.frame, ...d, input: f.input, ...(candidate ? { rejectedBoundary: candidate } : {}) } };
  }
  return { matchedFrames, boundary: null, failure: null };
}

async function main() {
  const { build } = await import('../../.gameengine/engine/node_modules/esbuild/lib/main.js');
  await build({ stdin: {contents: "export * from './src/arcade/game.ts'; export * from './src/arcade/balance.ts';", resolveDir: process.cwd(), loader: 'ts'}, outfile: '.cache/arcade-parity.mjs', bundle: true, platform: 'node', format: 'esm', target: 'es2022' });
  const { createGame, referencePlayerBalance, canonicalState, stepGame } = await import(pathToFileURL(resolve('.cache/arcade-parity.mjs')));
  const levels = JSON.parse(readFileSync('data/levels.json'));
  mkdirSync('artifacts/campaign-study', { recursive: true });
  const rows = [];
  for (let round = 1; round <= 25; round++) {
    const players = round % 2 + 1;
    const s = { name: 'study-' + round, seed: 42, round, players, spans: [{ ticks: 60, players: [{ Move: 0, Jump: false, Fire: false }], paused: false }, ...Array.from({ length: 20 }, (_, i) => ({ ticks: 60, players: Array.from({ length: players }, (_2, p) => ({ Move: (i + p) % 2 ? 1 : -1, Jump: i % 3 !== 0, Fire: true })), paused: false }))] };
    const out = spawnSync(resolve('.cache/port-oracle'), [], { cwd: '.cache/reference', input: JSON.stringify(s), encoding: 'utf8', maxBuffer: 5e7 });
    if (out.error) throw out.error;
    if (out.status !== 0) throw new Error(out.stderr || `Go oracle exited ${out.status}`);
    const frames = JSON.parse(out.stdout);
    if (!Array.isArray(frames) || frames.length !== 1 + s.spans.reduce((n, span) => n + span.ticks, 0)) throw new Error(`Round ${round}: incomplete oracle trace`);
    const g = createGame(levels.slice(round - 1), 42, players);
    g.NormalEnemySpeedScale = 1;
    g.PlayerBalance = {...referencePlayerBalance}; // Explicit source-speed audit, not playable default.
    const result = compareStudyPrefix(frames, f => {
      if (f.input) { g.Paused = f.input.paused; stepGame(g, f.input.players); }
      return canonicalState(g);
    });
    const row = { round, availableFrames: frames.length, ...result };
    rows.push(row);
    const path = `artifacts/campaign-study/round-${round}.json`;
    if (result.failure) {
      writeFileSync(path, JSON.stringify(row, null, 2) + '\n');
      console.error(`Round ${round}: UNEXPECTED first divergence ${JSON.stringify(result.failure)}`);
    } else if (result.boundary) {
      writeFileSync(path, JSON.stringify(row, null, 2) + '\n');
      console.log(`Round ${round}: ${result.matchedFrames} frames exact; verified player ceiling boundary at frame ${result.boundary.frame}; later frames NOT compared`);
    } else {
      rmSync(path, { force: true });
      console.log(`Round ${round}: all ${frames.length} frames exact`);
    }
  }
  const report = {
    sourceProfile: { NormalEnemySpeedScale: 1, PlayerBalance: referencePlayerBalance },
    scope: 'Exact canonical prefixes against original Go; stop each round at first narrowly verified player ceiling boundary. Production player/shooting and normal-enemy speeds are intentionally tuned. No claim about any suffix after a boundary.',
    exactRounds: rows.filter(r => !r.failure && !r.boundary).length,
    expectedBoundaryRounds: rows.filter(r => r.boundary).length,
    failedRounds: rows.filter(r => r.failure).length,
    matchedFrames: rows.reduce((n, r) => n + r.matchedFrames, 0),
    rows,
  };
  writeFileSync('artifacts/campaign-study/summary.json', JSON.stringify(report, null, 2) + '\n');
  console.log(`Source-speed audit: ${report.exactRounds} complete rounds; ${report.expectedBoundaryRounds} verified boundary stops; ${report.failedRounds} unexpected failures; ${report.matchedFrames} exact prefix frames`);
  process.exitCode = report.failedRounds ? 1 : 0;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
