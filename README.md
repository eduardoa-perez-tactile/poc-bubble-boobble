# Bubble Madness

The Tactile desktop project is in `bubble-boobble/`. The reference is [go-bubblebobble](https://github.com/olivierh59500/go-bubblebobble), pinned to revision `783cf6aa26ac3c57cdab43f2d7a5b3725a3991cc`.

Bubble Madness includes the playable arcade campaign, solo/two-player co-op, an AI companion, and a ten-dragon Wave Survival prototype. Deterministic tests/replays, a pinned reference oracle, and Git checkpoints support iteration.

See the [Wave Survival prototype](bubble-boobble/docs/wave-survival.md) for controls, implemented increments, validation, and remaining work.

With Tactile Game Engine and Node.js installed:

```sh
cd bubble-boobble
npm run harness:editor
npm run harness:reset
npm run harness:quick
npm run harness:verify
```

See the [harness guide](bubble-boobble/docs/harness.md), [strict-port contract](bubble-boobble/docs/port-harness.md), and [Git workflow](bubble-boobble/docs/git-workflow.md).

Browser builds and sharing: see [the web guide](bubble-boobble/docs/web.md).
