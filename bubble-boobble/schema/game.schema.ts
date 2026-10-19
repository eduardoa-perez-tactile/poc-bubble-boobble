import { component, array, f32, f64, i32, bool, string, event, resource, u32 } from '@gameengine/schema';

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

export const DesktopIntent = event('DesktopIntent', { action: string(), value: string(), index: i32(), x: i32(), y: i32() }, { sim: true });
export const ArcadeVisual = component('ArcadeVisual', { slot: u32() }, { sim: true });
export const ArcadeControl = resource('ArcadeControl', { active: bool(), skip: bool(), requestSequence: u32() }, { sim: true });
export const ArcadeInput = event('ArcadeInput', { player: u32(), move: i32(), jump: bool(), fire: bool(), paused: bool() }, { sim: true });

export const ArcadeAudio = resource('ArcadeAudio', { track: string(), native: bool(), muted: bool(), music: i32({default:-1}), sound: i32({default:-1}), sfxPriority: i32({default:2147483647,doc:'Strictly descending SFX priorities preserve older voices at the 24-slot cap; mute safely resets after bank unload'}), paused: bool(), exitSequence: u32() }, { sim:true });
export const EditorPointer = resource('EditorPointer', { drawing: bool(), erasing: bool(), col: i32({default:-1}), row: i32({default:-1}) }, { sim:true });

export const ArcadePlatformState = resource('ArcadePlatformState', { exitSequence:u32() }, { sim:false });

// Bounded cosmetic history is never read by simulation or included in replay hashes.
export const ArcadeFeel = resource('ArcadeFeel', {
 // clock, step, initialized, prior tick/wave/phase/state/HP/mode, player/cue counts.
 header:array(f64(),12),
 playerX:array(f64(),10),playerY:array(f64(),10),playerVY:array(f64(),10),
 playerFlags:array(i32(),10),playerDir:array(i32(),10),playerLives:array(i32(),10),
 cueKind:array(i32(),32),cueX:array(f64(),32),cueY:array(f64(),32),
 cueAt:array(f64(),32),cueSlot:array(i32(),32),cueStrength:array(f64(),32),
}, { sim:false });
