// Exercise source/editor and immutable launch-bundle bridge roots in separate,
// UI-pumped no-GPU hosts while the actual app's native endpoint is available.
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {setTimeout as delay} from 'node:timers/promises';
import {build} from '../../.gameengine/engine/node_modules/esbuild/lib/main.js';
export async function probeBridge(launchBundle,launchId){
 await build({entryPoints:['.gameengine/engine/packages/protocol-client/src/index.ts'],outfile:'.cache/desktop/bridge-protocol.cjs',bundle:true,platform:'node',format:'cjs',target:'es2022'});
 const {GameEngineClient}=createRequire(import.meta.url)(resolve('.cache/desktop/bridge-protocol.cjs'));
 const result={scope:'UI-pumped no-GPU execution of ordinary source and the exact copied app bundle'};
 for(const [name,bundle] of [['ordinary',resolve('.gameengine/bundle.js')],['launched',launchBundle]]){
  let address,log='',client;
  const host=spawn(resolve('.gameengine/engine/target/release/gameengine-host'),['--mode','headless','--project',process.cwd(),'--bundle',bundle,'--serve','127.0.0.1:0','--paused','--no-gpu','--ui-layout'],{stdio:['ignore','pipe','pipe']});
  host.stdout.on('data',d=>{log+=d;for(const line of log.split('\n'))try{const value=JSON.parse(line);if(value.ws&&value.token)address=value;}catch{}});host.stderr.on('data',d=>log+=d);
  try{
   for(let i=0;i<200&&!address;i++)await delay(25);if(!address)throw new Error(`Bridge probe host failed: ${log}`);
   client=await GameEngineClient.connect(address,{client:'desktop-bridge-scope-proof'});
   let audio;
   for(let i=0;i<80;i++){
    await client.api.engine.step({n:1,frames:true});await delay(25);
    audio=(await client.api.world.resources({})).resources.ArcadeAudio;
    if(name==='launched'&&audio?.native)break;
   }
   const marker=(await client.api.script.eval({code:'(()=>{const d=Object.getOwnPropertyDescriptor(globalThis,"__bubbleDesktopLaunch");return d?{launchId:d.value.launchId,writable:d.writable,configurable:d.configurable,frozen:Object.isFrozen(d.value)}:null})()'})).value;
   result[name]={marker,native:!!audio?.native};
   if(name==='ordinary'&&(marker!==null||audio?.native))throw new Error('Ordinary source/editor connected to native app');
   if(name==='launched'&&(!audio?.native||marker?.launchId!==launchId||marker.writable||marker.configurable||!marker.frozen))throw new Error('Copied launch bundle did not connect with immutable matching identity');
  }finally{client?.close();host.kill('SIGTERM');}
 }
 result.pass=true;return result;
}
