// Desktop capability gating. In the Electron desktop app, Chrome-tab capture is
// removed (decision 2); the browser build keeps it. These are pure functions,
// import-safe under Node so they can be unit-tested without a DOM.

import {
  buildAudioInputMediaOptions,
  buildMicrophoneMediaOptions,
  buildRawAudioInputMediaOptions,
} from "./capture-options.js";

// Labels of virtual/loopback devices whose signal must NOT be mangled by browser
// audio processing (echo cancellation / noise suppression / auto gain).
const VIRTUAL_AUDIO_LABEL = /blackhole|loopback|aggregate|virtual/i;

/** True when running inside the Electron desktop shell (preload bridge present). */
export function detectDesktop(globals = {}) {
  return Boolean(globals && globals.translationKonjac);
}

export function availableOneWaySources(isDesktop) {
  return isDesktop ? ["microphone"] : ["tab", "microphone"];
}

export function availableInboundSources(isDesktop) {
  return isDesktop ? ["device"] : ["tab", "device"];
}

export function defaultSelections(isDesktop) {
  return {
    oneWaySource: isDesktop ? "microphone" : "tab",
    inboundSource: isDesktop ? "device" : "tab",
  };
}

/**
 * Capture constraints for one-way mode. Desktop lets the user pick an input
 * device (e.g. BlackHole 16ch to translate another app's audio); virtual devices
 * get raw capture (no EC/NS/AGC) so the loopback signal survives intact. On the
 * web build (or with no device chosen) this is just the plain microphone.
 */
export function chooseOneWayCaptureOptions({ isDesktop = false, deviceId = "", deviceLabel = "" } = {}) {
  if (!isDesktop || !deviceId) {
    return buildMicrophoneMediaOptions();
  }
  if (VIRTUAL_AUDIO_LABEL.test(deviceLabel)) {
    return buildRawAudioInputMediaOptions(deviceId);
  }
  return buildAudioInputMediaOptions(deviceId);
}
