# Wave Survival prototype

## Direction and scope

A shared-screen cooperative run for one to six human players, with optional AI
filling the remaining dragon slots. The first prototype uses the campaign's
level-one geometry, nine enemy waves and a boss on wave ten. Victory ends the
run; an optional post-boss endless mode remains a future extension.

Open **START GAME → BUBBLE MADNESS** from the main menu. The default team is one human and five
bots. The selection screen presents six color-framed dragon portraits in a three-column,
two-row grid inspired by an arcade character-select screen. Select each card to
cycle Human → AI → Empty. Arrow keys or a controller navigate spatially; confirm
changes the highlighted slot. Start and Back remain separate from the cards. At least one human is
required. Start on a controller joins its corresponding slot. The two keyboard
layouts remain available. See [controller-input.md](controller-input.md) for
control mappings and the installed engine's input limitations.

During a run, pause → **TEAM SETUP** changes Human/AI/Empty assignments without
restarting the wave. Resuming applies those assignments and clears recorded pad
holds, providing a manual recovery path after a disconnected controller. The
host exposes no recorded disconnect event, so automatic takeover is deferred.

## Implemented increments

| Increment | Result | Evidence |
|---|---|---|
| Six-dragon foundation | Six slots, floor spawn areas, purple/orange skins, matching shots, player numbers and six-slot footer | Palette CPU/GPU probes, actual arena goldens, slot tests |
| Local input and bots | Independent recorded input for six pad indices; per-bot memory with shared immutable navigation graphs | Raw engine-input integration, independent snapshot tests, legacy companion regressions |
| Wave survival | Whole-wave formations, movable preparation countdown, escalating enemy counts and mixed types, safe rest periods | Wave boundary/placement/variety tests, full natural bot wave clear with damage disabled, recorded transition replay |
| Recovery and boss | Contact rescue, automatic rest recovery, persistent survivor upgrades, boss windup/vulnerability/attacks/summons, victory/results/restart | Rescue/wipe tests, real bot boss damage, ordinary bubble boss kill, result replay and visual captures |

## First balance values

- Each wave appears in full during a three-second preparation countdown. Players
  can move and jump into position; enemies and their attacks stay frozen, and
  players cannot fire or take contact damage. Ten safe rest seconds precede the
  next wave's preparation.
- Six spawn areas: tile columns 3, 8, 13, 18, 23, 28, floor row 25.
- Enemy budget: `min(32, 3 + wave * 2 + (occupied slots - 1) * 2)`.
  Six occupied slots face 15 enemies together on wave one, rising by two per
  wave to 31 on wave nine. Occupied slots include bots.
- Formations spread across eight columns and four heights, alternating sides
  between waves. Normal waves have no delayed reinforcements or spawn queue.
- Wave one mixes Zen-Chan and Monsta; waves two through five add Banebou,
  Mighta, Pulpul, and Invader respectively. Every unlocked type appears in each
  wave. Movement speed stays at the current playable tuning.
- Dragon numbers, AI labels, rescue labels, spawn markers and footer text use
  their dragon's green, blue, red, yellow, purple or orange identity color.
- A defeated dragon becomes a stationary rescue bubble. An active dragon within
  52 pixels on both axes rescues it. A full team knockout ends the run.
- Rests clear hazards, recover downed dragons and disable firing. Survivors keep
  upgrades; knocked-out dragons lose them. Bots collect rewards and then idle.
- The campaign's hurry-up and level-skip behavior do not run in survival.
  Parasols grant temporary protection instead of skipping waves. Score-based
  extra lives do not override the rescue rules. Campaign score/profile records
  remain separate from this prototype's team result.
- Boss health is `12 + occupied slots * 6`. Its 300-tick cycle winds up for 90
  ticks, exposes it for 150, then closes for 60. The attack drops projectiles at
  active dragons' positions; it summons two enemies every 600 ticks with a
  one-second entrance warning. Ordinary
  traveling bubbles damage it while exposed. Existing enlarged Mighta art is a
  placeholder; dedicated boss art and richer attack patterns are future work.

The run owns its wave, timer, slots, pending entrances and boss state. Resting
and preparing are explicit phases; arena data is copied from the campaign.
Party mode dispatches through the existing fixed-step game owner. Bot decisions
and held controller state belong to simulation documents, so recorded input is
sufficient for replay. The legacy solo/two-player modes remain available.

## Formation feedback validation — October 15, 2026

- 205 V8 logic tests, 32 desktop render tests, and all 17 saved replays pass.
- The 31-enemy wave also passes the mobile-tier, phone-low memory test, with
  preparation and combat below the 14-draw-call ceiling.
- Typechecking and asset/scene validation pass. No new build or cook was made.
- Hermes remains unavailable; these checks do not establish device GPU timing.

## Initial validation checkpoint — October 15, 2026

Local macOS arm64 Game Engine release V8/Metal:

- Full harness: 202 T0 logic cases and 29 desktop T1 cases passed, with 17
  independently verified explicit-scene replays, cold viewport checks,
  typechecking, validation, desktop cook and 600-frame cooked smoke.
- Final focused lobby checks cover 768×720, 1680×720 and 640×960. Reviewed
  goldens cover six distinct dragons, rests, the boss, the selection grid, open slots and matching
  palette shots. Menu baselines intentionally include the new Survival button.
- All-tier pipeline recording observed the existing presentation route over 230
  explicit frames per tier: peaks 11/9/9 draws (desktop/mobile/compat), under 14.
  Both new colors use the existing atlas and generated palette material.
- A 600-step one-human/five-bot headless sample after initialization measured
  simulation p95 0.561 ms, maximum 0.815 ms, zero hitch steps, 198.4 MiB process
  memory and maximum GC pause 0.252 ms. A separate 768×720 frame used six draws
  and 473 instances. The sample excludes initial navigation graph construction;
  sparse headless rendering does not establish playable GPU frame rate.

Hermes is unavailable because its host binary is not installed. Physical six-pad
input/reconnection, OS display/audio, and device GPU/thermal behavior were not
verified. All testing stayed within Game Engine APIs, per PROJECT.md. Existing
reference opaque-tile, camera-authoring and built-in Standard pipeline warnings
remain; they are not new survival failures.

## Next increments

1. Playtest wave duration, six-player readability and recovery pressure with
   humans; adjust the starting balance values from that evidence.
2. Improve boss-specific art, attack telegraphs and multiple attack patterns.
3. Measure first navigation graph construction and sustained six-dragon combat
   through a live engine viewport; extend stress coverage across later waves.
4. Add persistent survival records and decide whether victory unlocks endless
   play. Hardware disconnect detection depends on a recorded engine event.
