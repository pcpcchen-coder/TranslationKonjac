import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Pins the electron-builder packaging config so later steps can't silently break
// the signed arm64 DMG. Reads files only -- no electron required.

const macosDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const run = promisify(execFile);

async function readPkg() {
  return JSON.parse(await readFile(path.join(macosDir, "package.json"), "utf8"));
}

test("mac target is a hardened-runtime arm64 dmg with entitlements", async () => {
  const { build } = await readPkg();
  assert.equal(build.mac.hardenedRuntime, true);
  const dmg = build.mac.target.find((t) => t.target === "dmg");
  assert.ok(dmg, "expected a dmg target");
  assert.ok(dmg.arch.includes("arm64"));
  assert.match(build.mac.entitlements, /entitlements\.mac\.plist$/);
});

test("mic usage description and packaged resources are configured", async () => {
  const { build, main, dependencies, optionalDependencies } = await readPkg();
  assert.ok(build.mac.extendInfo.NSMicrophoneUsageDescription.length > 0);
  const web = build.extraResources.find((r) => r.from === "../web/src");
  assert.equal(web.to, "web/src");
  assert.ok(build.files.includes("electron/**/*"));
  assert.ok(build.files.includes("renderer/**/*"));
  assert.equal(main, "electron/main.js");
  // in-app update ships in the bundle; keytar stays optional so a failed native
  // build never breaks install.
  assert.ok(dependencies["electron-updater"]);
  assert.ok(optionalDependencies.keytar);
});

test("entitlements grant audio input and network client", async () => {
  const plist = await readFile(
    path.join(macosDir, "build", "entitlements.mac.plist"),
    "utf8",
  );
  assert.match(plist, /com\.apple\.security\.device\.audio-input/);
  assert.match(plist, /com\.apple\.security\.network\.client/);
});

test("the icon generator produces a valid PNG", async () => {
  const iconPath = path.join(macosDir, "build", "icon.png");
  await rm(iconPath, { force: true });
  await run(process.execPath, [path.join(macosDir, "scripts", "make-placeholder-icon.mjs")]);
  const info = await stat(iconPath);
  assert.ok(info.size > 0);
  const header = await readFile(iconPath);
  assert.deepEqual([...header.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
});
