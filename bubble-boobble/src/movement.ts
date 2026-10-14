// Ported from pinned internal/game/physics.go and game.go. See assets/reference/LICENSE.
import levels from '../data/levels.json';
export const level = levels[0]!;
export const TILE = 24, SIZE = 44, WIDTH = 768, HEIGHT = 624;
export type Body = { x: number; y: number; vx: number; vy: number; ground: boolean };
export type Player = Body & { lives: number; dir: number; jumpBuffer: number; coyote: number; lastJump: boolean; invincible: number; dead: number; shoot: number; cooldown: number; walkFrame: number };
export function solid(col: number, row: number): boolean {
  if (col < 2 || col >= 30) return true;
  if (row < 0 || row >= 26) return false;
  return level.tiles[row]![col] !== 0;
}
export function blocked(x: number, y: number, size: number): boolean {
  for (let row = Math.floor(y / TILE); row <= Math.floor((y + size - 0.01) / TILE); row++)
    for (let col = Math.floor(x / TILE); col <= Math.floor((x + size - 0.01) / TILE); col++)
      if (solid(col, row)) return true;
  return false;
}
export function spawnPosition(col: number, row: number): [number, number] {
  const x = Math.min(col * TILE, WIDTH - 2 * TILE - SIZE), y = Math.max(TILE, row * TILE - SIZE);
  if (!blocked(x, y, SIZE)) return [x, y];
  let best = Number.MAX_VALUE, bx = x, by = y;
  for (let r = 1; r < 24; r++) for (let c = 2; c < 29; c++) {
    const xx = c * TILE, yy = r * TILE, distance = Math.abs(xx - x) + Math.abs(yy - y);
    if (distance < best && !blocked(xx, yy, SIZE)) { best = distance; bx = xx; by = yy; }
  }
  return [bx, by];
}
export function initialPlayer(): Player {
  const [x, y] = spawnPosition(level.player.col, level.player.row);
  return { x, y, vx: 0, vy: 0, ground: false, lives: 3, dir: 1, jumpBuffer: 0, coyote: 0, lastJump: false, invincible: 0, dead: 0, shoot: 0, cooldown: 0, walkFrame: 0 };
}
export function moveActor(b: Body, dx: number): void {
  const inside = blocked(b.x + 2, b.y + 2, SIZE - 4);
  const steps = Math.max(1, Math.ceil(Math.abs(dx)));
  for (let i = 0; i < steps; i++) {
    const x = Math.max(2 * TILE, Math.min(WIDTH - 2 * TILE - SIZE, b.x + dx / steps));
    if (b.vy >= 0 && !inside && blocked(x + 2, b.y + 2, SIZE - 4)) break;
    b.x = x;
  }
  b.vy = Math.min(12, b.vy + 0.5);
  const oldFeet = b.y + SIZE;
  let newY = b.y + b.vy;
  b.ground = false;
  if (b.vy >= 0) {
    const first = Math.ceil(oldFeet / TILE), last = Math.floor((newY + SIZE) / TILE);
    for (let row = first; row <= last; row++) {
      for (let col = Math.trunc((b.x + 4) / TILE); col <= Math.trunc((b.x + SIZE - 4) / TILE); col++) {
        if (solid(col, row)) { newY = row * TILE - SIZE; b.vy = 0; b.ground = true; break; }
      }
      if (b.ground) break;
    }
  }
  b.y = newY;
  if (b.y < TILE) { b.y = TILE; b.vy = Math.max(0, b.vy); }
  if (b.y > HEIGHT) { b.y = TILE; b.vy = 2; }
}
export function updatePlayer(p: Player, move: number, jump: boolean): boolean {
  if (p.invincible > 0) p.invincible--;
  if (p.shoot > 0) p.shoot--;
  if (p.cooldown > 0) p.cooldown--;
  if (jump && !p.lastJump) p.jumpBuffer = 8;
  p.lastJump = jump;
  if (p.jumpBuffer > 0) p.jumpBuffer--;
  if (p.ground) p.coyote = 6; else if (p.coyote > 0) p.coyote--;
  const jumped = p.jumpBuffer > 0 && p.coyote > 0;
  if (jumped) { p.vy = -11.5; p.ground = false; p.coyote = 0; p.jumpBuffer = 0; }
  move = Math.max(-1, Math.min(1, move));
  if (move !== 0) { p.dir = move; p.walkFrame++; }
  moveActor(p, move * 3);
  return jumped;
}
