export const Columns = 32,
  Rows = 26,
  Tile = 24,
  Width = 768,
  Height = 624,
  TPS = 60,
  ActorSize = 44;
export enum State {
  Ready,
  Playing,
  Clearing,
  GameOver,
  Won,
}
export enum EnemyState {
  Active,
  Trapped,
  Defeated,
  Carried,
}
export interface Cell {
  col: number;
  row: number;
}
export interface Level {
  number: number;
  tiles: number[][];
  enemies: ({
    kind: string;
  } & Cell)[];
  player: Cell;
  power_spawn: Cell;
  food_spawn: Cell;
  special: string;
  special_count: number;
}
export interface Input {
  Move: number;
  Jump: boolean;
  Fire: boolean;
}
export interface Body {
  X: number;
  Y: number;
  VX: number;
  VY: number;
  Ground: boolean;
}
export interface Powers {
  Pink: boolean;
  Blue: boolean;
  Yellow: boolean;
  Shoes: boolean;
  Crystal: boolean;
  Amethyst: boolean;
  Ruby: boolean;
  WalkPoints: number;
}
export interface Player extends Body {
  Lives: number;
  JumpBuffer: number;
  Coyote: number;
  LastJump: boolean;
  Dir: number;
  Invincible: number;
  Dead: number;
  Shoot: number;
  Cooldown: number;
  WalkFrame: number;
  Power: Powers;
}
export interface Enemy extends Body {
  CarriedBy: number;
  CarryTicks: number;
  ID: number;
  Kind: string;
  State: EnemyState;
  Dir: number;
  Vertical: number;
  Angry: boolean;
  Age: number;
  Cooldown: number;
  Shoot: number;
  DeadTicks: number;
  Phase: number;
}
export interface Bubble extends Body {
  // Cosmetic shot ownership; absent on ambient bubbles and older sessions.
  Shooter?: number;
  ID: number;
  Dir: number;
  Age: number;
  EnemyID: number;
  CapturedAge: number;
  Distance: number;
  MaxDistance: number;
  Speed: number;
  Floating: boolean;
  Removed: boolean;
  Element: string;
}
export interface Projectile extends Body {
  Laser: boolean;
  Age: number;
  Removed: boolean;
}
export interface Effect extends Body {
  ID: number;
  Element: string;
  Dir: number;
  Age: number;
  Life: number;
  Spread: boolean;
}
export interface Particle extends Body {
  Text: string;
  Life: number;
}
export interface Item extends Body {
  Stationary: boolean;
  Power: string;
  Food: number;
  Age: number;
}
export interface Counters {
  Blown: number;
  Popped: number;
  Jumps: number;
  Water: number;
  Thunder: number;
  Fire: number;
  Pink: number;
  Blue: number;
  Yellow: number;
  Walked: number;
}
export interface GameState {
  // Authoritative locomotion tuning; angry enemies retain their original speed.
  NormalEnemySpeedScale: number;
  Campaign: Level[];
  Level: Level;
  LevelIndex: number;
  Custom: boolean;
  State: State;
  Paused: boolean;
  Tick: number;
  LevelTicks: number;
  Countdown: number;
  Freeze: number;
  Hurry: boolean;
  Score: number;
  Players: Player[];
  Enemies: Enemy[];
  Bubbles: Bubble[];
  Projectiles: Projectile[];
  Items: Item[];
  Effects: Effect[];
  Particles: Particle[];
  Sounds: string[];
  Counters: Counters;
  WaterStage: number;
  Pending: string[];
  SpawnedSpecial: number;
  NextID: number;
  ExtraLifeAt: number;
  RNG: string;
}
export const body = (X = 0, Y = 0): Body => ({
  X,
  Y,
  VX: 0,
  VY: 0,
  Ground: false,
});
export const powers = (): Powers => ({
  Pink: false,
  Blue: false,
  Yellow: false,
  Shoes: false,
  Crystal: false,
  Amethyst: false,
  Ruby: false,
  WalkPoints: 0,
});
export const alive = (p: Player) => p.Lives > 0 && p.Dead === 0;
export const direction = (n: number) => (n < 0 ? -1 : 1);
export const intersects = (
  x: number,
  y: number,
  w: number,
  h: number,
  xx: number,
  yy: number,
  ww: number,
  hh: number,
) => x < xx + ww && x + w > xx && y < yy + hh && y + h > yy;
export const position = (c: Cell, size: number): [number, number] => [
  Math.min(c.col * Tile, Width - 2 * Tile - size),
  Math.max(Tile, c.row * Tile - size),
];
