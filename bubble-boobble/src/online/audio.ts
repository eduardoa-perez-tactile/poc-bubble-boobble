import { audio, defineSystem, read, write, Time } from '@gameengine/runtime';
import { OnlineAudioState } from '../schema.gen';
import { clientWorldView } from './world-system';
import { session } from '../arcade/session';
import { desktopSaveState } from '../desktop/save';

/** A local playback cursor is not snapshotted: rewinding cannot replay a heard cue. */
export const OnlineAudioPresentation = defineSystem({
  name: 'OnlineAudioPresentation',
  stage: 'LateUpdate',
  resources: [write(OnlineAudioState), read(Time)],
  run(ctx) {
    const current = session.get(), game = current.game;
    if (!current.active || current.mode !== 'online' || !game?.Party) return;
    const old = ctx.get(OnlineAudioState), room=clientWorldView.get().room??'fixed';
    const sameRoom=room===old.room;
    if (sameRoom&&game.Tick <= old.tick) return;
    const party = game.Party, hp = party.Boss?.HP ?? -1;
    const downed = game.Players.filter(player => player.Downed).length;
    const gain = desktopSaveState.get().settings.sound / 100;
    const play = (sound: string, volume: number, priority: number, pitch = 1, maxVoices = 2) => {
      if (gain > 0) audio.play(sound, { volume: gain * volume, priority, pitch, maxVoices });
    };
    // Coalesce simultaneous dragon cues and never replay frames already presented.
    if (game.Sounds.includes('shoot')) play('audio/bubble-shot', .48, 10, 1 + game.Tick % 5 * .025, 3);
    if (game.Sounds.includes('pop')) play('audio/bubble-pop', .5, 30);
    if (game.Bubbles.some(bubble => bubble.EnemyID && bubble.CapturedAge === 1)) play('audio/capture', .55, 50);
    for (const sound of ['death', 'item', 'laser', 'fire', 'water', 'jump']) {
      if (game.Sounds.includes(sound)) play(`reference/audio/${sound}`, sound === 'jump' ? .3 : .6, sound === 'death' ? 100 : 25, 1, 3);
    }
    if (sameRoom&&old.tick >= 0) {
      if (downed < old.downed) play('audio/rescue', .7, 90);
      if (hp >= 0 && old.bossHP > hp) play('audio/boss-hit', .7, 75);
      if (party.Wave > old.wave) play('audio/wave-clear', .7, 75);
      if (game.State === 4 && old.state !== 4) play('audio/victory', .7, 90);
    }
    ctx.set(OnlineAudioState, { tick: game.Tick, wave: party.Wave, state: game.State, downed, bossHP: hp, room });
  },
});
