import { expect, renderTest, worldTest } from "@gameengine/test";
import { WorldView } from "@gameengine/runtime";
import { DesktopIntent } from "../src/schema.gen.ts";
import { ResetArcade } from "../src/arcade/arcade.cheats.ts";
import { arcadeDrawPlan, referenceFrame } from "../src/arcade/presentation.ts";
import { createGame } from "../src/arcade/game.ts";
import { bubble } from "../src/arcade/bubbles.ts";
import { EnemyState } from "../src/arcade/types.ts";
import type { Level } from "../src/arcade/types.ts";
import campaign from "../data/levels.json";
const scene = "scenes/arcade.scene.json";
worldTest(
  "arcade reference render frame order and capture warning selection",
  () => {
    expect(referenceFrame("green/walk", 69)).toBe("reference/green/walk/6");
    expect(referenceFrame("green/walk", 70)).toBe("reference/green/walk/0");
    expect(referenceFrame("green/walk", -1)).toBe("reference/green/walk/0");
    const g = createGame(campaign as Level[], 42),
      e = g.Enemies[0]!;
    e.State = EnemyState.Trapped;
    g.Bubbles = [
      { ...bubble(100, 120), EnemyID: e.ID, Age: 55, CapturedAge: 1201 },
    ];
    const draws = arcadeDrawPlan(g, "blue");
    const captured = draws.find((d) => d.x === 100 && d.y === 168)!;
    expect(captured.image).toBe(referenceFrame(e.Kind + "/escape", 55));
    expect(captured.w).toBe(44);
    expect(draws.some((d) => d.image.startsWith("reference/blue/jump/"))).toBe(
      true,
    );
    expect(draws.at(-1)!.image).toBe("reference/blue/walk/0");
  },
  { scene },
);
for (const [width, height] of [
  [768, 720],
  [1680, 720],
  [640, 960],
] as const) {
  renderTest(
    `arcade reference board ${width}x${height}`,
    async ({ input, step, render, world, cheat }) => {
      input.view(width, height, 1);
      input.emit(DesktopIntent, {
        action: "navigate",
        value: "play",
        index: 0,
        x: 0,
        y: 0,
      });
      await step(2);
      await cheat(ResetArcade, { round: 1, seed: 42, players: 1, ready: true });
      await step(2);
      expect(world.resource(WorldView).designAspect).toBeCloseTo(768 / 720, 5);
      const [left, top] = input.worldToScreen([0, 720]);
      const [right, bottom] = input.worldToScreen([768, 0]);
      expect(left).toBeGreaterThanOrEqual(-0.01);
      expect(top).toBeGreaterThanOrEqual(-0.01);
      expect(right).toBeLessThanOrEqual(width + 0.01);
      expect(bottom).toBeLessThanOrEqual(height + 0.01);
      // HUD must follow the same centered reference canvas as the world.
      // Board containment alone would miss a HUD stranded at viewport top-left.
      const scale = (right - left) / 768;
      const region = render.probe({
        width,
        height,
        regions: [
          [
            Math.round(left + 280 * scale),
            Math.round(top + 16 * scale),
            Math.round(208 * scale),
            Math.round(24 * scale),
          ],
        ],
      }).regions[0]!;
      expect(region.mean[0]!).toBeGreaterThan(region.mean[2]! * 1.2);
      render.expectDrawCalls("<=", 8, { width, height });
      render.expectScreenshot("round1", { width, height });
    },
    { scene },
  );
}
renderTest(
  "arcade reference editor preview",
  async ({ input, step, render }) => {
    input.view(768, 720, 1);
    input.emit(DesktopIntent, {
      action: "navigate",
      value: "editor",
      index: 0,
      x: 0,
      y: 0,
    });
    await step(3);
    render.expectScreenshot("editor", { width: 768, height: 720 });
  },
  { scene },
);
