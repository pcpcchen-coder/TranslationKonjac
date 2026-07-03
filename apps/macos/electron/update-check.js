// Update-check core: version comparison + GitHub Releases lookup. Electron-free
// (fetch is injectable) so it is fully unit-tested. This same logic is the
// unsigned/dev fallback: even without electron-updater it can tell the user a
// newer release exists and where to download it.

export const DEFAULT_REPO = "pcpcchen-coder/TranslationKonjac";

function parseVersion(value) {
  const clean = String(value ?? "").trim().replace(/^v/i, "");
  const parts = clean.split(".").map((n) => Number.parseInt(n, 10) || 0);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function normalizeVersion(value) {
  return String(value ?? "").trim().replace(/^v/i, "");
}

/** @returns {-1 | 0 | 1} */
export function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

export function releasesPageUrl(repo = DEFAULT_REPO) {
  return `https://github.com/${repo}/releases`;
}

/**
 * @returns {Promise<
 *   | { status: "update-available", version: string, url: string }
 *   | { status: "up-to-date", version: string }
 *   | { status: "no-releases" }
 *   | { status: "error", retriable: boolean }
 * >}
 */
export async function checkForUpdate({ currentVersion, fetchImpl = fetch, repo = DEFAULT_REPO }) {
  const url = `https://api.github.com/repos/${repo}/releases/latest`;
  let response;
  try {
    response = await fetchImpl(url, { headers: { Accept: "application/vnd.github+json" } });
  } catch {
    return { status: "error", retriable: true };
  }

  if (response.status === 404) {
    return { status: "no-releases" };
  }
  if (!response.ok) {
    return { status: "error", retriable: true };
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return { status: "error", retriable: false };
  }

  const latest = data?.tag_name ?? data?.name;
  if (!latest) {
    return { status: "error", retriable: false };
  }

  if (compareVersions(latest, currentVersion) <= 0) {
    return { status: "up-to-date", version: normalizeVersion(latest) };
  }

  const dmgAsset = (data.assets ?? []).find(
    (asset) => typeof asset?.name === "string" && asset.name.toLowerCase().endsWith(".dmg"),
  );
  return {
    status: "update-available",
    version: normalizeVersion(latest),
    url: dmgAsset?.browser_download_url ?? data.html_url ?? releasesPageUrl(repo),
  };
}
