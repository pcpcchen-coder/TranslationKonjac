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

export function buildAudioInputMediaOptions(deviceId = "") {
  const audio = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };

  if (deviceId) {
    audio.deviceId = { exact: deviceId };
  }

  return {
    audio,
    video: false,
  };
}
