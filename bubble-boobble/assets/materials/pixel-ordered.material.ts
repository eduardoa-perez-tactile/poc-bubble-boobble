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
  instanceParams,
  abs,
} from "@gameengine/materials";
import palettes from '../../data/dragon-palettes.json' with {type:'json'};
// The same immutable palette table drives CPU source-over and this GPU lookup.
const paletteBranches = Object.values(palettes).flatMap(palette => palette.swaps.map(swap =>
  `if (skin == ${palette.id} && all(rgb == vec3u(${swap.from.join(',')}))) { return vec4f(vec3f(${swap.to.map(v=>v+'.0').join(',')})/255.0,c.a); }`,
)).join('\n');
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
fn pixel_load(p: vec2f) -> vec4f {
 let skin = i32(max(floor(p.x/2048.0),0.0));
 let c = textureLoad(tex_atlas,vec2i(floor(p-vec2f(f32(skin)*2048.0,0.0))),0);
 if (skin == 0) { return c; }
 let rgb = vec3u(round(c.rgb*255.0));
 ${paletteBranches}
 return c;
}
`,
);
export default material("PixelOrdered", {
  blend: "mask",
  alphaCutoff: 0.999,
  cull: "none",
  fog: false,
  params: { atlas: texture2d({ default: "white", srgb: false }) },
  surface: () => {
    // All-zero params retain the dynamic-mesh prototype's original UV path.
    const rect = instanceParams();
    const useRect = step(0.000001, abs(rect.x).add(abs(rect.z)));
    // Direct CPU-composed runs use x=-1 and encoded RGB in yzw. Renderer tint
    // is applied after this shader, so it cannot carry colors needing decode.
    const directParams = step(rect.x, -0.5);
    const atlasUV = mix(mix(uv(), rect.swizzle('xy').add(uv().mul(rect.swizzle('zw'))), vec2(useRect)), vec2(-1), vec2(directParams));
    const pixel = loadPixel(atlasUV.mul(vec2(2048, 1024))),
      direct = step(atlasUV.x, -0.5);
    const globals = materialGlobal(0),
      pos = worldPosition(),
      screenY = pos.y.neg().add(720);
    const banner = globals.z
      .mul(step(108, pos.x))
      .mul(step(pos.x, 660))
      .mul(step(globals.y, screenY))
      .mul(step(screenY, globals.y.add(82)));
    const encoded = mix(pixel.rgb, mix(vertexColor().rgb,rect.swizzle('yzw'),vec3(directParams)), direct);
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
