# Stateful native transport

This transport is compiled into the project-owned desktop application.
The adjacent Go helper owns the unchanged pinned reference `ym.Stream(loop=true)`.

`BBYMTransport` starts that helper with an absolute track path and consumes its
raw stereo 48 kHz signed PCM16LE stdout. The caller must whitelist track paths.
The start selector is
`startHelper:track:paused:volume:muted:error:`. Initial pause, clamped volume and
mute are installed before creating either the producer or audio engine; saved
mute/pause settings cannot race an initial full-volume callback. A paused start
uses request generation 1, so `pauseAcknowledged` requires an actual callback
observation rather than the initial zero counters matching. Subsequent setters
remain serial control-thread operations.
A single producer reads into a 9,600-frame (200 ms) SPSC ring. When full it stops
reading: the bounded OS pipe blocks Go's producer and synthesis. The ring, pipe,
Go fixed buffers, and native 16 KiB read scratch bound all audio lookahead memory.
The source initially waits for 2,048 frames (42.7 ms) of preroll.

An AVAudioSourceNode converts PCM16 to planar float stereo. Its realtime callback
never waits, allocates, calls filesystem APIs, or runs Objective-C control code.
Underruns produce silence without consuming nonexistent source frames and are
counted; a run with nonzero underruns cannot claim uninterrupted playback.

Pause requests output silence without advancing the ring cursor. The audio
callback acknowledges the request only after observing it; callers must wait for
`pauseAcknowledged` before treating `consumedFrames` as frozen. Resume continues
from that exact cursor and keeps the helper's synthesizer state and buffered PCM.
Music position is `consumedFrames / 48000`, measured at the source callback. It is
not a measurement of the device DAC position or hardware output latency. The
engine may resample to the active output device rate. Volume/mute affect output
gain and preserve source progress. Stop terminates the helper, stops/detaches the
source, and lets the reader release its captured ring after exiting. Starting a
new track creates a fresh helper, queue, and zero cursor.

Compile and run from the project directory after building the adjacent helper:

```sh
clang -fobjc-arc -fblocks -framework AVFoundation -framework Foundation \
  tools/desktop/ym-source/native/BBYMTransport.m \
  tools/desktop/ym-source/native/probe.m -o .cache/desktop/ym-native-probe
.cache/desktop/ym-native-probe "$PWD/.cache/desktop/ym-source" \
  "$PWD/assets/reference/audio/bubble-2.ym" 600000 \
  "$PWD/assets/reference/audio/bubble-1.ym" \
  > artifacts/desktop-ym-native-loop-prototype.json
```

The actual AVAudioEngine probe first starts paused, muted, and at volume 0.25.
It waits for callback acknowledgement, then verifies for 250 ms that consumed
frames remain zero, the initial PCM hash is unchanged, and initial settings are
installed. It activates that same source and verifies its exact consumed prefix;
startup silence therefore cannot skip source frames. A different-track restart
starts muted at volume 0.5 and verifies those settings plus continued source
progress and exact prefix consistency.

The probe then crosses the first track's loop, pauses for 700 ms,
resumes, and pauses again. At both pauses it compares the consumed-frame count
and FNV-1a hash of consumed PCM against an independent fresh finite Go helper
prefix. It also checks a different track starts with a fresh exact prefix, both
helpers terminate, the queue stays bounded, and no underruns occur. This is a
source-PCM continuity check, not a device listening or waveform capture test.

Verified on macOS arm64: 600,064 consumed frames at 12.501333333333333 s remained
unchanged during the pause, resumed to 605,184 frames at 12.608 s, and both prefixes
matched. Track reset matched and both helper processes exited. The actual packaged application transport is additionally checked by
`npm run desktop:transport-probe`; input-driven GUI verification remains a
separate unlocked-desktop gate.

The startup regression also passes: both initial and 250 ms snapshots report
`consumedFrames=0`, hash `cbf29ce484222325`, paused/muted true, volume 0.25,
and 9,600 buffered frames. Activation reaches 600,064 frames with exact prefix
hash `89ce73293d12b061`; pause/resume reaches 605,184 frames with exact hash
`146a167547503125`. Muted track-1 restart at volume 0.5 reaches 5,120 frames
with exact prefix hash `3feaa498b8175f19`. No underruns occurred and both child
processes exited. Machine-local evidence is
`artifacts/desktop-ym-native-startup-proof.json`.
