import { arenaWidth, arenaHeight, arenaRows, arenaColumns } from './types';
import {
  ActorSize,
  type Body,
  type Cell,
  type Enemy,
  type GameState,
  Tile,
  position,
} from "./types";
export function solid(g: GameState, col: number, row: number): boolean {
  if (col < 2 || col >= arenaColumns(g)-2) return true;
  if (row < 0 || row >= arenaRows(g)) return false;
  return g.Level.tiles[row]![col] !== 0;
}
export function blocked(
  g: GameState,
  x: number,
  y: number,
  size: number,
): boolean {
  for (
    let row = Math.floor(y / Tile);
    row <= Math.floor((y + size - 0.01) / Tile);
    row++
  )
    for (
      let col = Math.floor(x / Tile);
      col <= Math.floor((x + size - 0.01) / Tile);
      col++
    )
      if (solid(g, col, row)) return true;
  return false;
}
export function spawnPosition(g: GameState, c: Cell): [number, number] {
  const [x, y] = position(c, ActorSize, g.Level);
  if (!blocked(g, x, y, ActorSize)) return [x, y];
  let best = Number.MAX_VALUE,
    bx = x,
    by = y;
  for (let row = 1; row < arenaRows(g) - 2; row++)
    for (let col = 2; col < arenaColumns(g)-3; col++) {
      const xx = col * Tile,
        yy = row * Tile,
        d = Math.abs(xx - x) + Math.abs(yy - y);
      if (d < best && !blocked(g, xx, yy, ActorSize)) {
        best = d;
        bx = xx;
        by = yy;
      }
    }
  return [bx, by];
}
function advanceActor(g: GameState, b: Body, dx: number, gravity: boolean, firstLandingRow = 0) {
  const inside = blocked(g, b.X + 2, b.Y + 2, ActorSize - 4),
    steps = Math.max(1, Math.ceil(Math.abs(dx)));
  for (let i = 0; i < steps; i++) {
    const x = Math.max(
      2 * Tile,
      Math.min(arenaWidth(g) - 2 * Tile - ActorSize, b.X + dx / steps),
    );
    if (b.VY >= 0 && !inside && blocked(g, x + 2, b.Y + 2, ActorSize - 4))
      break;
    b.X = x;
  }
  if (gravity) b.VY = Math.min(12, b.VY + 0.5);
  const oldFeet = b.Y + ActorSize;
  let newY = b.Y + b.VY;
  b.Ground = false;
  if (b.VY >= 0) {
    for (
      let row = Math.max(firstLandingRow, Math.ceil(oldFeet / Tile));
      row <= Math.floor((newY + ActorSize) / Tile);
      row++
    ) {
      for (
        let col = Math.trunc((b.X + 4) / Tile);
        col <= Math.trunc((b.X + ActorSize - 4) / Tile);
        col++
      ) {
        if (solid(g, col, row)) {
          newY = row * Tile - ActorSize;
          b.VY = 0;
          b.Ground = true;
          break;
        }
      }
      if (b.Ground) break;
    }
  }
  b.Y = newY;
}
// Enemy bounds retain the pinned reference behavior. Players have a separate
// boundary rule so their requested traversal does not change enemy movement.
export function moveActor(g: GameState, b: Body, dx: number, gravity: boolean) {
  advanceActor(g, b, dx, gravity);
  if (b.Y < Tile) {
    b.Y = Tile;
    b.VY = Math.max(0, b.VY);
  }
  wrapBottom(g,b);
}
function wrapBottom(g:GameState,b: Body) {
  if (b.Y > arenaHeight(g)) {
    b.Y = Tile;
    b.VY = 2;
  }
}
function matchingVerticalOpening(g: GameState, b: Body): boolean {
  // The full body must fit both openings; touching an adjacent wall is not an
  // exit. Horizontal bounds have already been applied by advanceActor.
  const first = Math.floor(b.X / Tile),
    last = Math.floor((b.X + ActorSize - 0.01) / Tile);
  for (let col = first; col <= last; col++)
    if (solid(g, col, 0) || solid(g, col, arenaRows(g) - 1)) return false;
  return true;
}
// Arcade-derived motion data: BubNext 47ad995, game.asm data_4AED,
// bank0000.asm data_1276/data_12A7. One arcade pixel is three game pixels.
// Pairs are signed vertical displacement (screen Y), then duration in substeps.
const jumpSegments: readonly (readonly [number, number])[] = [
  [-6, 16], [-3, 9], [0, 2], [-3, 1], [0, 2],
  [0, 3], [3, 1], [0, 2], [3, 9], [6, 16],
];
const normalCadence: readonly number[] = [1, 1, 1, 1, 2];
const shoesCadence: readonly number[] = [2, 2, 2, 2, 2, 2, 2, 2, 2, 1];
export function startPlayerJump(g: GameState, b: Body, referenceImpulse = -11.5) {
  if (g.PlayerBalance?.ArcadeMotion !== false) { b.JumpStep = 0; b.VY = -6; }
  else b.VY = referenceImpulse;
  b.Ground = false;
}
function jumpDisplacement(step: number): number {
  for (const [dy, duration] of jumpSegments) {
    if (step < duration) return dy;
    step -= duration;
  }
  return 3; // Completed jump: continue with the steady ledge-fall step.
}
export function movePlayer(g: GameState, b: Body, dx: number, shoes = false) {
  const arcade = g.PlayerBalance?.ArcadeMotion !== false;
  if (arcade) {
    const cadence = shoes ? shoesCadence : normalCadence;
    const phase = (b.MotionTick ?? 0) % cadence.length;
    const count = cadence[phase]!;
    b.MotionTick = (phase + 1) % cadence.length;
    if (b.JumpStep !== undefined) {
      let dy = 0;
      for (let i = 0; i < count; i++) dy += jumpDisplacement(b.JumpStep++);
      b.VY = dy;
      if (b.JumpStep >= 61) delete b.JumpStep;
    } else if (b.VY < 0) {
      // Preserve an externally supplied upward impulse (old sessions/dev scenarios)
      // until its apex. Normal jumps and bubble boosts always use the table above.
      b.VY = Math.min(0, b.VY + .5);
    } else b.VY = count * 3;
  }
  // Row zero is the board border, not a playable roof above the screen.
  advanceActor(g, b, dx, !arcade, 1);
  if (b.Ground) delete b.JumpStep;
  // Preserve the requested paired-opening upward wrap and one-way platforms.
  if (b.VY < 0 && b.Y + ActorSize < 0 && matchingVerticalOpening(g, b))
    b.Y += arenaHeight(g) + ActorSize;
  if (arcade) { if (b.Y > arenaHeight(g)) b.Y = Tile; }
  else wrapBottom(g,b);
}
export function moveFlying(g: GameState, e: Enemy, dx: number, dy: number) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  for (let i = 0; i < steps; i++) {
    const x = e.X + dx / steps;
    if (blocked(g, x + 3, e.Y + 3, ActorSize - 6)) {
      e.Dir *= -1;
      break;
    }
    e.X = x;
  }
  for (let i = 0; i < steps; i++) {
    const y = e.Y + dy / steps;
    if (
      y < Tile ||
      y > arenaHeight(g) - ActorSize ||
      blocked(g, e.X + 3, y + 3, ActorSize - 6)
    ) {
      e.Vertical *= -1;
      break;
    }
    e.Y = y;
  }
}
