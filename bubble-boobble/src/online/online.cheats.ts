import { multiplayer } from '@gameengine/runtime';
import { defineCheat } from '@gameengine/runtime/cheats';
import { session } from '../arcade/session';
import { ONLINE_DRAGONS, onlinePartySlots } from './rules';

/** Sent through mp test's recorded --event path, so title-screen hashes cannot pass unnoticed. */
export const OnlineAssertActive = defineCheat({
  id: 'online.assert-active',
  group: 'Online',
  title: 'Assert active synchronized Wave Survival',
  run() {
    const match = multiplayer.match(), current = session.get(), game = current.game;
    if (!match || current.mode !== 'online' || !current.active || !game?.Party || game.Tick <= 0 || game.Players.length !== ONLINE_DRAGONS) {
      throw new Error('Online assertion failed: match must be running ten-dragon Wave Survival');
    }
    const slots = onlinePartySlots(match.players);
    if (game.Paused || game.Party.Slots.some((slot, index) => slot !== slots[index]) || game.Party.Slots.length !== ONLINE_DRAGONS) {
      throw new Error('Online assertion failed: roster or pause state differs from the shared match');
    }
    if (game.Counters.Blown <= 0) throw new Error('Online assertion failed: network players have not fired in the match');
  },
});
