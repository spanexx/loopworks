# Loopworks App v1

The product shell around the Loopworks engine. Static files only: no build, no server, no network
at run time.

## Open it

Double-click `v1/index.html`, or open the folder in a browser. It also works on GitHub Pages from
the repository root; `index.html` redirects to `v1/`.

## Check it

```
npm run check
```

Runs `tools/verify.mjs` with plain Node, no dependencies. In the game workspace it checks the
copied engine and packs byte-for-byte against `../wireframe/loopworks/`, replays every published
solution, and audits the page for external assets, absolute paths, storage keys and theme contrast.
A standalone clone has no `../wireframe/loopworks/`, so that one copy check has no source there;
the rest of the harness still runs.

## What is inside

- `v1/js/engine.js` and `v1/js/packs/` are copies of the tested prototype files. In the game
  workspace, do not edit them here; change the source under `../wireframe/loopworks/` and copy
  them again. A standalone clone carries the only copies.
- `v1/js/app.js` owns the screen. It never decides a rule.
- Progress, the theme and the sound choice stay in this browser's storage. No account, server or
  telemetry.

## Git

This folder is its own repository. The development copy lives inside the game workspace, which is
where the byte-copy check can see `../wireframe/loopworks/`.

The hooks folder is not part of this app yet.
