import { test } from "node:test";
import assert from "node:assert/strict";

import { startTranslationServer } from "../electron/server-runtime.js";

test("serves the reused web front-end on a loopback port", async () => {
  const runtime = await startTranslationServer({ loadEnv: false, env: {} });
  try {
    assert.match(runtime.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);

    const response = await fetch(runtime.url);
    assert.equal(response.status, 200);

    const html = await response.text();
    assert.match(html, /In-browser Realtime Translation/);
  } finally {
    await runtime.close();
  }
});

test("session endpoint reports a missing key instead of crashing", async () => {
  const runtime = await startTranslationServer({ loadEnv: false, env: {} });
  try {
    const response = await fetch(new URL("/session", runtime.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetLanguage: "en" }),
    });
    assert.equal(response.status, 500);

    const body = await response.json();
    assert.match(body.error, /OPENAI_API_KEY/);
  } finally {
    await runtime.close();
  }
});
