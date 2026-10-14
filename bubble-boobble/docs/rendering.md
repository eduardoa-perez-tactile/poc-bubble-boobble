# Desktop rendering evidence and remaining gaps

`src/arcade/presentation.ts` follows the pinned Go `internal/app/render.go`
`drawMatch` ordering and sprite selection: tiles, items, enemies, bubbles,
projectiles, elemental effects, players, particles, then the HUD bars and icons.
Frames come from the original `sprites.json` manifest, with Go's
`max(0, tick) / 10 % frameCount` selection. Sizes, positive-direction mirroring,
warning/escape thresholds, invincibility flashing and two-player avatar rules
follow that source. Presentation does not mutate authoritative match state.

The visual pool reserves slots 0–2 for the board background and HUD bars,
3–834 for all 832 tile cells, then ordered runtime objects. It grows to the
observed peak without truncating reference collections, and hides unused slots.
Editor preview uses the original 16-pixel tile grid at logical (24,146),
original spawn positioning scaled by 2/3, and P/F/B markers.

The 768×720 logical canvas uses `WorldView` Contain. HUD documents use the same
centered canvas. Native 768×720, wide 1680×720, and tall 640×960 T1 captures passed
on the desktop Metal/V8 host on 2026-10-14, including a maximum-eight-draw-call
assertion. A pixel probe of the fitted ROUND label region protects against a
previous bug where the world centered correctly but the HUD stayed at viewport
origin. The editor preview also rendered successfully; the exact toolbar labels, individual button widths, header and hints have a
reviewed regression golden.

These Tactile goldens are regression baselines, **not Go visual-parity passes**.
The source renderer and engine do not currently rasterize the sprites identically.
A read-only Pillow comparison between ignored local `artifacts/go-round1.png`
and the native T1 golden measured the static left-wall rectangle
`(0,48)–(48,672)`:

| Measurement | Result |
| --- | --- |
| Pixel equality | 54.17% |
| Mean absolute RGB channel error, 0–255 scale | 3.922 |
| Go wall colors | `(244,106,252)` and `(252,194,252)` only |
| Additional engine wall colors | e.g. `(249,165,252)` and `(251,188,252)` |
| Empty interior rectangle `(48,72)–(720,145)` | 100% pixel equality |

The intermediate wall colors show texture interpolation across source texels.
The existing `filter = "nearest"` asset metadata does not establish that the
running engine honors nearest sampling: the pixels demonstrate otherwise.
No supported sprite-sampler setting was found in the packaged engine schema,
CLI sources or documentation during this investigation. A verified game-owned sampling adapter is needed before nearest-sampling parity
can be claimed. The original textures remain preserved.

Player/enemy areas also differ, but a strict error budget for those areas
requires frame-aligned reproducible Go captures; the current ad hoc Go screenshot
is not sufficient to attribute every actor-region difference to sampling.
Text rasterization also needs a separately reviewed allowance. There is no
broad visual tolerance that turns either unsupported area into a passing check.


A game-owned nearest-sampling workaround is being prototyped separately. The
core renderer retains the Sprite path and the measured limitations above until
that adapter receives its own verification slice; no engine changes are needed.

Core performance probe: macOS arm64 release V8, round 25, two players, seed 42,
600 ticks of recorded movement/jump/fire input produced score 3900 and 32 live
bubbles. Sim step p50/p95/max was 0.355/0.569/0.951 ms; GC max 0.185 ms; process
memory 203.5 MB. A requested final render used six draws and 334 instances.
The paused protocol run sampled 35 presentation frames (p95 4.358 ms), rather than
600 rendered GPU frames; these are local CPU/structural observations, not a
real-time GPU frame-rate claim or a supported-device budget pass.
