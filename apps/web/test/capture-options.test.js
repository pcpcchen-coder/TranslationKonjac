import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAudioInputMediaOptions,
  buildDisplayMediaOptions,
  buildMicrophoneMediaOptions,
} from "../src/public/capture-options.js";

test("buildDisplayMediaOptions requests local playback suppression when supported", () => {
  const options = buildDisplayMediaOptions({ suppressLocalAudioPlayback: true });

  assert.equal(options.audio.suppressLocalAudioPlayback, true);
  assert.equal(options.audio.echoCancellation, false);
  assert.equal(options.video.displaySurface, "browser");
});

test("buildDisplayMediaOptions omits local playback suppression when unsupported", () => {
  const options = buildDisplayMediaOptions({});

  assert.equal(Object.hasOwn(options.audio, "suppressLocalAudioPlayback"), false);
});

test("buildMicrophoneMediaOptions requests microphone audio only", () => {
  const options = buildMicrophoneMediaOptions();

  assert.equal(options.video, false);
  assert.equal(options.audio.echoCancellation, true);
  assert.equal(options.audio.noiseSuppression, true);
  assert.equal(options.audio.autoGainControl, true);
});


test("buildAudioInputMediaOptions can target a selected input device", () => {
  const options = buildAudioInputMediaOptions("device-123");

  assert.equal(options.video, false);
  assert.deepEqual(options.audio.deviceId, { exact: "device-123" });
  assert.equal(options.audio.echoCancellation, true);
});
