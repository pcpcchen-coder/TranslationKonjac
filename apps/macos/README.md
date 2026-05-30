# TranslationKonjac for macOS (Mac mini M4)

Native macOS desktop wrapper (Electron) around the `apps/web` Realtime
Translation front-end. See the execution plan in
[`../../docs/macos-app-execution-plan.md`](../../docs/macos-app-execution-plan.md)
and the tracking issue (#2).

> **Status: M1 scaffold.** The app boots an in-process copy of the web session
> server on a loopback port and loads the existing front-end in a native window.
> Keychain-backed API keys, a settings page, packaging/notarization, and in-app
> update arrive in later milestones (M2–M7).

## Layout

```
electron/
  main.js            # Electron entry: window, menu, permissions, lifecycle
  server-runtime.js  # Electron-free: starts the reused web session server (testable under plain Node)
  preload.cjs        # minimal, safe renderer bridge (never exposes the API key)
build/
  entitlements.mac.plist
scripts/
  make-placeholder-icon.mjs
test/
  server-runtime.test.js
```

The renderer reuses `apps/web/src/public` unchanged; `electron-builder` copies
`apps/web/src` into the packaged app's resources.

## Develop

Requires macOS + Node 20+.

```bash
# from the repo root
npm install            # installs Electron for this workspace
npm run macos:dev      # launches the app (electron .)
```

The app reads `OPENAI_API_KEY` from the environment for now (Keychain storage +
a first-run prompt arrive in M2/M4). To try translation in dev:

```bash
OPENAI_API_KEY=sk-... npm run macos:dev
```

## Test

The server-bootstrap layer is Electron-free and runs under plain Node — no
Electron install required:

```bash
npm run macos:test
```

## Package (later milestones)

```bash
npm run macos:dist     # electron-builder -> signed/notarized arm64 DMG (M6)
```

## Hardware / runtime prerequisites for the full app

- An external microphone — the Mac mini has no built-in mic.
- `BlackHole 2ch` + `BlackHole 16ch` for two-way LINE call routing.
- An Apple Developer ID for signing/notarization and in-app update (M6/M7).
