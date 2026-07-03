import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CHANNELS,
  containsApiKeyLike,
  validateGetKeyStatusResponse,
  validateOpenExternalRequest,
  validateSetKeyRequest,
  validateVerifyKeyRequest,
} from "../electron/ipc-contract.js";

test("CHANNELS defines the expected IPC channel names", () => {
  assert.equal(CHANNELS.GET_KEY_STATUS, "settings:get-key-status");
  assert.equal(CHANNELS.SET_KEY, "settings:set-key");
  assert.equal(CHANNELS.CLEAR_KEY, "settings:clear-key");
  assert.equal(CHANNELS.VERIFY_KEY, "settings:verify-key");
  assert.equal(CHANNELS.OPEN_EXTERNAL, "app:open-external");
});

test("containsApiKeyLike detects a full API key anywhere in a payload", () => {
  assert.equal(containsApiKeyLike("sk-abcdefghijklmnop"), true);
  assert.equal(containsApiKeyLike({ a: { b: "sk-abcdefghijklmnop" } }), true);
  assert.equal(containsApiKeyLike(["x", "sk-abcdefghijklmnop"]), true);
  // Safe values that must NOT trip the detector:
  assert.equal(containsApiKeyLike("ab12"), false);
  assert.equal(
    containsApiKeyLike({ hasKey: true, last4: "ab12", backend: "keytar" }),
    false,
  );
  assert.equal(containsApiKeyLike("sk-1234"), false); // too short to be a real key
});

test("validateGetKeyStatusResponse accepts a masked status", () => {
  assert.equal(
    validateGetKeyStatusResponse({ hasKey: true, last4: "ab12", backend: "keytar" }).ok,
    true,
  );
});

test("validateGetKeyStatusResponse rejects a payload that leaks a full key", () => {
  const result = validateGetKeyStatusResponse({
    hasKey: true,
    last4: "ab12",
    backend: "keytar",
    oops: "sk-abcdefghijklmnop",
  });
  assert.equal(result.ok, false);
});

test("validateGetKeyStatusResponse rejects malformed shapes", () => {
  assert.equal(
    validateGetKeyStatusResponse({ hasKey: "yes", last4: "ab12", backend: "keytar" }).ok,
    false,
  );
  assert.equal(validateGetKeyStatusResponse({ hasKey: true }).ok, false);
  assert.equal(validateGetKeyStatusResponse(null).ok, false);
});

test("validateOpenExternalRequest only allows the project GitHub URL prefix", () => {
  assert.equal(
    validateOpenExternalRequest({
      url: "https://github.com/pcpcchen-coder/TranslationKonjac",
    }).ok,
    true,
  );
  assert.equal(
    validateOpenExternalRequest({
      url: "https://github.com/pcpcchen-coder/TranslationKonjac/releases",
    }).ok,
    true,
  );
  assert.equal(validateOpenExternalRequest({ url: "https://evil.example.com" }).ok, false);
  assert.equal(validateOpenExternalRequest({ url: "https://github.com/someone/else" }).ok, false);
  assert.equal(validateOpenExternalRequest({ url: 42 }).ok, false);
});

test("validateSetKeyRequest requires a string key", () => {
  assert.equal(validateSetKeyRequest({ key: "sk-abcdefghijklmnop" }).ok, true);
  assert.equal(validateSetKeyRequest({}).ok, false);
  assert.equal(validateSetKeyRequest({ key: 123 }).ok, false);
  assert.equal(validateSetKeyRequest(null).ok, false);
});

test("validateVerifyKeyRequest expects an empty payload (no key crosses the bridge)", () => {
  assert.equal(validateVerifyKeyRequest({}).ok, true);
  assert.equal(validateVerifyKeyRequest(undefined).ok, true);
  assert.equal(validateVerifyKeyRequest({ key: "sk-abcdefghijklmnop" }).ok, false);
});
