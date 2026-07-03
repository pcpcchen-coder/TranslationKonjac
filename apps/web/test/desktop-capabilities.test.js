import test from "node:test";
import assert from "node:assert/strict";

import {
  detectDesktop,
  availableOneWaySources,
  availableInboundSources,
  defaultSelections,
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
