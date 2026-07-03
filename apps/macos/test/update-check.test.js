import test from "node:test";
import assert from "node:assert/strict";

import { compareVersions, checkForUpdate, releasesPageUrl } from "../electron/update-check.js";

test("compareVersions orders semantic versions numerically", () => {
  assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
  assert.equal(compareVersions("1.2.0", "1.1.9"), 1);
  assert.equal(compareVersions("1.0.0", "1.0.1"), -1);
  assert.equal(compareVersions("1.10.0", "1.9.0"), 1); // numeric, not lexical
});

test("compareVersions tolerates a leading v", () => {
  assert.equal(compareVersions("v1.0.1", "1.0.0"), 1);
  assert.equal(compareVersions("2.0.0", "v2.0.0"), 0);
});

test("releasesPageUrl points at the project releases page", () => {
  assert.equal(
    releasesPageUrl("pcpcchen-coder/TranslationKonjac"),
    "https://github.com/pcpcchen-coder/TranslationKonjac/releases",
  );
});

function ghResponse(body, { status = 200, ok = status >= 200 && status < 300 } = {}) {
  return {
    ok,
    status,
    async json() {
      return body;
    },
  };
}

test("checkForUpdate reports an available update with the DMG asset URL", async () => {
  const result = await checkForUpdate({
    currentVersion: "1.0.0",
    repo: "owner/repo",
    fetchImpl: async () =>
      ghResponse({
        tag_name: "v1.2.0",
        html_url: "https://github.com/owner/repo/releases/tag/v1.2.0",
        assets: [
          { name: "notes.txt", browser_download_url: "https://x/notes.txt" },
          { name: "TranslationKonjac-1.2.0-arm64.dmg", browser_download_url: "https://x/app.dmg" },
        ],
      }),
  });
  assert.equal(result.status, "update-available");
  assert.equal(result.version, "1.2.0");
  assert.equal(result.url, "https://x/app.dmg");
});

test("checkForUpdate falls back to the release page when there is no DMG asset", async () => {
  const result = await checkForUpdate({
    currentVersion: "1.0.0",
    repo: "owner/repo",
    fetchImpl: async () =>
      ghResponse({
        tag_name: "1.1.0",
        html_url: "https://github.com/owner/repo/releases/tag/1.1.0",
        assets: [],
      }),
  });
  assert.equal(result.status, "update-available");
  assert.equal(result.url, "https://github.com/owner/repo/releases/tag/1.1.0");
});

test("checkForUpdate reports up-to-date when the latest is not newer", async () => {
  const result = await checkForUpdate({
    currentVersion: "2.0.0",
    fetchImpl: async () => ghResponse({ tag_name: "v2.0.0", assets: [] }),
  });
  assert.equal(result.status, "up-to-date");
});

test("checkForUpdate reports no-releases on 404", async () => {
  const result = await checkForUpdate({
    currentVersion: "1.0.0",
    fetchImpl: async () => ghResponse(null, { status: 404, ok: false }),
  });
  assert.equal(result.status, "no-releases");
});

test("checkForUpdate reports a retriable error on 5xx", async () => {
  const result = await checkForUpdate({
    currentVersion: "1.0.0",
    fetchImpl: async () => ghResponse(null, { status: 500, ok: false }),
  });
  assert.equal(result.status, "error");
  assert.equal(result.retriable, true);
});

test("checkForUpdate reports a retriable error when fetch throws", async () => {
  const result = await checkForUpdate({
    currentVersion: "1.0.0",
    fetchImpl: async () => {
      throw new Error("ENOTFOUND");
    },
  });
  assert.equal(result.status, "error");
  assert.equal(result.retriable, true);
});
