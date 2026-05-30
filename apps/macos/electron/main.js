import {
  app,
  BrowserWindow,
  Menu,
  dialog,
  shell,
  systemPreferences,
} from "electron";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { startTranslationServer } from "./server-runtime.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRELOAD = path.join(__dirname, "preload.cjs");
const GITHUB_URL = "https://github.com/pcpcchen-coder/TranslationKonjac";

let mainWindow = null;
let runtime = null;

// In dev, server-runtime resolves the web app relative to itself. In a packaged
// build, electron-builder copies apps/web/src to <resources>/web/src.
function resolveServerModule() {
  if (!app.isPackaged) {
    return undefined;
  }
  return pathToFileURL(
    path.join(process.resourcesPath, "web", "src", "server.js"),
  ).href;
}

async function ensureMicrophoneAccess() {
  if (process.platform !== "darwin") {
    return;
  }
  try {
    // Triggers the macOS TCC microphone prompt on first run. M3 hardens this.
    await systemPreferences.askForMediaAccess("microphone");
  } catch {
    // Non-fatal: the renderer surfaces a clearer error if capture later fails.
  }
}

async function createWindow() {
  runtime = await startTranslationServer({ serverModule: resolveServerModule() });

  mainWindow = new BrowserWindow({
    width: 1180,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    title: "TranslationKonjac",
    backgroundColor: "#0b1021",
    show: false,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Auto-grant microphone; deny everything else. Chrome-tab/display capture is
  // intentionally removed (decision 2), so we never grant "display-capture".
  // M3 hardens this further.
  mainWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      callback(permission === "media");
    },
  );

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  await mainWindow.loadURL(runtime.url);
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              {
                label: "Settings…",
                accelerator: "Cmd+,",
                click: () => {
                  // Placeholder until M4 ships the settings window.
                  dialog.showMessageBox({
                    type: "info",
                    message: "Settings",
                    detail:
                      "API key management and update controls arrive in milestone M4.",
                  });
                },
              },
              { type: "separator" },
              { role: "hide" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      role: "help",
      submenu: [
        {
          label: "Project on GitHub",
          click: () => shell.openExternal(GITHUB_URL),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function shutdownRuntime() {
  try {
    await runtime?.close();
  } finally {
    runtime = null;
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    buildMenu();
    await ensureMicrophoneAccess();
    await createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("before-quit", (event) => {
    if (runtime) {
      event.preventDefault();
      shutdownRuntime().finally(() => app.quit());
    }
  });
}
