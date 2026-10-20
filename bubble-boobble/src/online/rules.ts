import { defineButtons, playerInput, type MorePlayerInputs, type PlayerInputs, type ValueOf } from '@gameengine/runtime';
import { createPartyGame } from '../arcade/party';
import type { GameState, Input, Level, PartySlot } from '../arcade/types';

// Wire format: keep this order identical to multiplayer.buttons in project.gameengine.json.
export const onlineButtons = defineButtons(['jump', 'fire'] as const);
export const ONLINE_DRAGONS = 10;
export interface OnlineMatch { players: number; mode: 'realtime' | 'turns'; seed: string }

export function onlinePartySlots(players: number): PartySlot[] {
  if (!Number.isInteger(players) || players < 1 || players > ONLINE_DRAGONS) throw new Error('Online Wave Survival needs one to ten humans');
  return Array.from({ length: ONLINE_DRAGONS }, (_, index) => index < players ? 'human' : 'ai');
}

/** Preserve every bit of the engine's unsigned decimal u64 through initial spawn RNG too. */
export function onlineGameSeed(seed: string): bigint {
  if (!/^(?:0|[1-9][0-9]{0,19})$/.test(seed)) throw new Error('Invalid online match seed');
  const value = BigInt(seed);
  if (value > 18446744073709551615n) throw new Error('Online match seed exceeds u64');
  return value;
}

export function createOnlineWaveGame(levels: Level[], match: OnlineMatch): GameState {
  if (match.mode !== 'realtime') throw new Error('Online Wave Survival requires a real-time match');
  return createPartyGame(levels, onlineGameSeed(match.seed), onlinePartySlots(match.players));
}

/** Only the human prefix reads network seats. Companion logic owns every remaining slot. */
export function readOnlineInputs(inputs: ValueOf<typeof PlayerInputs>, more: ValueOf<typeof MorePlayerInputs> | undefined, humans: number): Input[] {
  if (!Number.isInteger(humans) || humans < 1 || humans > ONLINE_DRAGONS) throw new Error('Invalid online human count');
  return Array.from({ length: ONLINE_DRAGONS }, (_, index) => {
    if (index >= humans) return { Move: 0, Jump: false, Fire: false };
    const input = playerInput(inputs, index, more);
    return { Move: input.stick[0], Jump: onlineButtons.isDown(input.buttons, 'jump'), Fire: onlineButtons.isDown(input.buttons, 'fire') };
  });
}
