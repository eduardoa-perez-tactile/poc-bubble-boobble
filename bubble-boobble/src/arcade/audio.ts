import { ActionState, app, defineSystem, query, read, write, PlayMusic, StopMusic, SetBusVolume, PlaySound, LoadSoundBank, UnloadSoundBank } from '@gameengine/runtime';
import { ArcadeAudio, ArcadeControl, ArcadePlatformState, DesktopIntent } from '../schema.gen.ts';
import { session } from './session.ts';
import { desktopGameRequest, desktopSaveState, desktopState } from '../desktop/index.ts';
const tracks:Record<string,string>={theme:'music-bubble-1',menu:'music-bubble-2',opening:'music-bubble-2',hurry:'music-bubble-3',gameover:'music-bubble-4',win:'music-bubble-5'};
export const ArcadeAudioSystem=defineSystem({
 name:'ArcadeAudioSystem',after:['ArcadeStep'],query:query(read(ActionState)),resources:[read(ArcadeControl),write(ArcadeAudio)],events:[DesktopIntent],
 runIf:{resource:ArcadeControl,field:'active',value:true},
 run(ctx,q){
  const old=ctx.get(ArcadeAudio),s=session.get(),save=desktopSaveState.get();let muted=old.muted,native=old.native,sfxPriority=old.sfxPriority;
  for(const intent of ctx.events.read(DesktopIntent))if(intent.action==='native-audio')native=intent.value==='1';
  if(native!==old.native){ctx.setField(ArcadeAudio,'native',native);if(native)ctx.events.emit(StopMusic,{fade:0});}
  if(desktopState.get().screen!=='new-profile')for(const c of q.chunks())for(let i=0;i<c.length;i++)if(c.is(ActionState,i,'name','mute')&&c.col(ActionState).justPressed[i])muted=!muted;
  const g=s.active?s.game:null;
  const track=!g?'menu':g.State===4?'win':g.State===3?'gameover':g.Hurry?'hurry':'theme';
  const paused=!!g?.Paused;
  if(track!==old.track||native!==old.native){if(!native)ctx.events.emit(PlayMusic,{track:`reference/audio/${tracks[track]}`,crossfade:0});ctx.setField(ArcadeAudio,'track',track);}
  if(muted!==old.muted){
   ctx.setField(ArcadeAudio,'muted',muted);
   // Go stops existing players on mute; a silent bus would let them resurface.
   ctx.events.emit(muted?UnloadSoundBank:LoadSoundBank,{bank:'reference/audio/sfx.bank'});
   ctx.events.emit(muted?UnloadSoundBank:LoadSoundBank,{bank:'audio/juice.bank'});
   if(muted)sfxPriority=2147483647; // Unload stops every older bank voice before reuse.
  }
  if(old.music!==save.settings.music||old.muted!==muted||old.paused!==paused||old.native!==native){ctx.events.emit(SetBusVolume,{bus:'Music',volume:native||muted||paused?0:save.settings.music/100});ctx.setField(ArcadeAudio,'music',save.settings.music);}
  // Source SFX players keep the gain they had when created. Settings affect
  // future voices, while mute unloads/stops them instead of changing their bus.
  if(old.sound<0)ctx.events.emit(SetBusVolume,{bus:'SFX',volume:1});
  if(old.sound!==save.settings.sound)ctx.setField(ArcadeAudio,'sound',save.settings.sound);
  // Party sounds are coalesced per fixed step and use meaningful voice priorities.
  // Classic keeps its original gain and ordering contract.
  if(g?.Party&&!muted&&!paused&&save.settings.sound>0){
    const gain=save.settings.sound/100;
    const play=(sound:string,volume:number,priority:number,pitch=1,maxVoices=2)=>ctx.events.emit(PlaySound,{sound,volume:gain*volume,priority,pitch,maxVoices});
    if(g.Sounds.includes('shoot'))play('audio/bubble-shot',.48,10,1+(g.Tick%5)*.025,3);
    const pops=g.Particles.filter(p=>!p.Text&&p.Life===14).length;
    if(g.Sounds.includes('pop'))play('audio/bubble-pop',.5,30,1+Math.min(6,pops)*.045,2);
    if(g.Bubbles.some(b=>b.EnemyID&&b.CapturedAge===1))play('audio/capture',.55,50,1,2);
    for(const sound of ['death','item','laser','fire','water','jump'])if(g.Sounds.includes(sound))
      play(`reference/audio/${sound}`,sound==='jump'?.3:sound==='laser'?.45:.65,sound==='death'?100:sound==='item'?60:20,1,sound==='laser'?2:3);
  }
  // Six simultaneous dragons can produce dozens of piercing pops. Party mode
  // keeps the visual pop feedback while retaining the other gameplay cues.
  if(g&&!g.Party&&!muted&&save.settings.sound>0)for(const sound of g.Sounds)if(sound!=='opening'&&!(g.Party&&sound==='pop')){
   // Only the global 24-voice cap applies; disable the per-sound cap.
   // Supported mixer rule rejects an incoming cue when every occupied voice has
   // higher priority. Strict decrease also preserves order within one step.
   if(sfxPriority===-2147483648)throw new Error('SFX priority capacity exhausted; mute to stop voices and reset the cursor');
   ctx.events.emit(PlaySound,{sound:`reference/audio/${sound}`,volume:save.settings.sound/100,maxVoices:0,priority:sfxPriority});
   sfxPriority--;
  }
  if(sfxPriority!==old.sfxPriority)ctx.setField(ArcadeAudio,'sfxPriority',sfxPriority);
  if(old.paused!==paused)ctx.setField(ArcadeAudio,'paused',paused);
 },
});
export const ArcadePlatform=defineSystem({
 name:'ArcadePlatform',stage:'LateUpdate',resources:[read(ArcadeControl),write(ArcadePlatformState)],
 run(ctx){
  // app.quit cannot run from sim. Its request stays in recorded document state.
  if(!ctx.get(ArcadeControl).active)return;
  const req=desktopGameRequest.get();
  if(req.action==='exit'&&req.sequence!==ctx.get(ArcadePlatformState).exitSequence){ctx.setField(ArcadePlatformState,'exitSequence',req.sequence);app.quit();}
 },
});
