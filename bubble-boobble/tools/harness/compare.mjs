import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function difference(expected, actual, path = '$') {
  if (typeof expected === 'number' && !Number.isFinite(expected)) throw new Error(`nonfinite reference at ${path}`);
  if (typeof actual === 'number' && !Number.isFinite(actual)) return { path, expected, actual: String(actual) };
  if (Object.is(expected, actual)) return null;
  if (expected === null || actual === null || typeof expected !== typeof actual || typeof expected !== 'object') return { path, expected, actual };
  if (Array.isArray(expected) !== Array.isArray(actual)) return { path, expected, actual };
  if (Array.isArray(expected)) {
    if (expected.length !== actual.length) return { path: `${path}.length`, expected: expected.length, actual: actual.length };
    for (let i = 0; i < expected.length; i++) { const d = difference(expected[i], actual[i], `${path}[${i}]`); if (d) return d; }
  } else {
    const keys = Object.keys(expected).sort();
    const keyDiff = difference(keys, Object.keys(actual).sort(), `${path}.keys`); if (keyDiff) return keyDiff;
    for (const key of keys) { const d = difference(expected[key], actual[key], `${path}.${key}`); if (d) return d; }
  }
  return null;
}

export function compareTrace(expected, actual) {
  if (expected.version !== 1 || actual.version !== 1 || typeof expected.scenario !== 'string' || typeof actual.scenario !== 'string' || !expected.reference || !actual.reference) throw new Error('Trace requires version 1, scenario and reference provenance');
  const header = difference({ version: expected.version, scenario: expected.scenario, reference: expected.reference }, { version: actual.version, scenario: actual.scenario, reference: actual.reference });
  if (header) return { scenario: expected.scenario, frame: null, ...header };
  if (!Array.isArray(expected.frames) || !Array.isArray(actual.frames) || expected.frames.length === 0 || actual.frames.length === 0) throw new Error('Trace requires initial state and frames');
  for (let i = 0; i < Math.max(expected.frames.length, actual.frames.length); i++) {
    const d = difference(expected.frames[i], actual.frames[i]);
    if (d) return { scenario: expected.scenario, frame: i, simulationTick: expected.frames[i]?.state?.Snapshot?.Tick ?? null, ...d, input: expected.frames[i]?.input, expectedContext: expected.frames.slice(Math.max(0, i - 1), i + 2), actualContext: actual.frames.slice(Math.max(0, i - 1), i + 2) };
  }
  return null;
}

export function compareFiles(expectedPath, actualPath, artifactDir = 'artifacts') {
  const d = compareTrace(JSON.parse(readFileSync(expectedPath, 'utf8')), JSON.parse(readFileSync(actualPath, 'utf8')));
  if (!d) { console.log('Trace matches exactly (comparator result; coverage depends on runner provenance).'); return true; }
  mkdirSync(artifactDir, { recursive: true });
  const artifact = resolve(artifactDir, 'first-divergence.json');
  writeFileSync(artifact, JSON.stringify(d, null, 2) + '\n');
  console.error(`${d.scenario}: first divergence at frame ${d.frame}, ${d.path}: expected ${JSON.stringify(d.expected)}, actual ${JSON.stringify(d.actual)}\nContext: ${artifact}`);
  return false;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 4) throw new Error('Usage: node tools/harness/compare.mjs EXPECTED.json ACTUAL.json');
    process.exitCode = compareFiles(process.argv[2], process.argv[3], process.env.HARNESS_ARTIFACT_DIR ?? 'artifacts') ? 0 : 1;
  } catch (e) { console.error(e.message); process.exitCode = 2; }
}
