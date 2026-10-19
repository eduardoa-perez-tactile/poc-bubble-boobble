// @generated — do not edit. Regenerate with `pnpm gen` (tools/bindgen).
import { typeToken, rowRead as $r, registerSchema, type EntityId } from '@gameengine/runtime';

export type { EntityId };

/** Project schema IR, registered with the engine when the bundle boots. */
export const schemaIr = {
  "version": 1,
  "package": "Bubble Madness",
  "enums": [],
  "types": [
    {
      "name": "ArcadeAudio",
      "kind": "resource",
      "sim": true,
      "fields": [
        {
          "name": "track",
          "kind": "string",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "native",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "muted",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "music",
          "kind": "i32",
          "scalar": "i32",
          "lanes": 1,
          "default": -1
        },
        {
          "name": "sound",
          "kind": "i32",
          "scalar": "i32",
          "lanes": 1,
          "default": -1
        },
        {
          "name": "sfxPriority",
          "kind": "i32",
          "scalar": "i32",
          "lanes": 1,
          "default": 2147483647,
          "doc": "Strictly descending SFX priorities preserve older voices at the 24-slot cap; mute safely resets after bank unload"
        },
        {
          "name": "paused",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "exitSequence",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        }
      ],
      "package": "Bubble Madness"
    },
    {
      "name": "ArcadeControl",
      "kind": "resource",
      "sim": true,
      "fields": [
        {
          "name": "active",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "skip",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "requestSequence",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        }
      ],
      "package": "Bubble Madness"
    },
    {
      "name": "ArcadeFeel",
      "kind": "resource",
      "sim": false,
      "fields": [
        {
          "name": "header",
          "kind": "array",
          "scalar": "f64",
          "lanes": 12
        },
        {
          "name": "playerX",
          "kind": "array",
          "scalar": "f64",
          "lanes": 10
        },
        {
          "name": "playerY",
          "kind": "array",
          "scalar": "f64",
          "lanes": 10
        },
        {
          "name": "playerVY",
          "kind": "array",
          "scalar": "f64",
          "lanes": 10
        },
        {
          "name": "playerFlags",
          "kind": "array",
          "scalar": "i32",
          "lanes": 10
        },
        {
          "name": "playerDir",
          "kind": "array",
          "scalar": "i32",
          "lanes": 10
        },
        {
          "name": "playerLives",
          "kind": "array",
          "scalar": "i32",
          "lanes": 10
        },
        {
          "name": "cueKind",
          "kind": "array",
          "scalar": "i32",
          "lanes": 32
        },
        {
          "name": "cueX",
          "kind": "array",
          "scalar": "f64",
          "lanes": 32
        },
        {
          "name": "cueY",
          "kind": "array",
          "scalar": "f64",
          "lanes": 32
        },
        {
          "name": "cueAt",
          "kind": "array",
          "scalar": "f64",
          "lanes": 32
        },
        {
          "name": "cueSlot",
          "kind": "array",
          "scalar": "i32",
          "lanes": 32
        },
        {
          "name": "cueStrength",
          "kind": "array",
          "scalar": "f64",
          "lanes": 32
        }
      ],
      "package": "Bubble Madness"
    },
    {
      "name": "ArcadeInput",
      "kind": "event",
      "sim": true,
      "fields": [
        {
          "name": "player",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "move",
          "kind": "i32",
          "scalar": "i32",
          "lanes": 1
        },
        {
          "name": "jump",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "fire",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "paused",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        }
      ],
      "package": "Bubble Madness"
    },
    {
      "name": "ArcadePlatformState",
      "kind": "resource",
      "sim": false,
      "fields": [
        {
          "name": "exitSequence",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        }
      ],
      "package": "Bubble Madness"
    },
    {
      "name": "ArcadeVisual",
      "kind": "component",
      "sim": true,
      "fields": [
        {
          "name": "slot",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        }
      ],
      "package": "Bubble Madness"
    },
    {
      "name": "Bubble",
      "kind": "component",
      "sim": true,
      "fields": [
        {
          "name": "radius",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "speed",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Units per step"
        }
      ],
      "package": "Bubble Madness"
    },
    {
      "name": "DesktopIntent",
      "kind": "event",
      "sim": true,
      "fields": [
        {
          "name": "action",
          "kind": "string",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "value",
          "kind": "string",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "index",
          "kind": "i32",
          "scalar": "i32",
          "lanes": 1
        },
        {
          "name": "x",
          "kind": "i32",
          "scalar": "i32",
          "lanes": 1
        },
        {
          "name": "y",
          "kind": "i32",
          "scalar": "i32",
          "lanes": 1
        }
      ],
      "package": "Bubble Madness"
    },
    {
      "name": "EditorPointer",
      "kind": "resource",
      "sim": true,
      "fields": [
        {
          "name": "drawing",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "erasing",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "col",
          "kind": "i32",
          "scalar": "i32",
          "lanes": 1,
          "default": -1
        },
        {
          "name": "row",
          "kind": "i32",
          "scalar": "i32",
          "lanes": 1,
          "default": -1
        }
      ],
      "package": "Bubble Madness"
    },
    {
      "name": "Game",
      "kind": "resource",
      "sim": true,
      "fields": [
        {
          "name": "score",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "doc": "Bubbles popped"
        },
        {
          "name": "spawned",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        }
      ],
      "package": "Bubble Madness"
    },
    {
      "name": "HarnessControl",
      "kind": "resource",
      "sim": true,
      "fields": [
        {
          "name": "active",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "doc": "Controlled starter scenario; suppresses random spawns"
        }
      ],
      "package": "Bubble Madness"
    },
    {
      "name": "MovementInput",
      "kind": "event",
      "sim": true,
      "fields": [
        {
          "name": "move",
          "kind": "i32",
          "scalar": "i32",
          "lanes": 1
        },
        {
          "name": "jump",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "paused",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        }
      ],
      "package": "Bubble Madness"
    },
    {
      "name": "PortInput",
      "kind": "resource",
      "sim": true,
      "fields": [
        {
          "name": "move",
          "kind": "i32",
          "scalar": "i32",
          "lanes": 1
        },
        {
          "name": "jump",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        }
      ],
      "package": "Bubble Madness"
    },
    {
      "name": "PortMatch",
      "kind": "resource",
      "sim": true,
      "fields": [
        {
          "name": "active",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "tick",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "countdown",
          "kind": "i32",
          "scalar": "i32",
          "lanes": 1,
          "default": 60
        },
        {
          "name": "ready",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1,
          "default": true
        },
        {
          "name": "paused",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "walked",
          "kind": "f64",
          "scalar": "f64",
          "lanes": 1
        },
        {
          "name": "jumps",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "jumpSound",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "skip",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        }
      ],
      "package": "Bubble Madness"
    },
    {
      "name": "PortPlayer",
      "kind": "resource",
      "sim": true,
      "fields": [
        {
          "name": "x",
          "kind": "f64",
          "scalar": "f64",
          "lanes": 1
        },
        {
          "name": "y",
          "kind": "f64",
          "scalar": "f64",
          "lanes": 1
        },
        {
          "name": "vx",
          "kind": "f64",
          "scalar": "f64",
          "lanes": 1
        },
        {
          "name": "vy",
          "kind": "f64",
          "scalar": "f64",
          "lanes": 1
        },
        {
          "name": "ground",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "lives",
          "kind": "i32",
          "scalar": "i32",
          "lanes": 1,
          "default": 3
        },
        {
          "name": "dir",
          "kind": "i32",
          "scalar": "i32",
          "lanes": 1,
          "default": 1
        },
        {
          "name": "jumpBuffer",
          "kind": "i32",
          "scalar": "i32",
          "lanes": 1
        },
        {
          "name": "coyote",
          "kind": "i32",
          "scalar": "i32",
          "lanes": 1
        },
        {
          "name": "lastJump",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "invincible",
          "kind": "i32",
          "scalar": "i32",
          "lanes": 1
        },
        {
          "name": "dead",
          "kind": "i32",
          "scalar": "i32",
          "lanes": 1
        },
        {
          "name": "shoot",
          "kind": "i32",
          "scalar": "i32",
          "lanes": 1
        },
        {
          "name": "cooldown",
          "kind": "i32",
          "scalar": "i32",
          "lanes": 1
        },
        {
          "name": "walkFrame",
          "kind": "i32",
          "scalar": "i32",
          "lanes": 1
        }
      ],
      "package": "Bubble Madness"
    },
    {
      "name": "PortVisual",
      "kind": "component",
      "sim": true,
      "fields": [],
      "package": "Bubble Madness"
    }
  ],
  "commands": [],
  "protocol": [],
  "services": []
} as const;
registerSchema(schemaIr);

export interface ArcadeAudioViews {
  track: Uint32Array;
  native: Uint8Array;
  muted: Uint8Array;
  music: Int32Array;
  sound: Int32Array;
  /** Strictly descending SFX priorities preserve older voices at the 24-slot cap; mute safely resets after bank unload */
  sfxPriority: Int32Array;
  paused: Uint8Array;
  exitSequence: Uint32Array;
}
export interface ArcadeAudioValue {
  track: string;
  native: boolean;
  muted: boolean;
  music: number;
  sound: number;
  /** Strictly descending SFX priorities preserve older voices at the 24-slot cap; mute safely resets after bank unload */
  sfxPriority: number;
  paused: boolean;
  exitSequence: number;
}
/** ArcadeAudio (resource, sim) */
export const ArcadeAudio = typeToken<ArcadeAudioViews, ArcadeAudioValue>('ArcadeAudio', 'resource', { sig: 'track:string:1,native:bool:1,muted:bool:1,music:i32:1,sound:i32:1,sfxPriority:i32:1,paused:bool:1,exitSequence:u32:1', read: (v: ArcadeAudioViews, i: number, o: Record<string, unknown>) => { o.track = $r.str(v.track[i]!); o.native = v.native[i] !== 0; o.muted = v.muted[i] !== 0; o.music = v.music[i]; o.sound = v.sound[i]; o.sfxPriority = v.sfxPriority[i]; o.paused = v.paused[i] !== 0; o.exitSequence = v.exitSequence[i]; return o; } });

export interface ArcadeControlViews {
  active: Uint8Array;
  skip: Uint8Array;
  requestSequence: Uint32Array;
}
export interface ArcadeControlValue {
  active: boolean;
  skip: boolean;
  requestSequence: number;
}
/** ArcadeControl (resource, sim) */
export const ArcadeControl = typeToken<ArcadeControlViews, ArcadeControlValue>('ArcadeControl', 'resource', { sig: 'active:bool:1,skip:bool:1,requestSequence:u32:1', read: (v: ArcadeControlViews, i: number, o: Record<string, unknown>) => { o.active = v.active[i] !== 0; o.skip = v.skip[i] !== 0; o.requestSequence = v.requestSequence[i]; return o; } });

export interface ArcadeFeelViews {
  header: Float64Array;
  playerX: Float64Array;
  playerY: Float64Array;
  playerVY: Float64Array;
  playerFlags: Int32Array;
  playerDir: Int32Array;
  playerLives: Int32Array;
  cueKind: Int32Array;
  cueX: Float64Array;
  cueY: Float64Array;
  cueAt: Float64Array;
  cueSlot: Int32Array;
  cueStrength: Float64Array;
}
export interface ArcadeFeelValue {
  header: number[];
  playerX: number[];
  playerY: number[];
  playerVY: number[];
  playerFlags: number[];
  playerDir: number[];
  playerLives: number[];
  cueKind: number[];
  cueX: number[];
  cueY: number[];
  cueAt: number[];
  cueSlot: number[];
  cueStrength: number[];
}
/** ArcadeFeel (resource, presentation-only) */
export const ArcadeFeel = typeToken<ArcadeFeelViews, ArcadeFeelValue>('ArcadeFeel', 'resource', { sig: 'header:array:12,playerX:array:10,playerY:array:10,playerVY:array:10,playerFlags:array:10,playerDir:array:10,playerLives:array:10,cueKind:array:32,cueX:array:32,cueY:array:32,cueAt:array:32,cueSlot:array:32,cueStrength:array:32', read: (v: ArcadeFeelViews, i: number, o: Record<string, unknown>) => { o.header = $r.lanes(v.header, i, 12, o.header); o.playerX = $r.lanes(v.playerX, i, 10, o.playerX); o.playerY = $r.lanes(v.playerY, i, 10, o.playerY); o.playerVY = $r.lanes(v.playerVY, i, 10, o.playerVY); o.playerFlags = $r.lanes(v.playerFlags, i, 10, o.playerFlags); o.playerDir = $r.lanes(v.playerDir, i, 10, o.playerDir); o.playerLives = $r.lanes(v.playerLives, i, 10, o.playerLives); o.cueKind = $r.lanes(v.cueKind, i, 32, o.cueKind); o.cueX = $r.lanes(v.cueX, i, 32, o.cueX); o.cueY = $r.lanes(v.cueY, i, 32, o.cueY); o.cueAt = $r.lanes(v.cueAt, i, 32, o.cueAt); o.cueSlot = $r.lanes(v.cueSlot, i, 32, o.cueSlot); o.cueStrength = $r.lanes(v.cueStrength, i, 32, o.cueStrength); return o; } });

export interface ArcadeInputViews {
  player: Uint32Array;
  move: Int32Array;
  jump: Uint8Array;
  fire: Uint8Array;
  paused: Uint8Array;
}
export interface ArcadeInputValue {
  player: number;
  move: number;
  jump: boolean;
  fire: boolean;
  paused: boolean;
}
/** ArcadeInput (event, sim) */
export const ArcadeInput = typeToken<ArcadeInputViews, ArcadeInputValue>('ArcadeInput', 'event', { sig: 'player:u32:1,move:i32:1,jump:bool:1,fire:bool:1,paused:bool:1', read: (v: ArcadeInputViews, i: number, o: Record<string, unknown>) => { o.player = v.player[i]; o.move = v.move[i]; o.jump = v.jump[i] !== 0; o.fire = v.fire[i] !== 0; o.paused = v.paused[i] !== 0; return o; } });

export interface ArcadePlatformStateViews {
  exitSequence: Uint32Array;
}
export interface ArcadePlatformStateValue {
  exitSequence: number;
}
/** ArcadePlatformState (resource, presentation-only) */
export const ArcadePlatformState = typeToken<ArcadePlatformStateViews, ArcadePlatformStateValue>('ArcadePlatformState', 'resource', { sig: 'exitSequence:u32:1', read: (v: ArcadePlatformStateViews, i: number, o: Record<string, unknown>) => { o.exitSequence = v.exitSequence[i]; return o; } });

export interface ArcadeVisualViews {
  slot: Uint32Array;
}
export interface ArcadeVisualValue {
  slot: number;
}
/** ArcadeVisual (component, sim) */
export const ArcadeVisual = typeToken<ArcadeVisualViews, ArcadeVisualValue>('ArcadeVisual', 'component', { sig: 'slot:u32:1', read: (v: ArcadeVisualViews, i: number, o: Record<string, unknown>) => { o.slot = v.slot[i]; return o; } });

export interface BubbleViews {
  radius: Float32Array;
  /** Units per step */
  speed: Float32Array;
}
export interface BubbleValue {
  radius: number;
  /** Units per step */
  speed: number;
}
/** Bubble (component, sim) */
export const Bubble = typeToken<BubbleViews, BubbleValue>('Bubble', 'component', { sig: 'radius:f32:1,speed:f32:1', read: (v: BubbleViews, i: number, o: Record<string, unknown>) => { o.radius = v.radius[i]; o.speed = v.speed[i]; return o; } });

export interface DesktopIntentViews {
  action: Uint32Array;
  value: Uint32Array;
  index: Int32Array;
  x: Int32Array;
  y: Int32Array;
}
export interface DesktopIntentValue {
  action: string;
  value: string;
  index: number;
  x: number;
  y: number;
}
/** DesktopIntent (event, sim) */
export const DesktopIntent = typeToken<DesktopIntentViews, DesktopIntentValue>('DesktopIntent', 'event', { sig: 'action:string:1,value:string:1,index:i32:1,x:i32:1,y:i32:1', read: (v: DesktopIntentViews, i: number, o: Record<string, unknown>) => { o.action = $r.str(v.action[i]!); o.value = $r.str(v.value[i]!); o.index = v.index[i]; o.x = v.x[i]; o.y = v.y[i]; return o; } });

export interface EditorPointerViews {
  drawing: Uint8Array;
  erasing: Uint8Array;
  col: Int32Array;
  row: Int32Array;
}
export interface EditorPointerValue {
  drawing: boolean;
  erasing: boolean;
  col: number;
  row: number;
}
/** EditorPointer (resource, sim) */
export const EditorPointer = typeToken<EditorPointerViews, EditorPointerValue>('EditorPointer', 'resource', { sig: 'drawing:bool:1,erasing:bool:1,col:i32:1,row:i32:1', read: (v: EditorPointerViews, i: number, o: Record<string, unknown>) => { o.drawing = v.drawing[i] !== 0; o.erasing = v.erasing[i] !== 0; o.col = v.col[i]; o.row = v.row[i]; return o; } });

export interface GameViews {
  /** Bubbles popped */
  score: Uint32Array;
  spawned: Uint32Array;
}
export interface GameValue {
  /** Bubbles popped */
  score: number;
  spawned: number;
}
/** Game (resource, sim) */
export const Game = typeToken<GameViews, GameValue>('Game', 'resource', { sig: 'score:u32:1,spawned:u32:1', read: (v: GameViews, i: number, o: Record<string, unknown>) => { o.score = v.score[i]; o.spawned = v.spawned[i]; return o; } });

export interface HarnessControlViews {
  /** Controlled starter scenario; suppresses random spawns */
  active: Uint32Array;
}
export interface HarnessControlValue {
  /** Controlled starter scenario; suppresses random spawns */
  active: number;
}
/** HarnessControl (resource, sim) */
export const HarnessControl = typeToken<HarnessControlViews, HarnessControlValue>('HarnessControl', 'resource', { sig: 'active:u32:1', read: (v: HarnessControlViews, i: number, o: Record<string, unknown>) => { o.active = v.active[i]; return o; } });

export interface MovementInputViews {
  move: Int32Array;
  jump: Uint8Array;
  paused: Uint8Array;
}
export interface MovementInputValue {
  move: number;
  jump: boolean;
  paused: boolean;
}
/** MovementInput (event, sim) */
export const MovementInput = typeToken<MovementInputViews, MovementInputValue>('MovementInput', 'event', { sig: 'move:i32:1,jump:bool:1,paused:bool:1', read: (v: MovementInputViews, i: number, o: Record<string, unknown>) => { o.move = v.move[i]; o.jump = v.jump[i] !== 0; o.paused = v.paused[i] !== 0; return o; } });

export interface PortInputViews {
  move: Int32Array;
  jump: Uint8Array;
}
export interface PortInputValue {
  move: number;
  jump: boolean;
}
/** PortInput (resource, sim) */
export const PortInput = typeToken<PortInputViews, PortInputValue>('PortInput', 'resource', { sig: 'move:i32:1,jump:bool:1', read: (v: PortInputViews, i: number, o: Record<string, unknown>) => { o.move = v.move[i]; o.jump = v.jump[i] !== 0; return o; } });

export interface PortMatchViews {
  active: Uint8Array;
  tick: Uint32Array;
  countdown: Int32Array;
  ready: Uint8Array;
  paused: Uint8Array;
  walked: Float64Array;
  jumps: Uint32Array;
  jumpSound: Uint8Array;
  skip: Uint8Array;
}
export interface PortMatchValue {
  active: boolean;
  tick: number;
  countdown: number;
  ready: boolean;
  paused: boolean;
  walked: number;
  jumps: number;
  jumpSound: boolean;
  skip: boolean;
}
/** PortMatch (resource, sim) */
export const PortMatch = typeToken<PortMatchViews, PortMatchValue>('PortMatch', 'resource', { sig: 'active:bool:1,tick:u32:1,countdown:i32:1,ready:bool:1,paused:bool:1,walked:f64:1,jumps:u32:1,jumpSound:bool:1,skip:bool:1', read: (v: PortMatchViews, i: number, o: Record<string, unknown>) => { o.active = v.active[i] !== 0; o.tick = v.tick[i]; o.countdown = v.countdown[i]; o.ready = v.ready[i] !== 0; o.paused = v.paused[i] !== 0; o.walked = v.walked[i]; o.jumps = v.jumps[i]; o.jumpSound = v.jumpSound[i] !== 0; o.skip = v.skip[i] !== 0; return o; } });

export interface PortPlayerViews {
  x: Float64Array;
  y: Float64Array;
  vx: Float64Array;
  vy: Float64Array;
  ground: Uint8Array;
  lives: Int32Array;
  dir: Int32Array;
  jumpBuffer: Int32Array;
  coyote: Int32Array;
  lastJump: Uint8Array;
  invincible: Int32Array;
  dead: Int32Array;
  shoot: Int32Array;
  cooldown: Int32Array;
  walkFrame: Int32Array;
}
export interface PortPlayerValue {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ground: boolean;
  lives: number;
  dir: number;
  jumpBuffer: number;
  coyote: number;
  lastJump: boolean;
  invincible: number;
  dead: number;
  shoot: number;
  cooldown: number;
  walkFrame: number;
}
/** PortPlayer (resource, sim) */
export const PortPlayer = typeToken<PortPlayerViews, PortPlayerValue>('PortPlayer', 'resource', { sig: 'x:f64:1,y:f64:1,vx:f64:1,vy:f64:1,ground:bool:1,lives:i32:1,dir:i32:1,jumpBuffer:i32:1,coyote:i32:1,lastJump:bool:1,invincible:i32:1,dead:i32:1,shoot:i32:1,cooldown:i32:1,walkFrame:i32:1', read: (v: PortPlayerViews, i: number, o: Record<string, unknown>) => { o.x = v.x[i]; o.y = v.y[i]; o.vx = v.vx[i]; o.vy = v.vy[i]; o.ground = v.ground[i] !== 0; o.lives = v.lives[i]; o.dir = v.dir[i]; o.jumpBuffer = v.jumpBuffer[i]; o.coyote = v.coyote[i]; o.lastJump = v.lastJump[i] !== 0; o.invincible = v.invincible[i]; o.dead = v.dead[i]; o.shoot = v.shoot[i]; o.cooldown = v.cooldown[i]; o.walkFrame = v.walkFrame[i]; return o; } });

export type PortVisualViews = Record<string, never>;
export type PortVisualValue = Record<string, never>;
/** PortVisual (component, sim) */
export const PortVisual = typeToken<PortVisualViews, PortVisualValue>('PortVisual', 'component');
