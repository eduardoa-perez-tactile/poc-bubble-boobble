// Presentation-only optional bridge to this game's macOS launcher. Ordinary engine
// runs retain the standard platform/audio path when no authenticated bridge exists.
import {read,net,Time} from '@gameengine/runtime';
import {defineUI,createEffect,useDoc,useResource,emit,onCleanup} from '@gameengine/ui';
import {ArcadeAudio,ArcadeControl,DesktopIntent} from '../schema.gen';
import {desktopSaveState} from '../desktop/save';
import {session} from '../arcade/session';
import {desktopState} from '../desktop/state';
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
 let token='',sent='',observed='',busy=false,nextRetry=0,alive=true;
 let pollBusy=false,nextPoll=0,wasFocused:boolean|undefined;
 function availability(value:boolean,error=''){
  if(!alive)return;
  if(audio()?.native!==value)emit(DesktopIntent,{action:'native-audio',value:value?'1':'0'});
  status.available=value;status.error=error;
 }
 onCleanup(()=>{alive=false;status.available=false;});
 createEffect(()=>{
  const t=clock(),c=control(),a=audio(),s=save(),g=game();
  if(!t||!c?.active||!a||!alive)return;
  const u=ui();
  const desired=JSON.stringify({fullscreen:s.settings.fullscreen,track:music[a.track]??'bubble-2',volume:s.settings.music/100,paused:nativeMusicPaused(u.screen,g.active,!!g.game?.Paused),muted:a.muted});
  const observationKey=`${u.screen}/${u.selected}/${g.active}/${g.game?.Paused??false}`;
  if(busy||(desired===sent&&observationKey===observed&&t.elapsed<nextRetry)||(!token&&t.elapsed<nextRetry))return;
  busy=true;nextRetry=t.elapsed+2;
  void(async()=>{
   try{
    if(!token){
     const response=await net.fetch(endpoint+'/health',{timeoutMs:300});
     const health=response.json<{bundleId?:string;protocol?:number;token?:string;launchId?:string}>();
     if(!response.ok||health.bundleId!=='bubbleboobble.desktop'||health.protocol!==1||health.launchId!==launch.launchId||typeof health.token!=='string'||!/^[0-9a-f]{64}$/.test(health.token))throw new Error('macOS game launcher unavailable');
     token=health.token;
    }
    const response=await net.fetch(endpoint+'/state',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({...JSON.parse(desired),observation:{screen:u.screen,selected:u.selected,gameActive:g.active,gamePaused:!!g.game?.Paused,gameTick:g.game?.Tick??0}}),timeoutMs:500});
    const applied=response.json<{ok?:boolean}>();
    if(!response.ok||applied.ok!==true)throw new Error(`Desktop adapter HTTP ${response.status}`);
    sent=desired;observed=observationKey;availability(true);
   }catch(error){token='';sent='';wasFocused=undefined;availability(false,String(error));}
   finally{busy=false;}
  })();
 });
 createEffect(()=>{
  const t=clock();
  if(!t||!token||!status.available||pollBusy||t.elapsed<nextPoll)return;
  nextPoll=t.elapsed+0.05;pollBusy=true;
  void(async()=>{try{
   const response=await net.fetch(endpoint+'/status',{headers:{authorization:`Bearer ${token}`},timeoutMs:300});
   const native=response.json<{focused?:boolean;launchId?:string}>();
   if(alive&&response.ok&&native.launchId===launch.launchId&&typeof native.focused==='boolean'){
    const current=session.get();
    if(shouldPauseAfterFocusLoss(wasFocused,native.focused,{screen:desktopState.get().screen,active:current.active&&!!current.game,paused:!!current.game?.Paused,enabled:!!control()?.active}))emit(DesktopIntent,{action:'pause'});
    wasFocused=native.focused;
   }
  }catch{}finally{pollBusy=false;}})();
 });
 return null;
}});
export const DesktopPlatformBridge={...bridge,resources:[...bridge.resources,read(ArcadeControl),read(ArcadeAudio),read(Time)]};
