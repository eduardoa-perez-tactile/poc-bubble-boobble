import { ActionState, app, defineSystem, query, read, write, PlayMusic, SetBusVolume } from '@gameengine/runtime';
import { ArcadeAudio, ArcadeControl, ArcadePlatformState, DesktopIntent } from '../schema.gen.ts';
import { session } from './session.ts';
import { desktopGameRequest, desktopSaveState, desktopState } from '../desktop/index.ts';
const tracks:Record<string,string>={theme:'music-bubble-1',menu:'music-bubble-2',opening:'music-bubble-2',hurry:'music-bubble-3',gameover:'music-bubble-4',win:'music-bubble-5'};
export const ArcadeAudioSystem=defineSystem({
 name:'ArcadeAudioSystem',after:['ArcadeStep'],query:query(read(ActionState)),resources:[read(ArcadeControl),write(ArcadeAudio)],events:[DesktopIntent],
 runIf:{resource:ArcadeControl,field:'active',value:true},
 run(ctx,q){
  const old=ctx.get(ArcadeAudio),s=session.get(),save=desktopSaveState.get();let muted=old.muted,native=old.native;
  for(const intent of ctx.events.read(DesktopIntent))if(intent.action==='native-audio')native=intent.value==='1';
  if(native!==old.native)ctx.setField(ArcadeAudio,'native',native);
  if(desktopState.get().screen!=='new-profile')for(const c of q.chunks())for(let i=0;i<c.length;i++)if(c.is(ActionState,i,'name','mute')&&c.col(ActionState).justPressed[i])muted=!muted;
  const g=s.active?s.game:null;
  const track=!g?'menu':g.State===4?'win':g.State===3?'gameover':g.Hurry?'hurry':'theme';
  const paused=!!g?.Paused;
  if(track!==old.track||native!==old.native){if(!native)ctx.events.emit(PlayMusic,{track:`reference/audio/${tracks[track]}`,crossfade:0});ctx.setField(ArcadeAudio,'track',track);}
  if(muted!==old.muted)ctx.setField(ArcadeAudio,'muted',muted);
  if(old.music!==save.settings.music||old.muted!==muted||old.paused!==paused||old.native!==native){ctx.events.emit(SetBusVolume,{bus:'Music',volume:native||muted||paused?0:save.settings.music/100});ctx.setField(ArcadeAudio,'music',save.settings.music);}
  if(old.sound!==save.settings.sound||old.muted!==muted){ctx.events.emit(SetBusVolume,{bus:'SFX',volume:muted?0:save.settings.sound/100});ctx.setField(ArcadeAudio,'sound',save.settings.sound);}
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
