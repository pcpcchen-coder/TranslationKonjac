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

// --- S4: an API key set on the live env takes effect without a restart ---

function fakeClientSecretFetch() {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({
      url: String(url),
      authorization: init.headers?.Authorization ?? null,
    });
    return {
      ok: true,
      status: 200,
      async json() {
        return { value: "cs_live_secret", expires_at: 9_999_999_999 };
      },
      async text() {
        return "";
      },
    };
  };
  return { fetchImpl, calls };
}

async function postSession(runtime, targetLanguage = "en") {
  const response = await fetch(new URL("/session", runtime.url), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ targetLanguage }),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

test("an API key set on the live env takes effect without a restart", async () => {
  const env = {};
  const { fetchImpl, calls } = fakeClientSecretFetch();
  const runtime = await startTranslationServer({ env, loadEnv: false, fetchImpl });
  try {
    // 1. No key configured yet -> 500, and OpenAI is never contacted.
    const missing = await postSession(runtime);
    assert.equal(missing.status, 500);
    assert.match(missing.body.error, /OPENAI_API_KEY/);
    assert.equal(calls.length, 0);

    // 2. Set the key on the SAME env object (no restart) -> 200.
    env.OPENAI_API_KEY = "sk-first-key-000000000000";
    const first = await postSession(runtime);
    assert.equal(first.status, 200);
    assert.equal(first.body.client_secret, "cs_live_secret");
    assert.equal(calls.at(-1).authorization, "Bearer sk-first-key-000000000000");

    // 3. Rotate the key -> the very next request uses the new key.
    env.OPENAI_API_KEY = "sk-second-key-11111111111";
    const second = await postSession(runtime);
    assert.equal(second.status, 200);
    assert.equal(calls.at(-1).authorization, "Bearer sk-second-key-11111111111");
  } finally {
    await runtime.close();
  }
});
