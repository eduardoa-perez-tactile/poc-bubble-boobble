import { component, f32, f64, i32, bool, event, resource, u32 } from '@gameengine/schema';

export const Game = resource('Game', { score: u32({ doc: 'Bubbles popped' }), spawned: u32() }, { sim: true });

export const Bubble = component('Bubble', { radius: f32(), speed: f32({ doc: 'Units per step' }) }, { sim: true });

export const HarnessControl = resource('HarnessControl', { active: u32({ doc: 'Controlled starter scenario; suppresses random spawns' }) }, { sim: true });

// Authoritative coordinates use Go float64; transforms are presentation only.
export const PortPlayer = resource('PortPlayer', {
  x: f64(), y: f64(), vx: f64(), vy: f64(), ground: bool(),
  lives: i32({ default: 3 }), dir: i32({ default: 1 }),
  jumpBuffer: i32(), coyote: i32(), lastJump: bool(),
  invincible: i32(), dead: i32(), shoot: i32(), cooldown: i32(), walkFrame: i32(),
}, { sim: true });
export const PortMatch = resource('PortMatch', {
  active: bool(), tick: u32(), countdown: i32({ default: 60 }), ready: bool({ default: true }),
  paused: bool(), walked: f64(), jumps: u32(), jumpSound: bool(), skip: bool(),
}, { sim: true });
export const PortInput = resource('PortInput', { move: i32(), jump: bool() }, { sim: true });
export const MovementInput = event('MovementInput', { move: i32(), jump: bool(), paused: bool() }, { sim: true });
export const PortVisual = component('PortVisual', {}, { sim: true });
