# macOS desktop adapter

This project-owned application provides desktop fullscreen and stateful music
pause/resume using the installed engine without changing its sources or installed
binaries. It currently supports **macOS arm64 only**.

From `bubble-boobble/`:

```sh
npm run desktop
npm run desktop:transport-probe
npm run desktop:integration
```

The launcher requires the installed engine link, Node.js, Apple's command-line
compiler/signing tools, and exact **Go 1.26.9** with its pinned dependencies already
cached. It uses `.cache/toolchains/go/bin/go` or `HARNESS_GO`. Launch builds set
`GOTOOLCHAIN=local` and `GOPROXY=off`: no compiler or module download is attempted.
Fresh-machine setup is explicit (these setup commands may download dependencies):

```sh
npm run harness:setup
.cache/toolchains/go/bin/go -C tools/desktop/ym-source mod download
```

If `HARNESS_GO` supplies the exact toolchain, use that executable for the same
`mod download` command. The harness setup alone need not populate the music
module cache.

The launcher reserves `127.0.0.1:47681`, copies the installed V8 host/WebGPU library
to ignored `.cache/desktop/BubbleBoobble.app`, builds the project native adapter
and Go music helper, and ad-hoc signs the **copies**. The helper is rebuilt from
current source each launch; its module sums, original YM reader, reference
revision and five source YM files are verified before packaging. The original
host hash is checked before/after packaging and shutdown. Public LaunchServices
(`open -n -W`) starts the application; a per-launch identity and its executable
path verify its real PID. Cleanup signals that PID, rather than the separate
`open` process. Private per-launch files forward application stdout/stderr.

Only the launcher's copied game bundle receives the immutable
`__bubbleDesktopLaunch` marker. The bridge returns before installing hooks in
ordinary source/editor bundles. Matching launch identities are required from
health and native status, preventing an editor Play session from sending its
preferences into a simultaneously running native application. Availability
transitions still enter game state solely through recorded `DesktopIntent`
inputs. Connecting stops the engine's existing music stream; disconnecting
restores the unique converted-WAV fallback. Original YM assets use
`reference/audio/bubble-N`; playable fallback WAVs use
`reference/audio/music-bubble-N`, avoiding the former same-stem asset collision.

Public AppKit APIs control only this process's own NSWindow. Fullscreen is
**borderless desktop mode**: it saves/restores frame/style, covers the current
screen, and sets the Dock/menu bar to auto-hide. It does not claim a separate
macOS fullscreen Space. No Accessibility or Apple Events permission is used.

Native music runs the unchanged pinned `ym.Stream(loop=true)` in one helper
process per selected track. Its synthesizer/chip/filter state continues across
loops. AVAudioSourceNode consumes raw stereo 48 kHz PCM16 through a bounded
9,600-frame (200 ms) ring and bounded OS pipe. Backpressure stops further
synthesis. Initial pause/mute/volume are configured before audio can consume
frames. Pause freezes the exact source cursor; resume continues with the same
helper and buffered PCM. Mute pauses consumption and defers track changes until
unmute, matching the reference. Track changes create a fresh helper/cursor.
The source callback never waits, allocates, or performs file operations.

Music pause follows canonical play/pause state; background menus and results
continue music. The launcher refreshes its liveness file independently once per
second, even when the UI clock stops. Native music stops and its helper exits if
the launcher dies or its heartbeat is older than five seconds. Sound effects
remain in the engine's sole original SFX bank, with saved per-cue gain and mute
bank-stop behavior.

The loopback service exposes `/health` and authenticated `/state`, `/status`,
`/game`, `/input`. `/game` is a read-only client projection. `/input` accepts eight
fixed game keys plus own-window hide/restore for bounded probes. Every launch
uses a random 256-bit bearer token. Browser Origin headers, unknown fields,
invalid ranges, arbitrary tracks and large bodies are refused. Only five known
packaged YM paths and the packaged helper can reach native file/process loading;
there is no general file or command endpoint. State/status writes are atomic.

`desktop:transport-probe` runs the actual packaged application in explicit
`--transport-probe` mode. Authenticated probe requests own its presentation input;
normal game clients still connect/report observations but cannot overwrite these
controlled inputs. Ordinary desktop launches and the GUI probe do not enable this
mode. Diagnostic runs impose a maximum 60-second application deadline (including
when the flag is invoked without `--run-sec`). It controls only native
presentation inputs, crosses the menu track's loop, and compares consumed
PCM prefixes after acknowledged pauses with fresh pinned helper prefixes. It
checks 700 ms pause retention, resume, muted deferred track changes, zero-cursor
configured startup, track reset, bounded queues, zero underruns, launcher-owned
liveness and normal/crashed-launcher cleanup. It also exercises ordinary source
and the exact copied launch bundle in UI-pumped no-GPU hosts to verify bridge
isolation. Evidence is `artifacts/desktop-ym-app-proof.json` and its adjacent log.
This is transport evidence, not an input-driven GUI claim.

`desktop:integration` (`desktop:probe` alias) drives actual menu/settings and
pause inputs, checks native fullscreen/volume/position, and hides/restores only
its own window to verify focus-loss pause. It requires an unlocked desktop and
ordinary foreground activation. It does not unlock or bypass the OS lock.
Evidence is `artifacts/desktop-platform-integration.json`; the ordinary GUI gate
passed on 2026-10-14, including 700 ms pause retention, focus-loss pause/resume,
fullscreen and music-gain changes, persisted preference restoration and verified
launcher/host/helper/endpoint shutdown. Inputs wait for actual focus and observed
setting changes, and startup baselines wait for saved preferences to load.
The optional `--restore-fullscreen=true|false` flag restores an explicitly known
original preference through Settings inputs; ordinary runs restore their loaded
baseline.

The independent source proof compares every PCM byte for all five tracks through
two loops plus boundary tails against the pinned original reader; see
`ym-source/README.md`. Position is the source callback's consumed-frame timeline,
not the DAC position or hardware latency. Device listening quality, native
fullscreen Spaces, macOS x64, Windows/Linux, notarization and a redistributable
installer have not been verified. The editor fallback repeats a finite converted
WAV segment and does not preserve continuous YM state across its loop boundary.

### Bridge failure recovery

A successful state-request acknowledgement does not certify native audio. The
client waits for authenticated status at an applied revision, restores converted
WAV playback when the transport reports failure, and continues polling for
recovery. Repeated acknowledgements cannot hide a persistent backend error.
The focused engine regression exercises failure, recovery and a later source EOF
against the actual fallback mixer. Both verification lanes also run a Node HTTP
regression proving that an interrupted request body leaves the bridge responsive.

The POST and status effects read the clock before non-reactive busy/token guards,
so async requests cannot unsubscribe retry polling. Run
`node tools/desktop/bridge-failure-probe.mjs` to exercise the actual controller
with delayed responses and an initial failed request in a UI-pumped no-GPU host.
This controller regression complements the ordinary native GUI gate.
