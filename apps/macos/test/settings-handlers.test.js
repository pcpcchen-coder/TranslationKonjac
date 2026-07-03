import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { resolveSecretStore } from "../electron/secret-store.js";
import { createSettingsHandlers } from "../electron/settings-handlers.js";
import { startTranslationServer } from "../electron/server-runtime.js";

const noKeytar = async () => {
  throw new Error("no keytar");
};

function tempDir() {
  return mkdtemp(path.join(tmpdir(), "tk-settings-"));
}

function fileStore(dir) {
  return resolveSecretStore({ keytarLoader: noKeytar, fileDir: dir });
}

test("getKeyStatus reports no key when the store is empty", async () => {
  const dir = await tempDir();
  try {
    const store = await fileStore(dir);
    const handlers = createSettingsHandlers({ store, env: {} });
    assert.deepEqual(await handlers.getKeyStatus(), {
      hasKey: false,
      last4: null,
      backend: "file",
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("getKeyStatus masks a stored key to its last 4 and never returns the full key", async () => {
  const dir = await tempDir();
  try {
    const store = await fileStore(dir);
    await store.setApiKey("sk-supersecretkey-9999");
    const handlers = createSettingsHandlers({ store, env: {} });
    const status = await handlers.getKeyStatus();
    assert.equal(status.hasKey, true);
    assert.equal(status.last4, "9999");
    assert.doesNotMatch(JSON.stringify(status), /sk-supersecret/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("setKey rejects a bad format and touches neither store nor env", async () => {
  const dir = await tempDir();
  try {
    const store = await fileStore(dir);
    const env = {};
    const handlers = createSettingsHandlers({ store, env });
    const result = await handlers.setKey({ key: "nope" });
    assert.equal(result.ok, false);
    assert.equal(await store.getApiKey(), null);
    assert.equal(env.OPENAI_API_KEY, undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("setKey stores the key and injects it into the live env", async () => {
  const dir = await tempDir();
  try {
    const store = await fileStore(dir);
    const env = {};
    const handlers = createSettingsHandlers({ store, env });
    const result = await handlers.setKey({ key: "  sk-abcdefghijklmnopqrst  " });
    assert.equal(result.ok, true);
    assert.equal(await store.getApiKey(), "sk-abcdefghijklmnopqrst");
    assert.equal(env.OPENAI_API_KEY, "sk-abcdefghijklmnopqrst");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("end-to-end: saving a key via settings makes /session work with no restart", async () => {
  const dir = await tempDir();
  const auth = [];
  const fetchImpl = async (_url, init = {}) => {
    auth.push(init.headers?.Authorization ?? null);
    return {
      ok: true,
      status: 200,
      async json() {
        return { value: "cs_e2e" };
      },
      async text() {
        return "";
      },
    };
  };
  const store = await fileStore(dir);
  const env = {};
  const handlers = createSettingsHandlers({ store, env });
  const runtime = await startTranslationServer({ env, loadEnv: false, fetchImpl });

  const post = () =>
    fetch(new URL("/session", runtime.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetLanguage: "en" }),
    });

  try {
    assert.equal((await post()).status, 500); // no key yet

    await handlers.setKey({ key: "sk-settings-live-000000" });
    const res = await post();
    assert.equal(res.status, 200);
    assert.equal((await res.json()).client_secret, "cs_e2e");
    assert.equal(auth.at(-1), "Bearer sk-settings-live-000000");

    await handlers.clearKey();
    assert.equal((await post()).status, 500); // key cleared
  } finally {
    await runtime.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("verifyKey verifies the stored key and reports missing when absent", async () => {
  const dir = await tempDir();
  try {
    const store = await fileStore(dir);
    const handlers = createSettingsHandlers({
      store,
      env: {},
      verify: async ({ apiKey }) => ({ ok: apiKey === "sk-good-0000000000000" }),
    });
    assert.deepEqual(await handlers.verifyKey(), { ok: false, reason: "missing" });
    await store.setApiKey("sk-good-0000000000000");
    assert.deepEqual(await handlers.verifyKey(), { ok: true });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
