import { pathToFileURL } from "node:url";

// The translation session server is the existing apps/web Node server. In dev it
// lives two directories up; in a packaged build electron-builder copies apps/web/src
// to <resources>/web/src and main.js passes that path in. This module deliberately
// does NOT import electron so it can be unit-tested under plain Node.
const DEV_SERVER_MODULE = new URL("../../web/src/server.js", import.meta.url);

function toModuleUrl(serverModule) {
  if (!serverModule) {
    return DEV_SERVER_MODULE.href;
  }
  if (typeof serverModule === "string") {
    return serverModule.startsWith("file:")
      ? serverModule
      : pathToFileURL(serverModule).href;
  }
  return serverModule.href;
}

/**
 * Start the reused web session server on a loopback port.
 *
 * @returns {Promise<{ server: import("node:http").Server, host: string,
 *   port: number, url: string, close: () => Promise<void> }>}
 */
export async function startTranslationServer({
  env = process.env,
  host = "127.0.0.1",
  port = 0,
  loadEnv = true,
  serverModule,
} = {}) {
  const { buildServer, loadEnvFiles } = await import(toModuleUrl(serverModule));

  if (loadEnv) {
    loadEnvFiles(env);
  }

  const server = buildServer({ env });

  await new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    // Hard-pin loopback: this server mints OpenAI client secrets and must never
    // be reachable off-host, regardless of any HOST env var.
    server.listen(port, host);
  });

  const address = server.address();
  const boundPort =
    address && typeof address === "object" ? address.port : port;

  return {
    server,
    host,
    port: boundPort,
    url: `http://${host}:${boundPort}/`,
    close() {
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}
