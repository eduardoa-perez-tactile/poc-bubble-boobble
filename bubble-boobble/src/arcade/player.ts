import { partySpawn } from './party-config';
import {
  ActorSize,
  EnemyState,
  type GameState,
  type Input,
  type Player,
  alive,
  body,
  intersects,
  powers,
} from "./types";
import { blocked, movePlayer, spawnPosition, startPlayerJump } from "./physics";
import { addScore } from "./game";
import { productionPlayerBalance } from './balance';
import { shootBubble } from "./bubbles";
export function respawn(g: GameState, index: number) {
  const c = g.Party ? partySpawn(index,g.Players.length) : { ...g.Level.player };
  if (!g.Party && index === 1) c.col = 28 - c.col;
  const [x, y] = spawnPosition(g, c),
    lives = g.Players[index]!.Lives;
  g.Players[index]! = {
    ...body(x, y),
    ...(g.Players[index]!.Skin ? {Skin:g.Players[index]!.Skin} : {}),
    ...(g.Party ? {Downed:false} : {}),
    Lives: lives,
    Dir: index % 2 === 0 ? 1 : -1,
    Invincible: 210,
    JumpBuffer: 0,
    Coyote: 0,
    LastJump: false,
    Dead: 0,
    Shoot: 0,
    Cooldown: 0,
    WalkFrame: 0,
    Power: powers(),
  };
}
export function updatePlayer(g: GameState, index: number, input: Input, canMove=true) {
  const p = g.Players[index]!,
    i = { ...input },
    balance = g.PlayerBalance ?? productionPlayerBalance;
  if (p.Invincible > 0) p.Invincible--;
  if (p.Shoot > 0) p.Shoot--;
  if (p.Cooldown > 0) p.Cooldown--;
  if(canMove){
  if (i.Jump && !p.LastJump) p.JumpBuffer = 8;
  p.LastJump = i.Jump;
  if (p.JumpBuffer > 0) p.JumpBuffer--;
  if (p.Ground) p.Coyote = 6;
  else if (p.Coyote > 0) p.Coyote--;
  if (p.JumpBuffer > 0 && p.Coyote > 0) {
    startPlayerJump(g, p);
    p.Coyote = 0;
    p.JumpBuffer = 0;
    g.Counters.Jumps++;
    if (p.Power.Amethyst) addScore(g, 500, p.X, p.Y);
    g.Sounds.push("jump");
  }
  const speed = p.Power.Shoes ? balance.ShoesSpeed : balance.MoveSpeed;
  i.Move = Math.max(-1, Math.min(1, i.Move));
  if (i.Move !== 0) {
    p.Dir = i.Move;
    p.WalkFrame++;
  }
  const oldX = p.X;
  movePlayer(g, p, i.Move * speed, p.Power.Shoes);
  const distance = Math.abs(p.X - oldX);
  g.Counters.Walked += distance;
  if (p.Power.Crystal) {
    p.Power.WalkPoints += distance;
    while (p.Power.WalkPoints >= 8) {
      addScore(g, 10, p.X, p.Y);
      p.Power.WalkPoints -= 8;
    }
  }
  }else{p.JumpBuffer=0;p.Coyote=0;p.LastJump=false;p.Ground=blocked(g,p.X,p.Y+1,ActorSize);}
  if (i.Fire && p.Cooldown === 0) {
    shootBubble(g, index);
    p.Cooldown = p.Power.Yellow ? balance.YellowFireCooldown : balance.FireCooldown;
    p.Shoot = 12;
  }
}
export function hurtPlayer(g: GameState, index: number) {
  const p = g.Players[index]!;
  if (!alive(p) || p.Invincible > 0) return;
  if (g.Party) { p.Lives=0;p.Downed=true;p.Dead=0;p.Power=powers();g.Sounds.push('death');return; }
  p.Lives--;
  p.Dead = 90;
  p.Power = powers();
  g.Sounds.push("death");
}
export function checkPlayerHit(g: GameState, index: number) {
  const p = g.Players[index]!;
  if (p.Invincible > 0 || !alive(p)) return;
  const boss=g.Party?.Boss;
  if(g.Party?.Phase==='boss'&&boss&&boss.Mode!=='captured'&&intersects(p.X+5,p.Y+5,34,36,boss.X+8,boss.Y+8,80,80)){hurtPlayer(g,index);return;}
  for (const e of g.Enemies)
    if (
      e.State === EnemyState.Active &&
      intersects(p.X + 5, p.Y + 5, 34, 36, e.X + 4, e.Y + 4, 36, 36)
    ) {
      hurtPlayer(g, index);
      return;
    }
  for (const b of g.Projectiles)
    if (!b.Removed && intersects(p.X + 5, p.Y + 5, 34, 36, b.X, b.Y, 16, 20)) {
      b.Removed = true;
      hurtPlayer(g, index);
      return;
    }
}
export function target(
  g: GameState,
  b: {
    X: number;
    Y: number;
  },
): Player {
  let best = Number.MAX_VALUE,
    t = g.Players[0]!;
  for (const p of g.Players) {
    const d = Math.abs(p.X - b.X) + Math.abs(p.Y - b.Y);
    if (alive(p) && d < best) {
      best = d;
      t = p;
    }
  }
  return t;
}
