// Permission policy for the renderer's webContents session. Kept as a pure
// function so the "audio yes, everything else no" rules are unit-testable.
//
// Decision 2 removed Chrome-tab/screen capture, so display-capture is always
// denied. The app only needs the microphone, so camera (video) is denied too.

/**
 * @param {string} permission the Electron permission string
 * @param {{ mediaTypes?: string[] }} [details]
 * @returns {boolean}
 */
export function decidePermission(permission, details = {}) {
  if (permission !== "media") {
    return false;
  }
  const { mediaTypes } = details;
  if (Array.isArray(mediaTypes)) {
    // Audio only. Any video (camera) request is denied.
    return mediaTypes.length > 0 && mediaTypes.every((type) => type === "audio");
  }
  // Some getUserMedia audio requests arrive without mediaTypes; this app only
  // ever asks for the microphone, so a bare media request is the mic.
  return true;
}
