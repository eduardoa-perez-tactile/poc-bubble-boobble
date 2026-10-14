import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { compareTrace, difference } from './compare.mjs';

const fixture = JSON.parse(readFileSync('tests/fixtures/reference-round1-smoke.expected.json', 'utf8'));
test('exact comparison accepts repeated trace and object key reordering', () => {
  assert.equal(compareTrace(fixture, structuredClone(fixture)), null);
  assert.equal(difference({ a: 1, b: 2 }, { b: 2, a: 1 }), null);
});
test('first divergent tick includes the field, input and surrounding states', () => {
  const actual = structuredClone(fixture);
  actual.frames[65].state.Snapshot.Score = 100;
  const d = compareTrace(fixture, actual);
  assert.equal(d.frame, 65);
  assert.equal(d.path, '$.state.Snapshot.Score');
  assert.equal(d.expected, 0);
  assert.equal(d.actual, 100);
  assert.equal(d.input.players[0].Fire, true);
  assert.equal(d.expectedContext.length, 3);
});
test('missing fields, reordered actors, changed precision, and missing frames fail', () => {
  const actual = structuredClone(fixture);
  delete actual.frames[1].state.RNG;
  assert.ok(compareTrace(fixture, actual));
  assert.ok(difference([{ ID: 1 }, { ID: 2 }], [{ ID: 2 }, { ID: 1 }]));
  assert.ok(difference(0.1, 0.10000000001));
  assert.ok(difference(1, NaN));
  assert.throws(() => compareTrace({ frames: [] }, { frames: [] }), /Trace requires/);
  assert.throws(() => compareTrace({ ...fixture, frames: [] }, fixture), /initial state/);
  const short = structuredClone(fixture); short.frames.pop();
  assert.equal(compareTrace(fixture, short).frame, fixture.frames.length - 1);
});
test('real comparator command exits nonzero and writes a diagnostic on corruption', () => {
  const actual = structuredClone(fixture); actual.frames[65].state.Snapshot.Score++;
  mkdirSync('artifacts', { recursive: true });
  writeFileSync('artifacts/corrupt-trace.json', JSON.stringify(actual));
  const result = spawnSync(process.execPath, ['tools/harness/compare.mjs', 'tests/fixtures/reference-round1-smoke.expected.json', 'artifacts/corrupt-trace.json'], { encoding: 'utf8', env: { ...process.env, HARNESS_ARTIFACT_DIR: 'artifacts/selftest' } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /frame 65.*Score/);
  assert.equal(JSON.parse(readFileSync('artifacts/selftest/first-divergence.json')).frame, 65);
});
test('fixture covers ready, movement, shooting and pause without ticking while paused', () => {
  assert.equal(fixture.frames.length, 89);
  assert.equal(fixture.frames[0].state.Snapshot.State, 0);
  assert.equal(fixture.frames[60].state.Snapshot.State, 1);
  assert.ok(fixture.frames[80].state.Snapshot.Bubbles.length > 0);
  assert.equal(fixture.frames[83].state.Snapshot.Tick, 80);
  assert.equal(fixture.frames[88].state.Snapshot.Tick, 85);
});
