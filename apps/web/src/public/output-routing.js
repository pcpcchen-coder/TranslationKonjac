export const BLACKHOLE_LABEL_PATTERN = /blackhole/i;
export const BLACKHOLE_2CH_LABEL_PATTERN = /blackhole\s*2ch/i;
export const BLACKHOLE_16CH_LABEL_PATTERN = /blackhole\s*16ch/i;

export function isBlackHoleLabel(label) {
  return typeof label === "string" && BLACKHOLE_LABEL_PATTERN.test(label);
}

export function pickPreferredOutboundDevice({ options, previousValue = "" }) {
  const previous = options.find((option) => option.value === previousValue);
  if (previous?.value) {
    return previous.value;
  }

  const blackHole2ch = options.find((option) =>
    BLACKHOLE_2CH_LABEL_PATTERN.test(option.label ?? ""),
  );
  if (blackHole2ch?.value) {
    return blackHole2ch.value;
  }

  const anyBlackHole = options.find((option) =>
    isBlackHoleLabel(option.label ?? ""),
  );
  return anyBlackHole?.value ?? "";
}

export function pickSafeInboundOutputDevice({
  options,
  outboundDeviceId = "",
  previousValue = "",
}) {
  const isSafe = (option) =>
    Boolean(option?.value) &&
    option.value !== outboundDeviceId &&
    !isBlackHoleLabel(option.label ?? "");

  const previous = options.find((option) => option.value === previousValue);
  if (isSafe(previous)) {
    return previous.value;
  }

  const candidate = options.find(isSafe);
  return candidate?.value ?? "";
}

export function validateTwoWayOutputRouting({ outboundDevice, inboundDevice }) {
  if (!inboundDevice?.value) {
    return {
      ok: false,
      error:
        "Choose an explicit headphones or speakers device for 'Their voice → Chinese output'. Leaving it on 'System default' may route translated Chinese into BlackHole and back into the call.",
    };
  }

  if (isBlackHoleLabel(inboundDevice.label ?? "")) {
    return {
      ok: false,
      error:
        "'Their voice → Chinese output' must not be a BlackHole device, otherwise the translated Chinese is sent into the call as your microphone.",
    };
  }

  if (
    outboundDevice?.value &&
    outboundDevice.value === inboundDevice.value
  ) {
    return {
      ok: false,
      error:
        "Outbound translated output and inbound translated output must be different devices.",
    };
  }

  return { ok: true };
}
