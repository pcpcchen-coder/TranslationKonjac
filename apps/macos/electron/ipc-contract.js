// The single source of truth for the renderer<->main IPC surface: channel names
// plus request/response validators. The security-critical invariant is that a
// full OpenAI API key only ever crosses the bridge in ONE direction (renderer ->
// main, when the user types it into set-key). Every response validator refuses
// to return anything that looks like a full key. Electron-free and unit-tested.

export const CHANNELS = {
  GET_KEY_STATUS: "settings:get-key-status",
  SET_KEY: "settings:set-key",
  CLEAR_KEY: "settings:clear-key",
  VERIFY_KEY: "settings:verify-key",
  UPDATE_CHECK: "update:check",
  OPEN_EXTERNAL: "app:open-external",
  GET_INFO: "app:get-info",
};

export const ALLOWED_EXTERNAL_PREFIXES = [
  "https://github.com/pcpcchen-coder/TranslationKonjac",
];

// A real OpenAI key is "sk-" followed by a long token. Match >=8 trailing chars
// so a 4-char masked "last4" (or a short placeholder) never trips the detector.
const FULL_KEY_PATTERN = /sk-[A-Za-z0-9_-]{8,}/;

/** Deep-scan any payload for something that looks like a full API key. */
export function containsApiKeyLike(value) {
  if (typeof value === "string") {
    return FULL_KEY_PATTERN.test(value);
  }
  if (Array.isArray(value)) {
    return value.some(containsApiKeyLike);
  }
  if (value && typeof value === "object") {
    return Object.values(value).some(containsApiKeyLike);
  }
  return false;
}

function ok() {
  return { ok: true };
}
function fail(error) {
  return { ok: false, error };
}

export function validateGetKeyStatusResponse(payload) {
  if (!payload || typeof payload !== "object") {
    return fail("Key status must be an object.");
  }
  if (typeof payload.hasKey !== "boolean") {
    return fail("Key status must include a boolean hasKey.");
  }
  if (payload.last4 !== null && typeof payload.last4 !== "string") {
    return fail("Key status last4 must be a string or null.");
  }
  if (typeof payload.backend !== "string") {
    return fail("Key status must include a backend name.");
  }
  if (containsApiKeyLike(payload)) {
    return fail("Key status must never contain a full API key.");
  }
  return ok();
}

export function validateSetKeyRequest(payload) {
  if (!payload || typeof payload !== "object") {
    return fail("set-key requires a { key } object.");
  }
  if (typeof payload.key !== "string") {
    return fail("set-key requires a string key.");
  }
  return ok();
}

export function validateVerifyKeyRequest(payload) {
  if (payload == null) {
    return ok();
  }
  if (typeof payload !== "object") {
    return fail("verify-key takes no arguments.");
  }
  if (containsApiKeyLike(payload)) {
    return fail("verify-key must not carry a key; it verifies the stored key.");
  }
  if (Object.keys(payload).length > 0) {
    return fail("verify-key takes no arguments.");
  }
  return ok();
}

export function validateOpenExternalRequest(payload) {
  if (!payload || typeof payload !== "object" || typeof payload.url !== "string") {
    return fail("open-external requires a { url } string.");
  }
  const allowed = ALLOWED_EXTERNAL_PREFIXES.some((prefix) =>
    payload.url.startsWith(prefix),
  );
  if (!allowed) {
    return fail("open-external URL is not on the allowlist.");
  }
  return ok();
}
