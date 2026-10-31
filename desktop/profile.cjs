'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const BRAND = require('../brand.js');

function detectInstallation({
  packaged,
  platform,
  env,
  resourcesPath,
  readFile = fs.readFileSync,
}) {
  if (!packaged) return { kind: 'development', portableDir: null, canUpdate: false };
  const portable = platform === 'win32' ? env.PORTABLE_EXECUTABLE_FILE : env.APPIMAGE;
  const paths = platform === 'win32' ? path.win32 : path.posix;
  if (portable && paths.isAbsolute(portable)) {
    return { kind: 'portable', portableDir: paths.dirname(portable), platform, canUpdate: false };
  }
  if (platform === 'win32') return { kind: 'nsis', portableDir: null, canUpdate: true };
  if (platform === 'linux') {
    try {
      if (readFile(path.join(resourcesPath, 'package-type'), 'utf8').trim() === 'deb') {
        return { kind: 'deb', portableDir: null, canUpdate: true };
      }
    } catch {}
  }
  return { kind: 'manual', portableDir: null, canUpdate: false };
}

function profilePath(installation, defaultPath) {
  const paths = installation.platform === 'win32' ? path.win32 : path.posix;
  return installation.portableDir ? paths.join(installation.portableDir, 'ROOT-data') : defaultPath;
}

function normalizePreferences(raw = {}) {
  return {
    autoCheck: typeof raw.autoCheck === 'boolean' ? raw.autoCheck : true,
    language: raw.language === 'en' ? 'en' : 'de',
    lastCheck: Number.isFinite(raw.lastCheck) && raw.lastCheck >= 0 ? raw.lastCheck : 0,
  };
}

function installedProfilePath(appData) {
  return path.join(appData, BRAND.legacyProfileName);
}

function createPreferences(directory) {
  const file = path.join(directory, 'desktop-settings.json');
  let data;
  try {
    data = normalizePreferences(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {
    data = normalizePreferences();
  }
  let queue = Promise.resolve();
  return {
    read: () => ({ ...data }),
    async update(patch) {
      data = normalizePreferences({ ...data, ...patch });
      const snapshot = JSON.stringify(data, null, 2) + '\n';
      const pending = queue.then(async () => {
        await fs.promises.mkdir(directory, { recursive: true });
        const temp = file + '.' + randomUUID() + '.tmp';
        try {
          await fs.promises.writeFile(temp, snapshot, { flag: 'wx', mode: 0o600 });
          await fs.promises.rename(temp, file);
        } finally {
          await fs.promises.rm(temp, { force: true });
        }
      });
      queue = pending.catch(() => {});
      await pending;
      return { ...data };
    },
    drain: () => queue,
  };
}

function prepareProfile(app, directory) {
  // Electron 45 requires sessionData synchronously before ready. Awaiting mkdir
  // could yield to ready and select a different Chromium storage directory.
  const sessionData = path.join(directory, 'chromium');
  fs.mkdirSync(sessionData, { recursive: true });
  app.setPath('userData', directory);
  app.setPath('sessionData', sessionData);
}

module.exports = {
  detectInstallation,
  profilePath,
  installedProfilePath,
  prepareProfile,
  normalizePreferences,
  createPreferences,
};
