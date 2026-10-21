import { defineSystem, multiplayer, MorePlayerInputs, PlayerInputs, read, WorldView, write } from '@gameengine/runtime';
import { ArcadeControl } from '../schema.gen';
import campaign from '../../data/levels.json';
import { copyGame, stepGame } from '../arcade/game';
import { session } from '../arcade/session';
import { State, type Level } from '../arcade/types';
import { createOnlineWaveGame, readOnlineInputs } from './rules';
import { compactOnlineNavigation, restoreOnlineNavigation } from './navigation';
export { onlineButtons } from './rules';

/** Shared server/client rules. No local menu, save, controller or connection state enters here. */
export const OnlineWaveStep = defineSystem({
  name: 'OnlineWaveStep',
  after: ['ArcadeBoot'],
  resources: [read(PlayerInputs), read(MorePlayerInputs), write(ArcadeControl), write(WorldView)],
  run(ctx) {
    const match = multiplayer.match();
    if (!match) return;
    const current = session.get();
    const initializing = current.mode !== 'online' || !current.active || !current.game;
    // Clear the final step's sound list once, then leave the settled result document alone.
    if (!initializing && (current.game!.State === State.GameOver || current.game!.State === State.Won) && current.game!.Sounds.length === 0) return;
    const game = initializing ? createOnlineWaveGame(campaign as Level[], match) : copyGame(current.game!);
    restoreOnlineNavigation(game);
    if (initializing) {
      ctx.set(ArcadeControl, { active: true, skip: false, requestSequence: 0 });
      ctx.set(WorldView, { center: [384, 360], orthoSize: 360, designAspect: 768 / 720, fit: 'Contain' });
    }
    const more = match.players > 4 ? ctx.get(MorePlayerInputs) : undefined;
    stepGame(game, readOnlineInputs(ctx.get(PlayerInputs), more, match.players));
    compactOnlineNavigation(game);
    session.set({ active: true, mode: 'online', game });
  },
});
