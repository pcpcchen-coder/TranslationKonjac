const { contextBridge, ipcRenderer } = require("electron");

// Channel names mirror electron/ipc-contract.js (CJS preload can't import the ESM
// module directly). Keep them in sync -- ipc-contract.test.js pins the values.
const CH = {
  GET_KEY_STATUS: "settings:get-key-status",
  SET_KEY: "settings:set-key",
  CLEAR_KEY: "settings:clear-key",
  VERIFY_KEY: "settings:verify-key",
  UPDATE_CHECK: "update:check",
  OPEN_EXTERNAL: "app:open-external",
  GET_INFO: "app:get-info",
};

// Safe, whitelisted surface. The full OpenAI API key only travels main-ward via
// setKey(key); nothing here ever returns a full key to the renderer.
contextBridge.exposeInMainWorld("translationKonjac", {
  platform: process.platform,
  settings: {
    getKeyStatus: () => ipcRenderer.invoke(CH.GET_KEY_STATUS),
    setKey: (key) => ipcRenderer.invoke(CH.SET_KEY, { key }),
    clearKey: () => ipcRenderer.invoke(CH.CLEAR_KEY),
    verifyKey: () => ipcRenderer.invoke(CH.VERIFY_KEY, {}),
  },
  updates: {
    check: () => ipcRenderer.invoke(CH.UPDATE_CHECK),
  },
  app: {
    getInfo: () => ipcRenderer.invoke(CH.GET_INFO),
    openExternal: (url) => ipcRenderer.invoke(CH.OPEN_EXTERNAL, { url }),
  },
});
