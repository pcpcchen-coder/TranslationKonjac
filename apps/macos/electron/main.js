import {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  shell,
  systemPreferences,
} from "electron";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { startTranslationServer } from "./server-runtime.js";
import { resolveSecretStore } from "./secret-store.js";
import { createSettingsHandlers } from "./settings-handlers.js";
import { resolveStartupFlow } from "./app-flow.js";
import { decidePermission } from "./permissions.js";
import { buildMenuTemplate } from "./menu-template.js";
import {
  CHANNELS,
  validateSetKeyRequest,
  validateVerifyKeyRequest,
  validateOpenExternalRequest,
} from "./ipc-contract.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRELOAD = path.join(__dirname, "preload.cjs");
const SETTINGS_HTML = path.join(__dirname, "..", "renderer", "settings.html");
const GITHUB_URL = "https://github.com/pcpcchen-coder/TranslationKonjac";

let mainWindow = null;
let settingsWindow = null;
let runtime = null;
let store = null;
let handlers = null;

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
    await systemPreferences.askForMediaAccess("microphone");
  } catch {
    // Non-fatal: the renderer surfaces a clearer error if capture later fails.
  }
}

function applyPermissionPolicy(session) {
  session.setPermissionRequestHandler((_wc, permission, callback, details) => {
    callback(decidePermission(permission, details ?? {}));
  });
  // Some flows consult the synchronous checker too.
  session.setPermissionCheckHandler((_wc, permission, _origin, details) =>
    decidePermission(permission, details ?? {}),
  );
}

async function createMainWindow() {
  runtime = await startTranslationServer({
    env: process.env,
    serverModule: resolveServerModule(),
  });

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

  applyPermissionPolicy(mainWindow.webContents.session);
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  await mainWindow.loadURL(runtime.url);
}

function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 560,
    height: 620,
    resizable: false,
    minimizable: false,
    title: "TranslationKonjac Settings",
    parent: mainWindow ?? undefined,
    backgroundColor: "#0b1021",
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
  settingsWindow.loadFile(SETTINGS_HTML);
}

function registerIpc() {
  ipcMain.handle(CHANNELS.GET_KEY_STATUS, () => handlers.getKeyStatus());

  ipcMain.handle(CHANNELS.SET_KEY, (_event, payload) => {
    const check = validateSetKeyRequest(payload);
    if (!check.ok) {
      return { ok: false, error: check.error };
    }
    return handlers.setKey(payload);
  });

  ipcMain.handle(CHANNELS.CLEAR_KEY, () => handlers.clearKey());

  ipcMain.handle(CHANNELS.VERIFY_KEY, (_event, payload) => {
    const check = validateVerifyKeyRequest(payload);
    if (!check.ok) {
      return { ok: false, error: check.error };
    }
    return handlers.verifyKey();
  });

  ipcMain.handle(CHANNELS.OPEN_EXTERNAL, (_event, payload) => {
    const check = validateOpenExternalRequest(payload);
    if (!check.ok) {
      return { ok: false, error: check.error };
    }
    return shell.openExternal(payload.url).then(() => ({ ok: true }));
  });

  ipcMain.handle(CHANNELS.GET_INFO, () => ({
    version: app.getVersion(),
    platform: process.platform,
  }));
}

function installMenu() {
  const template = buildMenuTemplate({
    appName: app.name,
    onOpenSettings: openSettingsWindow,
    onOpenGitHub: () => shell.openExternal(GITHUB_URL),
  });
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
    store = await resolveSecretStore({ fileDir: app.getPath("userData") });
    // Share process.env with the session server so a key saved in Settings takes
    // effect live (see settings-handlers / server-runtime).
    handlers = createSettingsHandlers({ store, env: process.env });

    registerIpc();
    installMenu();
    await ensureMicrophoneAccess();
    await createMainWindow();

    // First run with no key: open Settings so the user can enter one.
    const flow = await resolveStartupFlow({ store });
    if (flow.action === "prompt-key") {
      openSettingsWindow();
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
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
