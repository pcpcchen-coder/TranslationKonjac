# macOS app execution plan (Mac mini M4)

Concrete, phased execution plan for turning the `apps/web` browser app into a
native macOS desktop app that runs on a Mac mini M4 (Apple Silicon).

- **Feasibility & option comparison:** [`docs/macos-app-plan.md`](macos-app-plan.md)
- **Model selection, timeline & cost plan:** [`docs/macos-model-cost-plan.md`](macos-model-cost-plan.md)
- **Step-by-step TDD plan (S1–S20, execution granularity):** [`docs/macos-step-plan.md`](macos-step-plan.md)
- **Tracking issue:** [#2](https://github.com/pcpcchen-coder/TranslationKonjac/issues/2)
- **Working branch:** `claude/adoring-davinci-BrGrU`

This document is the *execution* plan (milestones, tasks, acceptance criteria);
the feasibility doc is why we chose Electron.

> **2026-05-30 update:** the four open decisions are resolved (see below). This
> adds two workstreams — a **Settings page** and **in-app update** — and
> **removes Chrome-tab capture**. Estimate revised from ~3 to **~4.5–5.5 days**.

## Goal

Ship the current browser app as a standalone macOS application so users can
launch it from the Dock without keeping a Chrome tab open, with stable
microphone / output-device permissions, preserving both modes:

- One-way translation (microphone source)
- Two-way call mode (LINE on macOS via BlackHole 2ch outbound + BlackHole 16ch inbound)

## Decisions (resolved 2026-05-30)

1. **Distribution:** No Mac App Store. Ship a self-contained, **Developer-ID
   signed + notarized DMG** ("keep the status quo" = stay on the DMG path, not
   App Store). Electron bundles Chromium + Node, so it is **self-contained — no
   extra downloads to run**.
   - Note: signing is also the prerequisite for in-app update (decision 4) on
     macOS — Squirrel.Mac requires a signed app. If we skip signing, the update
     feature degrades to a "open GitHub Releases to download manually" link.
2. **Chrome-tab capture:** **Removed.** Drop `getDisplayMedia` from the app.
   Cover the former tab-capture scenarios via BlackHole / virtual input, **but
   first verify the flows still work** (one-way "translate app/system audio",
   two-way "LINE Web / browser-call inbound"). Also build a dedicated
   **Settings UI**.
3. **API key:** **First-run prompt** (stored in Keychain) **plus a field in the
   Settings page** to view/update the key.
4. **Bundle size / updates:** **No size cap; fully self-contained** (runs with no
   extra downloads). Add an **in-app update** mechanism surfaced in the
   **Settings page** (electron-updater against GitHub Releases; requires signing
   per decision 1).

## What we are porting

1. **Node HTTP server** — `apps/web/src/server.js` + `apps/web/src/session.js`.
   Serves the static front-end and exposes `POST /session`, exchanging
   `OPENAI_API_KEY` for a short-lived OpenAI Realtime Translation client secret.
2. **Front-end** — `apps/web/src/public/app.js` (~1072 lines) plus helpers,
   depending on these browser APIs:

| Browser API | Purpose | Port criticality |
|---|---|---|
| `RTCPeerConnection` | Connect to OpenAI Realtime | Required |
| `getUserMedia` | Capture microphone | Required |
| ~~`getDisplayMedia({audio})`~~ | ~~Chrome-tab audio~~ | **Decision 2: removed** |
| `enumerateDevices` | List BlackHole 2ch / 16ch | Required |
| **`setSinkId`** | Route a specific `<audio>` to a specific output | **Keystone of two-way isolation** |
| `AudioContext` / `AudioWorklet` | Inbound playback fix, PCM capture | Required |
| `replaceTrack(null)` | Two-way echo guard | Required |

## Framework decision: Electron for v1

Electron ships the same Chromium we already test in, so the audio path
(`setSinkId`, AudioWorklet, WebRTC) has near-zero porting risk, and it is
inherently self-contained (satisfying decision 4). Tauri / WKWebView is the v2
size-reduction candidate. See [`docs/macos-app-plan.md`](macos-app-plan.md).

## Mac mini M4 / Apple Silicon notes

- **arm64** — build target `arm64` (or `universal`); sign and notarize on Apple Silicon.
- **No built-in microphone** — the Mac mini has no mic (only a small speaker);
  two-way mode needs to capture the user's own Chinese speech, so an external
  microphone / headset / audio interface is a hardware prerequisite.
- **Permissions (TCC)** — Microphone is required. Screen Recording is no longer
  needed (tab capture removed per decision 2).
- **Virtual audio** — still requires `BlackHole 2ch` (outbound into LINE's mic)
  and `BlackHole 16ch` (inbound from LINE's speaker).

## Target architecture (in `apps/macos/`)

```
apps/macos/
  package.json          # electron, electron-builder, electron-updater, keytar
  electron/
    main.js             # session server, window, permissions, menu, auto-update
    preload.js          # safe IPC bridge (config/key in, never leaks the key to renderer)
  renderer/
    settings.html/.js   # Settings page: API-key update, check for updates
  build/
    icon.icns
  entitlements.mac.plist
apps/web/               # untouched — reused as the main translation renderer payload
```

- **Main process:** start the existing session server on
  `127.0.0.1:<random port>` (or import `session.js` in-process); keep
  `OPENAI_API_KEY` in the Keychain via `keytar`; create the `BrowserWindow`;
  auto-grant mic via `setPermissionRequestHandler`; manage electron-updater.
- **Renderer:** main translation screen reuses `index.html` + `app.js` (with the
  tab-source UI removed); plus a new Settings page.

## Phased plan

### M0 — Decisions & prerequisites — decisions done
- [x] Four decisions resolved (2026-05-30).
- [ ] Apple Developer ID (signing + notarization; also the in-app-update prerequisite).
- [ ] Mac mini M4 test machine + external microphone + BlackHole 2ch/16ch.

### M1 — Scaffold (~0.5 day)
- [ ] Electron skeleton in `apps/macos/` + `electron-builder` (target: dmg, arch: arm64, self-contained).
- [ ] BrowserWindow loads the reused web front-end.
- [ ] `.icns` app icon.
- [ ] `npm run dev:mac` opens a window.

### M2 — Session server & secret handling (~0.5 day)
- [ ] Main process manages the session server lifecycle.
- [ ] First-run dialog asks for the OpenAI API key → store in Keychain.
- [ ] Key only reaches the server; **never** exposed to the renderer; server binds a random port on 127.0.0.1.

### M3 — Permissions & native shell (~0.5 day)
- [ ] `setPermissionRequestHandler` auto-grants mic, denies camera.
- [ ] `Info.plist`: `NSMicrophoneUsageDescription`.
- [ ] Menu: Quit / Reload / DevTools / About / Settings + shortcuts.

### M4 — Settings page (~0.75 day) — new (decisions 2/3/4)
- [ ] Dedicated settings window/page, separate from the main translation screen.
- [ ] View / update the API key → written to Keychain, effective without reinstall.
- [ ] Placeholder "Check for updates / update status" UI (logic wired in M7).
- [ ] (Optional) default target language, BlackHole routing reminders.

### M5 — Remove tab capture + audio verification (~0.75 day) — highest risk (decision 2)
- [ ] Remove `getDisplayMedia` and the tab-source UI.
- [ ] **Verify former tab scenarios are achievable via BlackHole / virtual input** (one-way app/system audio, two-way browser-call inbound).
- [ ] `enumerateDevices()` shows BlackHole 2ch / 16ch labels in-app.
- [ ] `setSinkId()` routes inbound `<audio>` to a physical headset, outbound to BlackHole 2ch.
- [ ] Two-way LINE app + BlackHole isolation; echo guard (`replaceTrack(null)` + mute) behaves correctly.

### M6 — Self-contained packaging: sign + notarize (~1 day) (decisions 1/4)
- [ ] Hardened runtime + entitlements (`com.apple.security.device.audio-input`, `com.apple.security.network.client`).
- [ ] Developer ID signing → `notarytool` notarize + staple.
- [ ] `npm run dist:mac` produces a self-contained arm64 DMG that opens on a clean M4 with no Gatekeeper warning.

### M7 — In-app update (~0.75 day) — new (decision 4)
- [ ] electron-updater against a GitHub Releases feed.
- [ ] Settings-page "Check for updates" button + notify/download/install when a newer version exists.
- [ ] Unsigned fallback: degrade to opening the Releases page for manual download.

### M8 — QA & docs (~0.5 day)
- [ ] Full QA matrix (see acceptance criteria).
- [ ] `apps/macos/README.md`: install, permissions, BlackHole setup, API key (first-run + settings), updates, LINE call steps.
- [ ] Update the macOS section in the root `README.md`.

**Estimate: ~4.5–5.5 working days** (includes Settings page, tab-capture removal
+ verification, and in-app update; excludes first-time certificate /
notarization buffer).

## Acceptance criteria / QA matrix

- [ ] Clean M4: open DMG → drag to Applications → launch from Dock; no Gatekeeper block; **no extra runtime download required**.
- [ ] First run requests and remembers the API key (Keychain).
- [ ] **Settings page can update the API key; effective without reinstall.**
- [ ] First run requests microphone permission.
- [ ] One-way (microphone source) translation works.
- [ ] **Former Chrome-tab scenarios are achievable via BlackHole / virtual input.**
- [ ] Two-way LINE app mode: the other party hears English, you hear Chinese, no echo/loop; BlackHole isolation regression passes.
- [ ] **Settings-page "Check for updates" detects a newer release (and installs, or degrades to a manual download link).**
- [ ] DevTools confirms the renderer never sees `OPENAI_API_KEY`.

## Risks

1. **In-app update needs signing** — macOS Squirrel.Mac auto-update requires a
   signed app, tying decision 4 to decision 1's Developer ID signing; unsigned →
   update degrades to manual download.
2. **Functionality gap after removing tab capture** — confirm every former tab
   scenario is reachable via BlackHole / virtual input (mitigation: select
   BlackHole as the input device + document how to route app audio in).
3. **Notarization** — first-time signing/notarization is finicky; budget a half-day buffer.
4. **Key exposure** — the renderer must never receive `OPENAI_API_KEY`, only the short-lived client secret.
5. **No built-in mic on Mac mini** — two-way self-voice capture needs an external device; document clearly.

## Out of scope for v1 (intentionally)

Mac App Store distribution, menu-bar status icon / global shortcut, multi-window
/ background mode, Tauri / WKWebView port. (Note: in-app update has moved *into*
v1 scope.)
