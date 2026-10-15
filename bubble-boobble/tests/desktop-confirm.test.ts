import { expect, worldTest } from '@gameengine/test';
import { DesktopIntent } from '../src/schema.gen';
import { desktopState, desktopGameRequest } from '../src/desktop/state';
const scene = 'scenes/arcade.scene.json';
worldTest('desktop physical Enter opens title and activates the selected menu item once', async ({ input, step }) => {
  await step(3); expect(desktopState.get().screen).toBe('title');
  input.key(38, true); await step(1); expect(desktopState.get().screen).toBe('menu');
  await step(3); expect(desktopState.get().screen).toBe('menu');
  input.key(38, false); await step(1);
  input.key(53, true); await step(1); input.key(53, false); await step(1);
  expect(desktopState.get().selected).toBe(1);
  input.key(38, true); await step(1); expect(desktopState.get().screen).toBe('settings');
  input.key(38, false); await step(1);
  input.emit(DesktopIntent, { action: 'menu' }); await step(1);
  input.key(38, true); await step(1); expect(desktopState.get().screen).toBe('modes');
  input.key(38, false); await step(1); input.key(38, true); await step(1); expect(desktopState.get().screen).toBe('play');
  expect(desktopGameRequest.get().action).toBe('start');
}, { scene });
worldTest('desktop physical Enter tap between simulation steps is not dropped', async ({ input, step }) => {
  await step(3);
  input.key(38, true); input.key(38, false); await step(1);
  expect(desktopState.get().screen).toBe('menu');
}, { scene });
worldTest('desktop short Enter taps confirm settings mode and start AI co-op', async ({ input, step }) => {
  await step(3);
  const tap = async () => { input.key(38, true); input.key(38, false); await step(1); };
  await tap();
  input.emit(DesktopIntent, { action: 'select', index: 1 }); await step(1); await tap();
  expect(desktopState.get().screen).toBe('settings');
  input.emit(DesktopIntent, { action: 'select', index: 4 }); await step(1); await tap();
  expect(desktopState.get().playMode).toBe('ai');
  input.emit(DesktopIntent, { action: 'menu' }); await step(1); await tap();
  expect(desktopState.get().screen).toBe('modes'); await tap();
  expect(desktopState.get().screen).toBe('play'); expect(desktopGameRequest.get().mode).toBe('ai');
}, { scene });
worldTest('desktop repeat Enter events activate once until release', async ({ input, step }) => {
  await step(3);
  input.key(38, true); await step(1); expect(desktopState.get().screen).toBe('menu');
  for (let i = 0; i < 5; i++) { input.key(38, true); await step(1); }
  expect(desktopState.get().screen).toBe('menu');
  input.key(38, false); await step(1); input.key(38, true); await step(1);
  expect(desktopState.get().screen).toBe('modes');
}, { scene });
worldTest('desktop short Space taps confirm menus while profile Space remains text', async ({ input, step }) => {
  await step(3);
  input.key(37, true); input.key(37, false); await step(1); expect(desktopState.get().screen).toBe('menu');
  input.emit(DesktopIntent, { action: 'new-profile' }); await step(1);
  input.key(37, true); input.key(37, false); await step(1);
  expect(desktopState.get().name).toBe('');
  input.key(38, true); input.key(38, false); await step(1);
  expect(desktopState.get().name).toBe('A');
}, { scene });
