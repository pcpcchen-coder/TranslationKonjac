export function buildDisplayMediaOptions(supportedConstraints = {}) {
  const audio = {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  };

  if (supportedConstraints.suppressLocalAudioPlayback) {
    audio.suppressLocalAudioPlayback = true;
  }

  return {
    preferCurrentTab: false,
    selfBrowserSurface: "exclude",
    surfaceSwitching: "include",
    systemAudio: "include",
    video: {
      displaySurface: "browser",
    },
    audio,
  };
}

export function buildMicrophoneMediaOptions() {
  return buildAudioInputMediaOptions();
}

export function buildRawAudioInputMediaOptions(deviceId = "") {
  return buildAudioInputMediaOptions(deviceId, {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  });
}

export function buildAudioInputMediaOptions(deviceId = "", processing = {}) {
  const audio = {
    echoCancellation: processing.echoCancellation ?? true,
    noiseSuppression: processing.noiseSuppression ?? true,
    autoGainControl: processing.autoGainControl ?? true,
  };

  if (deviceId) {
    audio.deviceId = { exact: deviceId };
  }

  return {
    audio,
    video: false,
  };
}
