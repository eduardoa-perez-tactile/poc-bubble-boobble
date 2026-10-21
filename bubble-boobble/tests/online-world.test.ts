import { worldTest, expect } from '@gameengine/test';
import type { WorldInputEvent } from '@gameengine/runtime';
import campaign from '../data/levels.json';
import { State } from '../src/arcade/types';
import { preparePartyWave } from '../src/arcade/party';
import { hurtPlayer } from '../src/arcade/player';
import { createOnlineWaveGame } from '../src/online/rules';
import { copyGame, stepGame } from '../src/arcade/game';
import { compactOnlineNavigation, restoreOnlineNavigation } from '../src/online/navigation';
import { applyWorldEvents, createWorldState, advanceWorld, stepWorld, worldHumanCount, WORLD_CONTROL_TIMEOUT, WORLD_ROOM_LIMIT, WORLD_TAKEOVER_DELAY } from '../src/online/world-rules';
import { projectWorld, isPublicWorld } from '../src/online/world-public';
const join = (player: number): WorldInputEvent => ({ kind: 'join', player, name: `Visitor ${player}` });
const intent = (player: number, data: unknown): WorldInputEvent => ({ kind: 'input', player, data });
const apply = (state: ReturnType<typeof createWorldState>, events: WorldInputEvent[]) => applyWorldEvents(state, events, campaign);

worldTest('world solo starts immediately with one dragon and midbattle joins preserve wave state', () => {
  let state = advanceWorld(createWorldState(), [join(0), intent(0, { action: 'create' })], campaign);
  const first = state.rooms[0]!;
  expect(first.game.Players.filter(player => player.Lives > 0).length).toBe(1);
  expect(first.owners).toEqual([0, null, null, null, null, null, null, null, null, null]);
  expect(first.game.Party!.Slots).toEqual(['human', ...Array(9).fill('empty')]);
  first.game.Party!.Timer = 1;
  state = stepWorld(state);
  const before = JSON.stringify(state), tick = state.rooms[0]!.game.Tick, enemies = JSON.stringify(state.rooms[0]!.game.Enemies);
  const next = apply(state, [join(1), intent(1, { action: 'join', room: first.id })]);
  expect(next.rooms[0]!.game.Tick).toBe(tick);
  expect(JSON.stringify(next.rooms[0]!.game.Enemies)).toBe(enemies);
  expect(next.rooms[0]!.game.Party!.Phase).toBe('combat');
  expect(next.rooms[0]!.game.Players[1]!.Lives).toBe(1);
  expect(next.rooms[0]!.owners[1]).toBe(1);
  expect(JSON.stringify(state)).toBe(before);
});

worldTest('world full rooms reject joins atomically and pending departures remain claimable', () => {
  let state = apply(createWorldState(), [join(0), intent(0, { action: 'create' })]);
  const id = state.rooms[0]!.id;
  for (let player = 1; player < 10; player++) state = apply(state, [join(player), intent(player, { action: 'join', room: id })]);
  expect(worldHumanCount(state.rooms[0]!)).toBe(10);
  state = apply(state, [join(10), intent(10, { action: 'create' })]);
  const ownRoom = state.peers.find(peer => peer.player === 10)!.room;
  state = apply(state, [intent(10, { action: 'join', room: id })]);
  expect(state.peers.find(peer => peer.player === 10)!.room).toBe(ownRoom);
  expect(state.peers.find(peer => peer.player === 10)!.error!.includes('ten human')).toBe(true);
  const game = state.rooms[0]!.game;
  game.Players[9]!.X = 333; game.Players[9]!.Power.Shoes = true;
  state = apply(state, [{ kind: 'leave', player: 9 }]);
  expect(state.rooms[0]!.game.Party!.Slots[9]).toBe('human');
  expect(state.rooms[0]!.game.Companions![9]).toBe(null);
  expect(state.rooms[0]!.pendingTakeovers[0]!.slot).toBe(9);
  expect(state.rooms[0]!.game.Players[9]!.X).toBe(333);
  expect(state.rooms[0]!.notices.slice(-1)[0]!.label).toBe('P10 FLINT');
  expect(state.rooms[0]!.notices.slice(-1)[0]!.kind).toBe('leave');
  expect(state.rooms[0]!.notices.length).toBe(11);
  state = apply(state, [join(9), intent(9, { action: 'join', room: id })]);
  expect(state.rooms[0]!.owners[9]).toBe(9);
  expect(state.rooms[0]!.game.Companions![9]).toBe(null);
  expect(state.rooms[0]!.game.Players[9]!.X).toBe(333);
  expect(state.rooms[0]!.game.Players[9]!.Power.Shoes).toBe(true);
  expect(state.rooms[0]!.pendingTakeovers.length).toBe(0);
  expect(state.peers.find(peer => peer.player === 9)!.error).toBe(undefined);
});

worldTest('world AI takeover waits exactly five simulated seconds with a public countdown', () => {
  let state = apply(createWorldState(), [join(0), join(1), intent(0, { action: 'create' })]);
  state = apply(state, [intent(1, { action: 'join', room: state.rooms[0]!.id }), intent(0, { action: 'controls', move: 1, jump: true, fire: true })]);
  for (const player of state.rooms[0]!.game.Players) player.Invincible = 2000;
  const dragon = state.rooms[0]!.game.Players[0]!; dragon.Lives = 2; dragon.Power.Shoes = true;
  const actor = JSON.stringify(dragon), old = JSON.stringify(state);
  let next = apply(state, [{ kind: 'leave', player: 0 }]);
  expect(JSON.stringify(state)).toBe(old);
  expect(JSON.stringify(next.rooms[0]!.game.Players[0])).toBe(actor);
  expect(projectWorld(next).rooms[0]!.pendingTakeovers).toEqual([{ slot: 0, label: 'P1 BUB', remainingTicks: 300 }]);
  expect(isPublicWorld(projectWorld(next))).toBe(true);
  for (let tick = 1; tick < WORLD_TAKEOVER_DELAY; tick++) next = stepWorld(next);
  expect(next.rooms[0]!.game.Party!.Slots[0]).toBe('human');
  expect(next.rooms[0]!.game.Companions![0]).toBe(null);
  expect(next.rooms[0]!.game.Counters.Blown).toBe(0);
  expect(next.rooms[0]!.game.Counters.Jumps).toBe(0);
  expect(next.rooms[0]!.game.Tick).toBe(299);
  expect(projectWorld(next).rooms[0]!.pendingTakeovers[0]!.remainingTicks).toBe(1);
  next = stepWorld(next);
  expect(next.rooms[0]!.game.Party!.Slots[0]).toBe('ai');
  expect(!!next.rooms[0]!.game.Companions![0]).toBe(true);
  expect(next.rooms[0]!.pendingTakeovers.length).toBe(0);
  expect(next.rooms[0]!.game.Tick).toBe(300);
  expect(next.rooms[0]!.owners[1]).toBe(1);
  expect(next.rooms[0]!.game.Players[0]!.Lives).toBe(2);
  expect(next.rooms[0]!.game.Players[0]!.Power.Shoes).toBe(true);
});

worldTest('world claiming a pending dragon cancels takeover without respawning or restoring health', () => {
  let state = apply(createWorldState(), [join(0), intent(0, { action: 'create' })]);
  state.rooms[0]!.game.Players[0]!.Invincible = 2000;
  state.rooms[0]!.game.Players[0]!.Power.Shoes = true;
  state = apply(state, [intent(0, { action: 'leave' })]);
  for (let tick = 0; tick < 100; tick++) state = stepWorld(state);
  const before = JSON.stringify(state.rooms[0]!.game.Players[0]);
  state = apply(state, [join(2), intent(2, { action: 'join', room: state.rooms[0]!.id })]);
  expect(state.rooms[0]!.owners[0]).toBe(2);
  expect(state.rooms[0]!.pendingTakeovers.length).toBe(0);
  expect(JSON.stringify(state.rooms[0]!.game.Players[0])).toBe(before);
  for (let tick = 0; tick < 210; tick++) state = stepWorld(state);
  expect(state.rooms[0]!.game.Party!.Slots[0]).toBe('human');
  expect(state.rooms[0]!.game.Companions![0]).toBe(null);
  expect(state.rooms[0]!.game.Players[0]!.Power.Shoes).toBe(true);
});

worldTest('world stale controls only neutralize a connected human and ended rooms cancel countdowns', () => {
  let state = apply(createWorldState(), [join(0), intent(0, { action: 'create' }), intent(0, { action: 'controls', move: 1, jump: false, fire: true })]);
  state.rooms[0]!.game.Players[0]!.Invincible = 2000;
  for (let tick = 0; tick < WORLD_TAKEOVER_DELAY + 1; tick++) state = stepWorld(state);
  expect(state.peers[0]!.input).toEqual({ Move: 0, Jump: false, Fire: false });
  expect(state.rooms[0]!.owners[0]).toBe(0);
  expect(state.rooms[0]!.game.Party!.Slots[0]).toBe('human');
  expect(state.rooms[0]!.pendingTakeovers.length).toBe(0);
  state = apply(state, [intent(0, { action: 'leave' })]);
  expect(state.rooms[0]!.pendingTakeovers.length).toBe(1);
  state.rooms[0]!.game.State = State.GameOver;
  state = stepWorld(state);
  expect(state.rooms[0]!.pendingTakeovers.length).toBe(0);
  expect(state.rooms[0]!.game.Companions![0]).toBe(null);
});

worldTest('world controls use server identity clamp movement and expire held inputs', () => {
  let state = apply(createWorldState(), [join(0), join(1), intent(0, { action: 'create' })]);
  state = apply(state, [intent(1, { action: 'join', room: state.rooms[0]!.id }), intent(0, { action: 'controls', player: 1, slot: 1, move: 100, jump: true, fire: true })]);
  expect(state.peers[0]!.input).toEqual({ Move: 1, Jump: true, Fire: true });
  expect(state.peers[1]!.input).toEqual({ Move: 0, Jump: false, Fire: false });
  for (const data of [null, [], {}, { action: 'controls', move: NaN, jump: true, fire: true }, { action: 'controls', move: 0, jump: 'yes', fire: true }, { action: 'join', room: 0 }]) state = apply(state, [intent(0, data)]);
  expect(state.peers[0]!.input.Move).toBe(1);
  state.tick = WORLD_CONTROL_TIMEOUT - 1;
  state = stepWorld(state);
  expect(state.peers[0]!.input).toEqual({ Move: 0, Jump: false, Fire: false });
  expect(state.peers[0]!.jumpPulse).toBe(false); expect(state.peers[0]!.firePulse).toBe(false);
  state = apply(state, [{ kind: 'leave', player: 0 }, intent(0, { action: 'create' })]);
  expect(state.peers.some(peer => peer.player === 0)).toBe(false);
  expect(state.rooms.length).toBe(1);
});

worldTest('world fresh join can rescue a downed dragon without resetting battle', () => {
  let state = apply(createWorldState(), [join(0), intent(0, { action: 'create' })]);
  const room = state.rooms[0]!, game = room.game;
  game.Party!.Timer = 1;
  game.Players[0]!.Invincible = 0; hurtPlayer(game, 0);
  game.Players[0]!.X = game.Players[1]!.X; game.Players[0]!.Y = game.Players[1]!.Y;
  state = advanceWorld(state, [join(1), intent(1, { action: 'join', room: room.id })], campaign);
  expect(state.rooms[0]!.game.Players[0]!.Downed).toBe(false);
  expect(state.rooms[0]!.game.Players[1]!.Lives).toBe(1);
  expect(state.rooms[0]!.game.State).toBe(State.Playing);
});

worldTest('world room cap evicts empty or ended sessions but never running occupied rooms', () => {
  let state = createWorldState();
  for (let player = 0; player < WORLD_ROOM_LIMIT + 1; player++) state = apply(state, [join(player), intent(player, { action: 'create' })]);
  expect(state.rooms.length).toBe(WORLD_ROOM_LIMIT);
  expect(state.peers[WORLD_ROOM_LIMIT]!.room).toBe(null);
  expect(state.peers[WORLD_ROOM_LIMIT]!.error!.includes('four active')).toBe(true);
  const id = state.rooms[0]!.id;
  state = apply(state, [intent(0, { action: 'leave' }), intent(WORLD_ROOM_LIMIT, { action: 'create' })]);
  expect(state.rooms.length).toBe(WORLD_ROOM_LIMIT);
  expect(state.rooms.some(room => room.id === id)).toBe(false);
  expect(state.peers[WORLD_ROOM_LIMIT]!.error).toBe(undefined);
  state.rooms[0]!.game.State = State.GameOver;
  state = apply(state, [intent(0, { action: 'join', room: state.rooms[0]!.id })]);
  expect(state.peers[0]!.room).toBe(null);
  const terminal = state.rooms[0]!.id;
  state = apply(state, [intent(0, { action: 'create' })]);
  expect(state.rooms.some(room => room.id === terminal)).toBe(false);
});

worldTest('world batched press release delivers exactly one jump and fire without held input', () => {
  let state = apply(createWorldState(), [join(0), intent(0, { action: 'create' })]);
  state.rooms[0]!.game.Party!.Timer = 1;
  state = stepWorld(state);
  expect(state.rooms[0]!.game.Party!.Phase).toBe('combat');
  state = apply(state, [intent(0, { action: 'controls', move: 0, jump: true, fire: true }), intent(0, { action: 'controls', move: 0, jump: false, fire: false })]);
  expect(state.peers[0]!.input).toEqual({ Move: 0, Jump: false, Fire: false });
  expect(state.peers[0]!.jumpPulse).toBe(true); expect(state.peers[0]!.firePulse).toBe(true);
  state = stepWorld(state);
  expect(state.rooms[0]!.game.Counters.Jumps).toBe(1);
  expect(state.rooms[0]!.game.Counters.Blown).toBe(1);
  expect(state.peers[0]!.jumpPulse).toBe(false); expect(state.peers[0]!.firePulse).toBe(false);
  for (let tick = 0; tick < 30; tick++) state = stepWorld(state);
  expect(state.rooms[0]!.game.Counters.Jumps).toBe(1);
  expect(state.rooms[0]!.game.Counters.Blown).toBe(1);
  expect(state.rooms[0]!.game.Players[0]!.LastJump).toBe(false);
});

worldTest('world private compact game document sizes are measured at start combat and boss', () => {
  let game = createOnlineWaveGame(campaign, { players: 2, seed: '42', mode: 'realtime' });
  compactOnlineNavigation(game);
  const sizes: Record<string, number> = { initial: JSON.stringify(game).length };
  for (let frame = 0; frame < 240; frame++) {
    game = copyGame(game); restoreOnlineNavigation(game);
    for (const player of game.Players) player.Invincible = 600;
    stepGame(game, game.Players.map(() => ({ Move: 0, Jump: false, Fire: true })));
    compactOnlineNavigation(game);
  }
  sizes.combat = JSON.stringify(game).length;
  game = copyGame(game); restoreOnlineNavigation(game); game.Party!.Wave = 10; preparePartyWave(game); compactOnlineNavigation(game);
  sizes.boss = JSON.stringify(game).length;
  console.log(`Private compact GameState JSON bytes (ASCII fixture): ${JSON.stringify(sizes)}`);
  expect(sizes.combat).toBeGreaterThan(sizes.initial!);
});
