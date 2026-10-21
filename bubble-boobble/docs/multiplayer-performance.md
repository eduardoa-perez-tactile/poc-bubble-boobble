# Multiplayer performance investigation

The reported symptom is slow-looking online movement in Chrome, with no noticeable input delay; local modes look normal. The current evidence separates server speed, snapshot cadence and client presentation cost. It does not yet establish that every source of the slowdown is fixed.

## Hosted authority

`.gameengine/perf-live-snapshot.json` observed the deployed authority for 11.8355 seconds: 238 snapshots, no transport errors and 60.073 world/document ticks per second. Snapshot delivery was approximately 20 Hz, matching the configured three-tick interval. The active game's tick advanced with the world. This sample does not support a slow authoritative simulation; it points toward how the client consumes and displays snapshots. It is a short transport observation, not a Chrome frame-rate measurement.

## Client changes under verification

The presentation-to-simulation bridge previously forwarded full display snapshots for every room and repeated serialization/validation work. It now retains the complete directory, rosters, notices and peer errors while forwarding game data only for the owned selected room. Browsing forwards no game snapshots. Existing public validators remain intact. Four focused projection tests passed, including privacy, no input mutation, stale/unowned selection and reduced four-room payload size. This reduces the local bridge's work; it does not reduce the server's network broadcast.

Display motion now interpolates valid keyed actors across one snapshot interval: three steps, or 50 ms. This is a display buffer, not client gameplay simulation or prediction. Room/player changes, restarts, state/wave/phase changes, respawns, identity/state changes and large jumps reset interpolation. Players, stable enemy/bubble/effect identities and eligible boss movement can interpolate. Unkeyed projectiles, items and particles still update at snapshot cadence, approximately 20 Hz; array positions are not treated as persistent identities.

## Before/after measurements

The three 600-step scenarios in `.gameengine/online-client-performance-v8-web-before.json` and `online-client-performance-v8-web-after.json` passed in both native V8 and WebAssembly. Web-lane totals were:

| Rooms received | Before | After | Change |
|---|---:|---:|---:|
| 1 | 6,010.56 ms | 6,205.23 ms | 3.2% slower |
| 2 | 6,456.89 ms | 6,017.99 ms | 6.8% faster |
| 4 | 7,343.75 ms | 6,186.49 ms | 15.8% faster |

The four-room result improves by about 16%, but the one-room result regresses by about 3%. In that one-room sample, `OnlineWorldClient` mean rose from 1.680 to 2.083 ms per step, approximately 0.40 ms of additional snapshot/motion bookkeeping. These combined changes are not an isolated motion-only benchmark.

The web tests use the debug WebAssembly engine test host. Their elapsed totals and system timings are comparison evidence, not Chrome gameplay FPS, GPU frame time or physical-phone performance. No new browser playtest was run.

## Visual pool follow-up

The measured baseline was 2,125 reserved online mesh entities versus 823 offline for the same solo state. Capacity now counts actual visible dragons and current pop effects while retaining the full presentation-cue safety margin. The actual online pool fell to 1,549 meshes (576 fewer, 27.1%). Before/after engine screenshots are byte-identical, and actual rendering remains 467 instances, 7 draw calls and 1,557 triangles. The renderer already culls zero-scale reserved meshes: this reduces allocation and traversal overhead, not the measured visible GPU workload. No Chrome FPS or memory reduction is claimed. Evidence: `.gameengine/pool-online-render-{before,after}.json`, `.gameengine/pool-online-{before,after}.png` and the new real-pool regression in `tests/online-presentation.test.ts`.

## Regression gates

The final desktop T0/T1 suite passed 368/368 cases, with an 11-draw structural peak against the 14-draw limit (`.gameengine/online-performance-full-desktop.json`). Final V8/WebAssembly online parity passed 32 cases per lane without mismatches (`.gameengine/online-performance-final-parity.json`). The focused phone-low T0/T1 selection passed 35/35 (`.gameengine/online-performance-phone-low.json`); these device-tier checks ran on the M2 Max host, not a physical phone.

The full-source release check also passed typecheck, validation, pipeline validation, cook and the 600-frame cooked smoke without a bypass (`.gameengine/online-performance-check.json`). Browser acceptance remains unverified until the updated build is exercised in Chrome.

## Published candidate

The performance update is live at [Play Bubble Madness](https://webgames.tactilews.com/bubble-madness-mp-8509a49-20261020t152237-19da/), built from clean revision `8509a4910afe0669ee04de710e453192567a632a`. [Linux CI 39447593321](https://github.com/eduardoa-perez-tactile/poc-bubble-boobble/actions/runs/39447593321) passed production startup and WebSocket checks. Exact browser/server script/config/input verification and packaging passed; ZIP `build/arcade/bubble-madness-performance-8509a49.zip` is 56,499,465 bytes, SHA-256 `53cc1c67109f71179846a86eb577d7319978684d330f360569a1748564a05177`. Office Arcade reported `published`, linked-file checks passed, and an independent hosted secure WebSocket upgrade passed. Chrome gameplay confirmation from the player remains pending.

## Enemy-entry follow-up

The player subsequently reported a brief drop while enemies descend, followed by smooth play. The production client path was measured through 240 authoritative ticks, including the 180-tick preparation/combat transition. The visual pool remained at 1,613 total entities throughout; there was no second allocation at landing. Native render samples used five draw calls, 447–467 instances, and no new texture uploads or pipelines. Explicit `sceneDraws` plus `orderedArrays` batches measured approximately 0.10–0.23 ms per plan in V8 and 0.43–0.53 ms in debug WebAssembly, without a descent-specific increase.

The cold first snapshot did spike: approximately 30 ms native and 134 ms in debug WebAssembly, including engine/test overhead. `ArcadePool` peaked at 7.70/20.50 ms respectively. Subsequent WebAssembly steps were generally 5–7 ms, including the combat transition. These measurements distinguish initial allocation from repeated entry behavior; they do not reproduce or fix the reported Chrome entry drop. No gameplay timings were changed and no speculative pool optimization was applied. Evidence: `.gameengine/entry-baseline-{v8,render,parity}.json`, `.gameengine/entry-final-v8.json`; regression fixture `tests/online-enemy-entry-performance.test.ts`.

## Window-switch disconnect

A separate confirmed defect explains AI takeover after switching windows. The pinned web player suspends WASM frames while hidden; socket polling therefore stops before the SDK can coalesce world snapshots. The actual engine `BrowserSockets` queue fills its 2 MiB receive limit in about 7.35 seconds at 20 messages/second with 14 KiB snapshots, then closes with `E_OVERFLOW`. This is a transport disconnect, rather than an intentional player leave.

The game-owned web shell now wraps native WebSockets only after observing the SDK's world hello. While the page or game dialog is hidden, it retains one latest complete snapshot per socket, bounded by the existing 256 KiB frame limit, and answers world ping packets with the SDK's legal binary heartbeat. It uses the pinned SDK batch decoder, preserves exact snapshot bytes, and forwards welcome, error, malformed and unknown traffic to the original SDK queue/validators. When visible, the retained snapshot is delivered through the original queue before the SDK resumes polling. Native close, explicit close and disposal discard retained data; no reconnect or identity reclaim is fabricated.

Offline suspension, background control release and resume-menu behavior remain in the existing lifecycle/input path. There are no background WASM frames, render loops or polling timers. This cannot keep a socket alive when a browser/OS entirely freezes or discards the page. The combined shell/control/transport suite passes 28/28. Genuine pinned `BrowserSockets` tests receive 1,200 maximum-budget 240 KiB snapshots over a simulated minute with no WASM frames, retain only the final snapshot, handle batched control traffic, and preserve the original malformed/oversized/nonworld limits. Evidence: `.gameengine/background-web-unit-tests.txt`. Actual window-switch browser acceptance remains unverified. This transport change is not evidence that the Chrome enemy-entry performance symptom is resolved.

## Published follow-up

The HUD/end-flow/hidden-window fixes are published at [Play Bubble Madness](https://webgames.tactilews.com/bubble-madness-mp-86dc75d-20261021t081826-1882/), built from clean `86dc75d291f611af5880075c06a22577be4bc6af`. Matching browser/Linux scripts, production startup, publication, linked files, hosted shell checksum and secure socket upgrade passed. This does not establish Chrome frame-rate or background-window acceptance. The reported enemy-entry hitch remains open; see [release evidence](multiplayer-release.md).
