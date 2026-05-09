# TranslationKonjac Web

Browser/WebRTC version of TranslationKonjac, based on OpenAI Realtime Translation.

## Features

- Capture either Chrome tab audio or microphone audio
- Translate into a selected target language; default is English
- Play translated speech locally
- Select translated audio output device with `HTMLMediaElement.setSinkId()` when supported by the browser
- Route translated audio to BlackHole 2ch for LINE / FaceTime virtual microphone workflows

## Setup

```bash
cp .env.example .env
# edit .env and set OPENAI_API_KEY
npm install
npm run start
```

Open `http://127.0.0.1:5173`.

## Development

```bash
npm run dev
npm test
```

## Recommended macOS call routing

1. Install BlackHole 2ch.
2. In this web app, choose `Microphone` as the input source.
3. Choose `English` as the target language.
4. Choose `BlackHole 2ch` as translated audio output.
5. In LINE / FaceTime, choose `BlackHole 2ch` as microphone/input.
