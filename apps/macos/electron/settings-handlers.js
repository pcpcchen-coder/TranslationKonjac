import { validateApiKeyFormat, verifyApiKeyOnline } from "./api-key.js";
import { validateGetKeyStatusResponse } from "./ipc-contract.js";

// The main-process implementation behind the settings IPC channels. This is the
// convergence point of S2 (store), S3 (validation), and S4 (live env): setting a
// key persists it AND injects it into the live server env so translation works
// with no restart. Electron-free -- main.js binds these to ipcMain.handle.

/**
 * @param {object} params
 * @param {{ backendName: string, getApiKey: Function, setApiKey: Function, clearApiKey: Function }} params.store
 * @param {Record<string, string>} params.env  the SAME env object the session server reads
 * @param {Function} [params.validate]
 * @param {Function} [params.verify]
 * @param {typeof fetch} [params.fetchImpl]
 */
export function createSettingsHandlers({
  store,
  env,
  validate = validateApiKeyFormat,
  verify = verifyApiKeyOnline,
  fetchImpl,
}) {
  async function getKeyStatus() {
    const key = await store.getApiKey();
    const status = {
      hasKey: Boolean(key),
      last4: key ? key.slice(-4) : null,
      backend: store.backendName,
    };
    // Defense in depth: never hand back anything key-shaped, even by accident.
    const check = validateGetKeyStatusResponse(status);
    if (!check.ok) {
      throw new Error(`Refusing to return key status: ${check.error}`);
    }
    return status;
  }

  async function setKey(payload = {}) {
    const check = validate(payload.key);
    if (!check.ok) {
      return { ok: false, error: check.error };
    }
    await store.setApiKey(check.key);
    // Live-inject so the running session server picks it up on the next request
    // (see server-runtime / S4). No restart required.
    env.OPENAI_API_KEY = check.key;
    return { ok: true };
  }

  async function clearKey() {
    await store.clearApiKey();
    delete env.OPENAI_API_KEY;
    return { ok: true };
  }

  async function verifyKey() {
    const key = await store.getApiKey();
    if (!key) {
      return { ok: false, reason: "missing" };
    }
    return verify({ apiKey: key, fetchImpl });
  }

  return { getKeyStatus, setKey, clearKey, verifyKey };
}
