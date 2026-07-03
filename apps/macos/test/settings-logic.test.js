import { test } from "node:test";
import assert from "node:assert/strict";

import {
  maskKeyStatus,
  deriveFormState,
  nextState,
  buildUpdateStatusText,
  INITIAL_SETTINGS_STATE,
} from "../renderer/settings-logic.js";

test("maskKeyStatus shows a masked key and the Keychain backend", () => {
  const text = maskKeyStatus({ hasKey: true, last4: "ab12", backend: "keytar" });
  assert.match(text, /ab12/);
  assert.match(text, /Keychain/i);
});

test("maskKeyStatus indicates when no key is saved", () => {
  assert.match(maskKeyStatus({ hasKey: false, last4: null, backend: "keytar" }), /no.*key/i);
});

test("maskKeyStatus labels the file backend", () => {
  assert.match(maskKeyStatus({ hasKey: true, last4: "wxyz", backend: "file" }), /file/i);
});

test("deriveFormState blocks saving an empty input", () => {
  assert.equal(deriveFormState("   ").canSave, false);
});

test("deriveFormState allows saving a non-empty input", () => {
  assert.equal(deriveFormState("sk-abc").canSave, true);
});

test("deriveFormState hints when the key does not look like sk-", () => {
  const state = deriveFormState("pk-abc");
  assert.equal(state.canSave, true);
  assert.match(state.hint, /sk-/);
});

test("nextState transitions through the save lifecycle", () => {
  assert.equal(nextState(INITIAL_SETTINGS_STATE, { type: "save" }).status, "saving");
  assert.equal(nextState(INITIAL_SETTINGS_STATE, { type: "verify" }).status, "verifying");
  assert.equal(nextState(INITIAL_SETTINGS_STATE, { type: "saved", message: "Saved!" }).message, "Saved!");
  assert.equal(nextState(INITIAL_SETTINGS_STATE, { type: "error", message: "Bad" }).status, "error");
  assert.deepEqual(
    nextState({ status: "saving", message: "x" }, { type: "unknown" }),
    { status: "saving", message: "x" },
  );
});

test("buildUpdateStatusText renders update states", () => {
  assert.match(buildUpdateStatusText({ status: "checking" }), /check/i);
  assert.match(buildUpdateStatusText({ status: "up-to-date" }), /latest/i);
  assert.match(buildUpdateStatusText({ status: "update-available", version: "1.2.0" }), /1\.2\.0/);
  assert.match(buildUpdateStatusText({ status: "downloading" }), /download/i);
  assert.match(buildUpdateStatusText({ status: "error" }), /could not/i);
  assert.equal(buildUpdateStatusText(null), "");
});
