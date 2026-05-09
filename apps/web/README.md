# TranslationKonjac Web

Browser/WebRTC version of TranslationKonjac, based on OpenAI Realtime Translation.

## Features

- One-way translation from either Chrome tab audio or microphone audio
- Two-way call mode with two independent Realtime Translation sessions
- Your microphone Chinese → English translated speech
- Their English audio → Chinese translated speech for you
- Output device selection with `HTMLMediaElement.setSinkId()` when supported by the browser
- macOS LINE app routing through BlackHole 2ch and BlackHole 16ch

## Requirements

- Node.js 20+
- OpenAI API key with access to Realtime Translation
- Chrome or Edge is recommended for audio output device selection
- macOS call routing:
  - BlackHole 2ch
  - BlackHole 16ch

## Setup

```bash
cp .env.example .env
# edit .env and set OPENAI_API_KEY
npm install
npm run start
```

Open:

```text
http://127.0.0.1:5173
```

## Development

```bash
npm run dev
npm test
```

## One-way mode

Use this when you only need to translate one audio source.

### Browser tab → translated audio

1. Open the web app.
2. Mode: `One-way`.
3. Audio source: `Chrome tab`.
4. Target language: choose the language you want to hear.
5. Translated audio output: choose your speaker/headphones, or leave `System default`.
6. Click `Choose tab to start translating`.
7. In the browser picker, choose a tab that is playing audio and enable tab audio.

### Microphone → translated audio

1. Open the web app.
2. Mode: `One-way`.
3. Audio source: `Microphone`.
4. Target language: choose the language you want to hear.
5. Translated audio output: choose your speaker/headphones, or choose `BlackHole 2ch` if you want another app to receive the translated speech as microphone input.
6. Click `Use microphone to start translating`.
7. Allow microphone permission.

## Two-way call mode: LINE app on macOS

Goal:

```text
You speak Chinese
  -> web app translates to English
  -> BlackHole 2ch
  -> LINE app microphone
  -> the other person hears English

The other person speaks English in LINE
  -> LINE app speaker/output sends audio to BlackHole 16ch
  -> web app captures BlackHole 16ch
  -> web app translates to Chinese
  -> your headphones/speakers
  -> you hear Chinese
```

### Why two BlackHole devices?

Use two separate virtual devices to avoid audio loops:

- `BlackHole 2ch` is the outbound path into LINE's microphone.
- `BlackHole 16ch` is the inbound path from LINE's speaker audio into the web app.

Do **not** route the Chinese translated audio back to either BlackHole device. Send it to your real headphones or speakers.

### macOS setup

1. Install `BlackHole 2ch`.
2. Install `BlackHole 16ch`.
3. Restart macOS if the devices do not appear.
4. Restart Chrome after installing virtual audio devices.

### LINE app setup

In LINE's call audio settings:

1. Microphone/input: `BlackHole 2ch`.
2. Speaker/output: `BlackHole 16ch`.

This means:

- LINE receives your translated English from `BlackHole 2ch`.
- LINE sends the other person's English voice to `BlackHole 16ch` so the web app can capture it.

### Web app setup

1. Open `http://127.0.0.1:5173` in Chrome or Edge.
2. Mode: `Two-way call`.
3. `Translated audio output`: choose `BlackHole 2ch`.
   - This is the outbound Chinese → English path to LINE.
4. `Their voice source`: choose `Audio input device, e.g. BlackHole 16ch from LINE app`.
5. In the input device dropdown, choose `BlackHole 16ch`.
   - This is the inbound English → Chinese path from LINE.
6. `Their voice → Chinese output`: choose your real headphones/speakers, or leave `System default` if that is your listening device.
   - Do **not** choose `BlackHole 2ch` or `BlackHole 16ch` here.
7. Click `Start two-way call mode`.
8. Allow microphone permission if prompted.

### Operating checklist before a LINE call

- LINE microphone/input = `BlackHole 2ch`
- LINE speaker/output = `BlackHole 16ch`
- Web app outbound translated output = `BlackHole 2ch`
- Web app inbound source = `BlackHole 16ch`
- Web app Chinese output = your headphones/speakers
- Use headphones if possible to reduce echo and feedback

## Two-way call mode: LINE Web / browser calls

If the call itself is inside Chrome, you can use tab capture instead of `BlackHole 16ch` for inbound audio.

1. Mode: `Two-way call`.
2. `Translated audio output`: choose `BlackHole 2ch`.
3. `Their voice source`: choose `Chrome tab audio`.
4. `Their voice → Chinese output`: choose your headphones/speakers.
5. Click `Start two-way call mode`.
6. When Chrome asks which tab to share, choose the call tab and enable tab audio.

## FaceTime notes

FaceTime may not always expose every virtual audio device cleanly. If FaceTime does not show `BlackHole 2ch` as a microphone, try LINE first, or use a dedicated audio routing app such as Loopback.

## Troubleshooting

### I cannot see BlackHole devices in the web app

- Restart Chrome.
- Reload the web app.
- Grant microphone permission; browsers often hide device labels until permission is granted.
- Restart macOS after installing BlackHole.

### The other person hears nothing

Check:

- Web app `Translated audio output` is `BlackHole 2ch`.
- LINE microphone/input is `BlackHole 2ch`.
- The web app status says the session is live.
- The input meter moves when you speak.

### I cannot hear the Chinese translation

Check:

- LINE speaker/output is `BlackHole 16ch`.
- Web app `Their voice source` is `Audio input device`.
- Web app inbound input device is `BlackHole 16ch`.
- Web app `Their voice → Chinese output` is your real headphones/speakers, not BlackHole.

### Audio loops or echo

- Do not route Chinese output to BlackHole.
- Prefer headphones over speakers.
- Keep outbound and inbound virtual devices separate: `BlackHole 2ch` for outbound, `BlackHole 16ch` for inbound.

### Browser cannot choose output device

Use Chrome or Edge. Some browsers do not support `HTMLMediaElement.setSinkId()`.
