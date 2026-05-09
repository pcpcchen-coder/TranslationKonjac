# TranslationKonjac

Realtime speech translation project.

## Current version: Web

The current implementation lives in `apps/web` and provides a browser-based OpenAI Realtime Translation service:

- One-way translation from Chrome tab audio or microphone audio
- Two-way call translation mode
- Output device selection for routing translated speech into virtual audio devices
- macOS LINE app routing with BlackHole 2ch + BlackHole 16ch

## Planned structure

```text
apps/
  web/      Browser/WebRTC version
  macos/    Reserved for future native macOS version
  ios/      Reserved for future native iOS version
  windows/  Reserved for future native Windows version
docs/       Architecture and setup notes
```

## Web setup

```bash
cd apps/web
cp .env.example .env
# edit .env and set OPENAI_API_KEY
npm install
npm run start
```

Open:

```text
http://127.0.0.1:5173
```

## macOS audio routing overview

For call translation, the web app translates audio, but LINE / FaceTime need to receive translated speech as if it were a microphone. On macOS, use virtual audio devices:

- `BlackHole 2ch`: outbound translated English sent into LINE/FaceTime as microphone input
- `BlackHole 16ch`: inbound LINE app speaker audio sent into the web app for English → Chinese translation

Detailed operating instructions are in [`apps/web/README.md`](apps/web/README.md).
