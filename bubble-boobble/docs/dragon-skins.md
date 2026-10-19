# Dragon skins

Settings → DRAGON cycles **green → blue → red → yellow → purple → orange → cyan → pink → ivory → slate**. Clicking or confirming
advances; keyboard Left reverses and Right advances. The preview and label update
immediately. The choice belongs to the active profile and survives saving/reload;
existing version-1 green/blue profiles keep their settings and statistics.

The selected dragon appears in the profile list, settings preview, level editor,
gameplay and life icon. Player one keeps the selected skin in solo and co-op;
player two retains the existing blue dragon. Party mode assigns each dragon its own skin; the ten dragon names and AI markers
identify teammates above their actors and in the footer. Downed dragons appear
inside matching rescue bubbles. Prepare/rest phases mark the ten starting areas.

Skins are cosmetic and do not alter
collision dimensions, movement, combat or scoring.

Red, yellow, purple and orange reuse all 19 original green walk/jump/shoot/death frames through
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

Purple uses `[180,90,255]`; orange uses `[255,135,0]` with pale orange spines.
Both reuse the original geometry and have matching two-shade bubble palettes.
The ten-color engine GPU probe checks rendered body pixels and matching shots.

The four added skins reuse the same virtual palette path. See [Ten-dragon prototype](ten-dragon-prototype.md) for identity cues, layout, arena and the larger Dragon Courtyard arena. Earlier six-color measurements below remain historical checkpoints.

## Matching shot colors

Ordinary bubbles use the firing dragon's color through all four growth frames
and while floating. Player one follows the active profile; co-op player two
shoots blue. The original green bubble artwork is unchanged. Blue uses the same
`[0,170,255]` body hue as the blue dragon; red and yellow use `[255,0,0]` and
`[255,220,0]`, with matching darker shades. Highlights and transparency remain.
Warning, trapped-enemy and elemental bubbles keep their existing distinct art.

Each fired bubble stores optional numeric `Shooter` metadata (0 or 1), retained
through copies and filtering. Legacy bubbles without it fall back to player one.
Physics never reads this field. The original Go canonical projection removes
only `Shooter` from copied bubble entries; engine replay hashes retain it. Tests
compare 240 owned/unowned ticks through capture with identical original state,
RNG, counters and sounds.

Virtual bubble palettes reuse the original four frames without extra textures.
The presentation replay ends with actual yellow/blue co-op shots, and all-tier
pipeline checks require both rendered bubble colors in addition to skin previews.

Bubble-color validation on the local release V8/Metal host passed
`harness:verify-full` in 56.016 seconds: 122 logic tests, 23 visual tests, nine
independent replay verifications and the cooked-game/provenance checks. All
46,464 rendered bubble palette samples match exactly across four frames, three
new palettes and both orientations. Eight new captures were reviewed; existing
goldens, source art, atlas/pixel data and Go fixtures remain unchanged.

The all-tier route covers 684 steps and 230 rendered frames per tier. Both bubble
color markers are verified from actual pixels; peak draws remain 11/9/9 against
the existing limit of 14. The new custom program is `3209a4bd719a3d11`.
Desktop protocol-driven CPU p95 is 1.796 ms per simulation step and 4.520 ms per
sampled presentation frame, with 233 MiB process memory. Ownership adds one
scalar to the existing shot object, without a separate tracking map; palettes
add no texture allocation. These figures do not establish phone performance.
The untested-platform and existing-warning limits below also apply here.

## Initial skin validation (PR #7)

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
