import assert from "node:assert/strict";
import test from "node:test";

import {
  isBlackHoleLabel,
  pickPreferredOutboundDevice,
  pickSafeInboundOutputDevice,
  validateTwoWayOutputRouting,
} from "../src/public/output-routing.js";

const SYSTEM_DEFAULT = { value: "", label: "System default" };
const SPEAKERS = { value: "speakers-id", label: "MacBook Pro Speakers" };
const HEADPHONES = { value: "headphones-id", label: "AirPods Pro" };
const BLACKHOLE_2CH = { value: "bh2-id", label: "BlackHole 2ch" };
const BLACKHOLE_16CH = { value: "bh16-id", label: "BlackHole 16ch" };

test("isBlackHoleLabel matches BlackHole 2ch and 16ch case-insensitively", () => {
  assert.equal(isBlackHoleLabel("BlackHole 2ch"), true);
  assert.equal(isBlackHoleLabel("blackhole 16ch"), true);
  assert.equal(isBlackHoleLabel("MacBook Pro Speakers"), false);
  assert.equal(isBlackHoleLabel(""), false);
  assert.equal(isBlackHoleLabel(undefined), false);
});

test("pickPreferredOutboundDevice keeps a previous BlackHole 2ch value", () => {
  const result = pickPreferredOutboundDevice({
    options: [SYSTEM_DEFAULT, SPEAKERS, BLACKHOLE_2CH, BLACKHOLE_16CH],
    previousValue: BLACKHOLE_2CH.value,
  });
  assert.equal(result, BLACKHOLE_2CH.value);
});

test("pickPreferredOutboundDevice ignores a non-BlackHole previous value", () => {
  const result = pickPreferredOutboundDevice({
    options: [SYSTEM_DEFAULT, SPEAKERS, BLACKHOLE_2CH, BLACKHOLE_16CH],
    previousValue: SPEAKERS.value,
  });
  assert.equal(result, BLACKHOLE_2CH.value);
});

test("pickPreferredOutboundDevice prefers BlackHole 2ch over 16ch when no previous value", () => {
  const result = pickPreferredOutboundDevice({
    options: [SYSTEM_DEFAULT, BLACKHOLE_16CH, BLACKHOLE_2CH, SPEAKERS],
    previousValue: "",
  });
  assert.equal(result, BLACKHOLE_2CH.value);
});

test("pickPreferredOutboundDevice falls back to any BlackHole if 2ch is missing", () => {
  const result = pickPreferredOutboundDevice({
    options: [SYSTEM_DEFAULT, BLACKHOLE_16CH, SPEAKERS],
    previousValue: "",
  });
  assert.equal(result, BLACKHOLE_16CH.value);
});

test("pickPreferredOutboundDevice returns empty string when no BlackHole exists", () => {
  const result = pickPreferredOutboundDevice({
    options: [SYSTEM_DEFAULT, SPEAKERS, HEADPHONES],
    previousValue: "",
  });
  assert.equal(result, "");
});

test("pickSafeInboundOutputDevice keeps a non-BlackHole previous selection", () => {
  const result = pickSafeInboundOutputDevice({
    options: [SYSTEM_DEFAULT, SPEAKERS, HEADPHONES, BLACKHOLE_2CH],
    outboundDeviceId: BLACKHOLE_2CH.value,
    previousValue: HEADPHONES.value,
  });
  assert.equal(result, HEADPHONES.value);
});

test("pickSafeInboundOutputDevice rejects a BlackHole previous selection", () => {
  const result = pickSafeInboundOutputDevice({
    options: [SYSTEM_DEFAULT, SPEAKERS, BLACKHOLE_2CH, BLACKHOLE_16CH],
    outboundDeviceId: BLACKHOLE_2CH.value,
    previousValue: BLACKHOLE_16CH.value,
  });
  assert.equal(result, SPEAKERS.value);
});

test("pickSafeInboundOutputDevice rejects matching the outbound device", () => {
  const result = pickSafeInboundOutputDevice({
    options: [SYSTEM_DEFAULT, SPEAKERS, HEADPHONES],
    outboundDeviceId: SPEAKERS.value,
    previousValue: SPEAKERS.value,
  });
  assert.equal(result, HEADPHONES.value);
});

test("pickSafeInboundOutputDevice returns empty when no safe device exists", () => {
  const result = pickSafeInboundOutputDevice({
    options: [SYSTEM_DEFAULT, BLACKHOLE_2CH, BLACKHOLE_16CH],
    outboundDeviceId: BLACKHOLE_2CH.value,
    previousValue: "",
  });
  assert.equal(result, "");
});

test("pickSafeInboundOutputDevice never returns the System default empty value", () => {
  const result = pickSafeInboundOutputDevice({
    options: [SYSTEM_DEFAULT, SPEAKERS],
    outboundDeviceId: BLACKHOLE_2CH.value,
    previousValue: "",
  });
  assert.equal(result, SPEAKERS.value);
});

test("validateTwoWayOutputRouting blocks System default for inbound", () => {
  const result = validateTwoWayOutputRouting({
    outboundDevice: BLACKHOLE_2CH,
    inboundDevice: SYSTEM_DEFAULT,
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /System default/);
});

test("validateTwoWayOutputRouting blocks BlackHole inbound", () => {
  const result = validateTwoWayOutputRouting({
    outboundDevice: BLACKHOLE_2CH,
    inboundDevice: BLACKHOLE_16CH,
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /BlackHole/);
});

test("validateTwoWayOutputRouting blocks identical outbound and inbound devices", () => {
  const result = validateTwoWayOutputRouting({
    outboundDevice: SPEAKERS,
    inboundDevice: SPEAKERS,
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /different devices/);
});

test("validateTwoWayOutputRouting accepts BlackHole outbound with real-speaker inbound", () => {
  const result = validateTwoWayOutputRouting({
    outboundDevice: BLACKHOLE_2CH,
    inboundDevice: HEADPHONES,
  });
  assert.deepEqual(result, { ok: true });
});
