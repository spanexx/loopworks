# Loopworks App v1

The product shell around the Loopworks engine. Static files only: no build, no server, no network
at run time.

## Open it

Double-click `v1/index.html`, or open the folder in a browser. It also works on GitHub Pages at
`/app/v1/`; the repository root redirects there.

## Check it

```
npm run check
```

Runs `tools/verify.mjs` with plain Node, no dependencies. It checks the copied engine and packs
byte-for-byte against `../wireframe/loopworks/`, replays every published solution, and audits the
page for external assets, absolute paths, storage keys and theme contrast.

## What is inside

- `v1/js/engine.js` and `v1/js/packs/` are copies of the tested prototype files. Do not edit them
  here; change the source under `../wireframe/loopworks/` and copy them again.
- `v1/js/app.js` owns the screen. It never decides a rule.
- Progress and the theme choice stay in this browser's storage. No account, server or telemetry.

## Git

This folder is meant to be its own repository. The learner runs these, not an agent:

```
git init
git config core.hooksPath .githooks
```

The hooks folder is not part of this app yet; until it exists, the second command has nothing to
point at.
