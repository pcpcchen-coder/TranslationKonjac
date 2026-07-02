import { test } from "node:test";
import assert from "node:assert/strict";

import { validateApiKeyFormat, verifyApiKeyOnline } from "../electron/api-key.js";

test("validateApiKeyFormat accepts a well-formed key and returns the trimmed value", () => {
  const result = validateApiKeyFormat("  sk-abcdefghijklmnopqrstuvwx  ");
  assert.equal(result.ok, true);
  assert.equal(result.key, "sk-abcdefghijklmnopqrstuvwx");
});

test("validateApiKeyFormat rejects empty / missing keys", () => {
  assert.equal(validateApiKeyFormat("").ok, false);
  assert.equal(validateApiKeyFormat("   ").ok, false);
  assert.equal(validateApiKeyFormat(undefined).ok, false);
  assert.equal(validateApiKeyFormat(null).ok, false);
});

test("validateApiKeyFormat rejects internal whitespace", () => {
  const result = validateApiKeyFormat("sk-abc def ghijklmnopqrst");
  assert.equal(result.ok, false);
  assert.match(result.error, /whitespace/i);
});

test("validateApiKeyFormat rejects keys not starting with sk-", () => {
  const result = validateApiKeyFormat("pk-abcdefghijklmnopqrstuvwx");
  assert.equal(result.ok, false);
  assert.match(result.error, /sk-/);
});

test("validateApiKeyFormat rejects a too-short key", () => {
  const result = validateApiKeyFormat("sk-short");
  assert.equal(result.ok, false);
  assert.match(result.error, /short/i);
});

test("verifyApiKeyOnline returns ok on HTTP 200", async () => {
  const result = await verifyApiKeyOnline({
    apiKey: "sk-x",
    fetchImpl: async () => ({ ok: true, status: 200 }),
  });
  assert.deepEqual(result, { ok: true });
});

test("verifyApiKeyOnline reports unauthorized on HTTP 401", async () => {
  const result = await verifyApiKeyOnline({
    apiKey: "sk-x",
    fetchImpl: async () => ({ ok: false, status: 401 }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "unauthorized");
});

test("verifyApiKeyOnline treats 5xx as a retriable network error", async () => {
  const result = await verifyApiKeyOnline({
    apiKey: "sk-x",
    fetchImpl: async () => ({ ok: false, status: 500 }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "network");
});

test("verifyApiKeyOnline treats a thrown fetch as a network error", async () => {
  const result = await verifyApiKeyOnline({
    apiKey: "sk-x",
    fetchImpl: async () => {
      throw new Error("ECONNREFUSED");
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "network");
});
