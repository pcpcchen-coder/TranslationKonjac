import test from "node:test";
import assert from "node:assert/strict";

import {
  detectDesktop,
  availableOneWaySources,
  availableInboundSources,
  defaultSelections,
  chooseOneWayCaptureOptions,
} from "../src/public/desktop-capabilities.js";

test("detectDesktop is true only when the Electron bridge is present", () => {
  assert.equal(detectDesktop({ translationKonjac: { platform: "darwin" } }), true);
  assert.equal(detectDesktop({}), false);
  assert.equal(detectDesktop(undefined), false);
  assert.equal(detectDesktop({ translationKonjac: null }), false);
});

test("availableOneWaySources drops tab capture on desktop", () => {
  assert.deepEqual(availableOneWaySources(false), ["tab", "microphone"]);
  assert.deepEqual(availableOneWaySources(true), ["microphone"]);
});

test("availableInboundSources drops tab capture on desktop", () => {
  assert.deepEqual(availableInboundSources(false), ["tab", "device"]);
  assert.deepEqual(availableInboundSources(true), ["device"]);
});

test("defaultSelections picks desktop-friendly defaults", () => {
  assert.deepEqual(defaultSelections(false), { oneWaySource: "tab", inboundSource: "tab" });
  assert.deepEqual(defaultSelections(true), {
    oneWaySource: "microphone",
    inboundSource: "device",
  });
});

test("chooseOneWayCaptureOptions uses plain mic options when no device is chosen", () => {
  const opts = chooseOneWayCaptureOptions({ isDesktop: true, deviceId: "" });
  assert.equal(opts.audio.echoCancellation, true);
  assert.equal(opts.video, false);
  assert.equal(opts.audio.deviceId, undefined);
});

test("chooseOneWayCaptureOptions disables processing for a virtual device (BlackHole)", () => {
  const opts = chooseOneWayCaptureOptions({
    isDesktop: true,
    deviceId: "dev1",
    deviceLabel: "BlackHole 16ch",
  });
  assert.equal(opts.audio.echoCancellation, false);
  assert.equal(opts.audio.noiseSuppression, false);
  assert.equal(opts.audio.autoGainControl, false);
  assert.deepEqual(opts.audio.deviceId, { exact: "dev1" });
});

test("chooseOneWayCaptureOptions keeps processing for a normal input device", () => {
  const opts = chooseOneWayCaptureOptions({
    isDesktop: true,
    deviceId: "mic1",
    deviceLabel: "USB Microphone",
  });
  assert.equal(opts.audio.echoCancellation, true);
  assert.deepEqual(opts.audio.deviceId, { exact: "mic1" });
});

test("chooseOneWayCaptureOptions on the web build ignores the device id", () => {
  const opts = chooseOneWayCaptureOptions({
    isDesktop: false,
    deviceId: "x",
    deviceLabel: "BlackHole 16ch",
  });
  assert.equal(opts.audio.deviceId, undefined);
});
