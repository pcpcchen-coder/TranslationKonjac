import { test } from "node:test";
import assert from "node:assert/strict";

import { buildMenuTemplate } from "../electron/menu-template.js";

function findMenu(template, labelOrRole) {
  return template.find((m) => m.label === labelOrRole || m.role === labelOrRole);
}

test("includes an app menu with a Settings item on macOS", () => {
  let opened = false;
  const template = buildMenuTemplate({
    appName: "TK",
    isMac: true,
    onOpenSettings: () => {
      opened = true;
    },
    onOpenGitHub: () => {},
  });

  assert.equal(template[0].label, "TK");
  const settings = template[0].submenu.find((i) => i.id === "settings");
  assert.ok(settings, "expected a Settings item");
  assert.equal(settings.accelerator, "Cmd+,");
  settings.click();
  assert.equal(opened, true);
  assert.ok(template[0].submenu.some((i) => i.role === "quit"));
});

test("omits the app menu on non-macOS platforms", () => {
  const template = buildMenuTemplate({
    appName: "TK",
    isMac: false,
    onOpenSettings: () => {},
    onOpenGitHub: () => {},
  });
  assert.notEqual(template[0].label, "TK");
  assert.ok(findMenu(template, "View"));
});

test("wires the GitHub help item to the provided callback", () => {
  let visited = false;
  const template = buildMenuTemplate({
    isMac: false,
    onOpenSettings: () => {},
    onOpenGitHub: () => {
      visited = true;
    },
  });
  const help = template.find((m) => m.role === "help");
  const gh = help.submenu.find((i) => i.id === "github");
  gh.click();
  assert.equal(visited, true);
});

test("provides a View menu with reload and devtools", () => {
  const template = buildMenuTemplate({
    isMac: true,
    onOpenSettings: () => {},
    onOpenGitHub: () => {},
  });
  const view = findMenu(template, "View");
  const roles = view.submenu.map((i) => i.role);
  assert.ok(roles.includes("reload"));
  assert.ok(roles.includes("toggleDevTools"));
});
