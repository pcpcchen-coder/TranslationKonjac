# macOS app feasibility & plan

## Goal
Ship the current browser app as a standalone macOS application so users do not need to keep a Chrome tab open, can launch it from the Dock, and get a native window with consistent microphone / output-device permissions.

## What the app actually needs from the host
The translation core is a static web bundle (`index.html`, `app.js`, CSS) plus a small Node server that mints a short-lived OpenAI client secret. Anything that wraps this needs to give us:

1. `navigator.mediaDevices.getUserMedia({ audio })` — captures the user's mic.
2. `navigator.mediaDevices.getDisplayMedia({ audio: true })` — captures Chrome-style tab audio. **(Tab capture only matters if we still want the "share a tab" one-way flow inside the app. For a desktop app, system-audio capture via BlackHole is the realistic equivalent.)**
3. `navigator.mediaDevices.enumerateDevices()` — lists every input/output, including BlackHole 2ch / 16ch.
4. `HTMLMediaElement.setSinkId(deviceId)` — routes a specific `<audio>` element to a specific output (BlackHole 2ch outbound, headphones inbound). **This is the keystone of the two-way isolation pattern; if `setSinkId` does not work, the two-way mode does not work.**
5. `RTCPeerConnection` to OpenAI Realtime over the public internet.
6. `AudioWorklet` and `AudioContext.createMediaStreamSource/Destination` for the inbound playback fix.
7. The Node session-mint endpoint, either bundled and run as a sidecar, or replaced with a native HTTP call.

The OS-level requirement is microphone permission (and, if we ever do system audio capture without BlackHole, screen-recording permission).

## Option comparison

| Option | Bundle size | `setSinkId` support | `getUserMedia` | Effort | Distribution | Verdict |
|---|---|---|---|---|---|---|
| **Electron** | ~150 MB | Native (Chromium) — works exactly like today's Chrome | Works | Low | DMG + notarize, or Mac App Store with sandbox | **Recommended for v1** |
| **Tauri 2 (WKWebView)** | ~10 MB | Patchy on older macOS, reasonable on macOS 14+ Safari 17.4+, but historically WKWebView has lagged Chromium | Works on macOS 11+ with mic entitlement | Medium (Rust + JS bridge) | DMG + notarize | Re-evaluate after v1 if size matters |
| **Native Swift + WKWebView** | ~5–15 MB | Same WKWebView caveats as Tauri | Works | High (Swift, AppKit, IPC to a sidecar Node) | DMG / Mac App Store | Only if we want full native chrome and App Store presence |
| **PWA / Chrome "Install as App"** | 0 | Works (it is Chrome) | Works | Zero | None — depends on user having Chrome | Good zero-cost interim |
| **`pake`** (CLI wrapper around Tauri) | ~10 MB | Same Tauri caveats | Works | Trivial | DMG | Useful for prototype, not v1 |

### Why Electron wins for v1
The two-way mode depends on three Chromium-specific guarantees we already rely on in the browser: `setSinkId` resolving on Audio elements, AudioContext sample-rate compatibility with the worklet, and `getDisplayMedia({ audio: true })` for the Chrome-tab one-way flow. Electron ships the same Chromium that the user already tests in, so there is essentially zero porting risk for the audio path. The bundle size is the only meaningful tax, and for a tool used during long meetings it is acceptable.

WKWebView (Tauri / native) is attractive for size, but `setSinkId` and AudioWorklet behavior on WKWebView have moved targets across Safari releases. We would have to gate users on macOS 14+ and re-test every BlackHole isolation scenario. Worth doing as v2 if Electron's footprint becomes a complaint.

## Recommended architecture (Electron, v1)

```
┌─────────────────────────────────────────────────────────────┐
│ Electron main process (Node)                                │
│  • spawns the existing Express/Node session server on 127.0.│
│    0.1:<random port>                                        │
│  • holds OPENAI_API_KEY via Keychain (keytar) or env file   │
│  • creates BrowserWindow that loads http://127.0.0.1:port/  │
│  • requests mic permission via systemPreferences.askFor…    │
│  • menu bar: Quit, Reload, Toggle DevTools, About           │
├─────────────────────────────────────────────────────────────┤
│ Electron renderer (Chromium)                                │
│  • current index.html + app.js, untouched                   │
│  • setPermissionRequestHandler → auto-grant mic/display     │
│  • setSinkId, enumerateDevices, RTCPeerConnection all work  │
└─────────────────────────────────────────────────────────────┘
```

### Code layout
```
/desktop
  /electron
    main.js           # spawns server, creates window, perms
    preload.js        # (optional) safe IPC bridge
    package.json      # electron, electron-builder, keytar
  /icons              # .icns
/apps/web             # unchanged — reused as the renderer payload
```

### Permissions / entitlements
- `NSMicrophoneUsageDescription` in `Info.plist` (mic prompt copy)
- `NSCameraUsageDescription` only if we ever add camera capture (skip for now)
- For Mac App Store sandboxing: `com.apple.security.device.audio-input`, `com.apple.security.network.client`. **Do not target Mac App Store in v1**: notarized DMG outside the store is much cheaper and avoids review friction over BlackHole / virtual device routing.
- Code signing: Apple Developer ID ($99/yr), notarize via `notarytool`.

### Secret handling
The current server reads `OPENAI_API_KEY` from environment. In the desktop app:
- First-run dialog: ask the user for their key, store it in macOS Keychain via `keytar`.
- Main process exports the key into the spawned Node session server's environment.
- Never expose the key to the renderer process.

### Session server lifecycle
Two options, both straightforward:
- **Sidecar (recommended for v1):** spawn the existing Node script as a child process. Pro: zero changes to the server. Con: ships Node runtime in the bundle (~50 MB extra; Electron already ships its own Node, so reuse it via `app.getPath`).
- **In-main-process:** import the session minting code directly into the Electron main process — same Node, no spawn. Cleaner, slightly more refactor.

### Audio device enumeration & sinkId
No changes to `app.js`. The renderer is real Chromium, so:
- `enumerateDevices()` returns BlackHole 2ch / 16ch labels exactly as today.
- `setSinkId()` routes the inbound `<audio>` to the chosen physical output and the outbound `<audio>` to BlackHole 2ch with no special handling.

### Auto-update
`electron-updater` against a GitHub Releases feed is the cheapest path. v1 can ship without auto-update and rely on a "Check for updates" menu item that opens the GitHub release page.

## Effort estimate (Electron v1)
| Task | Effort |
|---|---|
| Scaffold `desktop/electron/`, `electron-builder` config, icons | 0.5 day |
| Spawn session server, wire OPENAI_API_KEY via Keychain, first-run dialog | 0.5 day |
| Permission handler (auto-grant mic, deny camera/display until requested) | 0.25 day |
| Menu bar, About box, Quit/Reload/DevTools shortcuts | 0.25 day |
| Build pipeline: `npm run dist:mac` producing notarized DMG | 1 day (mostly cert + notarization plumbing) |
| Manual QA: one-way mic, one-way tab, two-way LINE app + LINE web, BlackHole isolation regression | 0.5 day |
| **Total** | **~3 days** |

## Risks
1. **Tab audio capture inside Electron.** `getDisplayMedia({ audio: true })` on macOS Electron requires screen-recording permission; user has to grant it once. If that is unacceptable, drop the Chrome-tab one-way flow inside the app and tell users to use BlackHole + Microphone source instead.
2. **Notarization.** First-time notarization is finicky (signing identity, hardened runtime, entitlement file). Budget a half-day buffer.
3. **App size.** ~150 MB DMG. If the user base pushes back, the Tauri rewrite plan becomes the answer.
4. **WebRTC / OpenAI key exposure.** Make sure the renderer never sees `OPENAI_API_KEY`; only the minted client secret should reach Chromium.

## Out of scope (intentionally) for v1
- Mac App Store distribution
- Auto-update channel (manual update is fine)
- Native menu-bar status icon / global shortcut
- Multi-window or background mode
- Tauri / WKWebView port

## Decision points before implementation
1. **Distribution channel:** notarized DMG (recommended) vs. Mac App Store?
2. **Tab audio:** keep Chrome-tab one-way mode in the desktop app, or strip it and rely entirely on BlackHole + microphone?
3. **API key UX:** Keychain prompt on first run (recommended), or `.env`-style file in `~/Library/Application Support/`?
4. **Bundle size budget:** is ~150 MB acceptable, or should we plan for the Tauri port from day one?

Once those four are answered, the v1 build can start.
