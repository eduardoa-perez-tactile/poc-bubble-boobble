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
      await cheat(ResetArcade, { round: 1, seed: 1, players: 1, ready: true });
      await step(2);
      expect(world.resource(WorldView).designAspect).toBeCloseTo(768 / 720, 5);
      const [left, top] = input.worldToScreen([0, 720]);
      const [right, bottom] = input.worldToScreen([768, 0]);
      expect(left).toBeGreaterThanOrEqual(-0.01);
      expect(top).toBeGreaterThanOrEqual(-0.01);
      expect(right).toBeLessThanOrEqual(width + 0.01);
      expect(bottom).toBeLessThanOrEqual(height + 0.01);
      if (width !== 768 || height !== 720) {
        const outside: [number, number] = width > height ? [20, 360] : [320, 20];
        const rgba = render.probe({ width, height, points: [outside] }).points[0]!.rgba;
        expect(rgba.slice(0, 3)).toEqual([0, 0, 0]);
        expect(rgba[3]).toBe(255);
      }
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

renderTest(
  "arcade reference encoded overlays",
  async ({ input, step, render, cheat }) => {
    input.view(768, 720, 1);
    await step(2);
    await cheat(ResetArcade, { round: 1, seed: 1, players: 1, ready: true });
    await step(1);
    const points: [number, number][] = [[1, 49], [5, 49], [200, 280]];
    const ready = render.probe({ width: 768, height: 720, points });
    expect(ready.points[0]!.rgba.slice(0, 3)).toEqual([244, 106, 252]);
    expect(ready.points[1]!.rgba.slice(0, 3)).toEqual([252, 194, 252]);
    // Source banner uses premultiplied color.RGBA{8,12,27,230} over black.
    expect(ready.points[2]!.rgba.slice(0, 3)).toEqual([8, 12, 27]);
    input.emit(DesktopIntent, { action: "pause" });
    await step(1);
    const paused = render.probe({ width: 768, height: 720, points });
    expect(paused.points[0]!.rgba.slice(0, 3)).toEqual([57, 25, 59]);
    expect(paused.points[1]!.rgba.slice(0, 3)).toEqual([59, 46, 59]);
    // Compare solid glyph interiors only: source encoded-RGB dimming rounds
    // channels. Glyph-edge raster coverage is a separate parity limitation.
    const hudPoints: [number, number][] = [[315,20],[25,29]];
    const pausedHud = render.probe({width:768,height:720,points:hudPoints});
    expect(pausedHud.points[0]!.rgba.slice(0,3)).toEqual([60,52,25]);
    expect(pausedHud.points[1]!.rgba.slice(0,3)).toEqual([55,58,60]);
    render.expectScreenshot("pause", { width: 768, height: 720 });
    await cheat(ResetArcade, { scenario: "boundary-campaign-win" });
    await step(1);
    const result = render.probe({ width: 768, height: 720, points: [[1,49]] });
    // The dedicated result screen replaces the old dimmed arena and combat HUD.
    expect(result.points[0]!.rgba.slice(0,3)).toEqual([8,12,27]);
    const resultHud = render.probe({width:768,height:720,points:hudPoints});
    expect(resultHud.points[0]!.rgba.slice(0,3)).toEqual([8,12,27]);
    expect(resultHud.points[1]!.rgba.slice(0,3)).toEqual([8,12,27]);
    render.expectScreenshot("result", { width: 768, height: 720 });
  },
  { scene },
);
