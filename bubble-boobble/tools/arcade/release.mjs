import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { zstdDecompressSync } from 'node:zlib';

export const manifest = { version: 1, server: { runtime: 'gameengine', target: 'linux-x64', entry: 'server/gameengine-server' } };
export const stampName = 'arcade-build.json';
const fail = message => { throw new Error(message); };
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export const json = path => JSON.parse(readFileSync(path, 'utf8'));
export function command(program, args, options = {}) {
  const result = spawnSync(program, args, { encoding: 'utf8', ...options });
  if (result.error || result.status !== 0) fail(`${program}: ${result.error?.message ?? result.stderr ?? `exit ${result.status}`}`);
  return result.stdout?.trim() ?? '';
}
export function files(root) {
  const result = [];
  function visit(dir) {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name), stat = lstatSync(path), rel = relative(root, path).replaceAll('\\', '/');
      if (stat.isSymbolicLink()) fail(`Symlink is not permitted in an export: ${rel}`);
      if (/^(?:\.env(?:\.|$)|\.git$|node_modules$|\.cache$|\.gameengine$|saves?$|credentials?)/i.test(name)) fail(`Unexpected private/cache path in export: ${rel}`);
      if (stat.isDirectory()) visit(path);
      else if (stat.isFile()) result.push({ path: rel, sha256: digest(readFileSync(path)), bytes: stat.size, mode: stat.mode & 0o777 });
      else fail(`Unsupported export file: ${rel}`);
    }
  }
  visit(root);
  return result;
}
export function sourceIdentity(project) {
  const git = args => command('git', ['-C', project, ...args]);
  const paths = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard', '.']).split('\0').filter(Boolean).sort();
  const hash = createHash('sha256');
  for (const path of paths) {
    hash.update(path).update('\0');
    hash.update(existsSync(join(project, path)) ? readFileSync(join(project, path)) : '<deleted>');
    hash.update('\0');
  }
  return { revision: git(['rev-parse', 'HEAD']), dirty: !!git(['status', '--porcelain', '--untracked-files=normal']), sourceSha256: hash.digest('hex') };
}
/** Use the actual exporter configuration, never stamp an independently supplied checkout. */
export function webEngineRoot(project, requested) {
  const toolchain = json(join(project, '.gameengine/web-toolchain.json'));
  if (typeof toolchain.engineRoot !== 'string' || !toolchain.engineRoot) fail('Web toolchain must configure an engineRoot.');
  const actual = realpathSync(resolve(project, toolchain.engineRoot));
  if (actual !== realpathSync(requested)) fail('Requested engine-root differs from the web exporter toolchain.engineRoot.');
  return actual;
}
export function engineIdentity(engineRoot) {
  const tag = command('git', ['-C', engineRoot, 'describe', '--tags', '--exact-match', 'HEAD']);
  const release = /^v(\d+\.\d+\.\d+)$/.exec(tag);
  if (!release) fail('Engine source must be checked out at an exact vX.Y.Z release tag.');
  if (command('git', ['-C', engineRoot, 'status', '--porcelain', '--untracked-files=no'])) fail('Engine source has tracked modifications.');
  // Distribution staging rewrites engine-version.json; its tracked source value can lag
  // the actual release. The exact clean source tag is authoritative for source identity.
  return { engineVersion: release[1], engineSourceMetadataVersion: json(join(engineRoot, 'engine-version.json')).version, engineRevision: command('git', ['-C', engineRoot, 'rev-parse', 'HEAD']) };
}
/** The server cooks the exact browser release script; WEB_BUILD affects presentation only. */
export function withBrowserReleaseFlags(project, build) {
  const path = join(project, 'src/desktop/build-flags.ts'), original = readFileSync(path, 'utf8');
  if (!/export const DEVELOPMENT_BUILD = (true|false);/.test(original) || !/export const WEB_BUILD = (true|false);/.test(original)) fail('Generated build flag format changed; review client/server identity alignment.');
  const source = original.replace(/export const DEVELOPMENT_BUILD = (true|false);/, 'export const DEVELOPMENT_BUILD = false;').replace(/export const WEB_BUILD = (true|false);/, 'export const WEB_BUILD = true;');
  writeFileSync(path, source);
  try { return build(); } finally { writeFileSync(path, original); }
}
export function stampExport({ project, engineRoot, out, target }) {
  if (!['web', 'linux-x64'].includes(target)) fail('Stamp target must be web or linux-x64.');
  const provenance = { version: 1, ...sourceIdentity(project), ...engineIdentity(engineRoot), target, config: 'release', recordedAt: new Date().toISOString() };
  if (target === 'web') {
    const report = json(join(out, 'build-report.json'));
    if (!report.ok || report.dryRun || report.config !== 'release') fail('A complete release web export is required.');
  } else if (process.platform !== 'linux' || process.arch !== 'x64') fail('Record the server build on Linux x64, where it was built.');
  provenance.files = files(out).filter(file => file.path !== stampName);
  writeFileSync(join(out, stampName), JSON.stringify(provenance, null, 2) + '\n');
  return provenance;
}
export function readPak(path) {
  const pack = readFileSync(path);
  if (pack.length < 32 || pack.toString('ascii', 0, 4) !== 'GPAK' || ![1, 2].includes(pack.readUInt32LE(4))) fail(`Invalid GPAK: ${path}`);
  const offset = Number(pack.readBigUInt64LE(8)), length = Number(pack.readBigUInt64LE(16));
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || length < 1 || offset < 32 || offset + length > pack.length) fail(`Invalid GPAK index: ${path}`);
  const index = JSON.parse(zstdDecompressSync(pack.subarray(offset, offset + length), { maxOutputLength: 64 * 1024 * 1024 }));
  return key => {
    const entry = index.entries.find(e => e.key === key);
    if (!entry) fail(`Missing ${key} in ${path}`);
    if (!Number.isSafeInteger(entry.size) || entry.size < 0 || entry.size > 64 * 1024 * 1024) fail(`Invalid GPAK entry: ${key}`);
    const chunks = [];
    for (let at = entry.offset; at < entry.offset + entry.size;) {
      const block = index.blocks[Math.floor(at / 65536)];
      if (!block) fail(`Truncated GPAK: ${key}`);
      const raw = zstdDecompressSync(pack.subarray(block.file_offset, block.file_offset + block.compressed), { maxOutputLength: 65536 });
      const chunk = raw.subarray(at % 65536, Math.min(raw.length, at % 65536 + entry.offset + entry.size - at));
      if (!chunk.length) fail(`Truncated GPAK entry: ${key}`);
      chunks.push(chunk); at += chunk.length;
    }
    return Buffer.concat(chunks);
  };
}
export function checkElf(path, executable = true) {
  const binary = readFileSync(path);
  if (binary.length < 64 || !binary.subarray(0, 4).equals(Buffer.from([127, 69, 76, 70])) || binary[4] !== 2 || binary[5] !== 1 || binary.readUInt16LE(18) !== 62) fail(`${path} must be an ELF64 little-endian Linux x86_64 binary.`);
  if (executable && !(lstatSync(path).mode & 0o111)) fail(`${path} must have executable permissions.`);
}
function verifiedStamp(out, target) {
  const stamp = json(join(out, stampName));
  if (stamp.version !== 1 || stamp.target !== target || stamp.config !== 'release') fail(`Invalid ${target} release provenance.`);
  if (stamp.dirty) fail('Release exports must come from a clean source revision; commit changes and rebuild both targets.');
  if (!/^[a-f0-9]{40}$/.test(stamp.revision) || !/^[a-f0-9]{64}$/.test(stamp.sourceSha256) || !stamp.engineVersion || !stamp.engineRevision) fail('Incomplete build provenance.');
  const actual = files(out).filter(file => file.path !== stampName);
  if (JSON.stringify(actual) !== JSON.stringify(stamp.files)) fail(`Export changed after provenance was recorded: ${out}`);
  return stamp;
}
export function verifyExports({ web, server }) {
  const client = verifiedStamp(web, 'web'), host = verifiedStamp(server, 'linux-x64');
  for (const field of ['revision', 'sourceSha256', 'engineVersion', 'engineRevision', 'config']) if (client[field] !== host[field]) fail(`Client/server ${field} mismatch.`);
  const report = json(join(web, 'build-report.json'));
  if (!report.ok || report.dryRun || report.config !== 'release') fail('Web export must be an actual release build.');
  for (const file of ['site/index.html', 'site/player.js', 'site/gameengine-web-player.js', 'site/gameengine_web_player.wasm', 'site/splash/splash.css', 'site/playtest-build.json']) if (!existsSync(join(web, file))) fail(`Missing complete browser shell file: ${file}`);
  const shell = json(join(web, 'site/playtest-build.json'));
  if (shell.sha !== client.revision || shell.dirty || shell.shell !== 'bubble-web-v2') fail('Browser controls/splash build provenance does not match the release.');
  const config = json(join(server, 'server.json'));
  if (config.target !== 'linux-x64' || config.authority !== 'server' || config.port !== 8787 || config.mode !== 'realtime') fail('Server export must be linux-x64, authoritative realtime, port 8787.');
  checkElf(join(server, 'gameengine-server'));
  checkElf(join(server, 'libgameengine_webgpu.so'), false);
  const c = readPak(join(web, 'site/game/code.gpak')), s = readPak(join(server, 'game/code.gpak'));
  const clientProject = JSON.parse(c('gameengine/project.gameengine.json')), serverProject = JSON.parse(s('gameengine/project.gameengine.json'));
  for (const field of ['name', 'version', 'multiplayer']) if (JSON.stringify(clientProject[field]) !== JSON.stringify(serverProject[field])) fail(`Cooked ${field} mismatch.`);
  if (!clientProject.multiplayer || clientProject.multiplayer.authority !== 'server') fail('Cooked project needs multiplayer.authority=server.');
  if (!c('gameengine/input.json').equals(s('gameengine/input.json'))) fail('Cooked input mappings differ.');
  const scriptSha256 = digest(c('gameengine/bundle.js'));
  if (scriptSha256 !== digest(s('gameengine/bundle.js'))) fail('Cooked scripts differ: actual engine match build identities will differ. Rebuild matching exports; never override the identity.');
  // Resolve all manifest-listed bundles, not just the scripts.
  for (const game of [join(web, 'site/game'), join(server, 'game')]) {
    const content = json(join(game, 'manifest.json'));
    for (const entry of content.entries) if (entry.bundle && !existsSync(join(game, `${entry.bundle}.gpak`))) fail(`Missing cooked bundle ${entry.bundle} in ${game}`);
  }
  return { ok: true, revision: client.revision, sourceSha256: client.sourceSha256, engineVersion: client.engineVersion, engineRevision: client.engineRevision, config: 'release', game: clientProject.name, version: clientProject.version, scriptSha256, limits: ['Static artifact verification only; does not prove Linux runtime dependencies, WebSocket handshake, browser gameplay or reconnect.'] };
}
export function packageExports({ web, server, out }) {
  const evidence = verifyExports({ web, server });
  out = resolve(out);
  if (existsSync(out)) fail(`Output already exists: ${out}`);
  const stage = out.replace(/\.zip$/i, '') + '.contents';
  if (existsSync(stage)) fail(`Staging directory already exists: ${stage}`);
  mkdirSync(stage, { recursive: true });
  cpSync(join(web, 'site'), join(stage, 'site'), { recursive: true });
  cpSync(server, join(stage, 'server'), { recursive: true });
  writeFileSync(join(stage, 'arcade.json'), JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync(join(stage, 'release-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
  command('zip', ['-q', '-r', out, 'arcade.json', 'release-evidence.json', 'site', 'server'], { cwd: stage });
  const zip = readFileSync(out);
  if (zip.length > 1024 ** 3) fail('ZIP exceeds Office Arcade compressed upload limit of 1 GiB.');
  command('unzip', ['-tq', out]);
  const receipt = { ...evidence, zip: basename(out), zipBytes: zip.length, zipSha256: digest(zip) };
  writeFileSync(`${out}.json`, JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}
