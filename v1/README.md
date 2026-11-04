# Loopworks App v1 - Depot Console

The first playable version of the Loopworks app. Static files only: no build, no server, no
network at run time.

## Open it

Double-click `index.html`, or open this folder in a browser. The repository root `index.html`
redirects here, and on GitHub Pages the app is served from `v1/`.

## Check it

`npm run check` from the repository root runs `tools/verify.mjs` with plain Node, no dependencies.
In the game workspace it checks the copied engine and packs byte-for-byte against
`../../wireframe/loopworks/`, replays every published solution, and audits the page for external
assets, absolute paths, storage keys and theme contrast. A standalone clone has no
`../../wireframe/loopworks/`, so that one copy check has no source there; the rest of the harness
still runs.

## What is inside

- `js/engine.js` and `js/packs/` are copies of the tested prototype files. In the game workspace,
  do not edit them here; change the source under `../../wireframe/loopworks/` and copy them again.
  A standalone clone carries the only copies.
- `js/app.js` owns the screen. It never decides a rule.
- Progress, the theme and the sound choice stay in this browser's storage. No account, server or
  telemetry.

## Git

This version lives at `v1/` in the app repository. `main` is the source branch; the app-level
[README](../README.md) describes the whole product and the versions beside it.
