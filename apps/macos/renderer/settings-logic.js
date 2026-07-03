// Pure presentation logic for the settings page. No DOM, no electron -- runs in
// the renderer but is unit-testable under plain Node. settings.js wires these to
// the DOM and the preload bridge.

export const INITIAL_SETTINGS_STATE = { status: "idle", message: "" };

function backendLabel(backend) {
  if (backend === "keytar") return "macOS Keychain";
  if (backend === "file") return "local file";
  return "unknown storage";
}

/** @param {{ hasKey: boolean, last4: string|null, backend: string }} status */
export function maskKeyStatus({ hasKey, last4, backend } = {}) {
  const where = backendLabel(backend);
  if (!hasKey) {
    return `No API key saved · ${where}`;
  }
  return `sk-…${last4 ?? "????"} · ${where}`;
}

/** UI-side gate: any non-empty input can be submitted; main does the real check. */
export function deriveFormState(input) {
  const trimmed = (input ?? "").trim();
  if (!trimmed) {
    return { canSave: false, hint: "Enter your OpenAI API key." };
  }
  if (!trimmed.startsWith("sk-")) {
    return { canSave: true, hint: 'Keys usually start with "sk-".' };
  }
  return { canSave: true, hint: "" };
}

export function nextState(state, event) {
  switch (event.type) {
    case "save":
      return { status: "saving", message: "Saving…" };
    case "verify":
      return { status: "verifying", message: "Verifying with OpenAI…" };
    case "saved":
      return { status: "saved", message: event.message ?? "Saved." };
    case "error":
      return { status: "error", message: event.message ?? "Something went wrong." };
    case "reset":
      return { ...INITIAL_SETTINGS_STATE };
    default:
      return state;
  }
}

export function buildUpdateStatusText(response) {
  if (!response) return "";
  switch (response.status) {
    case "checking":
      return "Checking for updates…";
    case "up-to-date":
      return "You’re on the latest version.";
    case "update-available":
      return `Update available: ${response.version}`;
    case "downloading":
      return "Downloading update…";
    case "error":
      return "Could not check for updates.";
    default:
      return "";
  }
}
