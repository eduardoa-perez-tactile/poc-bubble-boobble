#!/usr/bin/env node
// Engine match tests, not a browser substitute. The recorded cheat rejects title-only runs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cases = [
  { name: 'ten-humans', players: 10, frames: 1200, latency: 4, jitter: 2, seed: 1 },
  { name: 'two-humans-eight-ai', players: 2, frames: 900, latency: 10, jitter: 6, seed: 1 },
  { name: 'five-humans-five-ai', players: 5, frames: 600, latency: 4, jitter: 2, seed: 42 },
  { name: 'one-human-nine-ai', players: 1, frames: 600, latency: 4, jitter: 2, seed: 42 },
];
const selected = process.argv[2] ?? 'all';
if (process.argv.length > 3 || (selected !== 'all' && !cases.some(test => test.name === selected))) {
  console.error(`Choose all or ${cases.map(test => test.name).join(', ')}.`); process.exit(1);
}
const out = join(project, '.gameengine/multiplayer-evidence');
mkdirSync(out, { recursive: true });
const summary = [];
for (const test of cases.filter(test => selected === 'all' || test.name === selected)) {
  console.log(`Testing ${test.name}: ${test.frames} frames, latency ${test.latency}, jitter ${test.jitter}`);
  const args = ['mp', 'test', '--authority', 'server', '--js', 'v8', '--event', JSON.stringify({ $event: 'CheatRequested', id: 'online.assert-active', args: '{}' }), '--json'];
  for (const key of ['players', 'frames', 'latency', 'jitter', 'seed']) args.push(`--${key}`, String(test[key]));
  const result = spawnSync('gameengine', args, { cwd: project, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  writeFileSync(join(out, `${test.name}.json`), result.stdout || JSON.stringify({ ok: false, error: result.error?.message ?? result.stderr }));
  writeFileSync(join(out, `${test.name}.stderr.txt`), result.stderr ?? '');
  let report;
  try { report = JSON.parse(result.stdout); } catch { throw new Error(`Invalid engine report: ${result.error?.message ?? result.stderr}`); }
  if (result.status !== 0 || !report.ok || !report.reached || report.players !== test.players || report.divergence || report.desyncs?.length || !report.comparedHashes || !report.event?.reached?.length || report.event.failed?.length || report.event.refused) {
    throw new Error(`${test.name} failed; see ${join(out, `${test.name}.json`)}`);
  }
  const row = { ...test, ok: true, assertionFrame: report.event.reached[0].frame, comparedHashes: report.comparedHashes, serverMsPerTick: report.serverMsPerTick, clientMsPerFrame: report.clientMsPerFrame, rollback: report.rollback, wireBytesPerPlayerPerSecond: report.wireBytesPerPlayerPerSecond };
  summary.push(row);
  writeFileSync(join(out, 'summary.json'), JSON.stringify({ scope: 'Engine authoritative match harness; real browser acceptance separate', cases: summary }, null, 2) + '\n');
  console.log(JSON.stringify(row));
}
