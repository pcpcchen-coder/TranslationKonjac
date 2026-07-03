import {
  maskKeyStatus,
  deriveFormState,
  nextState,
  INITIAL_SETTINGS_STATE,
} from "./settings-logic.js";

const bridge = window.translationKonjac;

const el = {
  keyStatus: document.querySelector("#keyStatus"),
  keyInput: document.querySelector("#keyInput"),
  keyHint: document.querySelector("#keyHint"),
  saveButton: document.querySelector("#saveButton"),
  verifyButton: document.querySelector("#verifyButton"),
  clearButton: document.querySelector("#clearButton"),
  message: document.querySelector("#message"),
  version: document.querySelector("#version"),
};

let state = INITIAL_SETTINGS_STATE;

function render() {
  el.message.textContent = state.message;
  el.message.className = `message ${
    state.status === "error" ? "error" : state.status === "saved" ? "ok" : ""
  }`;
}

function dispatch(event) {
  state = nextState(state, event);
  render();
}

async function refreshStatus() {
  try {
    const status = await bridge.settings.getKeyStatus();
    el.keyStatus.textContent = maskKeyStatus(status);
  } catch {
    el.keyStatus.textContent = "Could not read key status.";
  }
}

function syncForm() {
  const form = deriveFormState(el.keyInput.value);
  el.saveButton.disabled = !form.canSave;
  el.keyHint.textContent = form.hint;
}

async function onSave() {
  dispatch({ type: "save" });
  try {
    const result = await bridge.settings.setKey(el.keyInput.value);
    if (result.ok) {
      el.keyInput.value = "";
      syncForm();
      await refreshStatus();
      dispatch({ type: "saved", message: "API key saved." });
    } else {
      dispatch({ type: "error", message: result.error ?? "Could not save the key." });
    }
  } catch {
    dispatch({ type: "error", message: "Could not save the key." });
  }
}

async function onVerify() {
  dispatch({ type: "verify" });
  try {
    const result = await bridge.settings.verifyKey();
    if (result.ok) {
      dispatch({ type: "saved", message: "Key verified with OpenAI." });
    } else if (result.reason === "missing") {
      dispatch({ type: "error", message: "Save a key first, then verify." });
    } else if (result.reason === "unauthorized") {
      dispatch({ type: "error", message: "OpenAI rejected this key." });
    } else {
      dispatch({ type: "error", message: "Could not reach OpenAI to verify." });
    }
  } catch {
    dispatch({ type: "error", message: "Could not verify the key." });
  }
}

async function onClear() {
  try {
    await bridge.settings.clearKey();
    await refreshStatus();
    dispatch({ type: "saved", message: "API key cleared." });
  } catch {
    dispatch({ type: "error", message: "Could not clear the key." });
  }
}

async function showVersion() {
  try {
    const info = await bridge.app.getInfo();
    el.version.textContent = `TranslationKonjac ${info.version} · ${info.platform}`;
  } catch {
    /* non-fatal */
  }
}

el.keyInput.addEventListener("input", syncForm);
el.saveButton.addEventListener("click", onSave);
el.verifyButton.addEventListener("click", onVerify);
el.clearButton.addEventListener("click", onClear);

syncForm();
render();
void refreshStatus();
void showVersion();
