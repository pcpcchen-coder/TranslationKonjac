import { validateApiKeyFormat } from "./api-key.js";

// First-run / startup flow, as a pure state machine over the secret store.
// Electron-free so it is unit-testable; main.js wires the window/dialog around it.

/**
 * @param {{ store: { getApiKey: () => Promise<string|null> } }} params
 * @returns {Promise<{ action: "start" | "prompt-key" }>}
 */
export async function resolveStartupFlow({ store }) {
  const key = await store.getApiKey();
  return { action: key ? "start" : "prompt-key" };
}

/**
 * Validate (and optionally online-verify) a key, then store it. A bad format or
 * a failed verification stores nothing.
 *
 * @param {object} params
 * @param {{ setApiKey: (key: string) => Promise<void> }} params.store
 * @param {string} params.key
 * @param {(key: unknown) => { ok: boolean, key?: string, error?: string }} [params.validate]
 * @param {(args: { apiKey: string }) => Promise<{ ok: boolean, reason?: string }>} [params.verify]
 * @returns {Promise<{ ok: true } | { ok: false, error: string, reason?: string }>}
 */
export async function completeKeySetup({
  store,
  key,
  validate = validateApiKeyFormat,
  verify,
}) {
  const check = validate(key);
  if (!check.ok) {
    return { ok: false, error: check.error };
  }

  if (verify) {
    const online = await verify({ apiKey: check.key });
    if (!online.ok) {
      return {
        ok: false,
        reason: online.reason,
        error:
          online.reason === "unauthorized"
            ? "OpenAI rejected this API key."
            : "Could not reach OpenAI to verify the key. Check your connection and try again.",
      };
    }
  }

  await store.setApiKey(check.key);
  return { ok: true };
}
