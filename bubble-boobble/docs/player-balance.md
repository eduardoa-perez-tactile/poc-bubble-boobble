# Player balance

The playable game uses the following tuning at 60 simulation ticks per second.
These values intentionally differ from the pinned Go reference; they are not
translation corrections.

| Rule | Pinned Go | Playable game |
| --- | --- | --- |
| Movement | 3 px/tick (180 px/s) | 2.5 px/tick (150 px/s) |
| Movement with shoes | 5 px/tick (300 px/s) | 3.5 px/tick (210 px/s) |
| Shoes travel threshold | 11,520 horizontal px | 9,600 horizontal px |
| Bubble speed | 8 px/tick | 6 px/tick |
| Bubble speed with blue candy | 16 px/tick | 9 px/tick |
| Bubble range | 200 px | 160 px |
| Bubble range with pink candy | 400 px | 240 px |
| Firing interval | 18 ticks (0.3 s) | 24 ticks (0.4 s) |
| Firing interval with yellow candy | 5 ticks (1/12 s) | 12 ticks (0.2 s) |

Candy effects still combine independently. Blue changes speed, pink changes
range, and yellow changes the interval between shots. Shots stop at their exact
range even when that requires a partial final movement tick. Pickups do not
retroactively change existing bubbles' stored speed/range or an already-running
firing cooldown. Shoes affect horizontal movement and the arcade-derived vertical
movement cadence; see [arcade motion](arcade-motion.md).

Player jumps and falls now use the arcade-derived motion profile described in
[arcade motion](arcade-motion.md). Capture, pop/escape timers, other powerup trigger
thresholds, pickup effects and enemy projectiles retain their previous rules.
All powers still start disabled and reset on death and round transitions.
The separately requested slower normal enemies, player top traversal and cosmetic
skin/bubble colors remain in place.

The shoes threshold is lowered separately to preserve its earlier ideal earning
time at the slower walking speed. The original 11,520 pixels at 180 px/s took
64 seconds of actual movement; leaving that threshold unchanged at 150 px/s
would take 76.8 seconds. The new 9,600-pixel threshold takes 64 seconds solo, or
32 seconds when two unpowered players continuously contribute their full speed.
These are unobstructed movement minima, not guaranteed pickup times. Shoes still
join the shared FIFO queue, grant the boost only to their collector, and retain
the existing expiry and death/round-reset behavior. Movement remains 150 px/s,
or 210 px/s with shoes.

`src/arcade/balance.ts` defines `productionPlayerBalance` and
`referencePlayerBalance`. Each game's authoritative `PlayerBalance` stores numeric
configuration, survives round transitions, and is independently copied with the
session. Pre-change live sessions use production defaults when the field is
missing. This is session configuration, with no environment-dependent simulation
branch.

Original Go comparisons explicitly select `referencePlayerBalance` together with
`NormalEnemySpeedScale = 1`. Go's canonical snapshot has neither tuning field;
the existing named-field projection omits them. Original Go fixtures remain
reference evidence. Passing those configured comparisons does not claim that the
playable game's tuned movement and combat match Go.

## Reach and verification scope

The engine T0 traversal regressions retain real campaign geometry and cover both
players: round 1's five-tile rise, round 24's three-tile rise, and round 7's
eight-tile horizontal gap with shoes. They also document a deliberately lost
round 3 shoes landing and a successful alternative using a controlled mature
floating bubble. That fixture proves the bounce-assisted route, not that a
single fresh shot creates the same setup. These checks do not establish natural
completion of all 25 rounds or avoidance of enemies on those routes.

Eight rendered desktop goldens change only where slower shots alter bubble
positions or subsequent combat. The nine engine replays and all-tier pipeline
recording are refreshed for the new authoritative session state. Original Go
fixtures and imported artwork are unchanged.

The installed engine now rejects the retired `Camera.msaa` property in the
isolated pixel-renderer test scene. That obsolete override is removed; MSAA
continues to use the project's renderer-tier configuration. No engine code changes.

Before the shoes-threshold followup, checkpoint validation with
`npm run harness:verify-full` passed in 60.786 s:
132 V8 T0 cases, 23 desktop T1 cases, nine independently verified explicit-scene
replays, cold live viewport, typecheck/validation, desktop cook and 600-step smoke,
and asset provenance checks. The all-tier recording completed 684 steps and
230 explicit frames per tier, with peak draws 11/9/9 against the limit of 14.
Pure cached Go comparisons and the pinned-source enemy audit also passed with
the explicit original profiles; Go fixtures remain unchanged.

These are local macOS engine checks. Hermes is unavailable; physical device,
OS input/display, and full natural campaign progression remain untested. No
computer-use access was requested or used.

Shoes-threshold followup validation: `npm run harness:verify-full` passed in
53.770 s with 137 V8 T0 cases, 23 desktop T1 cases, nine independently verified
replays, cold live viewport, typecheck/validation, desktop cook and smoke, and
asset provenance checks. Cached pure Go comparisons passed with the original
11,520-pixel threshold; Go fixtures, screenshot goldens and pipeline records
remain unchanged. This does not add physical-device or natural-campaign evidence.

## Empty bubbles and fruit feedback

Production scoring awards 10 points for each popped ordinary empty bubble,
including each bubble in a chain. Enemy bubbles retain their existing combo
awards; their pop does not add another empty-bubble bonus. Expiry and jumping
on a bubble do not score. The 10-point award follows the
[arcade FAQ's empty-bubble rule](https://gamefaqs.gamespot.com/arcade/583720-bubble-bobble/faqs/1221).

Fruit pickups always display the awarded value using the same 45-tick floating
text effect as defeated enemies, including fruit worth less than 100 points.
The score, HUD, shared co-op score and extra-life thresholds use the same central
score function. Frequent small ring awards keep their previous non-popup behavior.

`PlayerBalance.ArcadeScoring` defaults to true in production and false in the
explicit historical Go profile, preserving the original oracle fixtures.
`arcade-scoring.test.ts` covers chains, duplicate prevention, fruit values, both
players, extra lives, copy isolation, renderer text and recorded engine HUD updates.
