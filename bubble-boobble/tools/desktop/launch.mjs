// macOS arm64 game launcher. All binary copies/signatures remain project-owned.
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync, chmodSync, renameSync, openSync, readSync, closeSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, createHash } from "node:crypto";
import { createServer } from "node:http";
import {guardRequest} from "./bridge-http.mjs";
import {buildYMHelper} from "./ym-source/build.mjs";
const project = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
process.chdir(project);
if (process.platform !== "darwin" || process.arch !== "arm64") throw new Error("This game-owned adapter currently supports macOS arm64 only");
const controlledPresentation=process.argv.includes("--transport-probe");
const appArguments=process.argv.slice(2).filter(arg=>arg!=="--transport-probe");
let diagnosticSeconds=60;
if(controlledPresentation){
 for(let i=0;i<appArguments.length;i++)if(appArguments[i]==="--run-sec"||appArguments[i].startsWith("--run-sec=")){
  const inline=appArguments[i].startsWith("--run-sec="),raw=inline?appArguments[i].slice(10):appArguments[i+1];
  const requested=Number(raw);if(!Number.isFinite(requested)||requested<=0)throw new Error("Transport probe --run-sec must be a positive finite duration");
  diagnosticSeconds=Math.min(diagnosticSeconds,requested);appArguments.splice(i,inline?1:2);i--;
 }
 appArguments.push("--run-sec",String(diagnosticSeconds));
}
const cache = resolve(".cache/desktop");
mkdirSync(cache, { recursive: true });
function run(binary, args2) {
  const r = spawnSync(binary, args2, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || String(r.error));
  return r.stdout;
}
const server = createServer(guardRequest(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  if (req.headers.origin) {
    res.writeHead(403);
    res.end('{"error":"browser origins are not permitted"}');
    return;
  }
  if (req.method === "GET" && req.url === "/health") {
    res.end(JSON.stringify({ bundleId: "bubbleboobble.desktop", protocol: 1, token, pid: gamePID, originalRuntimeSha256: original, launchId, controlledPresentation }));
    return;
  }
  if (req.headers.authorization !== `Bearer ${token}`) {
    res.writeHead(403);
    res.end('{"error":"authorization required"}');
    return;
  }
  if (req.method === "GET" && req.url === "/status") {
    res.end(existsSync(statusPath) ? readFileSync(statusPath) : '{"windowReady":false}');
    return;
  }
  if (req.method === "GET" && req.url === "/game") { res.end(JSON.stringify({observation,desired})); return; }
  if (req.method !== "POST" || !["/state", "/input"].includes(req.url)) {
    res.writeHead(404);
    res.end("{}");
    return;
  }
  let bytes = "";
  for await (const chunk of req) {
    bytes += chunk;
    if (bytes.length > 2048) {
      res.writeHead(413);
      res.end("{}");
      return;
    }
  }
  try {
    const value = JSON.parse(bytes), keys = Object.keys(value).sort();
    if (req.url === "/input") {
      if (JSON.stringify(keys) !== '["key"]' || !["confirm","up","down","left","right","pause","fullscreen","mute","background","foreground"].includes(value.key)) throw new Error("unsupported own-game key");
      inputSequence++; inputKeys = [value.key]; save();
      res.end(JSON.stringify({ok:true,inputSequence})); return;
    }
    const suppliedObservation = value.observation;
    if (suppliedObservation !== undefined) {
      if (JSON.stringify(Object.keys(suppliedObservation).sort()) !== '["gameActive","gamePaused","gameTick","screen","selected"]' || !Number.isSafeInteger(suppliedObservation.selected) || suppliedObservation.selected < 0 || typeof suppliedObservation.gameActive !== 'boolean' || typeof suppliedObservation.gamePaused !== 'boolean' || !Number.isSafeInteger(suppliedObservation.gameTick) || suppliedObservation.gameTick < 0 || !['title','menu','profiles','new-profile','settings','scores','help','credits','editor','play','pause','result'].includes(suppliedObservation.screen)) throw new Error('invalid game observation');
      delete value.observation;
    }
    const stateKeys = Object.keys(value).sort();
    if (JSON.stringify(stateKeys) !== JSON.stringify(["fullscreen", "muted", "paused", "track", "volume"]) || typeof value.fullscreen !== "boolean" || typeof value.muted !== "boolean" || typeof value.paused !== "boolean" || !["", "bubble-1", "bubble-2", "bubble-3", "bubble-4", "bubble-5"].includes(value.track) || typeof value.volume !== "number" || !Number.isFinite(value.volume) || value.volume < 0 || value.volume > 1) throw new Error("invalid platform state");
    const observed = existsSync(statusPath) ? JSON.parse(readFileSync(statusPath, "utf8")) : null;
    if (!observed?.windowReady || observed.pid !== gamePID) {
      res.writeHead(503);
      res.end('{"error":"game-owned native window not ready"}');
      return;
    }
    if (suppliedObservation !== undefined) observation = suppliedObservation;
    // Only the explicit native transport probe owns this controlled presentation
    // session. Normal game clients still connect and report observations, while
    // input-driven GUI validation uses the ordinary launcher without this flag.
    if(controlledPresentation&&req.headers['x-bubble-desktop-probe']!==launchId){
      res.end(JSON.stringify({ok:true,revision,controlledPresentation:true}));return;
    }
    desired = value;
    revision++;
    save();
    res.end(JSON.stringify({ ok: true, revision }));
  } catch (e) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: e.message }));
  }
}));
let child, gamePID=null;
await new Promise((resolve2, reject) => {
  server.once("error", reject);
  server.listen(47681, "127.0.0.1", resolve2);
});
const installed = resolve(".gameengine/engine/target/release");
const appPath=resolve(cache,"BubbleBoobble.app"), macOS=resolve(appPath,"Contents/MacOS"), frameworks=resolve(appPath,"Contents/Frameworks");
mkdirSync(macOS,{recursive:true});mkdirSync(frameworks,{recursive:true});
const source = resolve(installed, "gameengine-host"), copy = resolve(macOS, "BubbleBoobble-runtime");
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const original = digest(source);
copyFileSync(source, copy);
chmodSync(copy, 493);
copyFileSync(resolve(installed, "libgameengine_webgpu.dylib"), resolve(macOS, "libgameengine_webgpu.dylib"));
const entitlements = resolve(cache, "runtime.entitlements");
writeFileSync(entitlements, '<?xml version="1.0"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>com.apple.security.cs.allow-jit</key><true/><key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/><key>com.apple.security.cs.allow-dyld-environment-variables</key><true/><key>com.apple.security.cs.disable-library-validation</key><true/></dict></plist>');
run("codesign", ["--force", "--sign", "-", "--options", "0", "--entitlements", entitlements, copy]);
const helper=resolve(macOS,"BubbleBoobble-YM"),helperProvenance=buildYMHelper(helper);
run("codesign",["--force","--sign","-",helper]);
const resources=resolve(appPath,"Contents/Resources"),musicRoot=resolve(resources,"music");mkdirSync(musicRoot,{recursive:true});
const expectedMusic=JSON.parse(readFileSync("tools/desktop/ym-source/expected-pcm.json","utf8"));
for(const entry of expectedMusic.tracks){const file=resolve("assets/reference/audio",entry.track);if(digest(file)!==entry.sourceSha256)throw new Error(`Original YM source checksum mismatch: ${entry.track}`);copyFileSync(file,resolve(musicRoot,entry.track));}
copyFileSync("tools/desktop/ym-source/internal/ym/LICENSE",resolve(resources,"LICENSE-reference-reader.txt"));
writeFileSync(resolve(resources,"ym-provenance.json"),JSON.stringify(helperProvenance,null,2)+"\n");
const adapter = resolve(frameworks, "libbubbleboobble-platform.dylib");
run("clang", ["-dynamiclib", "-fobjc-arc", "-fblocks", "-framework", "Cocoa", "-framework", "AVFoundation", "tools/desktop/native-adapter.m", "tools/desktop/ym-source/native/BBYMTransport.m", "-o", adapter]);
run("codesign", ["--force", "--sign", "-", adapter]);
writeFileSync(resolve(appPath,"Contents/Info.plist"),'<?xml version="1.0"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>com.example.bubbleboobble.desktop</string><key>CFBundleExecutable</key><string>BubbleBoobble-runtime</string><key>CFBundleName</key><string>BubbleBoobble</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleVersion</key><string>1</string><key>CFBundleShortVersionString</key><string>0.1.0</string><key>LSMinimumSystemVersion</key><string>14.0</string><key>NSHighResolutionCapable</key><true/><key>NSPrincipalClass</key><string>NSApplication</string></dict></plist>');
run("codesign",["--force","--sign","-","--options","0","--entitlements",entitlements,appPath]);
if (digest(source) !== original) throw new Error("Installed runtime changed unexpectedly");
const bundle = JSON.parse(run("gameengine", ["bundle", "--json"])).path;
const session = resolve(cache, `session-${process.pid}`);
mkdirSync(session, { recursive: true, mode:0o700 });
const statePath = resolve(session, "state.json"), statusPath = resolve(session, "status.json");
const token = randomBytes(32).toString("hex"), launchId=randomBytes(32).toString("hex");
let inputSequence = 0, inputKeys = [], observation = null;
let revision = 0, desired = { fullscreen: false, track: "", volume: 0.5, paused: false, muted: false };
function save() {
  writeFileSync(statePath + ".tmp", JSON.stringify({ revision, desired, inputSequence, inputKeys, observation, controlledPresentation, launcherPID:process.pid, updatedAtUnixMs: Date.now() }));
  renameSync(statePath + ".tmp", statePath);
}
save();
const launchBundle=resolve(session,"game.js");
const marker=`if(!Object.prototype.hasOwnProperty.call(globalThis,"__bubbleDesktopLaunch"))Object.defineProperty(globalThis,"__bubbleDesktopLaunch",{value:Object.freeze({launchId:${JSON.stringify(launchId)}}),writable:false,configurable:false});\n`;
writeFileSync(launchBundle,marker+readFileSync(bundle,"utf8"));
const args = ["--mode", "player", "--project", project, "--bundle", launchBundle, "--js", "v8", "--services", "native", ...appArguments];
// LaunchServices starts an actual foreground application. Directly spawning a
// windowed command-line process does not reliably receive macOS activation.
const stdoutPath=resolve(session,"stdout.log"),stderrPath=resolve(session,"stderr.log");
writeFileSync(stdoutPath,"");writeFileSync(stderrPath,"");
const environment={DYLD_INSERT_LIBRARIES:adapter,BUBBLEBOOBLE_PLATFORM_STATE:statePath,BUBBLEBOOBLE_PLATFORM_STATUS:statusPath,BUBBLEBOOBLE_AUDIO_ROOT:musicRoot,BUBBLEBOOBLE_YM_HELPER:helper,BUBBLEBOOBLE_LAUNCH_ID:launchId};
const openArgs=["-n","-W","--stdout",stdoutPath,"--stderr",stderrPath,...Object.entries(environment).flatMap(([key,value])=>["--env",`${key}=${value}`]),appPath,"--args",...args];
child=spawn("/usr/bin/open",openArgs,{stdio:["ignore","inherit","inherit"]});
let closing=false,ready=false,offsets=[0,0],lastLiveness=Date.now();
function pump(){
 if(!closing&&Date.now()-lastLiveness>=1000){save();lastLiveness=Date.now();}
 for(const [i,path]of[stdoutPath,stderrPath].entries()){
  const length=statSync(path).size-offsets[i];
  if(length>0){const bytes=Buffer.alloc(length),fd=openSync(path,"r");try{readSync(fd,bytes,0,length,offsets[i]);}finally{closeSync(fd);}offsets[i]+=length;(i===0?process.stdout:process.stderr).write(bytes);}
 }
 if(existsSync(statusPath)){
  try{const observed=JSON.parse(readFileSync(statusPath,"utf8"));
   if(observed.launchId===launchId&&observed.executablePath===copy&&Number.isSafeInteger(observed.pid)&&observed.pid>0){
    gamePID=observed.pid;ready=!!observed.windowReady;
    if(closing)try{process.kill(gamePID,"SIGTERM");}catch{}
   }
  }catch{}
 }
}
const pumpTimer=setInterval(pump,50);
const diagnosticTimer=controlledPresentation?setTimeout(()=>{closing=true;try{if(gamePID)process.kill(gamePID,"SIGTERM");}catch{}},diagnosticSeconds*1000):undefined;
const startupTimer=setTimeout(()=>{if(!ready){console.error("Game application did not report its own native window within 20 seconds");closing=true;try{if(gamePID)process.kill(gamePID,"SIGTERM");}catch{}child.kill("SIGTERM");process.exitCode=1;}},20000);
console.log(`BubbleBoobble game-owned macOS application: ${appPath}; bridge http://127.0.0.1:47681; installed runtime unchanged (${original.slice(0,12)}).`);
for(const signal of["SIGINT","SIGTERM"])process.on(signal,()=>{closing=true;try{if(gamePID)process.kill(gamePID,signal);}catch{}/* Before the first identity, keep pumping until it arrives and close only our verified host. */});
function finish(code){pump();clearInterval(pumpTimer);clearTimeout(startupTimer);if(diagnosticTimer)clearTimeout(diagnosticTimer);server.close();if(digest(source)!==original){console.error("Installed runtime changed unexpectedly");process.exitCode=1;}else if(!process.exitCode)process.exitCode=code??0;}
child.on("error",error=>{console.error(error);finish(1);});
child.on("exit",code=>finish(ready?code:1));
