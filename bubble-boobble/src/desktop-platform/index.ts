// Presentation-only optional bridge to this game's macOS launcher. Ordinary engine
// runs retain the standard platform/audio path when no authenticated bridge exists.
import {read,net,Time} from '@gameengine/runtime';
import {defineUI,createEffect,useDoc,useResource,emit,onCleanup} from '@gameengine/ui';
import {ArcadeAudio,ArcadeControl,DesktopIntent} from '../schema.gen';
import {desktopSaveState} from '../desktop/save';
import {session} from '../arcade/session';
import {desktopState} from '../desktop/state';
import {NativeAudioReadiness} from './readiness';
import type {NativeAudioStatus} from './readiness';
export interface DesktopLaunchIdentity {readonly launchId:string}
export function desktopLaunchIdentity():DesktopLaunchIdentity|undefined {
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'__bubbleDesktopLaunch');
 const value=descriptor?.value as DesktopLaunchIdentity|undefined;
 return descriptor&&!descriptor.writable&&!descriptor.configurable&&value&&Object.isFrozen(value)&&/^[0-9a-f]{64}$/.test(value.launchId)?value:undefined;
}
export interface DesktopPlatformStatus {available:boolean;error:string}
/** Decide from the current state when a native response arrives, not its request snapshot. */
export function shouldPauseAfterFocusLoss(wasFocused:boolean|undefined,focused:boolean,current:{screen:string;active:boolean;paused:boolean;enabled:boolean}):boolean {
 return wasFocused===true&&!focused&&current.enabled&&current.screen==='play'&&current.active&&!current.paused;
}
export function nativeMusicPaused(screen:string,active:boolean,paused:boolean):boolean {
 return active&&(screen==='play'||screen==='pause')&&paused;
}
const endpoint='http://127.0.0.1:47681';
const status:DesktopPlatformStatus={available:false,error:''};
export const desktopPlatformStatus=():Readonly<DesktopPlatformStatus>=>status;
export const desktopPlatformAvailable=():boolean=>status.available;
const music:Record<string,string>={theme:'bubble-1',menu:'bubble-2',opening:'bubble-2',hurry:'bubble-3',gameover:'bubble-4',win:'bubble-5'};
const bridge=defineUI({name:'DesktopPlatformBridge',root(){
 const launch=desktopLaunchIdentity();if(!launch)return null;
 const clock=useResource(Time),control=useResource(ArcadeControl),audio=useResource(ArcadeAudio);
 const save=useDoc(desktopSaveState),game=useDoc(session),ui=useDoc(desktopState);
 let token='',sent='',observed='',busy=false,nextRetry=0,alive=true,generation=0;
 let pollBusy=false,nextPoll=0,wasFocused:boolean|undefined;
 const readiness=new NativeAudioReadiness();
 function availability(value:boolean,error=''){
  if(!alive)return;
  if(audio()?.native!==value)emit(DesktopIntent,{action:'native-audio',value:value?'1':'0'});
  status.available=value;status.error=error;
 }
 function disconnect(error:unknown){
  generation++;token='';sent='';readiness.reset();wasFocused=undefined;availability(false,String(error));
 }
 onCleanup(()=>{alive=false;generation++;status.available=false;});
 createEffect(()=>{
  const t=clock(),c=control(),a=audio(),s=save(),g=game();
  if(!t||!c?.active||!a||!alive)return;
  const elapsed=t.elapsed;
  const u=ui();
  const desired=JSON.stringify({fullscreen:s.settings.fullscreen,track:music[a.track]??'bubble-2',volume:s.settings.music/100,paused:nativeMusicPaused(u.screen,g.active,!!g.game?.Paused),muted:a.muted});
  const observationKey=`${u.screen}/${u.selected}/${g.active}/${g.game?.Paused??false}`;
  if(busy||(desired===sent&&observationKey===observed&&elapsed<nextRetry)||(!token&&elapsed<nextRetry))return;
  busy=true;nextRetry=elapsed+2;
  const requestGeneration=generation;
  void(async()=>{
   try{
    if(!token){
     const response=await net.fetch(endpoint+'/health',{timeoutMs:300});
     const health=response.json<{bundleId?:string;protocol?:number;token?:string;launchId?:string}>();
     if(!response.ok||health.bundleId!=='bubbleboobble.desktop'||health.protocol!==1||health.launchId!==launch.launchId||typeof health.token!=='string'||!/^[0-9a-f]{64}$/.test(health.token))throw new Error('macOS game launcher unavailable');
     if(!alive||generation!==requestGeneration)return;
     token=health.token;
    }
    const response=await net.fetch(endpoint+'/state',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({...JSON.parse(desired),observation:{screen:u.screen,selected:u.selected,gameActive:g.active,gamePaused:!!g.game?.Paused,gameTick:g.game?.Tick??0}}),timeoutMs:500});
    const applied=response.json<{ok?:boolean;revision?:number}>();
    if(!alive||generation!==requestGeneration)return;
    if(!response.ok||applied.ok!==true)throw new Error(`Desktop adapter HTTP ${response.status}`);
    readiness.acknowledge(applied.revision);
    sent=desired;observed=observationKey;
   }catch(error){if(alive&&generation===requestGeneration)disconnect(error);}
   finally{busy=false;}
  })();
 });
 createEffect(()=>{
  const t=clock();
  if(!t)return;
  // Subscribe to elapsed before testing non-reactive connection state. Otherwise
  // the initial empty token leaves this effect without a clock dependency.
  const elapsed=t.elapsed;
  if(!token||pollBusy||elapsed<nextPoll)return;
  nextPoll=elapsed+0.05;pollBusy=true;
  const requestToken=token,requestGeneration=generation;
  void(async()=>{try{
   const response=await net.fetch(endpoint+'/status',{headers:{authorization:`Bearer ${requestToken}`},timeoutMs:300});
   const native=response.json<NativeAudioStatus&{focused?:boolean;launchId?:string}>();
   if(!alive||generation!==requestGeneration)return;
   if(!response.ok||native.launchId!==launch.launchId)throw new Error('Native adapter status unavailable');
   if(!readiness.observe(native))return;
   availability(readiness.available,readiness.error);
   // Window focus remains authoritative when only the audio helper has failed.
   if(!native.windowReady||!native.adapterActive){wasFocused=undefined;return;}
   if(typeof native.focused==='boolean'){
    const current=session.get();
    if(shouldPauseAfterFocusLoss(wasFocused,native.focused,{screen:desktopState.get().screen,active:current.active&&!!current.game,paused:!!current.game?.Paused,enabled:!!control()?.active}))emit(DesktopIntent,{action:'pause'});
    wasFocused=native.focused;
   }
  }catch(error){if(alive&&generation===requestGeneration)disconnect(error);}finally{pollBusy=false;}})();
 });
 return null;
}});
export const DesktopPlatformBridge={...bridge,resources:[...bridge.resources,read(ArcadeControl),read(ArcadeAudio),read(Time)]};
