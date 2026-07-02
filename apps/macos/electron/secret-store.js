import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import path from "node:path";

// Secret storage abstraction. On macOS the API key belongs in the Keychain
// (via the optional native `keytar` module); anywhere keytar is unavailable
// (CI, Linux dev, a failed native build) we fall back to a 0600 JSON file.
//
// This module deliberately does NOT import electron, so it is unit-testable
// under plain Node with an injected keytar loader.

const DEFAULT_SERVICE_NAME = "TranslationKonjac";
const DEFAULT_ACCOUNT_NAME = "openai-api-key";
const SECRETS_FILENAME = "secrets.json";

/**
 * Resolve the best available secret store. Tries keytar first; if the loader
 * throws or does not expose a usable keytar API, falls back to a file store.
 *
 * @param {object} [options]
 * @param {() => Promise<any>} [options.keytarLoader] resolves to the keytar module
 * @param {string} [options.fileDir] directory for the file-backend fallback
 * @param {string} [options.serviceName]
 * @param {string} [options.accountName]
 * @returns {Promise<{ backendName: "keytar" | "file",
 *   getApiKey: () => Promise<string|null>,
 *   setApiKey: (key: string) => Promise<void>,
 *   clearApiKey: () => Promise<void> }>}
 */
export async function resolveSecretStore({
  keytarLoader = () => import("keytar"),
  fileDir,
  serviceName = DEFAULT_SERVICE_NAME,
  accountName = DEFAULT_ACCOUNT_NAME,
} = {}) {
  const keytar = await tryLoadKeytar(keytarLoader);
  if (keytar) {
    return createKeytarStore({ keytar, serviceName, accountName });
  }
  if (!fileDir) {
    throw new Error(
      "resolveSecretStore: keytar unavailable and no fileDir was provided for the fallback store.",
    );
  }
  return createFileStore({ fileDir, accountName });
}

async function tryLoadKeytar(loader) {
  try {
    return pickKeytar(await loader());
  } catch {
    return null;
  }
}

// A dynamic import of the CJS keytar module exposes its API either directly or
// under `.default`; an injected fake exposes it directly. Accept both.
function pickKeytar(mod) {
  if (mod && typeof mod.getPassword === "function") {
    return mod;
  }
  if (mod?.default && typeof mod.default.getPassword === "function") {
    return mod.default;
  }
  return null;
}

function createKeytarStore({ keytar, serviceName, accountName }) {
  return {
    backendName: "keytar",
    async getApiKey() {
      return (await keytar.getPassword(serviceName, accountName)) || null;
    },
    async setApiKey(key) {
      await keytar.setPassword(serviceName, accountName, key);
    },
    async clearApiKey() {
      await keytar.deletePassword(serviceName, accountName);
    },
  };
}

function createFileStore({ fileDir, accountName }) {
  const filePath = path.join(fileDir, SECRETS_FILENAME);

  async function readAll() {
    let raw;
    try {
      raw = await readFile(filePath, "utf8");
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return {};
      }
      throw error;
    }
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      // A corrupt secrets file should not brick the app; treat it as empty.
      return {};
    }
  }

  async function writeAll(data) {
    await mkdir(fileDir, { recursive: true, mode: 0o700 });
    await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
    // writeFile's `mode` only applies when the file is created; enforce 0600
    // even if it already existed with looser permissions.
    await chmod(filePath, 0o600);
  }

  return {
    backendName: "file",
    async getApiKey() {
      const value = (await readAll())[accountName];
      return typeof value === "string" && value ? value : null;
    },
    async setApiKey(key) {
      const data = await readAll();
      data[accountName] = key;
      await writeAll(data);
    },
    async clearApiKey() {
      const data = await readAll();
      delete data[accountName];
      await writeAll(data);
    },
  };
}
