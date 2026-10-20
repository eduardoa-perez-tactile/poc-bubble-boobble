import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zstdCompressSync } from 'node:zlib';
import { arcadeBuildEnvironment, checkElf, command, digest, engineIdentity, files, packageExports, readPak, stampName, verifyExports, withBrowserReleaseFlags, webEngineRoot } from './release.mjs';
import { decodeRpc, publish, rpc, validSlug } from './client.mjs';
function pak(entries) {
  let size = 0;
  const data = Buffer.concat(Object.values(entries).map(v => Buffer.from(v)));
  const table = Object.entries(entries).map(([key, value]) => { const e = { key, offset: size, size: Buffer.byteLength(value), kind: 'script' }; size += e.size; return e; });
  const blocks = [], chunks = []; let offset = 32;
  for (let at = 0; at < data.length; at += 65536) {
    const raw = data.subarray(at, at + 65536), packed = zstdCompressSync(raw);
    blocks.push({ file_offset: offset, compressed: packed.length, raw: raw.length }); chunks.push(packed); offset += packed.length;
  }
  const index = zstdCompressSync(Buffer.from(JSON.stringify({ entries: table, blocks })));
  const header = Buffer.alloc(32); header.write('GPAK'); header.writeUInt32LE(1, 4); header.writeBigUInt64LE(BigInt(offset), 8); header.writeBigUInt64LE(BigInt(index.length), 16);
  return Buffer.concat([header, ...chunks, index]);
}
function elf() { const bytes = Buffer.alloc(64); bytes.set([127, 69, 76, 70, 2, 1]); bytes.writeUInt16LE(62, 18); return bytes; }
function put(root, path, data) { const out = join(root, path); mkdirSync(join(out, '..'), { recursive: true }); writeFileSync(out, data); }
function stamp(root, target) {
  writeFileSync(join(root, stampName), JSON.stringify({ version: 1, revision: 'a'.repeat(40), sourceSha256: 'b'.repeat(64), engineVersion: '0.1.15', engineRevision: 'c'.repeat(40), target, config: 'release', dirty: false, files: files(root).filter(f => f.path !== stampName) }));
}
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'bubble-arcade-test-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const web = join(root, 'web'), server = join(root, 'server'); mkdirSync(web); mkdirSync(server);
  const project = JSON.stringify({ name: 'Bubble', version: '1', multiplayer: { authority: 'server', players: 10 } });
  const code = pak({ 'gameengine/bundle.js': 'export default "same simulation";', 'gameengine/input.json': '{}', 'gameengine/project.gameengine.json': project });
  for (const game of [join(web, 'site/game'), join(server, 'game')]) {
    put(game, 'code.gpak', code); put(game, 'manifest.json', JSON.stringify({ entries: [{ bundle: 'code' }] }));
  }
  put(web, 'build-report.json', JSON.stringify({ ok: true, config: 'release', dryRun: false }));
  for (const file of ['index.html', 'player.js', 'gameengine-web-player.js', 'gameengine_web_player.wasm', 'splash/splash.css']) put(web, `site/${file}`, 'fixture');
  put(web, 'site/playtest-build.json', JSON.stringify({ sha: 'a'.repeat(40), dirty: false, shell: 'bubble-web-v2' }));
  put(server, 'gameengine-server', elf()); chmodSync(join(server, 'gameengine-server'), 0o755);
  put(server, 'libgameengine_webgpu.so', elf());
  put(server, 'server.json', JSON.stringify({ target: 'linux-x64', authority: 'server', port: 8787, mode: 'realtime' }));
  stamp(web, 'web'); stamp(server, 'linux-x64');
  return { root, web, server };
}
test('reads real GPAK block layout including cross-block entries', t => {
  const { root } = fixture(t), value = 'x'.repeat(140000), path = join(root, 'test.gpak');
  writeFileSync(path, pak({ first: 'offset', second: value })); assert.equal(readPak(path)('second').toString(), value);
});
test('rejects Mac executable and requires executable server bit', t => {
  const { server } = fixture(t), path = join(server, 'gameengine-server');
  writeFileSync(path, Buffer.from('Mach-O')); assert.throws(() => checkElf(path), /ELF64/);
  writeFileSync(path, elf()); chmodSync(path, 0o644); assert.throws(() => checkElf(path), /permissions/);
});
test('verifies matched artifacts and rejects modification after stamp', t => {
  const options = fixture(t); assert.equal(verifyExports(options).ok, true);
  put(options.web, 'site/player.js', 'changed'); assert.throws(() => verifyExports(options), /changed after/);
});
test('rejects dirty, wrong engine and differing cooked simulation', t => {
  const o = fixture(t), p = join(o.server, stampName), original = JSON.parse(readFileSync(p));
  writeFileSync(p, JSON.stringify({ ...original, dirty: true })); assert.throws(() => verifyExports(o), /clean source/);
  writeFileSync(p, JSON.stringify({ ...original, engineVersion: '0.1.14' })); assert.throws(() => verifyExports(o), /engineVersion mismatch/);
  put(o.server, 'game/code.gpak', pak({ 'gameengine/bundle.js': 'different', 'gameengine/input.json': '{}', 'gameengine/project.gameengine.json': JSON.stringify({ name: 'Bubble', version: '1', multiplayer: { authority: 'server', players: 10 } }) }));
  stamp(o.server, 'linux-x64'); assert.throws(() => verifyExports(o), /Cooked scripts differ/);
});
test('rejects symlinks and caches in exports', t => {
  const { root } = fixture(t), dir = join(root, 'unsafe'); mkdirSync(dir);
  symlinkSync('/tmp', join(dir, 'external')); assert.throws(() => files(dir), /Symlink/);
  rmSync(join(dir, 'external')); mkdirSync(join(dir, '.cache')); assert.throws(() => files(dir), /private\/cache/);
});
test('packages complete exports under exact arcade layout and records checksum', t => {
  const o = fixture(t), out = join(o.root, 'release.zip'), receipt = packageExports({ ...o, out });
  assert.equal(receipt.zipSha256, digest(readFileSync(out)));
  assert.equal(JSON.parse(readFileSync(join(o.root, 'release.contents/arcade.json'))).server.entry, 'server/gameengine-server');
  assert.throws(() => packageExports({ ...o, out }), /already exists/);
});
test('validates managed slug and refuses tool and JSON-RPC errors', () => {
  assert.equal(validSlug('bubble-madness-mp'), 'bubble-madness-mp');
  for (const value of ['../bad', 'Bad', 'x'.repeat(49)]) assert.throws(() => validSlug(value));
  assert.throws(() => decodeRpc({ error: { message: 'bad' } }), /JSON-RPC/);
  assert.throws(() => decodeRpc({ result: { isError: true, content: [] } }), /tool failed/);
  assert.deepEqual(decodeRpc({ result: { content: [{ type: 'text', text: '[]' }] } }), []);
});
test('read-only HTTP calls use guide JSON-RPC contract', async () => {
  let sent; const result = await rpc('list_games', {}, async (url, options) => { sent = { url, ...options }; return { ok: true, json: async () => ({ result: { content: [{ type: 'text', text: '[]' }] } }) }; });
  assert.deepEqual(result, []); assert.equal(JSON.parse(sent.body).params.name, 'list_games'); assert.equal(sent.method, 'POST');
});

test('server cook uses browser release flags and restores original after failure', t => {
  const { root } = fixture(t), original = 'export const DEVELOPMENT_BUILD = false;\nexport const WEB_BUILD = false;\n';
  put(root, 'src/desktop/build-flags.ts', original);
  assert.throws(() => withBrowserReleaseFlags(root, () => {
    assert.match(readFileSync(join(root, 'src/desktop/build-flags.ts'), 'utf8'), /WEB_BUILD = true/);
    throw new Error('build failed');
  }), /build failed/);
  assert.equal(readFileSync(join(root, 'src/desktop/build-flags.ts'), 'utf8'), original);
});

test('official runtime provenance checks version and binary integrity without running ELF', async t => {
  const { root } = fixture(t), runtime = join(root, 'official'); mkdirSync(runtime);
  const { checkRuntime } = await import('./prebuilt-server.mjs');
  const pin = { version: '0.1.15', sha256: 'd'.repeat(64) };
  put(runtime, 'gameengine-runtime.json', JSON.stringify({ version: pin.version, platform: 'linux', arch: 'x64' }));
  for (const name of ['gameengine-host', 'libgameengine_webgpu.so']) { put(runtime, `target/player/release/${name}`, elf()); chmodSync(join(runtime, `target/player/release/${name}`), 0o755); }
  const host = 'target/player/release/gameengine-host', gpu = 'target/player/release/libgameengine_webgpu.so', cooker = 'target/release/gameengine-cook';
  put(runtime, cooker, elf());
  put(runtime, 'arcade-runtime-download.json', JSON.stringify({ version: pin.version, sha256: pin.sha256, binaries: { [host]: digest(readFileSync(join(runtime, host))), [gpu]: digest(readFileSync(join(runtime, gpu))), [cooker]: digest(readFileSync(join(runtime, cooker))) } }));
  assert.equal(checkRuntime(runtime, pin).version, pin.version);
  put(runtime, host, 'changed'); assert.throws(() => checkRuntime(runtime, pin), /binary changed/);
});

test('web build rejects stamp engine different from the configured exporter checkout', t => {
  const { root } = fixture(t), a = join(root, 'engine-a'), b = join(root, 'engine-b'); mkdirSync(a); mkdirSync(b);
  put(root, '.gameengine/web-toolchain.json', JSON.stringify({ engineRoot: 'engine-b' }));
  assert.throws(() => webEngineRoot(root, a), /differs from.*toolchain/);
  const alias = join(root, 'same-engine'); symlinkSync(b, alias);
  assert.equal(webEngineRoot(root, alias), realpathSync(b));
});
test('runtime receipt rejects omitted checksum maps, incomplete hashes and unexpected paths', async t => {
  const { root } = fixture(t), runtime = join(root, 'bad-runtime'); mkdirSync(runtime);
  const { checkRuntime, runtimeBinaries } = await import('./prebuilt-server.mjs');
  const pin = { version: '0.1.15', sha256: 'd'.repeat(64) };
  put(runtime, 'gameengine-runtime.json', JSON.stringify({ version: pin.version, platform: 'linux', arch: 'x64' }));
  const full = Object.fromEntries(runtimeBinaries.map(key => [key, 'a'.repeat(64)]));
  for (const binaries of [undefined, {}, [], { ...full, '../escape': 'a'.repeat(64) }, { ...full, [runtimeBinaries[0]]: 'bad' }, { [runtimeBinaries[0]]: 'a'.repeat(64) }]) {
    put(runtime, 'arcade-runtime-download.json', JSON.stringify({ ...pin, binaries }));
    assert.throws(() => checkRuntime(runtime, pin), /requires exactly/);
  }
});
test('publication uses the exact guide engine prepare_publish arguments', async t => {
  const { root } = fixture(t), zip = join(root, 'publish.zip'), bytes = Buffer.from('intercepted upload fixture');
  put(root, 'publish.zip', bytes); put(root, 'publish.zip.json', JSON.stringify({ ok: true, zipSha256: digest(bytes) }));
  const calls = [];
  const fetcher = async (url, options) => {
    if (options.method === 'PUT') { assert.deepEqual(Buffer.from(options.body), bytes); return { status: 202, text: async () => 'queued' }; }
    const body = JSON.parse(options.body); calls.push(body.params);
    const result = body.params.name === 'list_games' ? [] : { uploadUrl: 'https://webgames.tactilews.com/test-upload', headers: { 'Content-Type': 'application/zip', 'x-game-upload': '1' } };
    return { ok: true, json: async () => ({ result: { content: [{ type: 'text', text: JSON.stringify(result) }] } }) };
  };
  const result = await publish({ slug: 'bubble-test', zip, fetcher });
  assert.deepEqual(calls[1], { name: 'prepare_publish', arguments: { slug: 'bubble-test', multiplayer: true } });
  assert.equal(result.state, 'queued');
});

test('engine source release tag controls identity when staged version metadata lags', t => {
  const { root } = fixture(t), engine = join(root, 'tagged-source'); mkdirSync(engine);
  const git = args => command('git', ['-C', engine, ...args]);
  git(['init', '--quiet', '--initial-branch=main']);
  put(engine, 'engine-version.json', JSON.stringify({ version: '0.1.9' }));
  git(['add', 'engine-version.json']);
  git(['-c', 'user.name=Release test', '-c', 'user.email=release-test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'source release fixture']);
  git(['tag', 'v0.1.15']);
  const identity = engineIdentity(engine);
  assert.equal(identity.engineVersion, '0.1.15');
  assert.equal(identity.engineSourceMetadataVersion, '0.1.9');
  assert.equal(identity.engineRevision, git(['rev-parse', 'HEAD']));
  put(engine, 'engine-version.json', JSON.stringify({ version: '0.1.15' }));
  assert.throws(() => engineIdentity(engine), /tracked modifications/);
});

test('all arcade builds force identical stock TypeScript flags over inherited and caller settings', () => {
  const inherited = { GAMEENGINE_NATIVE_SYSTEMS: 'on', GAMEENGINE_TRANSPILE: '1', KEEP_SETTING: 'preserved' };
  const web = arcadeBuildEnvironment({ WEB_CONFIG: 'release', GAMEENGINE_TRANSPILE: 'on' }, inherited);
  const server = arcadeBuildEnvironment({ GAMEENGINE_REPO: '/pinned/runtime', GAMEENGINE_NATIVE_SYSTEMS: 'on' }, inherited);
  for (const env of [web, server]) {
    assert.equal(env.GAMEENGINE_NATIVE_SYSTEMS, 'off');
    assert.equal(env.GAMEENGINE_TRANSPILE, 'off');
    assert.equal(env.KEEP_SETTING, 'preserved');
  }
  assert.equal(web.WEB_CONFIG, 'release');
  assert.equal(server.GAMEENGINE_REPO, '/pinned/runtime');
  assert.equal(inherited.GAMEENGINE_NATIVE_SYSTEMS, 'on');
  assert.equal(inherited.GAMEENGINE_TRANSPILE, '1');
});

test('world server metadata and cooked release verification require the real world contract', async t => {
  const o=fixture(t);
  const {serverConfiguration}=await import('./prebuilt-server.mjs');
  const project={name:'Bubble',version:'1',multiplayer:{authority:'server',mode:'realtime',world:{inputEvent:'OnlineWorldInput',document:'online.world.public',sendEvery:3}}};
  const server=serverConfiguration(project);
  assert.equal(server.world,true);assert.equal(server.players,null);assert.equal(server.port,8787);
  assert.equal(serverConfiguration({name:'Bubble',multiplayer:{authority:'server',players:10}}).players,10);
  for(const root of [join(o.web,'site/game'),join(o.server,'game')])put(root,'code.gpak',pak({'gameengine/bundle.js':'world script','gameengine/input.json':'{}','gameengine/project.gameengine.json':JSON.stringify(project)}));
  put(o.server,'server.json',JSON.stringify(server));stamp(o.web,'web');stamp(o.server,'linux-x64');
  assert.equal(verifyExports(o).world,true);
  put(o.server,'server.json',JSON.stringify({...server,players:10}));stamp(o.server,'linux-x64');assert.throws(()=>verifyExports(o),/world=true and players=null/);
});
test('production ready evidence distinguishes persistent world from fixed match mode', async()=>{
  const {validateServerReady}=await import('./smoke-server.mjs');
  assert.doesNotThrow(()=>validateServerReady({world:true},{ok:true,authority:'server',world:true,listening:'ws://127.0.0.1:8787'}));
  assert.throws(()=>validateServerReady({world:true},{ok:true,authority:'server',listening:'ws://127.0.0.1:8787'}),/world\/match mode/);
});
