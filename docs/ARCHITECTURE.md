# Architecture

## Web one-way call mode

```text
User microphone Chinese
  -> Browser WebRTC Realtime Translation session
  -> English translated audio
  -> selected output device, e.g. BlackHole 2ch
  -> LINE / FaceTime microphone input
  -> remote participant hears English
```

## Future two-way interpretation mode

Planned design uses two independent realtime translation sessions:

```text
Outbound:
User microphone Chinese -> English -> BlackHole 2ch -> calling app microphone

Inbound:
Calling app / tab audio English -> Chinese -> user headphones or speakers
```

The important constraint is audio isolation: inbound Chinese audio must not be routed back into the outbound microphone path, otherwise the call can echo or loop.
