# Ten-dragon prototype

Bubble Madness now has ten fixed identities: green, blue, red, yellow, purple,
orange, cyan, pink, ivory and slate. The default team is one human and nine bots;
every slot can be Human, AI or Empty. Classic keeps its campaign geometry and
solo/two-player behavior. Explicit six-slot simulation scenarios remain supported.

## Identity and presentation

Each dragon has a fixed name shown on its lobby card, overhead badge and footer:
Bub (green), Bob (blue), Ember (red), Sunny (yellow), Plum (purple), Tango
(orange), Mist (cyan), Rosie (pink), Pearl (ivory) and Flint (slate). Bub and Bob
are the original pair ([Taito](https://taito.co.jp/en/BB4F/console)); the other
eight names are original to this game. Names replace player numbers and the old
pixel identity symbols. AI is a suffix; HELP takes its place when downed. Badges
are plain text in the dragon’s own color, including HELP, with no rectangle or border. Names appear during each three-second
preparation countdown, then disappear during play; only HELP remains until rescue.
The footer keeps the full roster visible without covering the arena.
Cyan and pink have darker spines; ivory has brown spines and slate has pale blue
spines, without new textures or animation geometry. Matching ordinary bubbles
use each dragon's palette. Trapped and elemental bubbles keep semantic colors.
Human readability and color-vision testing still need a real group playtest.

The lobby uses five columns and two rows. The gameplay footer uses five entries
on each of two rows inside the existing footer band. Ten simultaneous badges are
tested for separation. Original campaign menu portraits retain their layout.

## Wave signals and finishers

The opening match holds dragons through a centered 3–2–1 countdown, with human
practice shots available. After that, humans and AI can move, jump and shoot
throughout the whole inter-wave break, including preparation for the next wave.
GO signals enemy release rather than unlocking movement between waves.
The large green GO cue lasts one second, and the top wave-start banner lasts
two seconds. The existing two-second start protection remains, with solid,
visible dragons throughout that grace period instead of blinking. Later rescue
protection can still blink normally.

The final enemy kill earns a two-second LAST KILL celebration in the finisher's
own color, both in the top banner and as plain text above that dragon. The
actual popper owns chained bubble kills; released fire, water and thunder retain
the releasing dragon, and dynamite credits its collector. The dragon that pops
the captured boss gets the award on the victory screen. Credit is recorded once
per wave, copied with snapshots, and reset for the next countdown. There is no
new score bonus or change to shared scoring. Normal name labels still disappear
at GO, and the finishing label stays clear of floating score text.

## Enemy placement

Wave previews use type-aware placement on the existing arena geometry. Zenchan,
Banebou, Mighta and Invader reserve grounded slots first: the entire collision
body must fit above a continuous supporting surface, with zero vertical speed
and grounded state already set. All enemy artwork falls from above during the
countdown, then settles on that assigned position before GO. This entrance is
presentation only: ground enemies keep their supported simulation coordinates.
Monsta and Pulpul can use remaining platform
space; if no platform slot fits, they use a clear air pocket. Neither group can
overlap another starting enemy or an occupied dragon start/current position.
Slots are allocated deterministically once per wave, with the same enemy types
and budgets as before. `tests/party-placement.test.ts` checks every normal wave
for every team size in six- and ten-slot modes, plus scarce footing and ceilings.
The arena tiles and platforms are unchanged by this placement fix.

## Playable arena

Dragon Courtyard is implemented as **44×30 tiles**, or 1056×720 world pixels.
It has 40 interior columns instead of 28, about 43% more usable width and 59%
more total tile area. Classic and explicit six-slot simulation scenarios retain
32×26 dimensions. See [the courtyard plan](ten-dragon-courtyard.svg).

Five districts use columns 4, 12, 20, 28 and 36, with a floor start on row 29
and an upper partner on row 24. Three middle shelves, four upper shelves and
staggered crown ledges provide alternate routes. Every rise is five tiles or
less. The authoritative bot navigation graph proves every platform is reachable
from all ten starts without upgrades. Navigation warms four nodes per movement
profile per tick, with immutable snapshots shared by equivalent bots. Local
movement, firing and avoidance remain active while full routes warm; normal
and shoes graphs match the synchronous physics-derived graph exactly.

Per-arena bounds drive movement, wrapping, bubbles, elemental effects, enemies,
boss patrols, food placement and navigation. Validation only accepts the larger
dimensions for authored courtyard levels. Campaign data and physics defaults
remain intact.

The pixel compositor fits the board inside the existing 48-pixel HUD bands;
the engine camera retains the original menu/HUD canvas. Wide windows use more
of the visible horizontal area, with explicit compositor clipping extended into
the gutters. A 96-pixel jump-headroom reserve also keeps a crown-ledge jump inside the view.
The entire board remains visible at 768×720, 1680×720, 640×960 and
2560×1080. Badges keep a 10-pixel reference font instead of shrinking with the
board. Actor collision sizes and movement are unchanged; rendered bodies become
about 34 pixels wide at the native canvas and 37 pixels on a wide window.

Whole-wave entrances use clear positions on rows 9, 14, 19 and 22, across the
arena. They stay away from starts and below the countdown panel once settled.
The enemy ceiling remains 32.

Enemy counts retain the old formula for teams of up to six; above six, each
pair of additional dragons adds one enemy. Ten dragons face 17/25/32 enemies on
waves 1/5/9, compared with 15/23/31 for six. This is initial tuning, not a claim
of equivalent difficulty. More firing and easier contact rescues may require
further balancing after human playtests. Rescue distance and pickup ownership
are unchanged so the first comparison isolates team size and arena layout.

Boss HP keeps the old six-player curve and adds four HP per additional occupied
slot (70 HP at ten). Thunder-potion supply can serve all ten dragons across both
starting tiers. Existing bottle-fan size, windup and movement speed stay bounded.

## Verification

Repeat the release-host six-versus-ten boss comparison with
`node tools/harness/perf-party.mjs`. It writes
`artifacts/ten-dragon-performance.json` with CPU percentiles, memory, draw counts
and the final observed game state. This is a desktop CPU/structural probe, not
a device GPU or thermal measurement.
Focused coverage lives in `tests/party-ten.test.ts` and `tests/courtyard.test.ts`: two-tier safe starts, full navigation-graph reachability without upgrades, clear
formations, ten distinct names, clustered labels, P10 raw/named input,
boss pickup supply, rescues, deterministic bot snapshots, ten real lobby buttons,
wide/tall layouts and a phone-low sustained-firing render budget.

Physical ten-controller support, human readability, sustained device GPU time and
thermals require separate hardware/group testing. Recorded engine input verifies
the adapter for pad indices 0–9; it does not prove ten physical pads on the OS.

### Initial ten-dragon measurements (before the larger arena)

Release V8/Metal host, mobile rendering tier, 768×720 explicit render probes;
600 measured boss steps after 60 warm-up steps, one firing human, remaining
slots bots, seeded game and protected team:

| Team | Simulation p95 | Sampled presentation p95 | Process memory | Peak draws |
|---|---:|---:|---:|---:|
| Six | 1.181 ms | 1.011 ms | 241.47 MiB | 6 |
| Ten | 1.446 ms | 1.344 ms | 255.03 MiB | 6 |

Both teams stayed alive with the boss active throughout the sample. Ten dragons
increased simulation p95 by about 22% and process memory by about 13.56 MiB.
Maximum recorded GC pause was 0.563 ms. The comparison excludes first navigation
graph construction and does not establish real-time GPU frame rate or thermals.
The focused mobile/phone-low late-wave and boss render scenario also peaks at
six draws, below the existing ceiling of 14, with every shooter identity observed.

Initial ten-dragon engine verification passed: 245 V8 logic cases, 42 desktop render cases,
29 independently verified replays, typechecking, validation, desktop cook,
600-step cooked smoke and original-asset provenance. Focused ten-dragon and
palette checks also pass with the mobile GPU tier and phone-low memory budget.
The complete presentation route peaks at 12/10/10 draws on desktop/mobile/compat.
Existing original-tile/camera warnings and the installed engine's Standard
pipeline registry warning remain. Hermes is unavailable; no physical controller,
OS input/display, device GPU/thermal or human group playtest was performed.

### Dragon Courtyard validation — October 19, 2026

Validation passes: **263 V8 logic cases, 45 desktop render cases and
32 independently verified replays**, plus typechecking, validation, desktop cook,
600-step cooked smoke and original-asset provenance. Six courtyard-specific cases
and the ten-dragon cases pass on the mobile tier with phone-low memory tracking.
Native/wide/tall/ultrawide wall probes, full-board captures, crown-jump framing,
far-edge physics, snapshot isolation and shoes/normal navigation are covered.
Twelve legacy companion hash traces remain identical across the graph refactor.

Release V8/Metal, mobile rendering tier, same protected boss probe and 600-step
steady sample described above:

| Arena/team | Simulation p95 | Sampled presentation p95 | Process memory | Peak draws |
|---|---:|---:|---:|---:|
| Original / six | 1.191 ms | 1.033 ms | 228.27 MiB | 6 |
| Courtyard / ten | 1.697 ms | 1.614 ms | 273.25 MiB | 6 |

The larger arena initially built all navigation in one update, taking 48.78 ms.
Bounded construction reduces the measured maximum of the first two updates to
9.88 ms; the synchronous six-player control measured 26.00 ms. Those startup
samples include simulation and initial visual allocation; subsequent route warming
is spread across preparation ticks. Local bot controls continue during warming,
and a rescued bot reuses ready routes rather than replacing them with an older
partial snapshot. Both movement profiles are tested against the full synchronous
physics graph. Maximum GC pause in the steady ten-dragon sample was 0.562 ms.

The ten-human late-wave/boss stress capture observes every shooter identity,
36 simultaneous bubbles and peaks at eight desktop / six mobile draw calls,
below the existing budget of 14. These are desktop CPU and rendering-structure
measurements; physical device GPU, thermals, ten-controller support and human
readability still require playtesting. Existing engine registry/camera/art warnings
and unavailable Hermes verification remain as described above.

## Final mobile snapshot refresh

The full 44-case mobile render run with phone-low memory tracking passes 38 cases,
including the ten-dragon lobby, courtyard, palette and firing/rescue scenarios.
Six general render tests fail exact color or draw-count assertions on this GPU
tier: encoded overlays, title animation, palette source-over, party countdown,
six-dragon HUD and the exact-texel prototype. These are not counted as passing
mobile coverage. Desktop render checks, all 31 recorded replays and the cooked
build check pass. Successful mobile captures have been refreshed for the final
names, character-colored text and temporary overhead labels.

## Wave fruit

Survival rewards rotate through the eight existing fruit sprites (food 13–20),
starting with red berries and progressing through citrus, peach, banana, pear
and watermelon before repeating. Both bubble-pop rewards and defeated-enemy
drops use the current wave. Pickup points stay at the arena’s original value;
Classic keeps its original per-level foods and scores. No new textures or
palette variants are needed. `tests/wave-fruit.test.ts` checks both paths,
collection points, the deterministic cycle and actual final-pop render captures.
