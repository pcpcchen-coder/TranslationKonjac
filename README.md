# TranslationKonjac

Realtime speech translation project.

## Current version: Web

The current implementation lives in `apps/web` and provides a browser-based OpenAI Realtime Translation service:

- Chrome tab audio → translated speech
- Microphone audio → translated speech
- Target language defaults to English
- Translated audio output device selection, useful for routing to BlackHole 2ch and then into LINE / FaceTime as a virtual microphone

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

## macOS audio routing note

For sending translated speech into LINE or FaceTime, install BlackHole 2ch, select `BlackHole 2ch` as the web app's translated audio output, then select `BlackHole 2ch` as the microphone/input device in the calling app.
