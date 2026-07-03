import { test } from "node:test";
import assert from "node:assert/strict";

import { decidePermission } from "../electron/permissions.js";

test("grants audio-only media (microphone)", () => {
  assert.equal(decidePermission("media", { mediaTypes: ["audio"] }), true);
});

test("denies media that includes video (camera)", () => {
  assert.equal(decidePermission("media", { mediaTypes: ["video"] }), false);
  assert.equal(decidePermission("media", { mediaTypes: ["audio", "video"] }), false);
});

test("denies display-capture (tab/screen capture removed by decision 2)", () => {
  assert.equal(decidePermission("display-capture", {}), false);
});

test("denies unrelated permissions", () => {
  assert.equal(decidePermission("geolocation", {}), false);
  assert.equal(decidePermission("notifications", {}), false);
  assert.equal(decidePermission("openExternal", {}), false);
});

test("grants a bare media request with no mediaTypes (mic-only app)", () => {
  assert.equal(decidePermission("media", {}), true);
});
