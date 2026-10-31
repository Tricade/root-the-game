'use strict';

const semver = require('semver');
const DAY = 24 * 60 * 60 * 1000;

function createUpdateController({
  installation,
  version,
  preferences,
  createUpdater,
  publish,
  now = Date.now,
}) {
  let updater = null;
  let operation = null;
  let disposed = false;
  let available = null;
  let state = {
    status: installation.canUpdate
      ? 'idle'
      : installation.kind === 'development'
        ? 'development'
        : 'manual',
    progress: 0,
    error: null,
  };
  const listeners = [];

  const snapshot = () => ({
    ...state,
    version,
    availableVersion: available,
    kind: installation.kind,
    canUpdate: installation.canUpdate,
    autoCheck: installation.canUpdate && preferences.read().autoCheck,
  });
  function emit(patch) {
    if (disposed) return;
    state = { ...state, ...patch };
    publish(snapshot());
  }
  function validUpdate(info) {
    return (
      typeof info?.version === 'string' &&
      info.version.length < 64 &&
      semver.valid(info.version) &&
      !semver.prerelease(info.version) &&
      semver.gt(info.version, version)
    );
  }
  function failed(error) {
    available = null;
    const missing =
      error?.code === 'ERR_UPDATER_LATEST_VERSION_NOT_FOUND' || error?.statusCode === 404;
    emit({ status: 'error', error: missing ? 'not-published' : 'update-failed', progress: 0 });
  }
  function getUpdater() {
    if (updater) return updater;
    updater = createUpdater(installation.kind);
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowDowngrade = false;
    updater.allowPrerelease = false;
    updater.disableWebInstaller = true;
    const on = (event, callback) => {
      updater.on(event, callback);
      listeners.push([event, callback]);
    };
    on('checking-for-update', () => emit({ status: 'checking', error: null }));
    on('update-available', (info) => {
      if (!validUpdate(info)) return failed();
      available = info.version;
      emit({ status: 'available', progress: 0, error: null });
    });
    on('update-not-available', () => {
      available = null;
      emit({ status: 'current', error: null });
    });
    on('download-progress', (info) => {
      const progress = Number.isFinite(info?.percent)
        ? Math.min(100, Math.max(0, info.percent))
        : 0;
      emit({ status: 'downloading', progress, error: null });
    });
    on('update-downloaded', (info) => {
      if (!validUpdate(info) || info.version !== available) return failed();
      emit({ status: 'downloaded', progress: 100, error: null });
    });
    on('error', failed);
    return updater;
  }
  async function run(action) {
    if (disposed || !installation.canUpdate) return snapshot();
    if (operation) return operation;
    operation = (async () => {
      try {
        await action();
      } catch (error) {
        failed(error);
      } finally {
        operation = null;
      }
      return snapshot();
    })();
    return operation;
  }
  const canInstall = () =>
    !disposed && installation.canUpdate && state.status === 'downloaded' && Boolean(available);
  return {
    snapshot,
    async check(automatic = false) {
      if (state.status === 'downloaded' || state.status === 'downloading') return snapshot();
      const prefs = preferences.read();
      if (automatic && (!prefs.autoCheck || now() - prefs.lastCheck < DAY)) return snapshot();
      return run(async () => {
        await preferences.update({ lastCheck: now() });
        emit({ status: 'checking', error: null });
        await getUpdater().checkForUpdates();
      });
    },
    async download() {
      if (!available || state.status === 'downloaded') return snapshot();
      return run(async () => {
        emit({ status: 'downloading', progress: 0, error: null });
        await getUpdater().downloadUpdate();
      });
    },
    canInstall,
    install() {
      if (!canInstall()) return false;
      getUpdater().quitAndInstall(false, true);
      return state.status === 'downloaded';
    },
    async setAutoCheck(value) {
      if (typeof value !== 'boolean') throw new TypeError('Expected an update preference');
      await preferences.update({ autoCheck: value });
      emit({});
      return snapshot();
    },
    dispose() {
      disposed = true;
      for (const [event, callback] of listeners) updater?.removeListener(event, callback);
    },
  };
}

module.exports = { createUpdateController, DAY };
