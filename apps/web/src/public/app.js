import { buildAudioMixState } from "/audio-mix.js";
import {
  buildAudioInputMediaOptions,
  buildDisplayMediaOptions,
  buildMicrophoneMediaOptions,
} from "/capture-options.js";
import {
  pickPreferredOutboundDevice,
  pickSafeInboundOutputDevice,
  validateTwoWayOutputRouting,
} from "/output-routing.js";

const TRANSLATION_CALL_URL =
  "https://api.openai.com/v1/realtime/translations/calls";

const OUTPUT_TRANSCRIPT_EVENTS = new Set(["session.output_transcript.delta"]);
const INPUT_TRANSCRIPT_EVENTS = new Set(["session.input_transcript.delta"]);

const modeInputs = [...document.querySelectorAll("input[name='translationMode']")];
const targetLanguage = document.querySelector("#targetLanguage");
const audioSourceInputs = [...document.querySelectorAll("input[name='audioSource']")];
const outputDevice = document.querySelector("#outputDevice");
const inboundSourceType = document.querySelector("#inboundSourceType");
const inboundInputDevice = document.querySelector("#inboundInputDevice");
const inboundOutputDevice = document.querySelector("#inboundOutputDevice");
const twoWayPanel = document.querySelector("#twoWayPanel");
const startButton = document.querySelector("#startButton");
const startTwoWayButton = document.querySelector("#startTwoWayButton");
const stopButton = document.querySelector("#stopButton");
const audioMix = document.querySelector("#audioMix");
const mixValue = document.querySelector("#mixValue");
const originalMixLabel = document.querySelector("#originalMixLabel");
const translatedMixLabel = document.querySelector("#translatedMixLabel");
const statusDot = document.querySelector("#statusDot");
const statusText = document.querySelector("#statusText");
const inputMeterLabel = document.querySelector("#inputMeterLabel");
const inputMeter = document.querySelector("#inputMeter");
const queueProgress = document.querySelector("#queueProgress");
const translatedTranscript = document.querySelector("#translatedTranscript");
const eventLog = document.querySelector("#eventLog");
const captureState = document.querySelector("#captureState");
const chunksSent = document.querySelector("#chunksSent");
const activeInputFrames = document.querySelector("#activeInputFrames");
const peakInputLevel = document.querySelector("#peakInputLevel");
const outputAudioDeltas = document.querySelector("#outputAudioDeltas");
const transcriptDeltas = document.querySelector("#transcriptDeltas");
const lastEventType = document.querySelector("#lastEventType");

const runtime = {
  oneWay: null,
  outbound: null,
  inbound: null,
  streams: [],
  sourceAudio: null,
  meters: [],
};

let diagnostics = createEmptyDiagnostics();

applyAudioMix();
updateModeUi();
void refreshOutputDevices();

audioMix.addEventListener("input", () => {
  applyAudioMix();
});

for (const input of modeInputs) {
  input.addEventListener("change", updateModeUi);
}

for (const input of audioSourceInputs) {
  input.addEventListener("change", updateModeUi);
}

outputDevice.addEventListener("change", () => {
  void applyOutputDevice(runtime.oneWay?.translatedAudio, outputDevice, "one-way output");
  void applyOutputDevice(runtime.outbound?.translatedAudio, outputDevice, "outbound output");
});

inboundOutputDevice.addEventListener("change", () => {
  void applyOutputDevice(runtime.inbound?.translatedAudio, inboundOutputDevice, "inbound output");
});

inboundSourceType.addEventListener("change", updateModeUi);

navigator.mediaDevices?.addEventListener?.("devicechange", () => {
  void refreshOutputDevices();
});

startButton.addEventListener("click", async () => {
  clearTranscript();
  resetDiagnostics();
  setControls({ running: true });
  const sourceType = selectedAudioSource();
  setStatus(sourceType === "microphone" ? "Allow microphone access" : "Pick a browser tab with audio", "idle");

  try {
    const stream = await captureAudioSource(sourceType, "one-way");
    runtime.streams.push(stream);
    await refreshOutputDevices({ preferBlackHole: sourceType === "microphone" });
    startSourceAudio(stream, sourceType);
    startInputMeter(stream, "one-way");

    setStatus("Creating Realtime Translation session", "idle");
    const session = await createSession(targetLanguage.value);

    setStatus("Connecting WebRTC", "idle");
    runtime.oneWay = await connectRealtimeTranslation({
      name: "one-way",
      session,
      stream,
      outputSelect: outputDevice,
      transcriptPrefix: "",
    });

    setStatus(sourceType === "microphone" ? "Translating microphone audio" : "Translating tab audio", "live");
  } catch (error) {
    logEvent("error", error instanceof Error ? error.message : String(error));
    await stopAll("Stopped after startup error", "error");
  }
});

startTwoWayButton.addEventListener("click", async () => {
  clearTranscript();
  resetDiagnostics();
  setControls({ running: true });
  setStatus("Allow microphone access for your Chinese speech", "idle");

  try {
    const micStream = await captureMicrophoneAudio("outbound");
    runtime.streams.push(micStream);
    startInputMeter(micStream, "outbound");

    setStatus("Resolving safe output devices", "idle");
    await refreshOutputDevices({ preferBlackHole: true });

    const routingCheck = validateTwoWayOutputRouting({
      outboundDevice: readSelectedOption(outputDevice),
      inboundDevice: readSelectedOption(inboundOutputDevice),
    });
    if (!routingCheck.ok) {
      throw new Error(routingCheck.error);
    }

    const inboundSource = selectedInboundSourceType();
    setStatus(
      inboundSource === "device"
        ? "Capturing LINE app audio from selected input device"
        : "Pick the call tab that contains their English audio",
      "idle",
    );
    const inboundStream = await captureInboundAudio("inbound");
    runtime.streams.push(inboundStream);

    setStatus("Creating outbound Chinese → English session", "idle");
    const outboundSession = await createSession("en");
    runtime.outbound = await connectRealtimeTranslation({
      name: "outbound mic→en",
      session: outboundSession,
      stream: micStream,
      outputSelect: outputDevice,
      transcriptPrefix: "To them: ",
      requireSink: true,
    });

    setStatus("Creating inbound English → Chinese session", "idle");
    const inboundSession = await createSession("zh");
    runtime.inbound = await connectRealtimeTranslation({
      name: selectedInboundSourceType() === "device" ? "inbound device→zh" : "inbound tab→zh",
      session: inboundSession,
      stream: inboundStream,
      outputSelect: inboundOutputDevice,
      transcriptPrefix: "To you: ",
      requireSink: true,
    });

    setStatus("Two-way call translation live", "live");
    captureState.textContent = `outbound=mic→en, inbound=${selectedInboundSourceType()}→zh`;
  } catch (error) {
    logEvent("error", error instanceof Error ? error.message : String(error));
    await stopAll("Stopped after two-way startup error", "error");
  }
});

stopButton.addEventListener("click", async () => {
  await stopAll("Stopped", "idle");
});

function selectedMode() {
  return modeInputs.find((input) => input.checked)?.value ?? "one-way";
}

function selectedAudioSource() {
  return audioSourceInputs.find((input) => input.checked)?.value ?? "tab";
}

function selectedInboundSourceType() {
  return inboundSourceType?.value ?? "tab";
}

function updateModeUi() {
  const mode = selectedMode();
  const twoWay = mode === "two-way";
  const sourceType = selectedAudioSource();
  const isMic = sourceType === "microphone";

  twoWayPanel.hidden = !twoWay;
  inboundInputDevice.hidden = !twoWay || selectedInboundSourceType() !== "device";
  startButton.hidden = twoWay;
  startTwoWayButton.hidden = !twoWay;
  targetLanguage.disabled = twoWay;
  for (const input of audioSourceInputs) {
    input.disabled = twoWay;
  }

  startButton.textContent = isMic
    ? "Use microphone to start translating"
    : "Choose tab to start translating";
  inputMeterLabel.textContent = twoWay
    ? "Your microphone audio"
    : isMic
      ? "Captured microphone audio"
      : "Captured tab audio";
  originalMixLabel.title = isMic || twoWay
    ? "Microphone/source monitoring is disabled to avoid feedback."
    : "Original tab audio played locally by this app.";
}

async function createSession(language) {
  const response = await fetch("/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetLanguage: language }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error ?? "Failed to create session.");
  }

  return body;
}

async function connectRealtimeTranslation({
  name,
  session,
  stream,
  outputSelect,
  transcriptPrefix,
  requireSink = false,
}) {
  const peerConnection = new RTCPeerConnection();
  const dataChannel = peerConnection.createDataChannel("oai-events");
  const translatedAudio = new Audio();
  translatedAudio.autoplay = true;
  translatedAudio.playsInline = true;
  await applyOutputDevice(translatedAudio, outputSelect, `${name} output`, { strict: requireSink });
  applyAudioMix();

  peerConnection.onconnectionstatechange = () => {
    diagnostics.connectionState = `${name}: ${peerConnection.connectionState}`;
    logEvent(`${name}.webrtc.connection`, peerConnection.connectionState);
    updateDiagnostics();
  };

  peerConnection.oniceconnectionstatechange = () => {
    diagnostics.iceConnectionState = `${name}: ${peerConnection.iceConnectionState}`;
    if (
      peerConnection.iceConnectionState === "connected" ||
      peerConnection.iceConnectionState === "completed"
    ) {
      diagnostics.connectedSessions.add(name);
    } else {
      diagnostics.connectedSessions.delete(name);
    }
    updateDiagnostics();
  };

  peerConnection.ontrack = ({ streams }) => {
    diagnostics.remoteAudioTracks += 1;
    translatedAudio.srcObject = streams[0];
    void applyOutputDevice(translatedAudio, outputSelect, `${name} output`);
    applyAudioMix();
    void translatedAudio.play().catch((error) => {
      logEvent(`${name}.audio.play`, error.message);
    });
    logEvent(`${name}.remote.audio`, "track received");
    updateDiagnostics();
  };

  dataChannel.onopen = () => {
    diagnostics.dataChannelState = `${name}: open`;
    logEvent(`${name}.datachannel.open`, "ok");
    updateDiagnostics();
  };
  dataChannel.onclose = () => {
    diagnostics.dataChannelState = `${name}: closed`;
    logEvent(`${name}.datachannel.close`, "closed");
    updateDiagnostics();
  };
  dataChannel.onerror = () => {
    logEvent(`${name}.datachannel.error`, "error");
  };
  dataChannel.onmessage = (message) => handleRealtimeEvent(message, name, transcriptPrefix);

  for (const track of stream.getAudioTracks()) {
    peerConnection.addTrack(track, stream);
  }

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  const sdpResponse = await fetch(TRANSLATION_CALL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.client_secret}`,
      "Content-Type": "application/sdp",
    },
    body: offer.sdp,
  });

  const answerSdp = await sdpResponse.text();
  if (!sdpResponse.ok) {
    throw new Error(answerSdp);
  }

  await peerConnection.setRemoteDescription({
    type: "answer",
    sdp: answerSdp,
  });

  logEvent(`${name}.webrtc.offer`, `connected for ${session.targetLanguage}`);
  return { name, peerConnection, dataChannel, translatedAudio };
}

async function captureTabAudio(label = "tab") {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("This browser does not support tab audio capture.");
  }

  const supportedConstraints =
    navigator.mediaDevices.getSupportedConstraints?.() ?? {};
  const stream = await navigator.mediaDevices.getDisplayMedia(
    buildDisplayMediaOptions(supportedConstraints),
  );

  const audioTracks = stream.getAudioTracks();
  const videoTracks = stream.getVideoTracks();

  if (audioTracks.length === 0) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error("No tab audio was shared. Pick a Chrome tab and enable tab audio.");
  }

  audioTracks[0].addEventListener(
    "ended",
    () => {
      void stopAll(`${label} tab audio sharing ended`, "idle");
    },
    { once: true },
  );

  const audioSettings = audioTracks[0].getSettings?.() ?? {};
  const suppressed =
    typeof audioSettings.suppressLocalAudioPlayback === "boolean"
      ? String(audioSettings.suppressLocalAudioPlayback)
      : "unknown";
  captureState.textContent = `${label}: audio=${audioTracks[0].readyState}, video=${videoTracks.length}, suppressed=${suppressed}`;
  logEvent(
    `${label}.capture.started`,
    `audio tracks=${audioTracks.length}, video tracks=${videoTracks.length}, suppressed=${suppressed}`,
  );

  return stream;
}

async function captureMicrophoneAudio(label = "microphone") {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser does not support microphone capture.");
  }

  const stream = await navigator.mediaDevices.getUserMedia(
    buildMicrophoneMediaOptions(),
  );

  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error("No microphone audio was shared. Allow microphone access and try again.");
  }

  audioTracks[0].addEventListener(
    "ended",
    () => {
      void stopAll(`${label} microphone sharing ended`, "idle");
    },
    { once: true },
  );

  const audioSettings = audioTracks[0].getSettings?.() ?? {};
  const device = audioSettings.deviceId ? "selected" : "default";
  captureState.textContent = `${label}: microphone=${audioTracks[0].readyState}, device=${device}`;
  logEvent(`${label}.capture.started`, `microphone tracks=${audioTracks.length}, device=${device}`);

  return stream;
}


async function captureAudioInputDevice(label = "audio-input", deviceId = "") {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser does not support audio input capture.");
  }

  const stream = await navigator.mediaDevices.getUserMedia(
    buildAudioInputMediaOptions(deviceId),
  );

  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error("No audio was captured from the selected input device.");
  }

  audioTracks[0].addEventListener(
    "ended",
    () => {
      void stopAll(`${label} input sharing ended`, "idle");
    },
    { once: true },
  );

  const selectedLabel = inboundInputDevice.selectedOptions[0]?.textContent ?? "selected input";
  captureState.textContent = `${label}: device=${selectedLabel}`;
  logEvent(`${label}.capture.started`, `input device=${selectedLabel}`);

  return stream;
}

function captureInboundAudio(label = "inbound") {
  if (selectedInboundSourceType() === "device") {
    return captureAudioInputDevice(label, inboundInputDevice.value);
  }
  return captureTabAudio(label);
}

function captureAudioSource(sourceType, label) {
  return sourceType === "microphone" ? captureMicrophoneAudio(label) : captureTabAudio(label);
}

async function refreshOutputDevices({ preferBlackHole = false } = {}) {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return;
  }

  const previousOutput = outputDevice.value;
  const previousInbound = inboundOutputDevice.value;
  const previousInboundInput = inboundInputDevice.value;
  let devices = [];
  try {
    devices = await navigator.mediaDevices.enumerateDevices();
  } catch (error) {
    logEvent("devices.enumerate", error instanceof Error ? error.message : String(error));
    return;
  }

  const outputs = devices.filter((device) => device.kind === "audiooutput");
  const inputs = devices.filter((device) => device.kind === "audioinput");
  fillOutputSelect(outputDevice, outputs);
  fillOutputSelect(inboundOutputDevice, outputs);
  fillInputSelect(inboundInputDevice, inputs);

  if (preferBlackHole) {
    outputDevice.value = pickPreferredOutboundDevice({
      options: readSelectOptions(outputDevice),
      previousValue: previousOutput,
    });
    inboundOutputDevice.value = pickSafeInboundOutputDevice({
      options: readSelectOptions(inboundOutputDevice),
      outboundDeviceId: outputDevice.value,
      previousValue: previousInbound,
    });
  } else {
    restoreOutputSelection(outputDevice, previousOutput, { preferBlackHole: false });
    restoreOutputSelection(inboundOutputDevice, previousInbound, { preferBlackHole: false });
  }
  restoreInputSelection(inboundInputDevice, previousInboundInput, { preferBlackHole16: true });
}

function readSelectOptions(select) {
  return [...select.options].map((option) => ({
    value: option.value,
    label: option.textContent ?? "",
  }));
}

function readSelectedOption(select) {
  const option = select.selectedOptions?.[0];
  return {
    value: select.value,
    label: option?.textContent ?? "",
  };
}

function fillOutputSelect(select, outputs) {
  select.replaceChildren(new Option("System default", ""));
  for (const [index, device] of outputs.entries()) {
    if (!device.deviceId || device.deviceId === "default") {
      continue;
    }
    const label = device.label || `Audio output ${index + 1}`;
    select.add(new Option(label, device.deviceId));
  }
}

function fillInputSelect(select, inputs) {
  select.replaceChildren(new Option("Default audio input", ""));
  for (const [index, device] of inputs.entries()) {
    if (!device.deviceId || device.deviceId === "default") {
      continue;
    }
    const label = device.label || `Audio input ${index + 1}`;
    select.add(new Option(label, device.deviceId));
  }
}

function restoreOutputSelection(select, previousValue, { preferBlackHole }) {
  const values = new Set([...select.options].map((option) => option.value));
  if (previousValue && values.has(previousValue)) {
    select.value = previousValue;
    return;
  }
  if (preferBlackHole) {
    const blackHoleOption = [...select.options].find((option) =>
      /blackhole/i.test(option.textContent ?? ""),
    );
    if (blackHoleOption) {
      select.value = blackHoleOption.value;
    }
  }
}

function restoreInputSelection(select, previousValue, { preferBlackHole16 }) {
  const values = new Set([...select.options].map((option) => option.value));
  if (previousValue && values.has(previousValue)) {
    select.value = previousValue;
    return;
  }
  if (preferBlackHole16) {
    const blackHole16Option = [...select.options].find((option) =>
      /blackhole\s*16ch/i.test(option.textContent ?? ""),
    );
    if (blackHole16Option) {
      select.value = blackHole16Option.value;
    }
  }
}

async function applyOutputDevice(audio, select, context, { strict = false } = {}) {
  if (!audio) {
    return;
  }

  if (!select?.value) {
    if (strict) {
      throw new Error(`${context}: an explicit output device is required (got 'System default').`);
    }
    return;
  }

  if (typeof audio.setSinkId !== "function") {
    const message = "This browser cannot choose output devices. Use Chrome/Edge or macOS sound routing.";
    if (strict) {
      throw new Error(`${context}: ${message}`);
    }
    logEvent("audio.output", message);
    return;
  }

  try {
    await audio.setSinkId(select.value);
    const label = select.selectedOptions[0]?.textContent ?? "selected output";
    const sinkSuffix = audio.sinkId ? ` sinkId=${audio.sinkId}` : "";
    logEvent("audio.output", `${context}: ${label}${sinkSuffix}`);
    if (strict && audio.sinkId && audio.sinkId !== select.value) {
      throw new Error(
        `${context}: requested sinkId ${select.value} but browser bound ${audio.sinkId}. Grant device permissions and retry.`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logEvent("audio.output.error", `${context}: ${message}`);
    if (strict) {
      throw new Error(`${context}: failed to apply output device — ${message}`);
    }
  }
}

function startInputMeter(stream, label) {
  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  const samples = new Float32Array(analyser.fftSize);
  const timer = window.setInterval(() => {
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) {
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / samples.length);
    inputMeter.value = Math.min(1, rms * 12);
    diagnostics.peakInputLevel = Math.max(diagnostics.peakInputLevel, rms);
    peakInputLevel.textContent = diagnostics.peakInputLevel.toFixed(3);
  }, 100);

  runtime.meters.push({ context, source, analyser, timer, label });
}

function startSourceAudio(stream, sourceType) {
  if (sourceType === "microphone") {
    logEvent("source.audio", "microphone monitoring disabled to avoid feedback");
    return;
  }

  runtime.sourceAudio = new Audio();
  runtime.sourceAudio.autoplay = true;
  runtime.sourceAudio.playsInline = true;
  runtime.sourceAudio.srcObject = stream;
  applyAudioMix();

  void runtime.sourceAudio.play().catch((error) => {
    logEvent("source.audio.play", error.message);
  });
}

function applyAudioMix() {
  const mix = buildAudioMixState(audioMix.value);

  audioMix.value = String(mix.translatedPercent);
  mixValue.textContent = mix.valueLabel;
  originalMixLabel.textContent = mix.originalLabel;
  translatedMixLabel.textContent = mix.translatedLabel;

  if (runtime.sourceAudio) {
    runtime.sourceAudio.volume = mix.originalVolume;
  }
  for (const session of [runtime.oneWay, runtime.outbound, runtime.inbound]) {
    if (session?.translatedAudio) {
      session.translatedAudio.volume = mix.translatedVolume;
    }
  }
}

function handleRealtimeEvent(message, sessionName, transcriptPrefix) {
  let event;
  try {
    event = JSON.parse(message.data);
  } catch {
    logEvent(`${sessionName}.message`, "Received non-JSON data channel message.");
    return;
  }

  diagnostics.lastEventType = `${sessionName}: ${event.type}`;

  if (event.type === "error") {
    logEvent(`${sessionName}.error`, JSON.stringify(event.error ?? event));
    updateDiagnostics();
    return;
  }

  if (OUTPUT_TRANSCRIPT_EVENTS.has(event.type) && typeof event.delta === "string") {
    diagnostics.transcriptDeltas += 1;
    appendTranslatedText(event.delta, transcriptPrefix);
    updateDiagnostics();
    return;
  }

  if (INPUT_TRANSCRIPT_EVENTS.has(event.type) && typeof event.delta === "string") {
    logEvent(`${sessionName}.input`, event.delta);
    updateDiagnostics();
    return;
  }

  if (
    event.type === "session.created" ||
    event.type === "session.updated" ||
    event.type === "output_audio_buffer.started"
  ) {
    logEvent(`${sessionName}.${event.type}`, "ok");
  }

  updateDiagnostics();
}

async function stopAll(message, state = "idle") {
  for (const meter of runtime.meters) {
    window.clearInterval(meter.timer);
    meter.source?.disconnect();
    meter.analyser?.disconnect();
    if (meter.context?.state !== "closed") {
      await meter.context?.close();
    }
  }
  runtime.meters = [];

  for (const session of [runtime.oneWay, runtime.outbound, runtime.inbound]) {
    session?.dataChannel?.close();
    session?.peerConnection?.close();
    if (session?.translatedAudio) {
      session.translatedAudio.pause();
      session.translatedAudio.srcObject = null;
    }
  }
  runtime.oneWay = null;
  runtime.outbound = null;
  runtime.inbound = null;

  if (runtime.sourceAudio) {
    runtime.sourceAudio.pause();
    runtime.sourceAudio.srcObject = null;
  }
  runtime.sourceAudio = null;

  for (const stream of runtime.streams) {
    stream.getTracks().forEach((track) => track.stop());
  }
  runtime.streams = [];

  inputMeter.value = 0;
  queueProgress.value = 0;
  setControls({ running: false });
  setStatus(message, state);
}

function setControls({ running }) {
  for (const input of modeInputs) {
    input.disabled = running;
  }
  startButton.disabled = running;
  startTwoWayButton.disabled = running;
  stopButton.disabled = !running;
  outputDevice.disabled = running;
  inboundSourceType.disabled = running;
  inboundInputDevice.disabled = running;
  inboundOutputDevice.disabled = running;

  if (!running) {
    updateModeUi();
    return;
  }

  targetLanguage.disabled = true;
  for (const input of audioSourceInputs) {
    input.disabled = true;
  }
}

function setStatus(message, state) {
  statusText.textContent = message;
  statusDot.className = `status-dot ${state === "live" ? "live" : ""} ${
    state === "error" ? "error" : ""
  }`;
}

function appendTranslatedText(text, prefix = "") {
  if (prefix && translatedTranscript.dataset.lastPrefix !== prefix) {
    const label = document.createElement("div");
    label.className = "transcript-label";
    label.textContent = prefix.trim();
    translatedTranscript.append(label);
    translatedTranscript.dataset.lastPrefix = prefix;
  }
  translatedTranscript.append(text);
  translatedTranscript.scrollTop = translatedTranscript.scrollHeight;
}

function clearTranscript() {
  translatedTranscript.textContent = "";
  delete translatedTranscript.dataset.lastPrefix;
}

function createEmptyDiagnostics() {
  return {
    connectionState: "new",
    dataChannelState: "connecting",
    iceConnectionState: "new",
    connectedSessions: new Set(),
    lastEventType: "none",
    peakInputLevel: 0,
    remoteAudioTracks: 0,
    transcriptDeltas: 0,
  };
}

function resetDiagnostics() {
  diagnostics = createEmptyDiagnostics();
  captureState.textContent = "Starting";
  eventLog.textContent = "";
  updateDiagnostics();
}

function updateDiagnostics() {
  chunksSent.textContent = diagnostics.connectionState;
  activeInputFrames.textContent = diagnostics.dataChannelState;
  queueProgress.value = Math.min(1, diagnostics.connectedSessions.size / Math.max(1, selectedMode() === "two-way" ? 2 : 1));
  peakInputLevel.textContent = diagnostics.peakInputLevel.toFixed(3);
  outputAudioDeltas.textContent = String(diagnostics.remoteAudioTracks);
  transcriptDeltas.textContent = String(diagnostics.transcriptDeltas);
  lastEventType.textContent = diagnostics.lastEventType;
}

function logEvent(type, detail) {
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${type}: ${detail}`;
  eventLog.append(entry);
  eventLog.scrollTop = eventLog.scrollHeight;
}
