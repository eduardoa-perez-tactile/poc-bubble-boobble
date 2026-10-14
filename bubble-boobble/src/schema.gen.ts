// @generated — do not edit. Regenerate with `pnpm gen` (tools/bindgen).
import { typeToken, registerSchema, type EntityId } from '@gameengine/runtime';

export type { EntityId };

/** Project schema IR, registered with the engine when the bundle boots. */
export const schemaIr = {
  "version": 1,
  "package": "BubbleBoobble",
  "enums": [],
  "types": [
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
      "package": "BubbleBoobble"
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
      "package": "BubbleBoobble"
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
      "package": "BubbleBoobble"
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
      "package": "BubbleBoobble"
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
      "package": "BubbleBoobble"
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
      "package": "BubbleBoobble"
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
      "package": "BubbleBoobble"
    },
    {
      "name": "PortVisual",
      "kind": "component",
      "sim": true,
      "fields": [],
      "package": "BubbleBoobble"
    }
  ],
  "commands": [],
  "protocol": [],
  "services": []
} as const;
registerSchema(schemaIr);

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
