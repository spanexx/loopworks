# Loopworks App

The product app for Loopworks, a desktop learning game that teaches programming logic by having
the player type short instruction lines. Static files only: no build, no server, no network at run
time, and no account. Progress, theme and sound stay in this browser's storage.

## Versions

The repository root is the app, not one version. Each version lives in its own folder, so a later
version can sit beside the one before it:

| Folder | Version | State |
|---|---|---|
| `v1/` | Depot Console | The current playable version. |

`index.html` at the root redirects to the current version, `v1/`. A future version will get its
own folder and the redirect will move when the learner chooses the next one. The engine and packs
are copied into each version; they are not edited here.

## Play it

Open `v1/index.html` from disk, or use the root `index.html` redirect. The app also runs on GitHub
Pages; the `deploy` branch is the published site.

## Check it

`npm run check` runs `tools/verify.mjs` with plain Node, no dependencies. In the game workspace it
checks the copied engine and packs byte-for-byte against `../wireframe/loopworks/`, replays every
published solution, and audits the page for external assets, absolute paths, storage keys and theme
contrast. A standalone clone has no `../wireframe/loopworks/`, so that one copy check has no source
there; the rest of the harness still runs.

`.githooks/pre-commit` runs that harness before a commit lands, in both shapes - the workspace and a
copy of the staged files alone, the way the publish job sees them. Either one red stops the commit,
so a push never arrives at a check job that is going to fail. It is live once the repository knows
about it:

```
git config core.hooksPath .githooks
```

## Layout

- `v1/` - the current app; [v1/README.md](v1/README.md) describes its screen, editor and checks.
- `tools/verify.mjs` - the plain-node harness.
- `.githooks/pre-commit` - the local gate, the same harness before a commit.
- `.github/workflows/deploy.yml` - the checks and the publish to the `deploy` branch.
- `index.html` - the root redirect to the current version.
- `package.json` - the `check` and `test` scripts; no dependencies.

## Git

This folder is its own repository. `main` is the source branch; Pages publishes from the `deploy`
branch. The development copy lives inside the game workspace, where the byte-copy check can see
`../wireframe/loopworks/`.
