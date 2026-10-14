import {
  ActorSize,
  type Body,
  type Cell,
  type Enemy,
  type GameState,
  Height,
  Rows,
  Tile,
  Width,
  position,
} from "./types";
export function solid(g: GameState, col: number, row: number): boolean {
  if (col < 2 || col >= 30) return true;
  if (row < 0 || row >= Rows) return false;
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
  const [x, y] = position(c, ActorSize);
  if (!blocked(g, x, y, ActorSize)) return [x, y];
  let best = Number.MAX_VALUE,
    bx = x,
    by = y;
  for (let row = 1; row < Rows - 2; row++)
    for (let col = 2; col < 29; col++) {
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
export function moveActor(g: GameState, b: Body, dx: number, gravity: boolean) {
  const inside = blocked(g, b.X + 2, b.Y + 2, ActorSize - 4),
    steps = Math.max(1, Math.ceil(Math.abs(dx)));
  for (let i = 0; i < steps; i++) {
    const x = Math.max(
      2 * Tile,
      Math.min(Width - 2 * Tile - ActorSize, b.X + dx / steps),
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
      let row = Math.ceil(oldFeet / Tile);
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
  if (b.Y < Tile) {
    b.Y = Tile;
    b.VY = Math.max(0, b.VY);
  }
  if (b.Y > Height) {
    b.Y = Tile;
    b.VY = 2;
  }
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
      y > Height - ActorSize ||
      blocked(g, e.X + 3, y + 3, ActorSize - 6)
    ) {
      e.Vertical *= -1;
      break;
    }
    e.Y = y;
  }
}
