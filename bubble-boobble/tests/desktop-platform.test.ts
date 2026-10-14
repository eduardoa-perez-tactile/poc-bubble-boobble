import {worldTest,expect} from '@gameengine/test';
import {shouldPauseAfterFocusLoss,nativeMusicPaused} from '../src/desktop-platform/index.ts';

worldTest('desktop native focus loss pauses only the current playing screen',()=>{
 const playing={screen:'play',active:true,paused:false,enabled:true};
 expect(shouldPauseAfterFocusLoss(true,false,playing)).toBe(true);
 expect(shouldPauseAfterFocusLoss(undefined,false,playing)).toBe(false);
 expect(shouldPauseAfterFocusLoss(false,false,playing)).toBe(false);
 expect(shouldPauseAfterFocusLoss(true,true,playing)).toBe(false);
 for(const screen of ['result','menu','editor','pause'])expect(shouldPauseAfterFocusLoss(true,false,{...playing,screen})).toBe(false);
 expect(shouldPauseAfterFocusLoss(true,false,{...playing,paused:true})).toBe(false);
 expect(shouldPauseAfterFocusLoss(true,false,{...playing,active:false})).toBe(false);
 expect(shouldPauseAfterFocusLoss(true,false,{...playing,enabled:false})).toBe(false);
 // A focus request can begin during play and return after the game finishes or
 // leaves. Only the snapshot read at response time may authorize a pause.
 let current=playing;
 const pendingResponse=()=>shouldPauseAfterFocusLoss(true,false,current);
 current={...playing,screen:'result'};expect(pendingResponse()).toBe(false);
 current={...playing,screen:'menu',active:false};expect(pendingResponse()).toBe(false);
},{scene:'scenes/arcade.scene.json'});

worldTest('desktop native music pauses only on canonical play page',async()=>{
 for(const screen of ['title','menu','profiles','new-profile','settings','scores','help','credits','editor','result'])expect(nativeMusicPaused(screen,true,true)).toBe(false);
 expect(nativeMusicPaused('play',true,true)).toBe(true);
 expect(nativeMusicPaused('pause',true,true)).toBe(true);
 expect(nativeMusicPaused('play',true,false)).toBe(false);
 expect(nativeMusicPaused('pause',false,true)).toBe(false);
});

import {desktopLaunchIdentity,desktopPlatformAvailable} from '../src/desktop-platform/index.ts';
import {ArcadeAudio} from '../src/schema.gen.ts';
worldTest('desktop ordinary source bundle stays disconnected from native app',async({step,world})=>{
 expect(desktopLaunchIdentity()).toBe(undefined);
 await step(120);
 expect(desktopPlatformAvailable()).toBe(false);
 expect(world.resource(ArcadeAudio).native).toBe(false);
},{scene:'scenes/arcade.scene.json'});

import {NativeAudioReadiness} from '../src/desktop-platform/readiness';
import {DesktopIntent} from '../src/schema.gen';
worldTest('desktop native backend failure restores music and ACKs cannot hide failure',async({step,input,audio,world})=>{
 await step(10);
 const readiness=new NativeAudioReadiness();
 const snapshot=(revision:number,error='')=>({revision,error,windowReady:true,adapterActive:true});
 const synchronize=async(revision:number,error='')=>{
  if(readiness.observe(snapshot(revision,error))&&world.resource(ArcadeAudio).native!==readiness.available)
   input.emit(DesktopIntent,{action:'native-audio',value:readiness.available?'1':'0'});
  await step(1);
 };
 readiness.acknowledge(1);
 await synchronize(1,'helper startup failed');
 expect(readiness.available).toBe(false);
 expect(audio.status().music).toBe('reference/audio/music-bubble-2');
 // A successful HTTP ACK cannot recover a failing helper, nor can an older
 // healthy snapshot certify a state the native adapter has not applied yet.
 for(let revision=2;revision<=4;revision++){
  readiness.acknowledge(revision);
  expect(readiness.available).toBe(false);
  expect(readiness.observe(snapshot(revision-1))).toBe(false);
  await synchronize(revision,'helper startup failed');
  expect(world.resource(ArcadeAudio).native).toBe(false);
  expect(audio.status().music).toBe('reference/audio/music-bubble-2');
  expect(world.events(DesktopIntent).filter(e=>e.action==='native-audio').length).toBe(0);
 }
 // Recovery is discovered by polling the backend, with no new HTTP ACK needed.
 await synchronize(4);
 expect(world.resource(ArcadeAudio).native).toBe(true);
 expect(audio.status().music).toBe(null);
 await synchronize(4,'Stateful music source ended unexpectedly');
 expect(world.resource(ArcadeAudio).native).toBe(false);
 expect(audio.status().music).toBe('reference/audio/music-bubble-2');
 readiness.acknowledge(5);
 expect(readiness.available).toBe(false);
 await synchronize(5,'Stateful music source ended unexpectedly');
 expect(world.resource(ArcadeAudio).native).toBe(false);
 await synchronize(5);
 expect(world.resource(ArcadeAudio).native).toBe(true);
 expect(audio.status().music).toBe(null);
 readiness.reset();readiness.acknowledge(0);
 expect(readiness.available).toBe(false);
},{scene:'scenes/arcade.scene.json'});
