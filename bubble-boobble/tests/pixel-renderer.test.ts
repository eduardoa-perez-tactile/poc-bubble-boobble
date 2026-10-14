import { expect, renderTest, worldTest } from "@gameengine/test";
import {
  updateOrderedPixels,
  composedColorAt,
  orderedArrays,
  orderedCapacity,
} from "../src/arcade/pixel-renderer/ordered.ts";
import probes from "../assets/pixel-renderer/prototype-probes.json";
worldTest("pixel instance capacity bounds clipped scaled alpha runs", () => {
  for (const scale of [0.1, 0.777, 1, 1.5, 2.75]) {
    const draws = [
      { image: "reference/logo", x: -17, y: 18, w: 450 * scale, h: 324 * scale },
      { image: "reference/food/1/0", x: 730, y: 695, w: 32 * scale, h: 32 * scale, flip: true },
      { image: "reference/green/jump/0", x: 96, y: 604, w: 48, h: 48 },
    ];
    expect(orderedArrays(draws).vertices / 4).toBeLessThanOrEqual(orderedCapacity(draws));
    expect(orderedCapacity(draws)).toBeLessThanOrEqual(65536);
  }
  expect(orderedCapacity([{ image: "reference/logo", x: 768, y: 0, w: 450, h: 324 }])).toBe(0);
}, { scene: "scenes/pixel-prototype.scene.json" });
renderTest(
  "pixel renderer exact texel prototype",
  async ({ step, render, input }) => {
    input.view(768, 720, 1);
    const draws = [
      { image: "reference/tiles/01", x: 0, y: 48, w: 24, h: 24 },
      { image: "reference/green/jump/0", x: 96, y: 604, w: 48, h: 48 },
    ];
    for (let i = 0; i < 64; i++) {
      const x = 500 + (i % 8) * 24,
        y = 108 + Math.floor(i / 8) * 24;
      draws.push(
        { image: "reference/tiles/01", x, y, w: 24, h: 24 },
        { image: "reference/food/1/0", x, y, w: 24, h: 24 },
      );
    }
    updateOrderedPixels("pixel-ordered-prototype", draws, 1 / 45, 384, 360);
    await step(2);
    // Original source texels, including empty space, prove the shader actually
    // renders sharp pixels; an accidentally empty golden cannot satisfy this.
    const actual = render.probe({
      width: 768,
      height: 720,
      points: probes.map((p) => [p.x, p.y] as [number, number]),
    });
    for (let index = 0; index < probes.length; index++)
      for (let channel = 0; channel < 3; channel++)
        expect(actual.points[index]!.rgba[channel]).toBe(
          probes[index]!.rgb[channel],
        );
    const alphaPoints = Array.from(
      { length: 64 },
      (_, index) =>
        [500 + (index % 8) * 3, 108 + Math.floor(index / 8) * 3] as [
          number,
          number,
        ],
    );
    const alphaResult = render.probe({
      width: 768,
      height: 720,
      points: alphaPoints,
    });
    for (let i = 0; i < alphaPoints.length; i++) {
      const [x, y] = alphaPoints[i]!,
        wanted = composedColorAt(draws, 3, x + 0.5, y + 0.5),
        got = alphaResult.points[i]!.rgba;
      expect(got[0]).toBe(wanted & 255);
      expect(got[1]).toBe((wanted >>> 8) & 255);
      expect(got[2]).toBe((wanted >>> 16) & 255);
    }
    render.expectDrawCalls("<=", 4, { width: 768, height: 720 });
    render.expectScreenshot("prototype", {
      width: 768,
      height: 720,
      threshold: 0,
      maxCap: 0,
    });
  },
  { scene: "scenes/pixel-prototype.scene.json" },
);
