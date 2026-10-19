import {worldTest,expect} from '@gameengine/test';
import {PlaySound,PlayMusic,LoadSoundBank,UnloadSoundBank,SetBusVolume} from '@gameengine/runtime';
import {DesktopIntent} from '../src/schema.gen.ts';
import {ResetArcade} from '../src/arcade/arcade.cheats.ts';
import {session} from '../src/arcade/session.ts';
worldTest('arcade audio bank original shoot trigger and music request',async({step,cheat,input,audio,world})=>{
 await step(10);
 expect(audio.status().music).toBe('reference/audio/music-bubble-2');
 await cheat(ResetArcade,{ready:false});
 expect(world.events(PlayMusic).some(e=>e.track==='reference/audio/music-bubble-1')).toBe(true);
 input.action('fire',1);await step(1);
 expect(session.get().game!.Sounds).toEqual(['shoot']);
 expect(world.events(PlaySound).some(e=>e.sound==='reference/audio/shoot')).toBe(true);
 const s=audio.status();
 expect(s.banks['reference/audio/sfx.bank']?.ready).toBe(true);
 expect(s.sounds).toBeGreaterThanOrEqual(10);
 expect(s.buses.SFX).toBe(1);
 expect(world.events(PlaySound)[0]!.volume).toBe(.75);
 expect(s.buses.Music).toBe(0.5);
 expect(s.music).toBe('reference/audio/music-bubble-1');
 input.emit(DesktopIntent,{action:'sound',index:-1});await step(1);
 expect(audio.status().buses.SFX).toBe(1);
 expect(world.events(SetBusVolume).some(e=>e.bus==='SFX')).toBe(false);
},{scene:'scenes/arcade.scene.json'});

import {ArcadeAudio,ArcadeInput} from '../src/schema.gen.ts';
import {canonicalState,copyGame,stepGame} from '../src/arcade/game.ts';
import {match} from './arcade-assert';
worldTest('arcade audio native connection restores fallback without gameplay changes',async({step,cheat,input,audio,world})=>{
 await step(10);
 await cheat(ResetArcade,{ready:false});
 const tick=async(action:string,value='')=>{
  const expected=copyGame(session.get().game!);
  stepGame(expected,{Move:0,Jump:false,Fire:false});
  input.emit(DesktopIntent,{action,value,index:0,x:0,y:0});await step(1);
  match(canonicalState(expected),canonicalState(session.get().game!),`native-audio.${value}.canonical`);
 };
 expect(world.resource(ArcadeAudio).native).toBe(false);
 await tick('native-audio','1');
 expect(world.resource(ArcadeAudio).native).toBe(true);
 expect(audio.status().music).toBe(null);
 expect(world.events(PlayMusic).length).toBe(0);
 expect(audio.status().buses.Music).toBe(0);
 expect(audio.status().buses.SFX).toBe(1);
 input.emit(DesktopIntent,{action:'music',index:-1});await step(1);
 expect(audio.status().buses.Music).toBe(0);
 await tick('native-audio','0');
 expect(world.resource(ArcadeAudio).native).toBe(false);
 expect(audio.status().buses.Music).toBe(.25);
 expect(audio.status().music).toBe('reference/audio/music-bubble-1');
 expect(world.events(PlayMusic).some(e=>e.track==='reference/audio/music-bubble-1')).toBe(true);
 input.emit(ArcadeInput,{player:0,move:0,jump:false,fire:false,paused:true});await step(1);
 const paused=canonicalState(session.get().game!);
 await tick('native-audio','1');
 await tick('native-audio','0');
 match(paused,canonicalState(session.get().game!),'native-audio.paused.canonical');
 expect(audio.status().buses.Music).toBe(0);
 input.emit(ArcadeInput,{player:0,move:0,jump:false,fire:false,paused:false});await step(1);
 expect(audio.status().buses.Music).toBe(.25);
},{scene:'scenes/arcade.scene.json'});

worldTest('arcade audio mute stops active SFX and reloads the first unmuted cue',async({step,cheat,input,audio,world})=>{
 await step(10);
 input.emit(DesktopIntent,{action:'native-audio',value:'1'});await step(1); // Isolate SFX voice count.
 await cheat(ResetArcade,{ready:false});
 input.action('fire',1);await step(1);
 expect(audio.status().voices).toBe(1);
 input.action('fire',0);input.action('mute',1);await step(1);
 expect(world.resource(ArcadeAudio).muted).toBe(true);
 expect(world.events(UnloadSoundBank).map(e=>e.bank)).toEqual(['reference/audio/sfx.bank','audio/juice.bank']);
 expect(audio.status().voices).toBe(0);
 input.action('mute',0);await step(1);
 await cheat(ResetArcade,{ready:false});
 const expected=copyGame(session.get().game!);stepGame(expected,{Move:0,Jump:false,Fire:true});
 input.action('fire',1);await step(1);
 match(canonicalState(expected),canonicalState(session.get().game!),'muted-fire.canonical');
 expect(session.get().game!.Sounds).toEqual(['shoot']);
 expect(world.events(PlaySound).length).toBe(0);expect(audio.status().voices).toBe(0);
 input.action('fire',0);await step(1);await cheat(ResetArcade,{ready:false});
 input.action('fire',1);input.action('mute',1);await step(1);
 expect(world.resource(ArcadeAudio).muted).toBe(false);
 expect(world.events(LoadSoundBank).map(e=>e.bank)).toEqual(['reference/audio/sfx.bank','audio/juice.bank']);
 expect(world.events(PlaySound).map(e=>[e.sound,e.volume])).toEqual([['reference/audio/shoot',.75]]);
 expect(audio.status().buses.SFX).toBe(1);
 expect(audio.status().banks['reference/audio/sfx.bank']?.ready).toBe(true);
 expect(audio.status().voices).toBe(1);
},{scene:'scenes/arcade.scene.json'});

worldTest('arcade audio SFX gain applies to future cues and sound zero skips them',async({step,cheat,input,audio,world})=>{
 await step(10);input.emit(DesktopIntent,{action:'native-audio',value:'1'});await step(1);
 await cheat(ResetArcade,{ready:false});input.action('fire',1);await step(1);
 expect(world.events(PlaySound)[0]!.volume).toBe(.75);expect(audio.status().voices).toBe(1);
 input.action('fire',0);input.emit(DesktopIntent,{action:'sound',index:-1});await step(1);
 expect(audio.status().voices).toBe(1);expect(audio.status().buses.SFX).toBe(1);
 expect(world.events(SetBusVolume).some(e=>e.bus==='SFX')).toBe(false);
 await cheat(ResetArcade,{ready:false});input.action('fire',1);await step(1);
 expect(world.events(PlaySound)[0]!.volume).toBe(.5);
 input.action('fire',0);input.emit(DesktopIntent,{action:'sound',index:-1});await step(1);
 input.emit(DesktopIntent,{action:'sound',index:-1});await step(1);
 expect(audio.status().buses.SFX).toBe(1);
 expect(world.events(UnloadSoundBank).length).toBe(0); // Zero gain does not stop older source players.
 await cheat(ResetArcade,{ready:false});input.action('fire',1);await step(1);
 expect(session.get().game!.Sounds).toEqual(['shoot']);expect(world.events(PlaySound).length).toBe(0);
 expect(audio.status().buses.SFX).toBe(1);
},{scene:'scenes/arcade.scene.json'});

for(const oldSound of ['water','shoot'])worldTest(`arcade audio saturation rejects new shoot and preserves 24 older ${oldSound} voices`,async({step,cheat,input,audio,world})=>{
 await step(10);input.emit(DesktopIntent,{action:'native-audio',value:'1'});await step(1);
 await cheat(ResetArcade,{ready:false});input.action('fire',1);await step(1);
 const olderPriority=world.events(PlaySound)[0]!.priority;
 input.action('fire',0);await step(30);expect(audio.status().voices).toBe(0);
 // Permanent old voices expose stealing: if an incoming short shot replaces
 // one, its expiration leaves only 23 loops. Fixed old priority is intentional.
 for(let i=0;i<24;i++)input.emit(PlaySound,{sound:`reference/audio/${oldSound}`,loop:true,maxVoices:0,priority:olderPriority});
 await step(1);expect(audio.status().voices).toBe(24);
 await cheat(ResetArcade,{ready:false});input.action('fire',1);await step(1);
 expect(session.get().game!.Sounds).toEqual(['shoot']);
 const incoming=world.events(PlaySound);expect(incoming.length).toBe(1);
 expect(incoming[0]!.priority).toBe(olderPriority-1);expect(incoming[0]!.maxVoices).toBe(0);
 expect(audio.status().voices).toBe(24);
 input.action('fire',0);await step(30);
 expect(audio.status().voices).toBe(24); // Incoming duration has elapsed; no old loop was replaced.
 // Control proves the supported SDK rule itself: equal-priority short sound
 // steals an old loop and its eventual end leaves only 23 old voices.
 input.emit(PlaySound,{sound:'reference/audio/shoot',maxVoices:0,priority:olderPriority});
 await step(1);expect(audio.status().voices).toBe(24);await step(30);
 expect(audio.status().voices).toBe(23);
 input.action('mute',1);await step(1);expect(audio.status().voices).toBe(0);
 expect(world.resource(ArcadeAudio).sfxPriority).toBe(2147483647);
},{scene:'scenes/arcade.scene.json'});

worldTest('arcade audio same-step SFX priorities strictly descend and mute resets bounded cursor',async({step,cheat,input,world,audio})=>{
 await step(10);await cheat(ResetArcade,{ready:false,players:2});
 const initial=world.resource(ArcadeAudio).sfxPriority;
 input.action('fire',1);input.action('fire2',1);await step(1);
 expect(session.get().game!.Sounds).toEqual(['shoot','shoot']);
 expect(world.events(PlaySound).map(e=>e.priority)).toEqual([initial,initial-1]);
 expect(world.resource(ArcadeAudio).sfxPriority).toBe(initial-2);
 input.action('fire',0);input.action('fire2',0);await step(1);
 // The final representable issued priority remains signed; mute resets only
 // after the bank is unloaded, so a subsequent epoch cannot outrank old voices.
 world.setResource(ArcadeAudio,{sfxPriority:-2147483647});
 await cheat(ResetArcade,{ready:false});input.action('fire',1);await step(1);
 expect(world.events(PlaySound)[0]!.priority).toBe(-2147483647);
 expect(world.resource(ArcadeAudio).sfxPriority).toBe(-2147483648);
 input.action('fire',0);input.action('mute',1);await step(1);
 expect(audio.status().voices).toBe(0);
 expect(world.events(UnloadSoundBank).length).toBe(2);
 expect(world.resource(ArcadeAudio).sfxPriority).toBe(2147483647);
 input.action('mute',0);await step(1);await cheat(ResetArcade,{ready:false});
 input.action('fire',1);input.action('mute',1);await step(1);
 expect(world.events(PlaySound)[0]!.priority).toBe(2147483647);
},{scene:'scenes/arcade.scene.json'});
