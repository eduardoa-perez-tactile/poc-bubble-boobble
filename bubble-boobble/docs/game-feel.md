# Multiplayer game feel

The modern presentation applies to Bubble Madness / Wave Survival. Classic keeps its original arena art, actor sizes, scoring, movement and sound ordering. Shared settings now include **EFFECTS: FULL / REDUCED**; the extra row and smaller dragon preview fit the existing logical canvas.

## Presentation

- Traveling bubbles stretch on emission, settle into a floating wobble, and have a small glint and short ownership-colored trail. Capture compresses the bubble vertically and adds a ring. Trapped, elemental and rescue bubbles have different visual treatments; dragon names and HELP labels supplement color.
- Pops expand into pixel rings and a few droplets. Rendering caps simultaneous pop effects at 18. Existing score particles receive stronger typography for larger awards, with a compact burst/chain announcement.
- Dragons stretch in the air, recoil when firing, compress on landing, and briefly narrow on turns. Contact shadows keep them grounded; brief color-matched names identify them during preparation. Wave-start protection keeps their sprites visible.
- Three coordinated arena palettes advance every three waves. Quiet masonry, highlighted platform tops, distant arches and sparse motes replace the party arena's bright stripes. Connected tile runs share primitives rather than adding an object per tile.
- Rescues produce a rising ring, sparkles, SAVED label and distinct ascending cue. Boss windups compress the sprite; a hit holds its animation pose, recoils and produces an impact ring. Its original dedicated boss frames remain intact. Capture and major team moments use short, bounded camera impulses.
- Wave banners ease into place. Results use a score-panel pop and a short UI confetti burst for a team victory. Gameplay instructions disappear on the result screen; the final boss finisher retains their credit.

Presentation changes preserve collision boxes, enemy rules, boss damage, rescue distance and score multipliers. Countdown input gating is an intentional gameplay change. The existing player controller already supplies coyote time and jump buffering.

## Sound and reduced effects

Original short mono cues are generated reproducibly by `python3 tools/art/build-feel-audio.py`, and preloaded through `audio/juice.bank`. Party audio coalesces simultaneous shots and pops into one cue per fixed step, limits voices and prioritizes captures, rescues and danger. Existing elemental and item sounds remain with adjusted party gains. Muting unloads both sound banks so no older cue can return on unmute.

Reduced effects disable camera shake, trails, ambient motes, landing dust, decorative rescue sparkles and victory confetti. Capture/pop rings, identity markers, HELP/SAVED labels and core sound feedback remain available.

## Architecture and limits

`src/arcade/juice.ts` owns pure geometry and bounded cosmetic history. `ArcadeFeel` is a presentation-only resource with a ten-player snapshot and at most 32 short-lived cues. Pause holds its clock. The simulation never reads it.

Opaque color primitives use the existing ordered pixel material, including exact encoded-RGB composition behind partially transparent original artwork. The party visual pool reserves 512 extra pixel slots and 36 text slots for transient cues; simulation owns allocation and LateUpdate only changes visual fields. Pool population and intentional audio-event changes require refreshed replay hashes, even though match mechanics are unchanged.

The single victory VFX emitter has a separate phone-low override. There are no new full-screen post-processing passes or runtime lights.

## Verification

Engine-only tests cover effect purity and lifetime, pause, sRGB composition, audio priorities/coalescing, rescue audio, boss capture, victory, reduced effects, and native/wide/tall layouts. `tests/arcade-feel.test.ts` includes a phone-low render scenario; the presentation warm-up route now visits party capture and victory as well as Classic screens.

Measured on macOS / Apple M2 Max, native Metal / V8:

- Final regression suite: all 279 cases pass; all 27 saved replays verify.
- Six-player showcase: peak 8 draw calls; six-player firing boss sample: peak 8, with 67 shots, up to 7 bottles and 12 lightning effects over 300 steps.
- Expanded complete presentation route: 262 explicitly rendered frames per tier; peaks 12 / 10 / 10 draws on desktop / mobile / compat, below the existing 14-call ceiling.
- A 600-step wave-nine headless sample: simulation p95 0.887 ms, maximum 1.423 ms, zero hitch steps; sampled presentation p95 1.202 ms; process memory 195.09 MiB. Its requested final frame used 10 draws.
- New focused phone-low/mobile tests pass. The UI confetti resolves to 18 particles on phone-low.

Headless CPU and structural checks do not establish device GPU frame time, thermals, audio quality through speakers or human multiplayer readability. Those require playtesting. Screenshots are regression evidence, not proof of motion quality.

## Design references

- [Juice It or Lose It](https://gdcvault.com/play/1016789/Juice-It-or-Lose): layered feedback for simple arcade interactions.
- [The Art of Screenshake, linked from Jan Willem Nijman's site](https://www.jwaaaap.com/): small action-game presentation improvements.
- [Celeste & Forgiveness](https://www.maddymakesgames.com/articles/celeste_and_forgiveness/index.html): input forgiveness; already represented in the player controller.
- [Juicing Your Cameras With Math](https://www.gdcvault.com/play/1023557/Math-for-Game-Programmers-Juicing): bounded, decaying camera feedback.
- [Eight Hit Stop Techniques](https://www.youtube.com/watch?v=tycbMSjDDLg): local emphasis without repeatedly freezing all six players.
- [Dead Cells color and readability](https://www.gamedeveloper.com/production/art-design-deep-dive-giving-back-colors-to-cryptic-worlds-in-i-dead-cells-i-): foreground/background hierarchy.
- [SLYNYRD: Side View Run 'N Gun](https://www.slynyrd.com/blog/2026/1/26/side-view-run-n-gun): economical sprite animation.
- [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/full-list/): redundant identity cues and reduced background movement.

The final typecheck, validation, desktop cook and cooked smoke pass. Hermes cross-engine verification is unavailable because its host binary is not installed. Pipeline capture completes on all three tiers; the installed host still emits the pre-existing built-in Standard program hash warning (`7946469ed20397e0`) in the packaged CLI metadata. The game-owned pixel material is recognized; no warning was suppressed or raw pipeline record deleted.

## Multiplayer playtest follow-up

The result screen now has a 45-step (0.75-second) input guard. It waits for confirmation, shooting and controller buttons to be released, then accepts a fresh Enter / pad A press or a deliberate button click. Space remains a shooting key and does not confirm results. A dimmed action panel and a release-controls hint show the guard; the hint changes once confirmation is ready. The keyboard latch still handles short Enter taps and suppresses key repeats.

Dragon shadows are small stepped ovals on the nearest supporting platform, rather than bars attached to the sprite. Height reduces their width and contrast; they disappear above the useful projection range. The search reads existing tiles and does not affect physics. Dragon labels match their character’s color, including HELP. They use plain text such as `BUB` / `BOB AI`, with no backplate or border. Names show during each three-second preparation countdown and disappear when combat begins; HELP stays only while downed. Up to ten nearby labels stack without overlap.

Takeoff and landing generate four and six small dust puffs respectively. They start near the feet, spread out slightly and finish in 14 / 18 steps. No burst is emitted merely because a dragon initially spawns on a platform. The arcade jump's zero-displacement apex can settle on a platform, so its jump phase is also considered when detecting a real landing. Reduced effects omit the dust.

Regression coverage in `tests/multiplayer-feedback.test.ts` reproduces the shooting-Space restart bug, checks held controller confirmation, verifies projected shadows and badge separation, and captures actual takeoff, airborne, landing, mixed-team labels and guarded defeat states through the engine.

The follow-up passes all 279 desktop regression cases and all 27 saved replays, plus the focused phone-low/mobile render scenario. The updated 262-frame pipeline route peaks at 12 / 10 / 10 draw calls on desktop / mobile / compat, within the 14-call budget. Typechecking, validation and cooked startup checks pass.

The match opens with a held 3–2–1 cue and green GO text. Between later waves,
movement and jumping remain available throughout the break and preparation.
Start protection lasts two seconds without hiding dragon sprites. Human practice
shots remain available during the countdown. Each wave's final kill gets a
brief character-colored LAST KILL banner and plain-text marker above its finisher;
bubble chains credit the popper, and elemental effects retain their owner.

### Sustained-session crash fix

The 12,000-tick ten-dragon boss soak reproduced `E_INTERN_LIMIT`: serializing
cosmetic history into a new `ArcadeFeel.data` string every frame filled the
engine's 32 MiB intern table. The resource now overwrites numeric arrays for
ten player snapshots and 32 cues. No changing serialized strings are interned.
The same soak completes with a stable 1,233-entry visual pool and a peak of
eight desktop / six mobile draw calls. The macOS CPU resource report showed memory growth
but did not itself record a termination reason.

Boss thunder bubbles retain the shooter’s colored rim with a lightning glyph.
Contact pops these attack bubbles even while Jump is held; ordinary bubbles
retain their bounce behavior. Ten-slot logic checks verify the owner, emitted
bolt and boss damage, plus native/wide/tall render captures of all ten rims.

Validation: 265 V8 logic cases, 47 desktop render cases, and the 200-second
simulated ten-dragon soak on desktop and mobile rendering tiers pass. Six
pre-existing mobile pixel/draw assertions remain unchanged.
