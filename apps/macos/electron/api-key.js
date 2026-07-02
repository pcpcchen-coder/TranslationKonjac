// OpenAI API key validation. Two layers:
//   - validateApiKeyFormat: local, instant, cheap sanity check (used by the
//     first-run flow and the settings page before storing).
//   - verifyApiKeyOnline: optional network check that the key actually works.
//
// No electron import, so both are unit-testable under plain Node.

export const MIN_API_KEY_LENGTH = 20;
export const OPENAI_MODELS_URL = "https://api.openai.com/v1/models";

/**
 * @param {unknown} key
 * @returns {{ ok: true, key: string } | { ok: false, error: string }}
 */
export function validateApiKeyFormat(key) {
  if (typeof key !== "string") {
    return { ok: false, error: "API key is required." };
  }
  const trimmed = key.trim();
  if (!trimmed) {
    return { ok: false, error: "API key is required." };
  }
  if (/\s/.test(trimmed)) {
    return { ok: false, error: "API key must not contain whitespace." };
  }
  if (!trimmed.startsWith("sk-")) {
    return { ok: false, error: 'API key should start with "sk-".' };
  }
  if (trimmed.length < MIN_API_KEY_LENGTH) {
    return { ok: false, error: "API key looks too short." };
  }
  return { ok: true, key: trimmed };
}

/**
 * @param {{ apiKey: string, fetchImpl?: typeof fetch }} params
 * @returns {Promise<{ ok: true } | { ok: false, reason: "unauthorized" | "network" }>}
 */
export async function verifyApiKeyOnline({ apiKey, fetchImpl = fetch }) {
  let response;
  try {
    response = await fetchImpl(OPENAI_MODELS_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch {
    return { ok: false, reason: "network" };
  }

  if (response.ok) {
    return { ok: true };
  }
  if (response.status === 401) {
    return { ok: false, reason: "unauthorized" };
  }
  // 4xx (other than 401) / 5xx / rate limits: treat as a transient network-ish
  // problem the caller can retry, rather than a definitively bad key.
  return { ok: false, reason: "network" };
}
