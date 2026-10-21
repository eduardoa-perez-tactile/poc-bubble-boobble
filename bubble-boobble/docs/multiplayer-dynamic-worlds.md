# Dynamic online Wave Survival

This replaces the original fixed-size room flow. The former deployed `cd5516d` build and its rollback test reports describe the previous strategy, not this implementation.

## Player flow

Game mode selection has three full cards: Classic, Bubble Madness and Online Wave Survival. Online opens game setup with **Start Game Now** and **Browse Games**. Starting creates a new game immediately with one human dragon and nine unoccupied slots; there is no room code, required human count or wait for peers.

Browse Games lists live sessions with their wave, current human count, phase and Join Game action. Full and finished games remain visible with disabled actions. A player may join during combat. The server assigns the next available AI or pending-handover dragon first, then the next unused dragon slot. Existing waves, enemies, scores, pickups, boss state and other players are preserved. Joining an unused slot spawns that dragon; taking an AI dragon preserves its current state, including a downed state that teammates can rescue.

Leaving or an observed disconnect clears that human's controls and starts a five-second authoritative countdown before AI takes over the same dragon. Rejoining an available slot during the countdown cancels that handover. Actor position, powers, lives and the current battle are preserved. A reconnect is a fresh world connection that can choose a game and claim an available dragon; it does not promise the previous identity or seat. Opening the local menu only releases movement/fire/jump. It does not start the takeover countdown or pause the game.

The online HUD has one hierarchy: team score, wave and alive count on the first row; short local identity such as **YOU P1 BUB**, human/AI counts and Menu on the second; one compact objective/status strip below. There is no second startup GO panel or duplicate wave/objective banner. A pending handover remains visible as **P2 BOB: AI IN 5S**; the server's actual activation notice says **P2 BOB AI STARTED**, followed by a persistent AI roster/count. Personal downing shows a rescue message while the team keeps playing.

Authority-confirmed team defeat opens **GAME OVER / TEAM DEFEATED**; victory opens **TEAM VICTORY**. Score and wave remain visible. **View Results** becomes available after three seconds, and rankings open only when the player presses it. The terminal screen stays until the player chooses results or browsing, including after the authority expires the finished room. An immutable client-local terminal display is cleared on leave, a new selection or a connection epoch change; it never resumes gameplay or changes authority state.

## Engine strategy

The game uses the engine's real authoritative `multiplayer.world` API. Fixed matches and `PlayerInputs` cannot meet the requested start-immediately, dynamic join and AI-takeover behavior. Server-stamped start/join/input/leave envelopes arrive through the empty `OnlineWorldInput` marker. Client commands never supply a trusted actor identity. Held controls have a neutral timeout; a press and release in one server batch still produces one jump/shot.

The engine hosts one world per process. The game implements up to four independent sessions inside that world. Their complete gameplay/controller/navigation state lives in the nonreplicated `online.world.private` document. The public `online.world.public` document contains the directory, roster, notices and compact display snapshots. Actor collections use field tables; campaigns, RNG and AI controllers/graphs never cross the public transport. Only the authority steps gameplay. Clients validate snapshots and apply their selected game through transient recorded input to the existing renderer; a stale online snapshot cannot become a local simulation. Display positions for stable actor IDs interpolate between snapshots with a bounded three-step (50 ms) buffer; gameplay remains authoritative. See [performance findings](multiplayer-performance.md) for measurements and limits.

Public room metadata includes bounded `pendingTakeovers` entries (`slot`, short `label`, `remainingTicks`), and distinct join, leave and AI-activation notices. A leave notice starts the countdown; it does not claim AI has already begun.

The public document stays below 240 KiB, leaving room under the engine's 256 KiB packet ceiling. If four dense games do not fit simultaneously, full display snapshots rotate while every game's directory and roster remain present. Rendering keeps the last complete snapshot for the selected game. Cosmetic effects may be trimmed under pressure; combat actors are retained. Public lobby errors are bounded independently of spectator count.

This world API has no built-in prediction or interest filtering. Snapshots normally update every three server steps. Transport controls are deduplicated with a 250 ms heartbeat, and browser keyboard, touch and primary gamepad use the same menu/focus/suspend neutral-release gate. These facts distinguish the new mode from the previous rollback performance evidence.

Rooms without humans and finished rooms are eligible for cleanup after 1,800 active world ticks (30 seconds at 60 Hz); the oldest empty/finished room may be recycled when four slots are already allocated. Occupied ongoing games cannot be evicted to create another. AI games continue while someone remains connected to the world, including a browser in the lobby. When every connection closes, the engine pauses the world without resetting it. A server process restart resets its in-memory directory and games.

## HUD and end-flow verification — 21 October 2026

The online arena uses the existing `arenaLayout`/`worldFit` math with a 120-reference-pixel top reservation instead of the offline default of 48. The two header rows occupy 0–70 and the single two-line objective/status strip occupies 76–112, leaving at least eight reference pixels before the reserved arena boundary. The complete arena is fitted into the remaining area; this reduces its scale slightly. Offline layout is unchanged. This is a layout tradeoff, not a claimed performance optimization.

| Local check | Verified evidence |
|---|---|
| HUD semantics, full-scene layout and staged defeat | 4/4 T0/T1; `.gameengine/online-hud-focused.json` |
| Phone-low HUD/end-flow selection | 4/4; `.gameengine/online-hud-phone-low.json` |
| Existing new-game, active-room eviction and reconnect regressions | 3/3 T1; `.gameengine/online-hud-client-regressions.json` |
| Pending-AI HUD and victory device samples | Fold5 cover, iPhone 15 Pro and iPad 10 landscape; zero layout warnings; `.gameengine/online-hud-pending-devices.json` and `.gameengine/online-end-victory-devices.json` |

`tests/online-hud.test.ts` exercises full scenes at 768×720, 1680×720 and 640×960, including a crown-height airborne dragon, distinct header/identity/status boxes, personal rescue, the three-second gate, indefinite manual staging and a room-expiry snapshot at world tick 2000. Pixel probes require rendered score/objective glyphs, the yellow GAME OVER title, the green score and both button labels; layout or hit-test success alone cannot pass a blank end screen. UI documents `online-bar` and `online-end` pass their individual engine checks with zero issues, and typecheck passed.

Full-scene screenshots were inspected at `.gameengine/t1/online_hud_and_staged_defeat_fit_full_scene_{768x720,1680x720,640x960}/hud_review.mobile.metal.actual.png` and the corresponding `defeat_review.mobile.metal.actual.png` files. The pending-AI and victory composites are `.gameengine/online-hud-pending-devices.png` and `.gameengine/online-end-victory-devices.png`. Diagnostic screenshot calls were removed after inspection; permanent geometry, pixel-probe and lifecycle assertions remain. These are native engine/mobile-tier checks on M2 Max/Metal, not Chrome gameplay or physical-phone acceptance.

The first end-screen capture exposed a real missing font scope: `.online-end` was absent from the stylesheet selector that supplies `reference/arcade`. Adding it made title, score and buttons render correctly in the real transition. The translucent staging background was retained; no blank screenshot was accepted as a reference.

## Initial dynamic-release verification

`npm run multiplayer:world-test -- --cooked COOKED_EXPORT --host HEADLESS_ENGINE_HOST` starts the actual cooked engine authority and real WebSocket protocol peers. It implements no game rules in Node. The final run used `.gameengine/world-cooked-final`, the installed native headless engine host and build identity `0.1.0-d4e51832e7ac2c4b`. Its report is `.gameengine/world-evidence-final/summary.json`; the server exited cleanly and its stderr log is empty.

That initial-release run, before the five-second handover follow-up, started solo at world tick 3/game tick 1, entered combat with five real enemies at tick 183, and accepted the next human during combat at tick 186 without resetting the game. Ten actual socket peers received the same authoritative combat snapshot at tick 192. An eleventh peer could browse but could not enter the full game. Real controls produced nine shots and approximately 40 units walked. Disconnecting slot nine converted the same dragon to AI; a new participant then took that AI slot. Two independent games appeared in the live directory at tick 207, one in combat and one preparing. These are native authority/raw protocol-client checks, not compiled browser-client acceptance.

| Final local scenario measurement | Result |
|---|---:|
| Elapsed receive window | 3.44 seconds |
| Largest public document | 15,129 bytes |
| Largest WebSocket payload | 15,171 bytes |
| First peer mean received payload | 149,538 bytes/second |
| Server CPU sample at ten peers / end | 520 / 610 ms total |
| Server RSS sample at ten peers / end | 136,432 / 138,880 KiB |

Packet measurements exclude WebSocket/TCP headers. CPU and RSS are coarse OS samples of the entire native server process, including startup and networking; the world protocol exposes no isolated simulation-ms/tick profiler, so that value remains unmeasured. The short localhost scenario, including two games, does not establish a worst-case four-game payload, internet latency, physical-phone frame rate or thermal performance.

The completed engine and tooling checks are:

| Check | Result / evidence |
|---|---|
| Full desktop T0/T1 suite | 355/355; `.gameengine/online-dynamic-full-desktop.json` |
| Focused phone-low T0/T1 selection | 22/22; `.gameengine/online-dynamic-phone-low.json` |
| World-rule V8/WebAssembly parity | 8/8 per lane, no mismatches; `.gameengine/online-dynamic-web-parity.json` |
| All online V8/WebAssembly parity | 20/20 per lane, no mismatches; `.gameengine/online-dynamic-web-parity-online.json` |
| Phone-tier online client/UI selection | 3/3 T1 cases; `.gameengine/online-dynamic-phone-client.json` |
| Full-source release check | Passed typecheck, pipeline gate, validation, desktop cook and 600-frame cooked smoke without a bypass; `.gameengine/online-dynamic-check.json` |
| Browser controls and world-transport unit checks | 18/18; `npm run web:test-controls` |
| Release/deployment tooling unit checks | 23/23; `npm run arcade:test` |

Desktop and phone-low engine rendering ran on Apple M2 Max/Metal, using desktop and mobile tiers respectively. They are not physical-phone measurements. Clean mobile references were inspected and preserved after bounded GPU capture attempts. Intermittent native capture failure remains a limitation; it does not count as a successful complete mobile golden capture or browser acceptance. The passed focused phone-low and three-case mobile client/UI selections are recorded separately from that capture limitation.

Tests cover the server input boundary, room rules, compact display equivalence, payload pressure, client snapshot application, actual setup/join/leave buttons and mode-card selection. The dynamic-world browser/Linux release pair was built from clean revision `989dd4747d5b442ee0c87080fefba2f931791b57` and passed exact cooked-script/config/input verification. [Linux CI run 39444147208](https://github.com/eduardoa-perez-tactile/poc-bubble-boobble/actions/runs/39444147208) passed production startup, library resolution and WebSocket upgrade with `world: true`. The verified package is `build/arcade/bubble-madness-dynamic-989dd47.zip` (56,497,160 bytes, SHA-256 `0b838e58cfeebc870c9675bcfe32b5d3fb8b2b143e3dc7ff19c5874d8c670f3c`); reports are `.gameengine/dynamic-release-verify.json` and `.gameengine/dynamic-release-package.json`. Both targets contain script SHA-256 `f9be30be853702c08032d5e2ac076ae0613d3a2b5bdcc7653d787683f732c302`. These release checks do not establish browser gameplay.

No browser automation or standalone desktop playtest was performed for this change. `PROJECT.md` continues to require an explicit request for those actions. The dynamic-world package is now published at [Play Bubble Madness](https://webgames.tactilews.com/bubble-madness-mp-8509a49-20261020t152237-19da/). Publication, entry/linked-file checks and a hosted secure WebSocket upgrade passed. Browser gameplay remains unverified. The earlier URL continues serving its fixed-match build.

## Five-second handover follow-up verification

The cooked authority run in `.gameengine/world-evidence-polish/summary.json` passed all 12 socket checks with build identity `0.1.0-7e266e7740ea30d6`. Ten real protocol peers shared combat; a departing dragon exposed its pending countdown, another participant canceled that countdown, and a second departure activated AI at authority tick 504 after departure tick 204: exactly 300 ticks. A fresh participant then reclaimed the AI dragon, and a second independent room started. This is evidence for that cooked authority build, not an assertion that subsequent shell/UI changes have the same build identity or that Chrome gameplay was tested.

Focused engine checks passed 11/11 world T0 cases (`.gameengine/pending-takeover-world-t0.json`) and 8/8 public-codec T0 cases (`.gameengine/pending-takeover-public-t0.json`). The boundary regression retains neutral human control through tick 299 and activates AI at tick 300; it also checks canceled takeover, preserved actor health/powers, terminal cleanup and all forty possible public countdowns.

Ownership changes only on explicit leave or actual transport departure. Stale controls become neutral after 60 authority ticks while the connected player retains ownership. Window/background lifecycle releases local held controls; it must not request leave. The separate shell transport follow-up addresses unintended background socket overflow while keeping engine rendering suspended. A countdown measures 300 active authority ticks; it pauses when the engine pauses a world with no global connections.

## Combined follow-up gates

The 21 October candidate passes 379/379 desktop T0/T1 cases, with peak 11 draw calls against the 14-call structural limit; 43/43 focused phone-low cases; and 36 online T0 cases per V8/WebAssembly lane with zero mismatches. Reports are `.gameengine/online-polish-{full-desktop,phone-low,parity}.json`. The full-source release check passes typecheck, validation, current pipelines, desktop cook and 600 cooked smoke frames (`.gameengine/online-polish-check.json`). The web control/shell/transport suite passes 28/28 and release tooling 23/23. These engine/device-tier checks run locally; actual Chrome frame timing and window-switch acceptance remain unverified.
