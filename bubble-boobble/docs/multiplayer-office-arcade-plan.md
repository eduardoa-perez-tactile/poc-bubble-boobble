# Bubble Madness multiplayer implementation plan

Status: implementation authorized and in progress, 20 October 2026. Publication remains a separate action. See [release instructions](multiplayer-release.md) and [the implementation experience log](multiplayer-experience-log.md) for verification evidence and remaining limits.

Build browser multiplayer for ten-dragon Wave Survival and publish it to Trond's Office Arcade. A match contains one to ten human-controlled dragons, with deterministic AI filling all remaining slots. The first networking milestone must support ten connected clients; fewer-human playtests are additional coverage.

The deployment destination is [Office Arcade](https://webgames.tactilews.com/browse/). Follow its live [agent publishing guide](https://webgames.tactilews.com/agents/), checked on 20 October 2026, and re-read it before implementation and publication. Trond explicitly proposed this destination for Bubble Madness in [the game's Slack thread](https://tactilegames.slack.com/archives/C0C5NQMELH0/p1792497112430349). His [announcement](https://tactilegames.slack.com/archives/C0C5NQMELH0/p1792409251961999) describes an experimental office service, without an ongoing support commitment.

## Target experience and match rules

- Add an Online Wave Survival entry alongside the existing local modes.
- The creator chooses the human count, from one to ten, and a named room. The invitation carries that human count and room identifier. All clients must request the same match parameters; verify the engine rejects incompatible join requests.
- The engine starts the match when the selected number of human seats is filled. Joining the room means being ready. Show the required and connected human counts while waiting; do not implement a separate ready protocol in this version.
- There are always ten dragon slots in the existing courtyard arena. Network seat `i` controls dragon slot `i`; slots from the human count through nine are AI. A two-human match therefore has two network seats and eight AI dragons, rather than ten network seats waiting for eight nonexistent clients.
- One human participates per browser client. Keyboard, the primary controller and the existing virtual controls drive that client's assigned dragon.
- Human count, seat mapping, AI roster, arena and gameplay rules are fixed when the match starts. Fresh participants join a new match. Hot joining and replacing a bot mid-match are outside this first version.
- Opening a local menu does not pause the shared match. Release local controls when leaving gameplay input focus. The menu must make continuing gameplay clear.
- The result shows all ten dragons and their human or AI ownership. A rematch creates or joins a fresh match through the normal start path; one client's results button cannot reset another client's active simulation.
- Keep online results separate from offline campaign progression. Any local record is written once after a confirmed result and match teardown, outside rollback.

Use fixed real-time matches with authoritative input synchronization and rollback. This directly exercises the engine's match client, `PlayerInputs`, rollback and authoritative server. The guide also supports always-open worlds through `multiplayer.world`, but that is a different design with no built-in client prediction. Revisit this choice before implementation if joining an ongoing match becomes required; do not mix the two transports.

## Architecture and boundaries

The browser runs the game and predicts inputs. The authoritative engine server runs the same cooked simulation. Office Arcade runs the exported Linux server and routes its secure socket. AI logic is ordinary shared simulation on both server and clients; bots are not extra connections.

| Area | Current integration | Planned change |
|---|---|---|
| Gameplay state | `src/arcade/session.ts` stores `GameState` in `defineDoc` | Retain this model and prove document restoration through rollback tests. |
| Game step | `src/arcade/engine.ts` consumes desktop requests, `ActionState`, pads and `ArcadeInput` | Separate shared gameplay stepping from offline device and menu orchestration. Add a network input adapter. |
| Initialization | Desktop start requests call `createPartyGame` with seed 1 | Add deterministic match initialization from `multiplayer.match()`, independent of the creator's local world, save or menu. |
| Ten-slot roster | `createPartyGame` accepts human, AI and empty slots | Always supply ten occupied slots online; derive ownership from the actual network human count. |
| Input seats | Local party actions and pad indices | Read `PlayerInputs` and `MorePlayerInputs` using `playerInput`; declare both resources. Exercise seats beyond the first four explicitly. |
| UI and saves | Desktop documents and persisted meta participate in simulation | Keep client-specific connection UI, preferences and profile data outside shared match state. Audit every hashed document/resource, including inactive systems. |
| Audio and effects | `ArcadeAudioSystem` currently runs in the simulation stage; other effects use presentation | Move or adapt online playback to presentation and prevent duplicate cues after resimulation. Keep gameplay-relevant state deterministic. |
| Browser controls | `web/controls.mjs` feeds the existing recorded input bridge | Route online controls into the engine's multiplayer mapping or `setInput`, and disable duplicate local gameplay input. Preserve offline controls. |
| Build and release | Existing tooling exports web; GitHub workflow deploys a prebuilt static artifact | Add a separate Office Arcade package and a verified Linux server build path. Preserve the existing static publishing workflow. |

Use `multiplayer.join/status/events/setInput/leave` only from presentation. Shared simulation may read `multiplayer.match()` and network input resources. Local socket state, names, menus, rendering dimensions, audio preferences and save loading must not affect shared hashes.

The match start rebuilds the world. A local lobby event cannot be assumed to survive that rebuild or reach the server. Initialize once from shared match information. Convert the engine's decimal 64-bit match seed to the game's RNG seed with a documented deterministic conversion; do not pass it through an imprecise JavaScript `Number` conversion. Test multiple seeds and clean initialization after rematch.

Preserve the existing gameplay implementation and all companion controller memory in world state. Audit copy-on-write behavior for nested objects and shared AI navigation graphs under snapshot restoration. Avoid a broad ECS rewrite unless measured failures require it.

## Milestone 1 Verify prerequisites and lifecycle contracts

1. Re-read `PROJECT.md`, engine `work-loop`, `multiplayer`, `rollback-multiplayer`, `determinism` and `sim-boundaries` instructions. Record the engine version; the current SDK reports 0.1.15.
2. Capture offline regression baselines with existing engine tests. Confirm the editor is not building native systems before starting tests or checks.
3. Inspect the installed match implementation and sample to verify human-count overrides, full-room start, world rebuild, seat assignment, room compatibility and input prediction on missing peers.
4. Verify real-time seat-token reclaim, catch-up limits and timeout behavior. Do not infer real-time reconnect guarantees from turn-game persistence or the always-open-world API.
5. Define the first disconnect policy from those results. Attempt same-seat reconnect only when supported and tested; clear held input immediately. If a match cannot recover, give an explicit match-ended or rejoin-unavailable state. AI takeover requires a synchronized engine event and is deferred unless that path is proven.
6. Establish a working Ubuntu 24.04 or compatible Linux build environment with access to the same engine release and required runtime/toolchain. Produce a runnable authoritative server export as an early feasibility check.

Exit gate: document the lifecycle contract and Linux build recipe. If fixed matches cannot meet the chosen human-count or recovery behavior, resolve the design before building the lobby. Do not silently substitute a Node simulation or an always-open world.

The existing GitHub Pages workflow downloads and deploys a prebuilt web artifact. It does not build the proprietary engine. Its Ubuntu runner alone does not establish access to a Linux SDK, toolchain or engine source. Identify the actual distribution method or configured runner before adding CI configuration.

## Milestone 2 Prove ten-client simulation and AI fill

1. Extract a common step boundary so offline and online adapters call the same Wave Survival rules.
2. Add shared match initialization and the ten-slot roster. Keep offline desktop requests from starting, pausing, reconfiguring or quitting the online simulation.
3. Define a stable button order for Jump and Fire, matching the configured input mapping. Preserve movement, held fire and jump edge behavior through network input packing.
4. Read all network seats, including zero-based seat nine. Feed AI slots exclusively through deterministic companion logic.
5. Isolate menu, profile, audio and other device-specific state from the match hash. Verify that server execution needs neither a UI nor local save services.
6. Prove that resimulation produces the same state and does not duplicate audio, celebrations or terminal transitions.

Exit gate: ten-peer rollback and authoritative tests pass during active Wave Survival gameplay. Test one, two, five and ten human seats with AI fill, and exercise rescue, pickups, capture, boss attacks and results. A test remaining on the title screen is not multiplayer evidence.

## Milestone 3 Build the browser room experience

Implement create/join, invitation parsing, waiting counts, assigned dragon identity, local menu, connection errors, disconnect/reconnect feedback, results and fresh-match retry. Validate room identifiers and human counts. Show build/version mismatch and unavailable/full room errors in usable language.

Build new UI through engine UI documents and thin controllers, following `ui-documents` and `screen-fit`. Connection state belongs to presentation. A client may submit its own controls, not another dragon's slot or authoritative gameplay state. Multiple waiting rooms must remain isolated.

Connect keyboard, primary controller and touch to the local network seat. Release held input on cancellation, focus loss, backgrounding, disconnect and screen transitions. Test existing browser suspension behavior against the new transport; reconnect must not restore a stale fire or movement latch.

Exit gate: engine-driven UI and input checks cover waiting, start, local controls, error states, results and exit. Repeat offline menu, solo, local co-op, AI and ten-dragon regressions.

## Milestone 4 Validate networking and performance

Use the installed CLI's help to confirm flags before adding scripts. Representative gates, after online gameplay initialization is wired:

```sh
gameengine net test --players 10 --latency 4 --jitter 2 --frames 1800 --synctest 6 --json
gameengine mp test --players 10 --authority server --latency 4 --jitter 2 --frames 1800 --js v8 --json
gameengine mp test --players 10 --authority server --latency 10 --jitter 6 --frames 1800 --js v8 --json
gameengine mp test --players 2 --authority server --frames 1800 --js v8 --json
```

Run additional human counts, seeds and a longer boss/results soak. Use ordinary world tests for precise gameplay cases. Run V8/Hermes and V8/web parity where supported and disclose missing hosts. Ordinary replay and hash-trace coverage does not currently cover match steps; use `net test` and `mp test` as the network correctness evidence.

| Concern | Acceptance evidence |
|---|---|
| Determinism | No divergence, desync or SyncTest failures in active matches, including highest seats and mixed AI rosters. |
| Gameplay | Independent movement, jumping and shooting; shared capture/rescue/boss state, kills, score and outcome. |
| Local differences | Different saves, settings, skins and viewport sizes leave shared state identical. Synchronize any cosmetic choice that affects game state, or keep it local to presentation. |
| Lifecycle | Verified room start, incompatible joins, full room, leave, same-seat reclaim or explicit failure, server loss and restart. No promises of persisted live matches. |
| Network stress | Latency/jitter measurements and documented stall behavior. Test interruptions through a supported engine/transport harness; do not invent CLI flags. |
| Presentation | No duplicate rollback sounds or result actions; ten identities and connection messages fit supported viewports. |
| Performance | Record server milliseconds per tick, client milliseconds per frame with rollback, rollback depth, stalls, bytes per second and memory. Aim for simulation steps well below the engine's 2 ms rollback guidance on the measured machine; report hardware and measurement conditions. |
| Regression | Offline tests, relevant render/pipeline checks, cooked validation and `gameengine check` pass after code changes. Check phone-low residency; desktop measurements do not prove mobile GPU or thermal performance. |

Before publication, verify the actual compiled browser client against the actual compiled server. Trond's guide requires at least two separate browser contexts, controls, visible shared actions, console/request inspection, screenshots and disconnect/rejoin. Add a ten-browser-client capacity test; engine bot tests alone do not prove ten-browser behavior.

`PROJECT.md` currently restricts playtesting to engine APIs and permits browser automation only when the user explicitly requests that specific action. Preserve that restriction. Prepare the browser acceptance procedure, but mark it pending until specifically requested. A deferred browser check is not a pass, and `check_game` or a WebSocket upgrade cannot replace it.

## Milestone 5 Package the Office Arcade release

Build both targets from one clean source revision, matching engine version and compatible configuration/build identity. Use the existing web export path so the virtual controls and splash are included. The guide's underlying commands are:

```sh
gameengine build web --config release --out WEB_EXPORT
gameengine build server --target linux-x64 --authority server --port 8787 --out SERVER_EXPORT
```

Run the Linux server build on Ubuntu 24.04 or compatible Linux CI. The arcade runtime uses glibc 2.39. A macOS executable or a dry-run export cannot replace a Linux executable. Use release gates, current pipeline coverage and matching game/build identities; do not override identity checks to mask a mismatched export.

Package this directory layout:

```text
release.zip
  arcade.json
  site/                  Complete browser site, using relative asset links
  server/
    gameengine-server    Runnable Linux x64 executable
    server.json
    game/                Cooked game
    ...                  All other exported files and shared libraries
```

The root manifest is:

```json
{
  "version": 1,
  "server": {
    "runtime": "gameengine",
    "target": "linux-x64",
    "entry": "server/gameengine-server"
  }
}
```

Verify executable permissions, Linux dependencies, complete cooked content, matching identities and the ZIP layout. Record source SHA, engine version, build configuration and artifact checksums. Keep SDK source, caches, credentials and saves out of the ZIP. The guide's compressed upload limit is 1 GiB.

Use the deployment's same-origin secure socket, normally `wss://webgames.tactilews.com/<slug>/socket`, so a fresh publication name does not require editing and rebuilding gameplay code. Derive it in presentation for arcade builds, retain an explicit local development endpoint, and verify the engine browser host permits the chosen origin lookup. Do not carry a localhost default into the shared release.

Each managed game has a separate restarting container. Public network egress, host ports and host mounts are unavailable; temporary writes belong in `/tmp`. In-memory matches are lost on server restart. The release must run without custom startup scripts, Dockerfiles, a health-wrapper server or external service calls.

Exit gate: one verified ZIP and release evidence, ready for review. No publication during the planning task.

## Milestone 6 Publish and verify when requested

1. Re-read the live guide and use Office Arcade MCP if connected; otherwise use its documented stateless JSON-RPC HTTP endpoint at `https://webgames.tactilews.com/mcp`. Tactile network/VPN access is required; installation and credentials are unnecessary.
2. Call `list_games`. Select a new available slug, such as `bubble-madness-mp` if available; existing addresses cannot be overwritten. Managed slugs allow up to 48 characters.
3. Call `prepare_publish` with that slug and `multiplayer: true`, using the engine runtime contract. Upload the ZIP bytes to the returned URL with the returned headers.
4. Treat HTTP 202 as queued. Poll `publication_status` until `published` or `failed`. Stop and report JSON-RPC errors or `result.isError`; an accepted upload is not a successful deployment.
5. Call `check_game` and inspect the returned file checks. This covers the entry page and directly linked files, not all runtime assets or gameplay.
6. Complete the authorized browser acceptance procedure against the published URL. Publish-status, file checks, shared gameplay, ten-client capacity and reconnect results must be reported separately.
7. Deliver the actual returned play URL, socket URL, source/build identity, checks performed and remaining limits. Do not claim general internet availability from office/VPN access.

Preserve prior working publications. If a deployment is faulty, share the previous verified play URL and stop advertising the faulty release; use a newly available slug for the replacement. Do not assume an unverified overwrite or deletion capability exists.

## Experience report for Trond

Keep a repository log during implementation, then produce a concise report covering instruction followed, expected behavior, actual result, engine version, exact reproducer, workaround and suggested instruction improvement. Separate engine defects, guide gaps, hosting limitations and game integration mistakes.

Include ten-client and AI-fill results, performance/bandwidth measurements, the Linux build experience, publication state and actual browser acceptance evidence. Record deferred checks as deferred. Draft the report and links for the user; sending it to Slack requires the user's instruction.

## Review checkpoints

1. Lifecycle and Linux build feasibility established.
2. Ten-client simulation and mixed AI matches pass.
3. Browser room flow and offline regression checks pass.
4. Matching release ZIP and evidence are ready.
5. Publication is explicitly requested, then guide-required deployed acceptance is completed within the user's testing authorization.

Implementation can proceed through these checkpoints without choosing a separate cloud provider. The first unresolved infrastructure dependency is a compatible Linux build environment, not server hosting.
