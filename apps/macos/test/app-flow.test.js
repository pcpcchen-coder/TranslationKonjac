import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveStartupFlow, completeKeySetup } from "../electron/app-flow.js";

function fakeStore(initialKey = null) {
  let key = initialKey;
  const calls = [];
  return {
    backendName: "file",
    calls,
    async getApiKey() {
      return key;
    },
    async setApiKey(next) {
      calls.push(["set", next]);
      key = next;
    },
    async clearApiKey() {
      calls.push(["clear"]);
      key = null;
    },
  };
}

test("resolveStartupFlow starts when a key already exists", async () => {
  const flow = await resolveStartupFlow({ store: fakeStore("sk-abcdefghijklmnop") });
  assert.equal(flow.action, "start");
});

test("resolveStartupFlow prompts for a key when none exists", async () => {
  const flow = await resolveStartupFlow({ store: fakeStore(null) });
  assert.equal(flow.action, "prompt-key");
});

test("completeKeySetup rejects a bad format without touching the store", async () => {
  const store = fakeStore(null);
  const result = await completeKeySetup({ store, key: "not-a-key" });
  assert.equal(result.ok, false);
  assert.equal(store.calls.length, 0);
});

test("completeKeySetup stores a valid key, trimmed", async () => {
  const store = fakeStore(null);
  const result = await completeKeySetup({ store, key: "  sk-abcdefghijklmnopqrst  " });
  assert.equal(result.ok, true);
  assert.deepEqual(store.calls, [["set", "sk-abcdefghijklmnopqrst"]]);
});

test("completeKeySetup does not store when online verify fails", async () => {
  const store = fakeStore(null);
  const result = await completeKeySetup({
    store,
    key: "sk-abcdefghijklmnopqrst",
    verify: async () => ({ ok: false, reason: "unauthorized" }),
  });
  assert.equal(result.ok, false);
  assert.equal(store.calls.length, 0);
});

test("completeKeySetup stores when online verify passes", async () => {
  const store = fakeStore(null);
  const result = await completeKeySetup({
    store,
    key: "sk-abcdefghijklmnopqrst",
    verify: async () => ({ ok: true }),
  });
  assert.equal(result.ok, true);
  assert.equal(store.calls.length, 1);
});
