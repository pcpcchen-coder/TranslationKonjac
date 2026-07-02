import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { resolveSecretStore } from "../electron/secret-store.js";

function tempDir() {
  return mkdtemp(path.join(tmpdir(), "tk-secret-"));
}

// keytar loader that always fails -> forces the file backend.
const noKeytar = async () => {
  throw new Error("Cannot find module 'keytar'");
};

function fakeKeytar() {
  const backing = new Map();
  const calls = [];
  const key = (service, account) => `${service}::${account}`;
  return {
    calls,
    async getPassword(service, account) {
      calls.push(["get", service, account]);
      return backing.get(key(service, account)) ?? null;
    },
    async setPassword(service, account, password) {
      calls.push(["set", service, account, password]);
      backing.set(key(service, account), password);
    },
    async deletePassword(service, account) {
      calls.push(["delete", service, account]);
      return backing.delete(key(service, account));
    },
  };
}

test("file backend: set then get round-trips", async () => {
  const dir = await tempDir();
  try {
    const store = await resolveSecretStore({ keytarLoader: noKeytar, fileDir: dir });
    assert.equal(store.backendName, "file");
    await store.setApiKey("sk-file-key-0000000000");
    assert.equal(await store.getApiKey(), "sk-file-key-0000000000");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("file backend: get returns null when unset", async () => {
  const dir = await tempDir();
  try {
    const store = await resolveSecretStore({ keytarLoader: noKeytar, fileDir: dir });
    assert.equal(await store.getApiKey(), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("file backend: setApiKey overwrites a previous value", async () => {
  const dir = await tempDir();
  try {
    const store = await resolveSecretStore({ keytarLoader: noKeytar, fileDir: dir });
    await store.setApiKey("sk-old-0000000000000000");
    await store.setApiKey("sk-new-0000000000000000");
    assert.equal(await store.getApiKey(), "sk-new-0000000000000000");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("file backend: clearApiKey removes the value", async () => {
  const dir = await tempDir();
  try {
    const store = await resolveSecretStore({ keytarLoader: noKeytar, fileDir: dir });
    await store.setApiKey("sk-clear-me-00000000000");
    await store.clearApiKey();
    assert.equal(await store.getApiKey(), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test(
  "file backend: secrets file is written with 0600 permissions",
  { skip: process.platform === "win32" ? "POSIX permissions only" : false },
  async () => {
    const dir = await tempDir();
    try {
      const store = await resolveSecretStore({ keytarLoader: noKeytar, fileDir: dir });
      await store.setApiKey("sk-perm-0000000000000000");
      const info = await stat(path.join(dir, "secrets.json"));
      assert.equal(info.mode & 0o777, 0o600);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
);

test("keytar backend is selected and used when keytar loads", async () => {
  const dir = await tempDir();
  const keytar = fakeKeytar();
  try {
    const store = await resolveSecretStore({
      keytarLoader: async () => keytar,
      fileDir: dir,
      serviceName: "TKTest",
    });
    assert.equal(store.backendName, "keytar");

    await store.setApiKey("sk-keytar-000000000000");
    assert.equal(await store.getApiKey(), "sk-keytar-000000000000");
    await store.clearApiKey();
    assert.equal(await store.getApiKey(), null);

    // Confirm the injected keytar really handled the calls...
    assert.ok(keytar.calls.some((c) => c[0] === "set" && c[1] === "TKTest"));
    assert.ok(keytar.calls.some((c) => c[0] === "delete"));
    // ...and that nothing leaked to the file backend.
    await assert.rejects(stat(path.join(dir, "secrets.json")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("falls back to file backend when keytar fails to load", async () => {
  const dir = await tempDir();
  try {
    const store = await resolveSecretStore({ keytarLoader: noKeytar, fileDir: dir });
    assert.equal(store.backendName, "file");
    await store.setApiKey("sk-fallback-00000000000");
    assert.equal(await store.getApiKey(), "sk-fallback-00000000000");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
