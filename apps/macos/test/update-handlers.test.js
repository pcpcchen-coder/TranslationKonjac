import test from "node:test";
import assert from "node:assert/strict";

import { decideUpdateStrategy } from "../electron/update-check.js";
import { createUpdateHandlers } from "../electron/update-handlers.js";
import { validateOpenExternalRequest } from "../electron/ipc-contract.js";

test("decideUpdateStrategy uses electron-updater only when packaged and available", () => {
  assert.equal(decideUpdateStrategy({ isPackaged: true, updaterAvailable: true }), "electron-updater");
  assert.equal(decideUpdateStrategy({ isPackaged: false, updaterAvailable: true }), "manual-fallback");
  assert.equal(decideUpdateStrategy({ isPackaged: true, updaterAvailable: false }), "manual-fallback");
});

test("check passes the result through and tags the active strategy", async () => {
  const handlers = createUpdateHandlers({
    strategy: "manual-fallback",
    appVersion: "1.0.0",
    checkImpl: async ({ currentVersion }) => ({
      status: "update-available",
      version: "1.1.0",
      url: "https://x/app.dmg",
      currentVersion,
    }),
  });
  const result = await handlers.check();
  assert.equal(result.status, "update-available");
  assert.equal(result.strategy, "manual-fallback");
  assert.equal(result.currentVersion, "1.0.0");
});

test("check reports up-to-date", async () => {
  const handlers = createUpdateHandlers({
    strategy: "electron-updater",
    appVersion: "2.0.0",
    checkImpl: async () => ({ status: "up-to-date", version: "2.0.0" }),
  });
  assert.equal((await handlers.check()).status, "up-to-date");
});

test("check surfaces errors", async () => {
  const handlers = createUpdateHandlers({
    strategy: "manual-fallback",
    appVersion: "1.0.0",
    checkImpl: async () => ({ status: "error", retriable: true }),
  });
  assert.equal((await handlers.check()).status, "error");
});

test("openDownload opens the allowlisted releases page", async () => {
  const opened = [];
  const handlers = createUpdateHandlers({
    strategy: "manual-fallback",
    appVersion: "1.0.0",
    repo: "pcpcchen-coder/TranslationKonjac",
    openExternalImpl: async (url) => {
      opened.push(url);
    },
  });
  const result = await handlers.openDownload();
  assert.equal(result.ok, true);
  assert.equal(result.url, "https://github.com/pcpcchen-coder/TranslationKonjac/releases");
  assert.deepEqual(opened, [result.url]);
  // The download URL must satisfy the S5 open-external allowlist.
  assert.equal(validateOpenExternalRequest({ url: result.url }).ok, true);
});
