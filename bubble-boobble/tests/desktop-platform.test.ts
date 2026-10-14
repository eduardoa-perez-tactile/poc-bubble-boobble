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
