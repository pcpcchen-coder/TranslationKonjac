import { checkForUpdate, releasesPageUrl } from "./update-check.js";

// The main-process handlers behind the settings "Check for updates" button.
// Detection always uses the GitHub Releases lookup (S12); how an update is then
// installed depends on the strategy (electron-updater when signed+packaged, else
// a manual download link). Electron-free -- main.js injects openExternalImpl and
// (in S19) the electron-updater download trigger.
export function createUpdateHandlers({
  strategy,
  appVersion,
  repo,
  checkImpl = checkForUpdate,
  openExternalImpl,
}) {
  async function check() {
    const result = await checkImpl({ currentVersion: appVersion, repo });
    return { ...result, strategy };
  }

  async function openDownload() {
    const url = releasesPageUrl(repo);
    if (openExternalImpl) {
      await openExternalImpl(url);
    }
    return { ok: true, url };
  }

  return { check, openDownload };
}
