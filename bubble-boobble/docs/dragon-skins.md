# Dragon skins

Settings → DRAGON cycles **green → blue → red → yellow**. Clicking or confirming
advances; keyboard Left reverses and Right advances. The preview and label update
immediately. The choice belongs to the active profile and survives saving/reload;
existing version-1 green/blue profiles keep their settings and statistics.

The selected dragon appears in the profile list, settings preview, level editor,
gameplay and life icon. Player one keeps the selected skin in solo and co-op;
player two retains the existing blue dragon. Skins are cosmetic and do not alter
collision dimensions, movement, combat or scoring.

Red and yellow reuse all 19 original green walk/jump/shoot/death frames through
virtual frame aliases. Exact palette swaps preserve transparency, black outlines,
white eyes, pink details, original frame bounds and animation timing. Red uses a
red body and the original yellow spines; yellow uses a warm yellow body and orange
spines. Original green/blue art, atlas pixels and reference fixtures are unchanged.

`data/dragon-palettes.json` supplies the immutable CPU/GPU color mappings.
The existing pixel material samples the original atlas and applies the selected
palette; the source-over compositor applies the same mapping when composing
translucent effects. No duplicate textures or additional sprite quads are needed.
`src/desktop/skins.ts` supplies the valid saved names and selection order.

The overlap tests also exposed an inherited color-space error: CPU-composed
colors passed as renderer tint were brightened after the material decoded them.
Static composed runs now carry encoded RGB directly in material parameters and
use white renderer tint. The real presentation regression verifies a partial
food texel stays `[0,178,0]`, rather than becoming `[0,218,0]`. This corrects
translucent edges without changing original source texels or the dynamic-mesh
reference prototype.

Regression coverage includes per-profile persistence, legacy saves, invalid skin
rejection, real settings input, every animation frame, solo/co-op selection and
palette rendering at gameplay/preview/icon sizes. The full presentation replay
also visits red and yellow settings previews; its pipeline check requires both
the selected labels and actual body-color pixels on every recorded GPU tier.

## Validation

October 15, local macOS arm64 release V8/Metal host:

- `harness:verify-full` passed in 51.182 seconds: 116 logic tests, 20 visual
  tests, seven independent replay verifications, cold live viewport, typecheck,
  validation, desktop cook, 600-step cooked smoke and asset provenance checks.
- The all-frame contact sheet has 59,584 exact green-to-palette RGB comparisons
  with zero mismatches across all 19 frames and both orientations. GPU probes
  cover 48/96/36/28-pixel sizes, canvas clipping, and source-over colors.
- All-tier pipeline recording covers 643 steps and 215 rendered frames per
  tier, with actual red/yellow body pixels and selected labels verified. Peaks
  are 11/9/9 draws for desktop/mobile/compat against the existing limit of 14.
  The custom program is `4e6a1dfe77ea2e70`; the old custom program was replaced.
- Cold viewport residency remains 11,185,048 texture bytes and five draws;
  virtual skins add no atlas texture allocation. The desktop presentation route
  measured CPU p95 1.491 ms per simulation step and 4.362 ms per sampled
  presentation frame, 234 MiB process memory, and 0.361 ms maximum GC pause.
  These protocol-driven desktop figures do not establish real-time GPU or phone
  performance. Frame-name construction retains existing temporary strings.
- Existing tracked visual baselines are unchanged. Eleven new captures cover
  both selected skins and the animation contact sheet; thresholds were not
  relaxed. Original PNGs, atlas/pixel data, sprite manifest and Go fixtures are
  unchanged.

Hermes, physical OS-input/display checks and device GPU/thermal checks were not
run. Existing warnings for original opaque tile 12 and the installed engine's
unregistered built-in Standard pipeline remain. No engine edits or computer-use
access were required.
