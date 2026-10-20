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
