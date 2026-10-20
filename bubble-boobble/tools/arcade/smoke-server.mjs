#!/usr/bin/env node
// Target-environment startup and WebSocket-upgrade evidence. This does not drive a player,
// run a browser, or prove authoritative gameplay/reconnect.
import { spawn } from 'node:child_process';
import { request } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkElf, command, json } from './release.mjs';

export async function smokeServer(server) {
  if (process.platform !== 'linux' || process.arch !== 'x64') throw new Error('Run production server startup verification on Linux x64.');
  const binary = join(server, 'gameengine-server'), config = json(join(server, 'server.json'));
  if (config.authority !== 'server' || config.target !== 'linux-x64') throw new Error('Expected authoritative Linux x64 export.');
  checkElf(binary);
  const dependencies = command('ldd', [binary]);
  const gpuDependencies = command('ldd', [join(server, 'libgameengine_webgpu.so')]);
  if (/not found/.test(dependencies + gpuDependencies)) throw new Error('The production export has unresolved shared libraries.');
  const child = spawn(binary, ['--mode=server', '--project', join(server, 'game'), '--cooked', join(server, 'game'), '--authority', 'server', '--listen', '127.0.0.1:0'], { cwd: server, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '', stdout = '';
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-64000); });
  try {
    const ready = await new Promise((accept, reject) => {
      const timer = setTimeout(() => reject(new Error(`Server startup timed out: ${stderr}`)), 30000);
      const done = (error, value) => { clearTimeout(timer); error ? reject(error) : accept(value); };
      child.once('error', error => done(error));
      child.once('exit', code => done(new Error(`Server exited before ready (${code}): ${stderr}`)));
      child.stdout.on('data', chunk => {
        stdout = (stdout + chunk).slice(-64000);
        for (const line of stdout.split('\n')) try { const value = JSON.parse(line); if (value.ok && value.listening && value.authority === 'server') done(null, value); } catch { /* Engine logs can precede its ready record. */ }
      });
    });
    const endpoint = new URL(ready.listening);
    if (endpoint.protocol !== 'ws:' || endpoint.hostname !== '127.0.0.1') throw new Error('Unexpected production server listen address.');
    const key = randomBytes(16).toString('base64');
    const expected = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    await new Promise((accept, reject) => {
      const req = request({ hostname: endpoint.hostname, port: endpoint.port, path: '/', headers: { Upgrade: 'websocket', Connection: 'Upgrade', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': key } });
      req.setTimeout(10000, () => req.destroy(new Error('WebSocket upgrade timed out.')));
      req.on('error', reject);
      req.on('response', response => { response.resume(); reject(new Error(`Expected HTTP 101, got ${response.statusCode}`)); });
      req.on('upgrade', (response, socket) => {
        socket.destroy();
        if (response.statusCode !== 101 || response.headers['sec-websocket-accept'] !== expected) reject(new Error('Invalid WebSocket upgrade response.'));
        else accept();
      });
      req.end();
    });
    return { ok: true, scope: 'Actual Linux production host startup + authoritative cooked game load + RFC6455 WebSocket upgrade', game: ready.game, rate: ready.rate, authority: ready.authority, dependencies, gpuDependencies, stderr, gameplayVerified: false, browserVerified: false, reconnectVerified: false };
  } finally {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await new Promise(done => { const timer = setTimeout(() => { child.kill('SIGKILL'); done(); }, 3000); child.once('exit', () => { clearTimeout(timer); done(); }); });
    }
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] !== '--server' || !process.argv[3]) throw new Error('Usage: smoke-server.mjs --server EXPORT');
    console.log(JSON.stringify(await smokeServer(resolve(process.argv[3])), null, 2));
  } catch (error) { console.error(`Office Arcade production smoke: ${error.message}`); process.exitCode = 1; }
}
