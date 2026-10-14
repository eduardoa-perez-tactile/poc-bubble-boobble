# Bubble Bobble strict port

The Tactile desktop project is in `bubble-boobble/`. The reference is [go-bubblebobble](https://github.com/olivierh59500/go-bubblebobble), pinned to revision `783cf6aa26ac3c57cdab43f2d7a5b3725a3991cc`.

Gameplay has not been ported yet. This repository first establishes fast iteration, a reference oracle, deterministic tests/replay, and Git checkpoints.

With Tactile Game Engine and Node.js installed:

```sh
cd bubble-boobble
npm run harness:editor
npm run harness:reset
npm run harness:quick
npm run harness:verify
```

See the [harness guide](bubble-boobble/docs/harness.md), [strict-port contract](bubble-boobble/docs/port-harness.md), and [Git workflow](bubble-boobble/docs/git-workflow.md).
