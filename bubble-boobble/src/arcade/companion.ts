import { arenaWidth, arenaRows } from './types';
import { ActorSize, EnemyState, State, Tile, alive, body, type GameState, type Input } from './types';
import { blocked, movePlayer, solid, startPlayerJump } from './physics';

interface Link { To: number; Move: number; Jump: boolean; Ticks: number; Turn: number; After: number }
interface Node { X: number; Y: number; Links: Link[] }
interface Graph { BuildIndex?:number; Nodes: Node[]; LevelIndex: number; Speed: number; Shoes: boolean; ArcadeMotion: boolean }
interface Goal { Kind: 'enemy' | 'bubble' | 'item' | 'follow' | 'rescue' | 'boss'; ID: number; X: number; Y: number }
/** All controller memory belongs to the game document; graph content is immutable after construction. */
export interface CompanionState {
  Graph: Graph | null;
  Goal: Goal | null;
  NextThink: number;
  Move: number;
  TurnIn: number;
  After: number;
  Remaining: number;
  LastX: number;
  LastY: number;
  Stuck: number;
}
/** Party slots are indexed exactly like Players. The original two-player API remains supported. */
export function enableCompanion(g: GameState, index = 1) {
  const p = g.Players[index];
  if (!p || index < 0 || index >= g.Players.length || !Number.isInteger(index)) throw new Error('AI requires a valid player slot in Players');
  const ai: CompanionState = { Graph: null, Goal: null, NextThink: 0, Move: 0, TurnIn: -1, After: 0, Remaining: 0, LastX: p.X, LastY: p.Y, Stuck: 0 };
  if (g.Companions || g.Players.length !== 2 || index !== 1) {
    if (!g.Companions) {
      g.Companions = g.Players.map(() => null);
      if (g.Companion) g.Companions[1] = g.Companion;
    }
    g.Companions[index] = ai;
  }
  if (index === 1) g.Companion = ai;
}
function controller(g: GameState, index: number): CompanionState | null | undefined {
  return g.Companions ? g.Companions[index] : index === 1 ? g.Companion : null;
}
function downed(p: GameState['Players'][number]): boolean {
  return !!p.Downed;
}
function nearest(nodes: Node[], x: number, y: number, sameSurface = false): number {
  let best = -1, distance = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!;
    if (sameSurface && Math.abs(n.Y - y) > 2) continue;
    const d = Math.abs(n.X - x) + 3 * Math.abs(n.Y - y);
    if (d < distance) { best = i; distance = d; }
  }
  return best;
}
/** Sample standing positions, then validate graph edges with the authoritative one-way/wrap physics. */
function createCompanionGraph(g: GameState, speed: number, index = 1): Graph {
  const nodes: Node[] = [];
  const shoes = g.Players[index]?.Power.Shoes ?? false;
  for (let row = 1; row < arenaRows(g); row++) {
    const y = row * Tile - ActorSize;
    const stands = (x: number) => x >= 2 * Tile && x <= arenaWidth(g) - 2 * Tile - ActorSize &&
      !blocked(g, x + 2, y + 2, ActorSize - 4) &&
      (solid(g, Math.floor((x + 4) / Tile), row) || solid(g, Math.floor((x + ActorSize - 4) / Tile), row));
    for (let x = 2 * Tile; x <= arenaWidth(g) - 2 * Tile - ActorSize; x += Tile)
      if (stands(x) && (x % (2 * Tile) === 0 || !stands(x - Tile) || !stands(x + Tile))) nodes.push({ X: x, Y: y, Links: [] });
    const right = arenaWidth(g) - 2 * Tile - ActorSize;
    if (stands(right)) nodes.push({ X: right, Y: y, Links: [] });
  }
  return { Nodes: nodes, LevelIndex: g.LevelIndex, Speed: speed, Shoes: shoes, ArcadeMotion: g.PlayerBalance.ArcadeMotion !== false };
}
function linkCompanionNodes(g:GameState,graph:Graph,start:number,count:number) {
  const nodes=graph.Nodes,speed=graph.Speed,shoes=graph.Shoes;
  for (let from = start; from < Math.min(nodes.length,start+count); from++) {
    const n:Node = {...nodes[from]!,Links:[]};
    nodes[from]=n;
    for (const jump of [false, true]) for (const move of [-1, 0, 1]) {
      if (!jump && move === 0) continue;
      // Braking/reversing in the air reaches ledges that constant-direction jumps miss.
      const turns = move === 0 ? [-1] : [-1, 12, 24];
      for (const turn of turns) for (const after of (turn < 0 ? [move] : [0, -move])) {
        const b = { ...body(n.X, n.Y), Ground: true };
        if (jump) startPlayerJump(g, b);
        for (let tick = 1; tick <= 240; tick++) {
          movePlayer(g, b, (turn >= 0 && tick > turn ? after : move) * speed, shoes);
          if (b.Ground && (jump || Math.abs(b.Y - n.Y) > 1 || Math.abs(b.X - n.X) >= 2 * Tile && (turn < 0 || tick > turn))) {
            const to = nearest(nodes, b.X, b.Y, true);
            if (to >= 0 && to !== from && Math.abs(nodes[to]!.X - b.X) <= Tile) {
              const previous = n.Links.find(l => l.To === to);
              const link = { To: to, Move: move, Jump: jump, Ticks: tick, Turn: turn, After: after };
              if (!previous) n.Links.push(link);
              else if (tick < previous.Ticks) Object.assign(previous, link);
            }
            break;
          }
          if (!jump && b.Ground && (Math.abs(b.X - n.X) < .01 || turn >= 0 && tick > turn && after === 0)) break;
        }
      }
    }
  }
}
/** Synchronous oracle for Classic, tests and offline inspection. */
export function buildCompanionGraph(g:GameState,speed:number,index=1):Graph {
  const graph=createCompanionGraph(g,speed,index);
  linkCompanionNodes(g,graph,0,graph.Nodes.length);
  return graph;
}
function graphMatches(g:GameState,graph:Graph|null,index:number):graph is Graph {
  const p=g.Players[index]!;
  return !!graph&&graph.LevelIndex===g.LevelIndex&&graph.Speed===(p.Power.Shoes?g.PlayerBalance.ShoesSpeed:g.PlayerBalance.MoveSpeed)&&graph.Shoes===p.Power.Shoes&&graph.ArcadeMotion===(g.PlayerBalance.ArcadeMotion!==false);
}
/** Bound first-use work to four nodes per movement profile per tick. Each published
 * graph is immutable: snapshots share finished nodes; only newly built nodes get
 * fresh links. All equivalent bots share the same in-progress or ready graph. */
export function warmPartyNavigation(g:GameState):void {
  if(g.Level.arena!=='courtyard'||!g.Companions)return;
  if(g.Companions.every((ai,index)=>!ai||!alive(g.Players[index]!)||graphMatches(g,ai.Graph,index)&&ai.Graph.BuildIndex===undefined))return;
  for(const shoes of [false,true]){
    const indices=g.Companions.flatMap((ai,index)=>ai&&alive(g.Players[index]!)&&g.Players[index]!.Power.Shoes===shoes?[index]:[]);
    if(!indices.length)continue;
    const first=indices[0]!,speed=shoes?g.PlayerBalance.ShoesSpeed:g.PlayerBalance.MoveSpeed;
    const candidates=indices.map(i=>g.Companions![i]!.Graph).filter((graph):graph is Graph=>graphMatches(g,graph,first));
    const shared=candidates.find(graph=>graph.BuildIndex===undefined)??candidates.reduce<Graph|undefined>((best,graph)=>!best||(graph.BuildIndex??0)>(best.BuildIndex??0)?graph:best,undefined);
    let graph=shared??{...createCompanionGraph(g,speed,first),BuildIndex:0};
    if(graph.BuildIndex!==undefined){
      const start=graph.BuildIndex;
      graph={...graph,Nodes:graph.Nodes.slice()};
      linkCompanionNodes(g,graph,start,4);
      if(start+4>=graph.Nodes.length)delete graph.BuildIndex;
      else graph.BuildIndex=start+4;
    }
    for(const i of indices){
      const ai=g.Companions[i]!;
      if(!graphMatches(g,ai.Graph,i)){ai.Remaining=0;ai.NextThink=0;ai.Goal=null;ai.Stuck=0;}
      ai.Graph=graph;
    }
  }
}

function chooseGoal(g: GameState, ai: CompanionState, index: number): Goal {
  const p = g.Players[index]!;
  // Idle bots follow the closest active human; an all-bot party follows its closest teammate.
  let humanIndex = -1, closest = Infinity;
  for (let i = 0; i < g.Players.length; i++) {
    const teammate = g.Players[i]!;
    if (i === index || (g.Party ? g.Party.Slots[i] !== 'human' : !!controller(g, i)) || !alive(teammate) || downed(teammate)) continue;
    const distance = Math.abs(teammate.X - p.X) + 2 * Math.abs(teammate.Y - p.Y);
    if (distance < closest) { closest = distance; humanIndex = i; }
  }
  if (humanIndex < 0) humanIndex = g.Players.findIndex((teammate, i) => i !== index && alive(teammate) && !downed(teammate));
  const human = g.Players[humanIndex] ?? p;
  let score = -Infinity;
  let best: Goal = { Kind: 'follow', ID: humanIndex, X: human.X, Y: human.Y };
  const offer = (goal: Goal, value: number, focusX = goal.X, focusY = goal.Y) => {
    const distance = Math.abs(p.X - goal.X) + 2 * Math.abs(p.Y - goal.Y);
    const ownDistance = Math.abs(p.X - focusX) + 2 * Math.abs(p.Y - focusY);
    let cooperation = 0;
    for (let i = 0; i < g.Players.length; i++) {
      const teammate = g.Players[i]!;
      if (i === index || !alive(teammate) || downed(teammate)) continue;
      const distance = Math.abs(teammate.X - focusX) + 2 * Math.abs(teammate.Y - focusY);
      const claimed = controller(g, i)?.Goal;
      if (distance + 48 < ownDistance) cooperation += 100;
      if (claimed?.Kind === goal.Kind && claimed.ID === goal.ID) cooperation += 160;
    }
    const persistence = ai.Goal?.Kind === goal.Kind && ai.Goal.ID === goal.ID ? 65 : 0;
    const utility = value - distance - cooperation + persistence;
    if (utility > score) { score = utility; best = goal; }
  };
  for (let i = 0; i < g.Players.length; i++) {
    const teammate = g.Players[i]!;
    if (i !== index && downed(teammate)) offer({ Kind: 'rescue', ID: i, X: teammate.X, Y: teammate.Y }, 1400);
  }
  const boss = g.Party?.Boss;
  if (boss && (boss.HP > 0 || boss.Mode==='captured')) {
    const center = boss.X + 48, side = p.X + ActorSize / 2 <= center ? -1 : 1;
    const captured=boss.Mode==='captured';
    offer({ Kind: 'boss', ID: -1, X: captured?boss.X:Math.max(2*Tile,Math.min(arenaWidth(g)-2*Tile-ActorSize,center+side*160)), Y:boss.Y+46 }, captured?2000:p.Power.Thunder?560:0, center, boss.Y+46);
    // Pop reachable thunder bubbles rather than firing forever from a safe ledge.
    if(p.Power.Thunder&&!captured)for(const bubble of g.Bubbles)
      if(bubble.ThunderShot&&!bubble.Removed&&bubble.Age>20&&Math.abs(bubble.Y-p.Y)<170)
        offer({Kind:'bubble',ID:bubble.ID,X:bubble.X,Y:bubble.Y},950);

  }
  for (const b of g.Bubbles) if (!b.Removed && b.EnemyID !== 0)
    offer({ Kind: 'bubble', ID: b.ID, X: b.X, Y: b.Y }, 650 + Math.min(250, b.CapturedAge / 4));
  for (const e of g.Enemies) if (e.State === EnemyState.Active) {
    // Approach a firing position, rather than walking directly into an enemy.
    const side = p.X <= e.X ? -1 : 1;
    offer({ Kind: 'enemy', ID: e.ID, X: Math.max(2 * Tile, Math.min(arenaWidth(g) - 2 * Tile - ActorSize, e.X + side * 72)), Y: e.Y }, 430, e.X, e.Y);
  }
  for (let i = 0; i < g.Items.length; i++) {
    const item = g.Items[i]!;
    offer({ Kind: 'item', ID: i, X: item.X, Y: item.Y }, item.Power==='thunder_potion' ? (p.Power.Thunder?-10000:1800) : g.State === State.Clearing ? 500 : item.Power ? 260 : 140);
  }
  return best;
}
/** Dijkstra from the current platform. Moving targets use the closest reachable platform. */
function route(graph: Graph, start: number, goal: Goal): Link | null {
  const nodes = graph.Nodes, cost = nodes.map(() => Infinity), first: (Link | null)[] = nodes.map(() => null), visited = nodes.map(() => false);
  cost[start] = 0;
  let best = start, bestScore = Infinity;
  for (let iteration = 0; iteration < nodes.length; iteration++) {
    let current = -1;
    for (let i = 0; i < nodes.length; i++) if (!visited[i] && Number.isFinite(cost[i]!) && (current < 0 || cost[i]! < cost[current]!)) current = i;
    if (current < 0) break;
    visited[current] = true;
    const n = nodes[current]!, distance = Math.abs(n.X - goal.X) + 3 * Math.abs(n.Y - goal.Y) + cost[current]! * .25;
    if (distance < bestScore) { bestScore = distance; best = current; }
    for (const link of n.Links) {
      const next = cost[current]! + link.Ticks;
      if (next < cost[link.To]!) { cost[link.To] = next; first[link.To] = current === start ? link : first[current]!; }
    }
  }
  return first[best]!;
}
export function companionInput(g: GameState, index = 1): Input {
  const ai = controller(g, index), p = g.Players[index];
  const input: Input = { Move: 0, Jump: false, Fire: false };
  if (!ai || !p || !alive(p) || downed(p) || g.Paused || (g.Party?.Phase === 'rest' && g.Items.length === 0) || (g.State !== State.Playing && g.State !== State.Clearing)) {
    if (ai) { ai.Remaining = 0; ai.Goal = null; ai.Stuck = 0; ai.NextThink = 0; }
    return input;
  }
  const speed = p.Power.Shoes ? g.PlayerBalance.ShoesSpeed : g.PlayerBalance.MoveSpeed;
  if (!ai.Graph || ai.Graph.LevelIndex !== g.LevelIndex || ai.Graph.Speed !== speed || ai.Graph.Shoes !== p.Power.Shoes || ai.Graph.ArcadeMotion !== (g.PlayerBalance.ArcadeMotion !== false)) {
    // Graphs are immutable after construction, so equivalent bots reuse one graph in game state.
    const shared = g.Companions?.find(other => other?.Graph && other.Graph.LevelIndex === g.LevelIndex && other.Graph.Speed === speed && other.Graph.Shoes === p.Power.Shoes && other.Graph.ArcadeMotion === (g.PlayerBalance.ArcadeMotion !== false));
    ai.Graph = shared?.Graph ?? buildCompanionGraph(g, speed, index); ai.Remaining = 0; ai.NextThink = 0; ai.Goal = null; ai.Stuck = 0;
  }
  if (g.Tick >= ai.NextThink || !ai.Goal) {
    const travel = Math.abs(p.X - ai.LastX) + Math.abs(p.Y - ai.LastY);
    const far = ai.Goal && Math.abs(ai.Goal.X - p.X) + Math.abs(ai.Goal.Y - p.Y) > 48;
    ai.Stuck = far && travel < 5 ? ai.Stuck + 12 : 0;
    ai.LastX = p.X; ai.LastY = p.Y;
    ai.Goal = chooseGoal(g, ai, index); ai.NextThink = g.Tick + 12;
  }
  const goal = ai.Goal!, dx = goal.X - p.X;
  if (ai.Remaining > 0) {
    if (ai.TurnIn >= 0) { if (ai.TurnIn === 0) ai.Move = ai.After; ai.TurnIn--; }
    input.Move = ai.Move; ai.Remaining--;
    // Landing early (e.g. on a bubble) invalidates the remaining airborne route.
    if (p.Ground && ai.Remaining < 5) ai.Remaining = 0;
  } else {
    input.Move = Math.abs(dx) > 8 ? Math.sign(dx) : 0;
    // Local movement, firing and avoidance remain responsive while routes warm.
    if (ai.Graph.BuildIndex===undefined && p.Ground && (Math.abs(goal.Y - p.Y) > Tile || Math.abs(dx) > 2 * Tile)) {
      const start = nearest(ai.Graph.Nodes, p.X, p.Y, true);
      if (start >= 0) {
        const link = route(ai.Graph, start, goal), node = ai.Graph.Nodes[start]!;
        if (link) {
          if (Math.abs(node.X - p.X) > speed) input.Move = Math.sign(node.X - p.X);
          else {
            input.Move = link.Move; input.Jump = link.Jump && !p.LastJump;
            ai.Move = link.Move; ai.TurnIn = link.Turn < 0 ? -1 : link.Turn - 1; ai.After = link.After; ai.Remaining = link.Ticks - 1;
          }
        } else if (goal.Y < p.Y - Tile && goal.Y > p.Y - 170 && Math.abs(dx) < 72) {
          // A floating target can be reached during a jump even without a higher landing surface.
          input.Jump = !p.LastJump;
        }
      }
    }
  }
  if (ai.Stuck >= 60) {
    input.Move = p.X > arenaWidth(g) / 2 ? -1 : 1; input.Jump = p.Ground && !p.LastJump;
    ai.Move = input.Move; ai.Remaining = 36; ai.TurnIn = -1; ai.NextThink = g.Tick + 12; ai.Stuck = 0;
    input.Fire = goal.Y < p.Y - Tile;
  }
  if (goal.Kind === 'rescue') {
    const teammate = g.Players[goal.ID];
    if (teammate && downed(teammate)) {
      goal.X = teammate.X; goal.Y = teammate.Y;
      if (Math.abs(teammate.X - p.X) < 96 && Math.abs(teammate.Y - p.Y) < 170) {
        input.Move = Math.abs(teammate.X - p.X) > 6 ? Math.sign(teammate.X - p.X) : 0;
        input.Jump = p.Ground && teammate.Y < p.Y - 12 && !p.LastJump;
        ai.Remaining = 0;
      }
    } else { ai.Goal = null; ai.NextThink = 0; }
  }
  if (goal.Kind === 'bubble') {
    const b = g.Bubbles.find(b => b.ID === goal.ID && !b.Removed);
    if (b && Math.abs(b.X - p.X) < 96 && Math.abs(b.Y - p.Y) < 170) {
      // Intercept nearby drifting bubbles directly instead of completing an obsolete platform route.
      input.Move = Math.abs(b.X - p.X) > 6 ? Math.sign(b.X - p.X) : 0;
      input.Jump = p.Ground && b.Y < p.Y - 12 && !p.LastJump;
      ai.Remaining = 0;
    }
  }
  // Re-evaluate immediate hazards every tick, independently of the slower goal selection.
  if (p.Invincible === 0) {
    let dangerX: number | null = null, closest = Infinity;
    const boss=g.Party?.Boss;
    if(boss&&g.Party?.Phase==='boss'&&boss.Mode!=='captured'&&p.Y+44>boss.Y&&p.Y<boss.Y+96&&Math.abs(boss.X+48-p.X-22)<105){dangerX=boss.X+48;closest=Math.abs(dangerX-p.X-22);}
    for (const e of g.Enemies) if (e.State === EnemyState.Active && Math.abs(e.Y - p.Y) < 38) {
      const distance = Math.abs(e.X - p.X);
      if (distance < 62 && distance < closest) { dangerX = e.X; closest = distance; }
    }
    for (const shot of g.Projectiles) if (!shot.Removed && Math.abs(shot.Y + shot.VY * 6 - p.Y - 12) < 38) {
      const x = shot.X + shot.VX * 6, distance = Math.abs(x - p.X - 16);
      if (distance < 70 && distance < closest) { dangerX = x; closest = distance; }
    }
    if (dangerX !== null) {
      input.Move = dangerX >= p.X ? -1 : 1; input.Jump = p.Ground && !p.LastJump; ai.Remaining = 0;
    }
  }
  // Holding jump bounces on bubbles; release it when the goal is to pop a trapped enemy.
  if (!p.Ground && p.VY >= 0)
    for (const b of g.Bubbles) if (!b.Removed && !(goal.Kind === 'bubble' && b.ID === goal.ID) && b.Age > 20 && Math.abs(b.X - p.X) < 30 && b.Y >= p.Y + ActorSize - 12 && b.Y < p.Y + ActorSize + 20) input.Jump = true;
  const facing = input.Move || p.Dir, range = p.Power.Pink ? g.PlayerBalance.PinkBubbleRange : g.PlayerBalance.BubbleRange;
  for (const e of g.Enemies) if (e.State === EnemyState.Active && Math.abs(e.Y - p.Y) < 30 && (e.X - p.X) * facing >= 0 && Math.abs(e.X - p.X) < range) input.Fire = true;
  const boss = g.Party?.Boss;
  if (boss && boss.HP > 0 && p.Power.Thunder && p.Y + ActorSize > boss.Y && p.Y < boss.Y + 96 && (boss.X + 48 - p.X) * facing >= 0 && Math.abs(boss.X + 48 - p.X) < 400) input.Fire = true;
  ai.Move = input.Move;
  return input;
}
