#!/usr/bin/env node
// Installed 0.1.15 build-server refuses E_CHECKOUT even though its release runtime contains
// the no-protocol V8 desktop host with the same authoritative server feature. Cook the real
// game using its CLI and export that official binary; never replace its simulation/protocol.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, createWriteStream, chmodSync, symlinkSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { arcadeBuildEnvironment, checkElf, command, digest, files, json, sourceIdentity, stampName, withBrowserReleaseFlags } from './release.mjs';

export const project = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const pins = json(join(project, 'tools/arcade/runtime-pins.json'));
export const runtimeBinaries = ['target/player/release/gameengine-host', 'target/player/release/libgameengine_webgpu.so', 'target/release/gameengine-cook'];
export function checkRuntime(root, pin = pins) {
  const runtime = json(join(root, 'gameengine-runtime.json'));
  if (runtime.version !== pin.version || runtime.platform !== 'linux' || runtime.arch !== 'x64') throw new Error('Expected pinned official Linux x64 runtime.');
  const receipt = json(join(root, 'arcade-runtime-download.json'));
  if (receipt.version !== pin.version || receipt.sha256 !== pin.sha256) throw new Error('Runtime download provenance is missing or differs from its checked-in pin.');
  if (!receipt.binaries || typeof receipt.binaries !== 'object' || Array.isArray(receipt.binaries) || JSON.stringify(Object.keys(receipt.binaries).sort()) !== JSON.stringify([...runtimeBinaries].sort()) || Object.values(receipt.binaries).some(hash => typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash))) throw new Error('Runtime receipt requires exactly the host, WebGPU and cooker SHA-256 checksums.');
  for (const [path, sha256] of Object.entries(receipt.binaries)) if (digest(readFileSync(join(root, path))) !== sha256) throw new Error(`Runtime binary changed after download: ${path}`);
  checkElf(join(root, 'target/player/release/gameengine-host'));
  checkElf(join(root, 'target/player/release/libgameengine_webgpu.so'), false);
  return receipt;
}
export async function fetchRuntime(out) {
  if (existsSync(out)) throw new Error(`Runtime output already exists: ${out}`);
  mkdirSync(dirname(out), { recursive: true });
  const archive = `${out}.tar.gz`;
  if (existsSync(archive)) throw new Error(`Download already exists: ${archive}`);
  const response = await fetch(pins.url, { signal: AbortSignal.timeout(180000) });
  if (!response.ok || !response.body) throw new Error(`Runtime download HTTP ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(archive, { flags: 'wx' }));
  if (digest(readFileSync(archive)) !== pins.sha256) throw new Error('Official runtime SHA-256 mismatch. Archive was not extracted.');
  mkdirSync(out);
  command('tar', ['-xzf', archive, '-C', out]);
  const binaries = {};
  for (const path of runtimeBinaries) binaries[path] = digest(readFileSync(join(out, path)));
  const receipt = { version: pins.version, sha256: pins.sha256, url: pins.url, binaries };
  writeFileSync(join(out, 'arcade-runtime-download.json'), JSON.stringify(receipt, null, 2) + '\n');
  checkRuntime(out);
  return { ok: true, runtimeRoot: out, ...receipt };
}
export function assemblePrebuiltServer({ runtimeRoot, out, gameProject = project }) {
  if (process.platform !== 'linux' || process.arch !== 'x64') throw new Error('Cook and assemble the official Linux production host on Linux x64.');
  const runtime = checkRuntime(runtimeRoot);
  const source = sourceIdentity(gameProject);
  if (source.dirty) throw new Error('Prebuilt release assembly requires a clean committed source revision.');
  if (existsSync(out)) throw new Error(`Server export already exists: ${out}`);
  const config = json(join(gameProject, 'project.gameengine.json')), mp = config.multiplayer;
  if (!mp || mp.authority !== 'server' || mp.world || (mp.mode ?? 'realtime') !== 'realtime') throw new Error('This exporter requires an authoritative fixed realtime match project.');
  // Resolve gameengine package imports against the official distribution. Never replace a
  // developer's established engine link silently.
  const link = join(gameProject, '.gameengine/engine');
  mkdirSync(dirname(link), { recursive: true });
  if (!existsSync(link)) symlinkSync(runtimeRoot, link, 'dir');
  else if (realpathSync(link) !== realpathSync(runtimeRoot)) throw new Error('Project engine link points elsewhere; use a fresh CI checkout.');
  mkdirSync(out, { recursive: true });
  const game = join(out, 'game');
  const env = arcadeBuildEnvironment({ GAMEENGINE_REPO: runtimeRoot, GAMEENGINE_NODE: process.execPath });
  const reportText = withBrowserReleaseFlags(gameProject, () => command(join(runtimeRoot, 'bin/gameengine'), ['cook', '--project', gameProject, '--platform', 'desktop', '--release', '--out', game, '--json'], { cwd: gameProject, env, maxBuffer: 64 * 1024 * 1024 }));
  const report = JSON.parse(reportText);
  if (!report.ok || !existsSync(join(game, 'code.gpak')) || !existsSync(join(game, 'manifest.json'))) throw new Error('Engine release cook did not produce a complete game export.');
  cpSync(join(runtimeRoot, 'target/player/release/gameengine-host'), join(out, 'gameengine-server'));
  cpSync(join(runtimeRoot, 'target/player/release/libgameengine_webgpu.so'), join(out, 'libgameengine_webgpu.so'));
  chmodSync(join(out, 'gameengine-server'), 0o755);
  const server = { game: config.name, target: 'linux-x64', authority: 'server', turnOrder: mp.turnOrder ?? 'roundRobin', port: 8787, mode: mp.mode ?? 'realtime', players: mp.players ?? 2 };
  writeFileSync(join(out, 'server.json'), JSON.stringify(server, null, 2) + '\n');
  writeFileSync(join(out, 'prebuilt-runtime.json'), JSON.stringify({ ...runtime, engineRevision: pins.engineRevision, binary: 'target/player/release/gameengine-host', features: 'v8,desktop,shipped', protocol: false, method: 'Official production host + engine CLI release cook; workaround for build-server E_CHECKOUT in installed 0.1.15.' }, null, 2) + '\n');
  const after = sourceIdentity(gameProject);
  if (after.dirty || after.sourceSha256 !== source.sourceSha256 || after.revision !== source.revision) throw new Error('Source changed during cook; restore it and rebuild.');
  const stamp = { version: 1, ...after, engineVersion: pins.version, engineRevision: pins.engineRevision, config: 'release', target: 'linux-x64', recordedAt: new Date().toISOString(), runtimeArchiveSha256: pins.sha256, files: files(out) };
  writeFileSync(join(out, stampName), JSON.stringify(stamp, null, 2) + '\n');
  return { ok: true, out, source: stamp.revision, engineVersion: pins.version, method: 'official-prebuilt-production-host', startupVerified: false };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const action = process.argv[2], args = {};
    for (let at = 3; at < process.argv.length; at += 2) { if (!process.argv[at]?.startsWith('--') || !process.argv[at + 1]) throw new Error('Expected --name value arguments.'); args[process.argv[at].slice(2)] = process.argv[at + 1]; }
    if (!args.out) throw new Error('Missing --out');
    const out = resolve(args.out);
    const result = action === 'fetch' ? await fetchRuntime(out) : action === 'build' && args['runtime-root'] ? assemblePrebuiltServer({ runtimeRoot: resolve(args['runtime-root']), out }) : (() => { throw new Error('Usage: prebuilt-server.mjs fetch --out RUNTIME | build --runtime-root RUNTIME --out EXPORT'); })();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) { console.error(`Office Arcade prebuilt server: ${error.message}`); process.exitCode = 1; }
}
