import {
  material,
  texture2d,
  unlit,
  uv,
  vec2,
  vertexColor,
  mix,
  step,
  fn,
  wgsl,
  materialGlobal,
  worldPosition,
  vec3,
} from "@gameengine/materials";
const srgbToLinear = fn(
  "pixel_srgb_to_linear",
  "vec3f",
  wgsl`
fn pixel_srgb_to_linear(c: vec3f) -> vec3f {
 return select(pow((c+vec3f(0.055))/1.055,vec3f(2.4)),c/12.92,c<=vec3f(0.04045));
}`,
);
const loadPixel = fn(
  "pixel_load",
  "vec4f",
  wgsl`
// The atlas is this material's own declared texture binding. Integer loads
// select original mip-zero texels even when the logical canvas shrinks.
fn pixel_load(p: vec2f) -> vec4f { return textureLoad(tex_atlas,vec2i(floor(p)),0); }
`,
);
export default material("PixelOrdered", {
  blend: "mask",
  alphaCutoff: 0.999,
  cull: "none",
  fog: false,
  params: { atlas: texture2d({ default: "white", srgb: false }) },
  surface: () => {
    const pixel = loadPixel(uv().mul(vec2(2048, 1024))),
      direct = step(uv().x, -0.5);
    const globals = materialGlobal(0),
      pos = worldPosition(),
      screenY = pos.y.neg().add(720);
    const banner = globals.z
      .mul(step(108, pos.x))
      .mul(step(pos.x, 660))
      .mul(step(globals.y, screenY))
      .mul(step(screenY, globals.y.add(82)));
    const encoded = mix(pixel.rgb, vertexColor().rgb, direct);
    const bannerEncoded = vec3(8 / 255, 12 / 255, 27 / 255).add(
      encoded.mul(25 / 255),
    );
    const finalEncoded = mix(encoded, bannerEncoded, banner).mul(
      globals.x.neg().add(1),
    );
    return unlit({
      color: srgbToLinear(finalEncoded),
      alpha: mix(pixel.a, 1, direct),
    });
  },
});
