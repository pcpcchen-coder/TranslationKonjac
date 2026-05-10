import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { buildServer, getListenHost } from "../src/server.js";

async function withServer(options, run) {
  const server = buildServer(options);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.closeAllConnections?.();
    server.close();
    await once(server, "close");
  }
}

test("serves the browser app from the root route", async () => {
  await withServer({ env: { OPENAI_API_KEY: "sk-test" } }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/html/);
    assert.match(body, /In-browser Realtime Translation/);
    assert.match(body, /Choose tab to start translating/);
    assert.match(body, /Microphone/);
    assert.match(body, /Two-way call/);
    assert.match(body, /Start two-way call mode/);
    assert.match(body, /id="oneWayCard"/);
    assert.match(body, /id="twoWayCard"/);
    assert.match(body, /id="oneWayOutputDevice"/);
    assert.match(body, /id="outboundOutputDevice"/);
    assert.match(body, /id="inboundOutputDevice"/);
    assert.match(body, /id="stopOneWayButton"/);
    assert.match(body, /id="stopTwoWayButton"/);
    assert.match(body, /id="myLanguage"/);
    assert.match(body, /id="partnerLanguage"/);
    assert.match(body, /Your language \(you speak this\)/);
    assert.match(body, /Their language \(partner speaks this\)/);
    assert.match(body, /Send translated voice into call via/);
    assert.match(body, /Hear translated partner voice on/);
    assert.match(body, /Audio input device, e.g. BlackHole 16ch from LINE app/);
    assert.match(body, /<option value="zh" selected>Chinese<\/option>/);
    assert.match(body, /<option value="en" selected>English<\/option>/);
    assert.match(body, /Their voice inbound audio/);
    assert.match(body, /Strict isolation/);
    assert.match(body, /Translated audio output/);
    assert.match(body, /option value="en" selected/);
    assert.doesNotMatch(body, /Their voice → Chinese output/);
    assert.doesNotMatch(body, /id="outputDevice"/);
    assert.doesNotMatch(body, /id="stopButton"/);
    assert.doesNotMatch(body, /id="twoWayPanel"/);
    assert.doesNotMatch(body, /Start translating</);
    assert.doesNotMatch(body, /OpenAI Developers/);
    assert.doesNotMatch(body, /class="topbar"/);
    assert.doesNotMatch(body, /Open a tab that is already playing audio/);
    assert.doesNotMatch(body, /Test Chinese output/);
    assert.doesNotMatch(body, /Test outbound/);
    assert.doesNotMatch(body, /Audit inbound/);
    assert.doesNotMatch(body, /Audit microphone capture of inbound/);
    assert.doesNotMatch(body, /Start BlackHole 2ch live monitor/);
    assert.doesNotMatch(body, /Show macOS default output/);
    assert.doesNotMatch(body, /BlackHole 2ch live/);
  });
});

test("uses localhost by default and allows the listen host to be configured", () => {
  assert.equal(getListenHost({}), "127.0.0.1");
  assert.equal(getListenHost({ HOST: "0.0.0.0" }), "0.0.0.0");
});

test("serves the source speech WAV as audio", async () => {
  await withServer({ env: { OPENAI_API_KEY: "sk-test" } }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/source-speech.wav`, { method: "HEAD" });

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /audio\/wav/);
  });
});

test("serves browser app code that connects to translation over WebRTC", async () => {
  await withServer({ env: { OPENAI_API_KEY: "sk-test" } }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/app.js`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(body, /RTCPeerConnection/);
    assert.match(body, /getUserMedia/);
    assert.match(body, /setSinkId/);
    assert.match(body, /startTwoWayButton/);
    assert.match(body, /stopOneWayButton/);
    assert.match(body, /stopTwoWayButton/);
    assert.match(body, /oneWayOutputDevice/);
    assert.match(body, /outboundOutputDevice/);
    assert.match(body, /outbound mic→\$\{theirLang\}/);
    assert.match(body, /inbound tab→\$\{myLang\}/);
    assert.match(body, /inbound device→\$\{myLang\}/);
    assert.match(body, /myLanguage\.value/);
    assert.match(body, /partnerLanguage\.value/);
    assert.match(body, /Your language and their language must be different/);
    assert.match(body, /captureInboundAudio/);
    assert.match(body, /buildRawAudioInputMediaOptions/);
    assert.match(body, /assertTwoWayIsolation/);
    assert.match(body, /createTranslatedAudioSink/);
    assert.match(body, /Chrome bound/);
    assert.match(body, /createMediaStreamSource/);
    assert.match(body, /createMediaStreamDestination/);
    assert.doesNotMatch(body, /playOutputTestTone/);
    assert.doesNotMatch(body, /auditInboundLeak/);
    assert.doesNotMatch(body, /auditOutboundMicCapture/);
    assert.doesNotMatch(body, /startBh2chMonitor/);
    assert.doesNotMatch(body, /logSystemDefaultOutput/);
    assert.doesNotMatch(body, /testChineseOutputButton/);
    assert.doesNotMatch(body, /testOutboundButton/);
    assert.doesNotMatch(body, /auditLeakButton/);
    assert.doesNotMatch(body, /auditMicCaptureButton/);
    assert.doesNotMatch(body, /liveBh2chMonitorButton/);
    assert.doesNotMatch(body, /showDefaultOutputButton/);
    assert.match(body, /Web Audio routing/);
    assert.match(body, /closeRemoteAudioContext/);
    assert.match(body, /audio.blocked/);
    assert.match(body, /BlackHole output is blocked/);
    assert.match(body, /guardOutboundMicDuringInboundPlayback/);
    assert.match(body, /outbound.mic/);
    assert.match(body, /replaceTrack/);
    assert.match(body, /outbound.output/);
    assert.match(body, /quiet-window/);
    assert.match(body, /realtime\/translations\/calls/);
    assert.doesNotMatch(body, /new WebSocket/);
  });
});

test("POST /session validates target language before calling OpenAI", async () => {
  let calls = 0;
  await withServer(
    {
      env: { OPENAI_API_KEY: "sk-test" },
      fetchImpl: async () => {
        calls += 1;
        throw new Error("fetch should not be called");
      },
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: "english" }),
      });
      const body = await response.json();

      assert.equal(response.status, 400);
      assert.match(body.error, /language code/i);
      assert.equal(calls, 0);
    },
  );
});

test("POST /session returns a browser-safe client secret response", async () => {
  const requests = [];
  await withServer(
    {
      env: { OPENAI_API_KEY: "sk-test" },
      fetchImpl: async (url, init) => {
        requests.push({ url, init });
        return Response.json({
          value: "ek_test",
          expires_at: 123,
          session: { id: "sess_test" },
        });
      },
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: "es" }),
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.deepEqual(body, {
        client_secret: "ek_test",
        expires_at: 123,
        model: "gpt-realtime-translate",
        session: { id: "sess_test" },
        session_update: {
          type: "session.update",
          session: {
            audio: {
              input: {
                transcription: { model: "gpt-realtime-whisper" },
                noise_reduction: null,
              },
              output: { language: "es" },
            },
          },
        },
        targetLanguage: "es",
      });
      assert.equal(requests.length, 1);
      const requestBody = JSON.parse(requests[0].init.body);
      assert.equal(requestBody.session.model, "gpt-realtime-translate");
      assert.equal(requestBody.session.audio.output.language, "es");
      assert.deepEqual(requestBody.session.audio.input, {
        transcription: { model: "gpt-realtime-whisper" },
        noise_reduction: null,
      });
    },
  );
});
