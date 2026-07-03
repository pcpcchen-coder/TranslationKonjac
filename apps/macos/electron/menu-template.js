// Builds the application menu as a plain data template (no electron import), so
// its structure and click wiring are unit-testable. main.js passes the real
// callbacks and feeds the result to Menu.buildFromTemplate.

/**
 * @param {object} params
 * @param {string} [params.appName]
 * @param {() => void} params.onOpenSettings
 * @param {() => void} params.onOpenGitHub
 * @param {boolean} [params.isMac]
 */
export function buildMenuTemplate({
  appName = "TranslationKonjac",
  onOpenSettings,
  onOpenGitHub,
  isMac = process.platform === "darwin",
}) {
  const template = [];

  if (isMac) {
    template.push({
      label: appName,
      submenu: [
        { role: "about" },
        { type: "separator" },
        {
          id: "settings",
          label: "Settings…",
          accelerator: "Cmd+,",
          click: onOpenSettings,
        },
        { type: "separator" },
        { role: "hide" },
        { role: "quit" },
      ],
    });
  }

  template.push({
    label: "View",
    submenu: [
      { role: "reload" },
      { role: "forceReload" },
      { role: "toggleDevTools" },
      { type: "separator" },
      { role: "togglefullscreen" },
    ],
  });

  template.push({
    role: "help",
    submenu: [{ id: "github", label: "Project on GitHub", click: onOpenGitHub }],
  });

  return template;
}
