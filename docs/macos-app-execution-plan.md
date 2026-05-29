# macOS app execution plan (Mac mini M4)

Concrete, phased execution plan for turning the `apps/web` browser app into a
native macOS desktop app that runs on a Mac mini M4 (Apple Silicon).

- **Feasibility & option comparison:** [`docs/macos-app-plan.md`](macos-app-plan.md)
- **Tracking issue:** [#2](https://github.com/pcpcchen-coder/TranslationKonjac/issues/2)
- **Working branch:** `claude/adoring-davinci-BrGrU`

This document is the *execution* plan (milestones, tasks, acceptance criteria);
the feasibility doc is why we chose Electron. Read that first if the framework
choice is in question.

## Goal

Ship the current browser app as a standalone macOS application so users can
launch it from the Dock without keeping a Chrome tab open, with stable
microphone / output-device permissions, preserving both existing modes:

- One-way translation (microphone or Chrome-tab audio)
- Two-way call mode (LINE on macOS via BlackHole 2ch outbound + BlackHole 16ch inbound)

## What we are porting

The web app is two pieces:

1. **Node HTTP server** — `apps/web/src/server.js` + `apps/web/src/session.js`.
   Serves the static front-end and exposes `POST /session`, which exchanges
   `OPENAI_API_KEY` for a short-lived OpenAI Realtime Translation client secret.
2. **Front-end** — `apps/web/src/public/app.js` (~1072 lines) plus helper
   modules. This is the core and depends on these browser APIs:

| Browser API | Purpose | Port criticality |
|---|---|---|
| `RTCPeerConnection` | Connect to OpenAI Realtime | Required |
| `getUserMedia` | Capture microphone | Required |
| `getDisplayMedia({audio})` | Capture Chrome-tab audio (one-way) | Only if tab mode kept |
| `enumerateDevices` | List BlackHole 2ch / 16ch | Required |
| **`setSinkId`** | Route a specific `<audio>` to a specific output | **Keystone of two-way isolation** |
| `AudioContext` / `AudioWorklet` | Inbound playback fix, PCM capture | Required |
| `replaceTrack(null)` | Two-way echo guard | Required |

The porting risk is concentrated in `setSinkId` + `AudioWorklet` + WebRTC
behavior, which is exactly why v1 uses Electron's Chromium (identical to the
browser we already test in) rather than WKWebView.

## Framework decision: Electron for v1

Per [`docs/macos-app-plan.md`](macos-app-plan.md): Electron ships the same
Chromium we already rely on, so the audio path has near-zero porting risk. The
~150 MB bundle is the only meaningful tax. Tauri / WKWebView is the v2 candidate
if size becomes a complaint, after the audio isolation scenarios are re-verified
on Safari.

## Mac mini M4 / Apple Silicon notes

- **arm64 architecture** — build target `arm64` (or `universal`); sign and
  notarize on Apple Silicon.
- **No built-in microphone** — the Mac mini has no mic (only a small speaker).
  Two-way mode needs to capture the user's own Chinese speech, so an external
  microphone / headset / audio interface is a hardware prerequisite.
- **Permissions (TCC)** — Microphone is required. Screen Recording is only
  needed if we keep the Chrome-tab `getDisplayMedia` flow.
- **Virtual audio** — call routing still requires `BlackHole 2ch` (outbound into
  LINE's mic) and `BlackHole 16ch` (inbound from LINE's speaker), unchanged from
  the web version.

## Target architecture

Lives in the existing `apps/macos/` directory (following the repo's
`apps/<platform>` convention, superseding the `/desktop` path in the older doc):

```
apps/macos/
  package.json          # electron, electron-builder, keytar
  electron/
    main.js             # start session server, create window, permissions, menu
    preload.js          # safe IPC bridge (config in, never leaks the API key)
  build/
    icon.icns
  entitlements.mac.plist
apps/web/               # untouched — reused as the renderer payload
```

- **Main process:** start the existing session server on
  `127.0.0.1:<random port>` (or import `session.js` in-process); keep
  `OPENAI_API_KEY` in the macOS Keychain via `keytar`; create a `BrowserWindow`
  that loads the local server; auto-grant mic via `setPermissionRequestHandler`.
- **Renderer:** reuse the current `index.html` + `app.js` with no changes.

## Phased plan

### M0 — Decisions & prerequisites
- [ ] Resolve the 4 open decisions (distribution / tab audio / key UX / size budget) — see below.
- [ ] Apple Developer ID for signing + notarization (US$99/yr).
- [ ] Mac mini M4 test machine + external microphone + BlackHole 2ch/16ch installed.

### M1 — Scaffold (~0.5 day)
- [ ] Create the Electron skeleton in `apps/macos/` + `electron-builder` config (target: dmg, arch: arm64).
- [ ] BrowserWindow loads the reused web front-end.
- [ ] Prepare `.icns` app icon.
- [ ] `npm run dev:mac` opens a window locally.

### M2 — Session server & secret handling (~0.5 day)
- [ ] Main process manages the session server lifecycle (sidecar or in-process).
- [ ] First-run dialog asks for the OpenAI API key → store in Keychain (keytar).
- [ ] Key only reaches the server side; **never** exposed to the renderer.
- [ ] Server binds to a random port on 127.0.0.1.

### M3 — Permissions & native shell (~0.5 day)
- [ ] `setPermissionRequestHandler` auto-grants mic, denies camera by default.
- [ ] `Info.plist`: `NSMicrophoneUsageDescription` (required), `NSCameraUsageDescription` (only if needed).
- [ ] Menu: Quit / Reload / Toggle DevTools / About + shortcuts.
- [ ] First run triggers and verifies the macOS microphone authorization flow.

### M4 — Audio path verification (real hardware, ~0.5 day) — highest risk
> Verify early: as soon as M1 yields a window that loads the front-end, smoke-test the audio path.
- [ ] `enumerateDevices()` shows BlackHole 2ch / 16ch labels inside the app.
- [ ] `setSinkId()` routes inbound `<audio>` to a chosen physical headset and outbound to BlackHole 2ch.
- [ ] One-way: microphone → translated speech → chosen output.
- [ ] Two-way: LINE app + BlackHole isolation; echo guard (`replaceTrack(null)` + mute) behaves correctly.
- [ ] `Outbound mic` diagnostic row briefly shows muted/detached during inbound playback, then returns to enabled/attached.

### M5 — Sign / notarize / package (~1 day)
- [ ] Hardened runtime + entitlements (`com.apple.security.device.audio-input`, `com.apple.security.network.client`).
- [ ] Developer ID signing.
- [ ] `notarytool` notarize + staple.
- [ ] `npm run dist:mac` produces an arm64 DMG that opens on a clean M4 with no Gatekeeper warning.

### M6 — QA & docs (~0.5 day)
- [ ] Full QA matrix (see acceptance criteria).
- [ ] Write `apps/macos/README.md`: install, permissions, BlackHole setup, API-key setup, LINE call steps.
- [ ] Update the macOS section in the root `README.md`.

**Estimate: ~3 working days** (matches the feasibility doc; excludes first-time
certificate / notarization fiddling buffer).

## Open decisions (needed at M0, with recommendations)

1. **Distribution channel:** notarized DMG (recommended — cheap, avoids App
   Store review friction over virtual-audio routing) vs Mac App Store?
2. **Chrome-tab audio:** keep in-app `getDisplayMedia` tab capture (needs Screen
   Recording permission) vs drop it and rely on BlackHole + microphone?
   (Recommended: drop for v1 to reduce permission complexity.)
3. **API key UX:** Keychain prompt on first run (recommended) vs an `.env`-style
   file in `~/Library/Application Support/`?
4. **Size budget:** is ~150 MB DMG acceptable for v1 (recommended) vs plan the
   Tauri port from day one?

## Acceptance criteria / QA matrix

- [ ] On a clean Mac mini M4: open DMG → drag to Applications → launch from Dock, no Gatekeeper block.
- [ ] First run correctly requests and remembers the OpenAI API key (Keychain).
- [ ] First run correctly requests microphone permission.
- [ ] One-way (microphone source) translation works.
- [ ] Two-way LINE app mode: the other party hears English, you hear Chinese, no echo/loop.
- [ ] BlackHole isolation regression passes (Chinese output never routed back into any BlackHole device).
- [ ] DevTools inspection confirms the renderer never sees `OPENAI_API_KEY`.

## Risks

1. **Tab capture** — `getDisplayMedia({audio})` in Electron needs Screen
   Recording permission; if unacceptable, take decision 2's drop path.
2. **Notarization** — first-time signing/notarization is finicky (identity,
   hardened runtime, entitlements); budget a half-day buffer.
3. **Bundle size** — ~150 MB; if users push back, start the Tauri v2 plan.
4. **Key exposure** — ensure the renderer never receives `OPENAI_API_KEY`, only
   the short-lived client secret.
5. **No built-in mic on Mac mini** — two-way self-voice capture needs an external
   device; document this clearly.

## Out of scope for v1 (intentionally)

Mac App Store distribution, auto-update channel, menu-bar status icon / global
shortcut, multi-window / background mode, Tauri / WKWebView port.
