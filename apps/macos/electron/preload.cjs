const { contextBridge } = require("electron");

// Minimal, safe surface for the renderer. The OpenAI API key never crosses this
// bridge — it stays in the main process / session server. M4 adds settings and
// update IPC (e.g. get/set API key, check for updates) here.
contextBridge.exposeInMainWorld("translationKonjac", {
  platform: process.platform,
});
