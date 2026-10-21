import { expect, renderTest } from '@gameengine/test';
import { multiplayer, type WorldConnection, type WorldEvent } from '@gameengine/runtime';
import campaign from '../data/levels.json';
import { DesktopIntent } from '../src/schema.gen';
import { session } from '../src/arcade/session';
import { State } from '../src/arcade/types';
import { applyWorldEvents, createWorldState, type WorldState } from '../src/online/world-rules';
import { projectWorld } from '../src/online/world-public';
import { clientWorldView } from '../src/online/world-system';

const scene = 'scenes/arcade.scene.json';
function createRoom(player = 7): WorldState {
  return applyWorldEvents(createWorldState(), [{ kind: 'join', player, name: 'PLAYER' }, { kind: 'input', player, data: { action: 'create' } }], campaign);
}
function transportMock() {
  const handlers: ((event: WorldEvent) => void)[] = [], sent: unknown[] = [];
  let count = 0;
  const connect = async (): Promise<WorldConnection> => {
    const player = 7 + count++;
    return { send: value => { sent.push(value); }, poll: () => [], close: () => {}, subscribe: handler => { handlers.push(handler); handler({ kind: 'welcome', player, version: 1 }); return () => {}; } };
  };
  return { handlers, sent, connect };
}

renderTest('world client new game cannot reopen old results while creation waits for a snapshot', async ({ input, step, ui, render }) => {
  input.view(768, 720, 1);
  const original = multiplayer.world.connect, mock = transportMock();
  try {
    multiplayer.world.connect = mock.connect;
    await step(4); input.emit(DesktopIntent, { action: 'online-mode' }); await step(5); render.stats({ width: 768, height: 720 });
    await ui.press(ui.interactables().find(button => button.label === 'START GAME NOW')!.id!); await step(3);
    const state = createRoom(); state.tick = 100; state.rooms[0]!.game.State = State.GameOver;
    mock.handlers[0]!({ kind: 'snapshot', tick: 100, document: projectWorld(state) }); await step(4); render.stats({ width: 768, height: 720 });
    expect(ui.interactables().some(button => button.label === 'BROWSE GAMES')).toBe(true);
    expect(ui.interactables().some(button => button.label === 'NEW GAME')).toBe(false);
    await step(184);render.stats({width:768,height:720});
    await ui.press(ui.interactables().find(button => button.label === 'VIEW RESULTS')!.id!);await step(2);render.stats({width:768,height:720});
    await ui.press(ui.interactables().find(button => button.label === 'NEW GAME')!.id!); await step(2); render.stats({ width: 768, height: 720 });
    await ui.press(ui.interactables().find(button => button.label === 'START GAME NOW')!.id!); await step(2);
    // This was already in flight when the create intent was sent; it still owns the old room.
    state.tick = 101; mock.handlers[0]!({ kind: 'snapshot', tick: 101, document: projectWorld(state) }); await step(4); render.stats({ width: 768, height: 720 });
    expect(ui.interactables().some(button => button.label === 'NEW GAME')).toBe(false);
    expect(ui.interactables().some(button => button.label === 'MENU')).toBe(false);
    const next = applyWorldEvents(state, [{ kind: 'input', player: 7, data: { action: 'leave' } }, { kind: 'input', player: 7, data: { action: 'create' } }], campaign);
    next.tick = 102; mock.handlers[0]!({ kind: 'snapshot', tick: 102, document: projectWorld(next) }); await step(4); render.stats({ width: 768, height: 720 });
    expect(clientWorldView.get().room).toBe('room-2');
    expect(session.get().game!.State).toBe(State.Playing);
    expect(ui.interactables().some(button => button.label === 'MENU')).toBe(true);
  } finally { multiplayer.world.connect = original; }
}, { scene });

renderTest('world client evicted room returns to browsing when the public peer row is absent', async ({ input, step, ui, render }) => {
  input.view(768, 720, 1);
  const original = multiplayer.world.connect, mock = transportMock();
  try {
    multiplayer.world.connect = mock.connect;
    await step(4); input.emit(DesktopIntent, { action: 'online-mode' }); await step(5); render.stats({ width: 768, height: 720 });
    await ui.press(ui.interactables().find(button => button.label === 'START GAME NOW')!.id!); await step(3);
    const state = createRoom(); state.tick = 50;
    mock.handlers[0]!({ kind: 'snapshot', tick: 50, document: projectWorld(state) }); await step(4); render.stats({ width: 768, height: 720 });
    expect(ui.interactables().some(button => button.label === 'MENU')).toBe(true);
    mock.handlers[0]!({ kind: 'snapshot', tick: 51, document: { version: 1, tick: 51, rooms: [], peers: [] } }); await step(5); render.stats({ width: 768, height: 720 });
    expect(session.get().active).toBe(false);
    expect(ui.interactables().some(button => button.label === 'NEW GAME')).toBe(true);
    expect(ui.interactables().some(button => button.label === 'BACK')).toBe(true);
    expect(ui.interactables().some(button => button.label === 'MENU')).toBe(false);
  } finally { multiplayer.world.connect = original; }
}, { scene });

renderTest('world client reconnect accepts a restarted tick and ignores the closed connection snapshots', async ({ input, step, ui, render }) => {
  input.view(768, 720, 1);
  const original = multiplayer.world.connect, mock = transportMock();
  try {
    multiplayer.world.connect = mock.connect;
    await step(4); input.emit(DesktopIntent, { action: 'online-mode' }); await step(5); render.stats({ width: 768, height: 720 });
    await ui.press(ui.interactables().find(button => button.label === 'START GAME NOW')!.id!); await step(3);
    const old = createRoom(); old.tick = 200;
    mock.handlers[0]!({ kind: 'snapshot', tick: 200, document: projectWorld(old) }); await step(4);
    mock.handlers[0]!({ kind: 'closed', reason: 'server restarted' }); await step(4); render.stats({ width: 768, height: 720 });
    expect(session.get().active).toBe(false);
    await ui.press(ui.interactables().find(button => button.label === 'NEW GAME')!.id!); await step(2); render.stats({ width: 768, height: 720 });
    await ui.press(ui.interactables().find(button => button.label === 'START GAME NOW')!.id!); await step(4);
    expect(mock.handlers.length).toBe(2);
    const restarted = createRoom(8); restarted.tick = 1;
    mock.handlers[1]!({ kind: 'snapshot', tick: 1, document: projectWorld(restarted) });
    old.tick = 300; mock.handlers[0]!({ kind: 'snapshot', tick: 300, document: projectWorld(old) });
    await step(5); render.stats({ width: 768, height: 720 });
    expect(clientWorldView.get().player).toBe(8); expect(clientWorldView.get().tick).toBe(1);
    expect(session.get().active).toBe(true);
    expect(ui.interactables().some(button => button.label === 'MENU')).toBe(true);
  } finally { multiplayer.world.connect = original; }
}, { scene });
