# Desktop rendering evidence

Wave Survival now adds a [modern presentation pass](game-feel.md) through the same
ordered pixel renderer. The source-parity observations below concern Classic;
party arenas intentionally use new colors, geometry, effects and actor poses.

The game owns its renderer workaround; the engine and pinned Go source are
unchanged. `src/arcade/presentation.ts` follows Go `internal/app/render.go`
ordering, frame selection, sizes, mirroring, warning thresholds, flashing and
avatar rules, with the playtest item fitting and selectable skins described in
[playtest-feedback.md](playtest-feedback.md) and [dragon-skins.md](dragon-skins.md).
Authoritative simulation state is read only during presentation.
The logical canvas is 768×720 with Contain fitting; physical letterboxes are
black, matching Ebiten's opaque-screen `fillBlack` behavior. HUD documents share
the centered logical canvas. Editor tiles begin at (24,146) with 16-pixel cells.

## Integer texture loads and ordered composition

`src/arcade/pixel-renderer/ordered.ts` builds ordered quad geometry in original
draw order. Production renders it as instances of one imported static unit quad,
with per-instance transforms, atlas rectangles and colors. The installed runtime
omits dynamic meshes from cold live viewports until an offscreen screenshot
initializes them; static file meshes render immediately. The dynamic mesh helper
remains for the isolated pixel prototype, not the production world.
Textured instances carry an atlas rectangle in `MaterialParams`; red/yellow
virtual frames encode their palette ID in whole 2048-texel U offsets, decoded
before the atlas load. CPU-composed runs instead carry `(-1, encodedR, encodedG,
encodedB)`. Renderer tint stays white: it is applied after material evaluation
and cannot safely carry a color that the material must first decode from sRGB.
All-zero parameters retain the dynamic prototype's vertex-color/UV path.
`assets/materials/pixel-ordered.material.ts` uses the supported material
DSL's raw WGSL function to call `textureLoad` at integer, mip-zero coordinates.
This bypasses the built-in Sprite sampler, which visibly interpolated the
original tile colors. All original assets remain unchanged; a deterministic
atlas is a derivative of those originals.

Opaque texels draw directly. Partial-alpha texels are resolved against preceding
original draws using the source's premultiplied, eight-bit encoded-RGB
source-over arithmetic, then emitted as opaque pixel runs. The shader converts
that encoded RGB to linear output for the engine. Ready/Clear/Hurry banner and
pause/result dimming also compose in encoded RGB, avoiding the brighter result
of applying the source alpha values through a linear-light UI blend. HUD text
uses corresponding dimmed colors; font rasterization remains a separate issue.
Menu circles draw before the logo, so logo partial alpha resolves over them.

The skin overlap regression exposed and corrected an inherited static-renderer
error in that final tint stage. A real production food texel now reads
`[0,178,0]`, matching the source composition, rather than the brightened
`[0,218,0]`. The original dynamic prototype was unaffected; its earlier source-
over checks alone did not prove the static instance color transport.

Geometry is clipped to the logical canvas. Mesh scratch capacity is 262,144
vertices and 393,216 indices (10.61 MiB including normals, colors, UVs and the
contributor stack). The 2048×1024 RGBA atlas requires 8 MiB before engine copies.
Capacity overflow throws rather than dropping objects. Scratch arrays are fully
rewritten and contain no authoritative or temporal game state. Static pixel instances and Text2D particles/editor labels use disjoint pooled
slots. The fixed-step pool uses a conservative count of immutable source partial
texels; full source-over composition runs only during presentation. Pools retain
their observed capacity and hide unused entries.

## Verification and its limits

`tests/pixel-renderer.test.ts` checks 64 original tile/player/empty-space RGB
samples and 64 source-over samples, all with exact channel equality. Its native
Metal/V8 capture passes with four draw calls, including 64 overlapping sprite
pairs. `tests/arcade-render.test.ts` covers native, wide 1680×720 and tall 640×960
boards, editor preview, fitted HUD placement and encoded overlays. Board captures
assert at most eight draws. Direct comparison with a fresh Go pause capture
also matches tile (1,49) = (57,25,59), footer white (30,690) = (60,60,60),
and panel (200,220) = (8,12,27), proving the encoded dimming correction.
These regression goldens are not blanket Go parity
certificates.

A frame-aligned round-one comparison found exact RGB equality in the enemy
rectangle (380,148)–(440,192), player rectangle (96,600)–(148,648), and empty
interior (48,72)–(720,145). The nearest renderer's left wall contains only the two
original colors. Its equality against one Go capture was 91.707%; the remaining
tile-boundary choice cannot be judged from one screenshot. Fresh pristine Go
launches themselves differed at 8,807 pixels, exclusively tile texel-boundary
stripes; their HUD pixels were identical. `tools/harness/visual-reference.mjs`
records both captures and reports differences honestly. Proven variable pixels
may be identified from repeated references; no broad tolerance or guessed mask
is used to turn unverified differences into a pass. Text glyph rasterization and
Go's unstable tile tie choices remain separately scoped visual limitations.

The four circle sizes are exact crops of a committed original Go menu capture.
The source uses integer `frame/2` movement, so circles move by whole logical
pixels. Reusing those crops preserves their sampled coverage at integer native
translations; coverage under resized rendering is a regression baseline, not an
independent Go antialiasing parity claim.

## Reproducing derivative assets

`tools/port/reference-captures/go-menu-r1-smoke1.png` preserves the original Go
capture outside cooked assets. `assets/pixel-renderer/circles-source.json`
records its SHA-256, pinned reference revision, crop boxes and inferred
presentation-frame range. Run:

```sh
python3 tools/port/build-pixel-assets.py
```

The script verifies the capture hash, reproduces circle crops, packs unchanged
reference sprites and logo, exports premultiplied texels with the pinned Go
standard library, and compiles the game-owned material. It contains no
machine-specific absolute paths. The original `sprites.json` manifest and source
textures are not rewritten.

## Desktop combat probe

On 2026-10-14, the release V8 host ran round 25, seed 42, two players,
600 steps and 1,200 recorded input events. The observed final state was tick 600,
score 3,900 and 32 bubbles. Simulation step time was p95 0.583 ms / max 1.639 ms;
sampled presentation time was p95 0.820 ms / max 4.269 ms. Reported memory was
154.31 MiB and maximum GC pause 0.285 ms. A requested final GPU frame had five
draw calls and 58 instances. The complete desktop page/effect replay separately
peaked at eleven draws against its fourteen-draw budget.

Reproduce with a fresh `gameengine run --headless --paused --scene
scenes/arcade.scene.json`, then `npm run harness:perf-combat`. The probe writes
`artifacts/perf-combat.json` and a requested screenshot. These paused protocol
measurements establish scenario execution and CPU/structural cost on this Mac;
the sampled presentation values and final frame are not a real-time GPU
frame-rate measurement. Stop that owned headless session when finished.

## Cold live viewport regression

The user-reported HUD-only black frame was reproduced through the engine's
`viewport.create` readback path without computer-use access. CPU dynamic geometry
was present, but the live frame had only two draws and 125 triangles. Calling
`render.screenshot` made the same world's geometry appear, which explains why the
older screenshot tests passed. The working `round1.scene` used ordinary 2D
sprites and rendered its character and level in the same cold viewport.

`tools/harness/viewport-smoke.mjs` now captures actual viewport frames before any
offscreen render or diagnostic preload. With static quad instances, the complete
tile band and player render in five draws and 1,065 triangles. It checks world
pixels independently of the HUD and runs in both verification lanes.

The atlas image and layout metadata also had the same cooked alias. Layout data
is now `atlas-layout.json`; the texture retains `pixel-renderer/atlas`. The asset
guard rejects duplicate nonempty aliases across all cooked asset kinds. Removing
this collision alone did not fix the reproduced viewport failure.

Static unit-quad interpolation changes nearest-sample ties relative to the old
per-quad vertex UVs. Reviewed native/wide/tall baseline differences were 9,551,
9,614 and 4,742 pixels: respectively 9,140/9,184/3,910 were the two original tile
colors exchanging at texel boundaries, 402/419/639 were the same exchanges under
the banner, and 9/11/193 were glyph or sprite-edge texels. Native player artwork
matched the previous baseline. No UV bias or broader threshold was introduced;
only the inspected renderer baselines were refreshed. The unchanged isolated
prototype still passes all 128 exact RGB/source-over probes. These limits remain
distinct from the cold live-viewport visibility regression.
