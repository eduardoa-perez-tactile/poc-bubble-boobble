# Party controller input foundation

The prototype assigns engine pad indices 0–9 to dragon slots 1–10. Slot 1 also accepts
arrows/A-D, Up/W and Space/Control. Slot 2 accepts J/L, I and K. Named actions
`partyMove1` through `partyPause10` are declared; keyboard bindings populate slots
1 and 2. Start on a controller requests joining its slot in the lobby and pause
while playing. South/A/Cross jumps; west/X/Square fires; left stick or D-pad moves.

## Engine contract and integration

The installed runtime's `InputEvent` union exposes recorded `gamepadButton`
(`pad`, `button`, `down`) and `gamepadAxis` (`pad`, `axis`, `value`) events.
Numbers follow SDL standard controls: south 0, west 2, Start 6, D-pad left 13,
right 14, horizontal stick axis 0. Engine tests accept pad indices 0 through 9.
This proves the recorded input path, not ten physical controllers on the host OS.

The installed action mapper aggregates controllers: a trial binding
`{ "axis": 0, "pad": 5 }` silently ignores `pad`, and a recorded pad-5 movement
also activates the action bound with `pad: 0`. Such bindings are deliberately
absent. Although aggregate confirmation and Back accepted pad 5 in an engine probe,
all controller menu input now uses the raw adapter to preserve independent edges. Stick axes have another limitation: a neutral pad can suppress
a negative axis from a different pad. Menu movement therefore uses raw per-pad
`menuXEdge` and `menuYEdge` (-1/0/+1), including D-pad navigation, rather than
aggregate axis bindings. Holds do not repeat; neutralizing and moving again or
changing direction produces another edge.

`src/arcade/party-input.ts` isolates players using recorded raw input:

- `updatePartyPads(ctx.input)` is called exactly once per sim step, including
  lobby and pause steps. It returns ten `inputs`, `joinedSlots`, a `pause` edge, `menuXEdge`/`menuYEdge`, and
  `menuConfirm`/`menuBack` booleans. Short button press/release pairs retain their edge.
- The `party-pads` sim document stores held axes/buttons. Holds survive steps,
  pause/resume, replay and rollback without module mutable state.
- `readPartyAction(name, value, pressed, justPressed)` returns a zero-based slot
  and action kind, or null. `applyPartyAction(inputs, action)` merges keyboard
  movement/jump/fire into the pad input array.
- `resetPartyPads()` explicitly clears stored holds. Do not reset blindly on
  resume; raw input events carry changes rather than a fresh snapshot each step.
- The pure `reducePartyPadInput(previous, events)` is separately tested for ten
  slot isolation, holds, release, Start edges, D-pad, deadzone and invalid indices.

## Known host limitations

The exposed recorded input union contains no controller-connected or
controller-disconnected event. The game cannot reliably detect disconnection or
promise automatic bot takeover. A disconnected controller that does not deliver
release/neutral events can leave held input in the reducer. An explicit pause and
slot reassignment/reset can recover it; automatic lifecycle handling needs engine
support for a recorded connection/focus event. Pad order follows the host's indices
and is not a persistent device identity across reconnects.

No OS input, desktop automation or standalone playtest was used. Physical ten-pad
availability, reconnect ordering and host disconnect neutralization remain to be
verified through an explicitly requested hardware playtest.
