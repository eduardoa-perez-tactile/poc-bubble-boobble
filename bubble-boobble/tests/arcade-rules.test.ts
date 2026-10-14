import { worldTest } from "@gameengine/test";
import levels from "../data/levels.json";
import {
  addScore,
  copyGame,
  createGame,
  defeat,
  loadLevel,
  remainingEnemies,
  stepGame,
  validateLevel,
} from "../src/arcade/game";
import {
  bubble,
  popBubble,
  releaseElement,
  spawnSpecial,
  updateBubbles,
  updateEffects,
} from "../src/arcade/bubbles";
import { updateDefeated, updateEnemies } from "../src/arcade/enemies";
import {
  applyPower,
  checkPowerSpawns,
  item,
  updateItems,
} from "../src/arcade/items";
import { hurtPlayer, target } from "../src/arcade/player";
import { blocked, moveActor } from "../src/arcade/physics";
import {
  ActorSize,
  EnemyState,
  type GameState,
  Height,
  type Level,
  State,
  Tile,
  alive,
  body,
} from "../src/arcade/types";
const idle = { Move: 0, Jump: false, Fire: false };
function check(v: unknown, message: string) {
  if (!v) throw new Error(message);
}
function testLevel(): Level {
  return {
    number: 1,
    player: { col: 4, row: 25 },
    power_spawn: { col: 10, row: 25 },
    food_spawn: { col: 16, row: 25 },
    enemies: [{ kind: "zenchan", col: 24, row: 25 }],
    special: "",
    special_count: 0,
    tiles: Array.from({ length: 26 }, (_, row) =>
      Array.from({ length: 32 }, (_, col) =>
        col < 2 || col >= 30 || row === 0 || row === 25 ? 1 : 0,
      ),
    ),
  };
}
function game(count = 1): GameState {
  const g = createGame([testLevel()], 1, count);
  g.State = State.Playing;
  return g;
}
worldTest(
  "arcade upstream rules: all rounds spawn clear and preserve campaign data",
  () => {
    const g = createGame(levels, 42);
    for (let index = 0; index < 25; index++) {
      loadLevel(g, index);
      check(g.Level.number === index + 1, "round progression");
      for (const p of g.Players)
        check(!blocked(g, p.X, p.Y, ActorSize), "player spawn blocked");
      for (const e of g.Enemies)
        check(!blocked(g, e.X, e.Y, ActorSize), "enemy spawn blocked");
    }
    const original = levels[24]!.tiles[1]![2]!;
    g.Level.tiles[1]![2]! = 123;
    check(
      levels[24]!.tiles[1]![2]! === original,
      "level clone modified campaign",
    );
    const bad = testLevel();
    bad.enemies[0]!.kind = "unknown";
    let rejected = false;
    try {
      validateLevel(bad);
    } catch {
      rejected = true;
    }
    check(rejected, "invalid enemy accepted");
  },
  { scene: "scenes/main.scene.json" },
);
worldTest(
  "arcade upstream rules: rising platforms swept landing and bottom wrap",
  () => {
    const g = game();
    for (let c = 5; c < 15; c++) g.Level.tiles[12]![c]! = 1;
    const b = { ...body(8 * Tile, 12 * Tile), VY: -10 };
    for (let i = 0; i < 10; i++) moveActor(g, b, 0, false);
    check(b.Y < 12 * Tile - ActorSize, "rise blocked");
    b.VY = 80;
    moveActor(g, b, 0, false);
    check(b.Ground && b.Y === 12 * Tile - ActorSize, "descent tunneled");
    for (let c = 2; c < 30; c++) g.Level.tiles[25]![c]! = 0;
    Object.assign(b, body(100, Height - 2), { VY: 8 });
    moveActor(g, b, 0, false);
    check(b.Y === Tile && b.VY === 2, "bottom wrap differs");
  },
  { scene: "scenes/main.scene.json" },
);
worldTest(
  "arcade upstream rules: chain score enemy drop and captured timeout",
  () => {
    const g = game();
    g.Enemies.push({ ...g.Enemies[0]!, ID: 2 });
    for (const e of g.Enemies) e.State = EnemyState.Trapped;
    g.Bubbles = [
      { ...bubble(100, 100), Age: 30, EnemyID: 1 },
      { ...bubble(138, 100), Age: 30, EnemyID: 2 },
    ];
    popBubble(g, 0, 0);
    check(g.Score === 300 && g.Counters.Popped === 2, "chain combo differs");
    for (let i = 0; i < 120; i++) updateDefeated(g);
    check(
      g.Items.length === 4,
      "food should drop exactly once per enemy plus bonus",
    );
    const h = game();
    h.Enemies[0]!.State = EnemyState.Trapped;
    h.Bubbles = [
      {
        ...bubble(300, 100),
        Age: 1500,
        CapturedAge: 1270,
        EnemyID: h.Enemies[0]!.ID,
        Floating: true,
      },
    ];
    updateBubbles(h, [idle]);
    check(
      Number(h.Enemies[0]!.State) === EnemyState.Active &&
        h.Enemies[0]!.Angry &&
        h.Bubbles.length === 0,
      "trapped timeout",
    );
  },
  { scene: "scenes/main.scene.json" },
);
worldTest(
  "arcade upstream rules: all power bonuses thresholds and water progress",
  () => {
    for (const [power, field] of [
      ["pink_candy", "Pink"],
      ["blue_candy", "Blue"],
      ["yellow_candy", "Yellow"],
      ["shoes", "Shoes"],
      ["crystal_ring", "Crystal"],
      ["amethyst_ring", "Amethyst"],
      ["ruby_ring", "Ruby"],
    ] as const) {
      const g = game();
      applyPower(g, power, 0);
      check(g.Players[0]!.Power[field] && g.Score > 0, "power " + power);
    }
    for (const power of ["orange_parasol", "red_parasol", "purple_parasol"]) {
      const g = game();
      check(
        applyPower(g, power, 0) && Number(g.State) === State.Won,
        "warp " + power,
      );
    }
    const g = game();
    g.Counters.Blown = 36;
    checkPowerSpawns(g);
    check(
      g.Items[0]!.Power === "pink_candy" && g.Counters.Blown === 1,
      "threshold overshoot",
    );
    for (const [water, power] of [
      [15, "orange_parasol"],
      [20, "red_parasol"],
      [25, "purple_parasol"],
    ] as const) {
      g.Items = [];
      g.Counters.Water = water;
      checkPowerSpawns(g);
      check(g.Items[0]!.Power === power, "water " + water);
    }
    check(g.WaterStage === 0 && g.Counters.Water === 0, "water cycle");
    applyPower(g, "clock", 0);
    check(g.Freeze === 420, "clock length");
    applyPower(g, "dynamite", 0);
    check(remainingEnemies(g) === 0, "dynamite enemies");
  },
  { scene: "scenes/main.scene.json" },
);
worldTest(
  "arcade upstream rules: element scheduling carrying and damage",
  () => {
    for (const element of ["water", "thunder", "fire"]) {
      const g = game();
      g.Level.special = element;
      g.Level.special_count = 2;
      for (let tick = 1; tick <= 1350; tick++) {
        g.LevelTicks = tick;
        spawnSpecial(g);
      }
      check(g.Bubbles.length === 2, "special budget");
      const b = g.Bubbles[0]!;
      b.X = g.Enemies[0]!.X;
      b.Y = g.Enemies[0]!.Y;
      releaseElement(g, b, 0);
      if (element === "fire") g.Effects[0]!.Ground = true;
      updateEffects(g);
      if (element === "water") {
        check(
          Number(g.Enemies[0]!.State) === EnemyState.Carried,
          "water carry",
        );
        for (let i = 0; i < 180; i++) updateEffects(g);
      }
      check(
        Number(g.Enemies[0]!.State) === EnemyState.Defeated,
        "element damage " + element,
      );
    }
    const g = game();
    g.Level.special = "water";
    g.Level.special_count = 3;
    g.LevelTicks = 1;
    spawnSpecial(g);
    g.Freeze = 10;
    for (let i = 0; i < 10; i++) spawnSpecial(g);
    g.Freeze = 0;
    spawnSpecial(g);
    check(g.Bubbles.length === 1, "freeze duplicated scheduled bubble");
    g.LevelTicks = 451;
    spawnSpecial(g);
    check(g.Bubbles.length === 2, "next special missing");
  },
  { scene: "scenes/main.scene.json" },
);
worldTest(
  "arcade upstream rules: coop targeting bonuses revival and survivor",
  () => {
    const g = game(2),
      x0 = g.Players[0]!.X,
      x1 = g.Players[1]!.X;
    stepGame(g, [
      { Move: 1, Jump: false, Fire: true },
      { Move: -1, Jump: false, Fire: true },
    ]);
    check(
      g.Players[0]!.X > x0 && g.Players[1]!.X < x1 && g.Bubbles.length === 2,
      "independent controls",
    );
    applyPower(g, "shoes", 1);
    check(
      !g.Players[0]!.Power.Shoes && g.Players[1]!.Power.Shoes,
      "power ownership",
    );
    hurtPlayer(g, 1);
    check(
      g.Players[0]!.Lives === 3 && g.Players[1]!.Lives === 2,
      "life ownership",
    );
    g.Players[1]!.Lives = 0;
    for (let i = 0; i < 90; i++) stepGame(g, [idle, idle]);
    check(
      Number(g.State) !== State.GameOver && !alive(g.Players[1]!),
      "one survivor",
    );
    check(
      target(g, g.Players[1]!) === g.Players[0]!,
      "target selected dead player",
    );
    addScore(g, 30000, 300, 300);
    check(
      alive(g.Players[1]!) && g.Players[1]!.Invincible > 0,
      "team extra life revival",
    );
    const next = copyGame(g);
    next.Players[0]!.Power.Blue = true;
    next.Enemies[0]!.X++;
    check(
      !g.Players[0]!.Power.Blue && next.Enemies[0]!.X !== g.Enemies[0]!.X,
      "copy leaked mutation",
    );
  },
  { scene: "scenes/main.scene.json" },
);
worldTest(
  "arcade upstream rules: projectile directions and 25 round victory",
  () => {
    for (const kind of ["mighta", "invader"]) {
      const g = game(),
        e = g.Enemies[0]!;
      e.Kind = kind;
      e.Cooldown = 0;
      e.X = 300;
      e.Y = g.Players[0]!.Y;
      updateEnemies(g);
      check(g.Projectiles.length === 1, "missing projectile");
      const p = g.Projectiles[0]!;
      check(
        kind === "mighta"
          ? !p.Laser && p.VX !== 0 && p.VY === 0
          : p.Laser && p.VX === 0 && p.VY > 0,
        "projectile direction",
      );
    }
    const g = createGame(levels, 1);
    for (let round = 1; round <= 25; round++) {
      check(g.Level.number === round, "wrong round");
      g.State = State.Playing;
      for (const e of g.Enemies) defeat(g, e, 1);
      stepGame(g, idle);
      check(Number(g.State) === State.Clearing, "round clear");
      for (let t = 0; t < 420; t++) stepGame(g, idle);
    }
    check(Number(g.State) === State.Won, "campaign did not end");
  },
  { scene: "scenes/main.scene.json" },
);
