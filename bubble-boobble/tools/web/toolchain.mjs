#!/usr/bin/env node
// Web builds need the pinned engine sources, Rust and activated Emscripten locally.
// Keep machine paths in ignored .gameengine/web-toolchain.json, never package.json.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { extendWebShell } from './extend-shell.mjs';
import { webContentTypes } from './content-types.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const action = process.argv[2];
function requireFile(path, help) {
  if (!existsSync(path) || !statSync(path).isFile()) throw new Error(`Missing ${path}. ${help}`);
  return path;
}
function localPath(value, fallback) {
  const path = value ?? fallback;
  if (typeof path !== 'string' || !path) throw new Error('Web toolchain paths must be non-empty strings.');
  return isAbsolute(path) ? path : resolve(project, path);
}
function toolchain() {
  const configPath = join(project, '.gameengine/web-toolchain.json');
  requireFile(configPath, 'Create this ignored local JSON file with engineRoot (full source checkout matching the installed SDK), cargoHome, rustupHome, emsdkRoot, and rustToolchain. Paths may be relative to the project. Install Emscripten 6.0.10 and Rust 1.94.1 with wasm32-unknown-emscripten; build tools/wasm/build.mjs --host in that checkout.');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const engineRoot = realpathSync(localPath(config.engineRoot));
  const sdk = realpathSync(join(project, '.gameengine/engine'));
  const cargoHome = localPath(config.cargoHome, '.gameengine/toolchains/cargo');
  const rustupHome = localPath(config.rustupHome, '.gameengine/toolchains/rustup');
  const emsdk = localPath(config.emsdkRoot, '.gameengine/toolchains/emsdk');
  const em = join(emsdk, 'upstream/emscripten');
  const target = localPath(config.targetDir, join(engineRoot, 'target'));
  const host = join(target, 'wasm32-unknown-emscripten/debug/gameengine-host.js');
  const nativeHost = requireFile(join(sdk, 'target/release/gameengine-host'), 'Run npm run setup with the installed engine.');
  const cook = requireFile(join(sdk, 'target/release/gameengine-cook'), 'Install the engine SDK cooker.');
  requireFile(join(engineRoot, 'Cargo.toml'), 'engineRoot must point to full pinned engine sources, not the desktop SDK.');
  requireFile(join(engineRoot, 'platform/web/player.ts'), 'Use a full source checkout matching the installed SDK.');
  const sdkVersion = JSON.parse(readFileSync(requireFile(join(sdk, 'engine-version.json'), 'Install a versioned engine SDK.'), 'utf8')).version;
  const sourceTag = spawnSync('git', ['-C', engineRoot, 'describe', '--tags', '--exact-match', 'HEAD'], { encoding: 'utf8' });
  if (sourceTag.status !== 0 || sourceTag.stdout.trim() !== `v${sdkVersion}`) throw new Error(`engineRoot must be checked out at v${sdkVersion}, matching the installed SDK; rebuild the wasm host/player after changing versions.`);
  // Export with the matching source CLI so source-only web dependencies resolve
  // there, rather than in the installed editor's reduced SDK dependency set.
  const cli = requireFile(join(action === 'export' ? engineRoot : sdk, 'tools/cli/bin/gameengine.mjs'), 'Install the matching engine CLI and its dependencies.');
  requireFile(host, 'Build the real wasm host: node tools/wasm/build.mjs --host in engineRoot with the scoped Rust/Emscripten environment.');
  requireFile(join(dirname(host), 'gameengine_host.wasm'), 'Rebuild the wasm test host; its .js loader alone is insufficient.');
  requireFile(join(cargoHome, 'bin/cargo'), 'Install Rust into the configured scoped cargoHome/rustupHome.');
  for (const name of ['emcc', 'em++', 'emar']) requireFile(join(em, name), 'Install and activate Emscripten 6.0.10 in emsdkRoot.');
  const emConfig = requireFile(join(emsdk, '.emscripten'), 'Activate the installed SDK: emsdk activate 6.0.10.');
  // The activated SDK records its bundled Python; do not depend on macOS Python 3.9.
  const pythonSetting = /^PYTHON\s*=\s*['"]([^'"]+)['"]/m.exec(readFileSync(emConfig, 'utf8'))?.[1];
  const python = config.python ? localPath(config.python) : pythonSetting?.replaceAll('$CFGDIR', emsdk);
  if (!python) throw new Error('The activated .emscripten file has no Python path; set python in the local toolchain JSON.');
  requireFile(python, 'Activate the bundled Emscripten Python, or set python to Python 3.10+ in the local config.');
  const env = {
    ...process.env,
    RUSTUP_HOME: rustupHome,
    CARGO_HOME: cargoHome,
    RUSTUP_TOOLCHAIN: config.rustToolchain ?? '1.94.1',
    CARGO_TARGET_DIR: target,
    EMSDK: emsdk,
    GAMEENGINE_EMSDK: emsdk,
    EM_CONFIG: emConfig,
    EMSDK_PYTHON: python,
    EMSDK_QUIET: '1',
    PATH: [join(cargoHome, 'bin'), emsdk, em, process.env.PATH].filter(Boolean).join(sep === '\\' ? ';' : ':'),
    CC_wasm32_unknown_emscripten: join(em, 'emcc'),
    CXX_wasm32_unknown_emscripten: join(em, 'em++'),
    AR_wasm32_unknown_emscripten: join(em, 'emar'),
    CARGO_TARGET_WASM32_UNKNOWN_EMSCRIPTEN_LINKER: join(em, 'emcc'),
    GAMEENGINE_HOST: nativeHost,
    GAMEENGINE_COOK: cook,
    GAMEENGINE_HOST_WEB: host,
  };
  return { engineRoot, sdk, cli, env };
}
async function run(argv, env, cli) {
  const child = spawn(process.execPath, [cli, ...argv], { cwd: project, env, stdio: 'inherit' });
  const forward = signal => child.kill(signal);
  const term = () => forward('SIGTERM');
  const interrupt = () => forward('SIGINT');
  process.on('SIGTERM', term);
  process.on('SIGINT', interrupt);
  await new Promise((done, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); done(); });
  });
  process.off('SIGTERM', term);
  process.off('SIGINT', interrupt);
}
function serve() {
  const site = join(project, 'build/web/site');
  requireFile(join(site, 'index.html'), 'Run npm run web:build to create the browser build first.');
  const port = Number(process.env.PORT ?? 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
  const server = createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const path = resolve(site, `.${pathname === '/' ? '/index.html' : pathname}`);
      const rel = relative(site, path);
      if (rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)) { response.writeHead(403).end(); return; }
      if (!existsSync(path) || !statSync(path).isFile()) { response.writeHead(404).end(); return; }
      response.writeHead(200, { 'Content-Type': webContentTypes[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(readFileSync(path));
    } catch { response.writeHead(400).end(); }
  });
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Bubble Madness: http://localhost:${port} (Ctrl+C stops the server)`));
}
try {
  if (action === 'serve') serve();
  else if (['parity', 'export', 'inspect'].includes(action)) {
    const { engineRoot, sdk, cli, env } = toolchain();
    // Simulation uses the installed SDK + native host and the genuine wasm lane. Export
    // uses the matching source tree for its browser shell/build, retaining SDK cook/native tools.
    env.GAMEENGINE_REPO = action === 'export' ? engineRoot : sdk;
    if (action === 'inspect') console.log(JSON.stringify({ engineRoot, sdk, cli, wasmHost: env.GAMEENGINE_HOST_WEB, rustToolchain: env.RUSTUP_TOOLCHAIN, emsdk: env.GAMEENGINE_EMSDK }, null, 2));
    else {
      await run(action === 'parity'
        ? ['test', '--tier', 't0', '--js', 'v8,web', '--jobs', '1', ...process.argv.slice(3)]
        : ['build', 'web', '--config', process.env.WEB_CONFIG ?? 'probe', '--out', 'build/web'], env, cli);
      if (action === 'export' && !process.exitCode) await extendWebShell({ project, engineRoot, sdk });
    }
  } else throw new Error('Usage: node tools/web/toolchain.mjs parity|export|inspect|serve');
} catch (error) { console.error(`Web toolchain: ${error.message}`); process.exitCode = 1; }
