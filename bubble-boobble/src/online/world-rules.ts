import type { WorldInputEvent } from '@gameengine/runtime';
import { createPartyGame } from '../arcade/party';
import { partyNames } from '../arcade/party-config';
import { copyGame, stepGame } from '../arcade/game';
import { enableCompanion } from '../arcade/companion';
import { respawn } from '../arcade/player';
import { State, type GameState, type Input, type Level, type PartySlot } from '../arcade/types';
import { compactOnlineNavigation, restoreOnlineNavigation } from './navigation';

export const WORLD_ROOM_LIMIT = 4;
export const WORLD_CONTROL_TIMEOUT = 60;
export const WORLD_ROOM_IDLE_TICKS = 1800;
export interface WorldNotice { id: number; tick: number; slot: number; kind: 'join' | 'leave'; label: string }
export interface WorldPeer { player: number; name: string; room: string | null; input: Input; lastInputTick: number; jumpPulse: boolean; firePulse: boolean; error?: string }
export interface WorldRoom {
  id: string; title: string; owners: (number | null)[]; game: GameState;
  notices: WorldNotice[]; nextNotice: number; createdTick: number; emptySince: number | null; endedTick: number | null;
}
export interface WorldState { tick: number; nextRoom: number; peers: WorldPeer[]; rooms: WorldRoom[] }
const neutral = (): Input => ({ Move: 0, Jump: false, Fire: false });
const ended = (room: WorldRoom) => room.game.State === State.GameOver || room.game.State === State.Won;
export const worldHumanCount = (room: WorldRoom): number => room.owners.filter(owner => owner !== null).length;
export function createWorldState(): WorldState { return { tick: 0, nextRoom: 1, peers: [], rooms: [] }; }
function copyState(state: WorldState): WorldState {
  return { ...state, peers: state.peers.map(peer => ({ ...peer, input: { ...peer.input } })), rooms: state.rooms.map(room => ({ ...room, owners: room.owners.slice(), notices: room.notices.slice() })) };
}
function copyRoomGame(room: WorldRoom): GameState {
  const game = copyGame(room.game); restoreOnlineNavigation(game); return game;
}
function notice(state: WorldState, room: WorldRoom, slot: number, kind: WorldNotice['kind']): void {
  room.notices = [...room.notices, { id: room.nextNotice++, tick: state.tick, slot, kind, label: `P${slot + 1} ${partyNames[slot]!}` }].slice(-32);
}
function leaveRoom(state: WorldState, peer: WorldPeer): void {
  const room = state.rooms.find(room => room.id === peer.room);
  if (room) {
    const slot = room.owners.indexOf(peer.player);
    if (slot >= 0) {
      const game = copyRoomGame(room);
      room.owners[slot] = null;
      game.Party!.Slots[slot] = 'ai';
      enableCompanion(game, slot);
      compactOnlineNavigation(game); room.game = game;
      notice(state, room, slot, 'leave');
      if (!worldHumanCount(room)) room.emptySince = state.tick;
    }
  }
  peer.room = null; peer.input = neutral(); peer.jumpPulse = false; peer.firePulse = false; peer.lastInputTick = state.tick;
}
function evictRoom(state: WorldState, room: WorldRoom): void {
  for (const peer of state.peers) if (peer.room === room.id) { peer.room = null; peer.input = neutral(); peer.jumpPulse = false; peer.firePulse = false; peer.lastInputTick = state.tick; }
  state.rooms = state.rooms.filter(candidate => candidate.id !== room.id);
}
function validPlayer(player: number): boolean { return Number.isInteger(player) && player >= 0 && player <= 0xffffffff; }

/** Transport events already carry server identities; client data can select an intent, never an actor. */
export function applyWorldEvents(previous: WorldState, events: readonly WorldInputEvent[], levels: Level[]): WorldState {
  let state = copyState(previous);
  for (const event of events) {
    if (event.kind === 'start') { state = createWorldState(); continue; }
    if (!validPlayer(event.player)) continue;
    if (event.kind === 'join') {
      if (!state.peers.some(peer => peer.player === event.player)) state.peers.push({ player: event.player, name: event.name.slice(0, 64), room: null, input: neutral(), lastInputTick: state.tick, jumpPulse: false, firePulse: false });
      continue;
    }
    const peer = state.peers.find(peer => peer.player === event.player);
    if (!peer) continue;
    if (event.kind === 'leave') { leaveRoom(state, peer); state.peers = state.peers.filter(candidate => candidate !== peer); continue; }
    const data = event.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) continue;
    const intent = data as Record<string, unknown>;
    if (intent.action === 'leave') { leaveRoom(state, peer); delete peer.error; continue; }
    if (intent.action === 'controls') {
      if (!peer.room || typeof intent.move !== 'number' || !Number.isFinite(intent.move) || typeof intent.jump !== 'boolean' || typeof intent.fire !== 'boolean') continue;
      peer.jumpPulse ||= intent.jump && !peer.input.Jump;
      peer.firePulse ||= intent.fire && !peer.input.Fire;
      peer.input = { Move: Math.max(-1, Math.min(1, intent.move)), Jump: intent.jump, Fire: intent.fire }; peer.lastInputTick = state.tick;
      continue;
    }
    if (intent.action === 'create') {
      // A failed create must not eject the player from their existing session.
      if (state.rooms.length >= WORLD_ROOM_LIMIT) {
        const disposable = state.rooms.filter(room => ended(room) || worldHumanCount(room) === 0).sort((a, b) => a.createdTick - b.createdTick)[0];
        if (!disposable) { peer.error = 'The server has four active games. Join an existing game or try again later.'; continue; }
        evictRoom(state, disposable);
      }
      leaveRoom(state, peer);
      const number = state.nextRoom++;
      const slots: PartySlot[] = Array.from({ length: 10 }, (_, slot) => slot === 0 ? 'human' : 'empty');
      const game = createPartyGame(levels, number, slots);
      const room: WorldRoom = { id: `room-${number}`, title: `WAVE SURVIVAL ${number}`, owners: [peer.player, ...Array(9).fill(null)], game, notices: [], nextNotice: 1, createdTick: state.tick, emptySince: null, endedTick: null };
      state.rooms.push(room); peer.room = room.id; peer.input = neutral(); peer.lastInputTick = state.tick; delete peer.error;
      notice(state, room, 0, 'join'); continue;
    }
    if (intent.action === 'join' && typeof intent.room === 'string') {
      const room = state.rooms.find(room => room.id === intent.room);
      if (!room) { peer.error = 'This game is no longer available. Choose another game.'; continue; }
      if (ended(room)) { peer.error = 'This game has ended. Start or join another game.'; continue; }
      if (room.id === peer.room) { delete peer.error; continue; }
      let slot = room.owners.findIndex((owner, slot) => owner === null && room.game.Party!.Slots[slot] === 'ai');
      if (slot < 0) slot = room.owners.findIndex((owner, slot) => owner === null && room.game.Party!.Slots[slot] === 'empty');
      if (slot < 0) { peer.error = 'This game already has ten human players. Choose another game.'; continue; }
      leaveRoom(state, peer);
      const game = copyRoomGame(room), wasEmpty = game.Party!.Slots[slot] === 'empty';
      game.Party!.Slots[slot] = 'human'; game.Companions![slot] = null;
      if (slot === 1) delete game.Companion;
      if (wasEmpty) { game.Players[slot]!.Lives = 1; respawn(game, slot); }
      compactOnlineNavigation(game); room.game = game; room.owners[slot] = peer.player; room.emptySince = null;
      peer.room = room.id; peer.input = neutral(); peer.lastInputTick = state.tick; delete peer.error;
      notice(state, room, slot, 'join');
    }
  }
  return state;
}

/** Every room uses ordinary authoritative rules; no browser input or presentation state enters here. */
export function stepWorld(previous: WorldState): WorldState {
  const state = copyState(previous); state.tick++;
  for (const peer of state.peers) if (state.tick - peer.lastInputTick >= WORLD_CONTROL_TIMEOUT) { peer.input = neutral(); peer.jumpPulse = false; peer.firePulse = false; }
  for (const room of state.rooms) {
    if (!ended(room)) {
      const game = copyRoomGame(room);
      const inputs = room.owners.map(owner => {
        const peer = owner === null ? undefined : state.peers.find(peer => peer.player === owner && peer.room === room.id);
        return peer ? { Move: peer.input.Move, Jump: peer.input.Jump || peer.jumpPulse, Fire: peer.input.Fire || peer.firePulse } : neutral();
      });
      stepGame(game, inputs); compactOnlineNavigation(game); room.game = game;
    }
    if (ended(room) && room.endedTick === null) room.endedTick = state.tick;
  }
  for (const peer of state.peers) { peer.jumpPulse = false; peer.firePulse = false; }
  for (const room of state.rooms.slice()) {
    if (room.emptySince !== null && state.tick - room.emptySince >= WORLD_ROOM_IDLE_TICKS || room.endedTick !== null && state.tick - room.endedTick >= WORLD_ROOM_IDLE_TICKS) evictRoom(state, room);
  }
  return state;
}
export function advanceWorld(previous: WorldState, events: readonly WorldInputEvent[], levels: Level[]): WorldState { return stepWorld(applyWorldEvents(previous, events, levels)); }
