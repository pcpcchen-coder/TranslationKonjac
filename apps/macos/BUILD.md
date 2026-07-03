# Building, signing & notarizing the macOS app (S18)

How to produce a self-contained, Developer-ID-signed, notarized arm64 DMG on a
Mac. Phase A (S1–S14) is done in the cloud; this runs on the Mac mini M4.

## Prerequisites

- macOS on Apple Silicon (Mac mini M4) + Node 20+.
- **Apple Developer Program** membership (US$99/yr). Required for signing and
  notarization, and for in-app auto-update to work (Squirrel.Mac needs a signed
  app). Enrolment can take a day or two — start it early.
- A **Developer ID Application** certificate in your login Keychain
  (Xcode → Settings → Accounts → Manage Certificates → +, or download from the
  Apple Developer portal).
- An **app-specific password** for notarization: appleid.apple.com → Sign-In &
  Security → App-Specific Passwords.

## One-time setup

```bash
# from the repo root
npm install            # installs Electron, electron-builder, electron-updater, keytar
```

Export the notarization credentials in your shell (electron-builder reads these
via its notarize step). Never commit them:

```bash
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="YOURTEAMID"          # Apple Developer → Membership → Team ID
export CSC_NAME="Developer ID Application: Your Name (YOURTEAMID)"
```

## Build

```bash
npm run macos:dist     # runs make-icon, then electron-builder --mac --arm64
```

Output lands in `apps/macos/dist/`:
- `TranslationKonjac-<version>-arm64.dmg` — the installer
- `latest-mac.yml` + blockmap — the electron-updater feed (used in S19)

## Verify the signature & notarization

```bash
# staple check on the .app inside the dmg after install
spctl -a -vvv -t install /Applications/TranslationKonjac.app
codesign --verify --deep --strict --verbose=2 /Applications/TranslationKonjac.app
xcrun stapler validate /Applications/TranslationKonjac.app
```

A clean result on another user account or a second Mac (no dev tools) is the real
S18 acceptance check: open the DMG → drag to Applications → launch from the Dock,
no Gatekeeper prompt.

## Entitlements (already in `build/entitlements.mac.plist`)

- `com.apple.security.device.audio-input` — microphone capture
- `com.apple.security.network.client` — reach OpenAI Realtime
- `com.apple.security.cs.allow-jit` + `allow-unsigned-executable-memory` —
  Chromium under the hardened runtime

## First-notarization troubleshooting

- **"The binary is not signed with a valid Developer ID"** — `CSC_NAME` doesn't
  match a Developer ID Application cert in the Keychain; check
  `security find-identity -v -p codesigning`.
- **Notarization stuck / rejected** — inspect the log:
  `xcrun notarytool log <submission-id> --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_APP_SPECIFIC_PASSWORD"`.
- **App opens then quits on a clean Mac** — usually a missing entitlement (JIT)
  or an unbundled resource; confirm `apps/web/src` was copied to
  `Resources/web/src` (see `extraResources`).
- **"App is damaged"** on the target Mac — the DMG wasn't notarized/stapled;
  re-run notarization and `xcrun stapler staple` the `.dmg`.
- Budget half a day for the first successful notarization; subsequent ones are
  quick.

## Scope note

Auto-update install (electron-updater downloading + relaunching) is verified in
S19 against a real GitHub Release. Without signing, the app still runs but the
in-app updater degrades to the "Go to download" fallback (see S13).
