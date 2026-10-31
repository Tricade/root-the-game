'use strict';

const { trustedSender, RELEASES_URL } = require('./security.cjs');

function installBridge({
  ipcMain,
  window,
  updates,
  preferences,
  closeSession,
  close,
  shell,
  dataDir,
  onReady,
}) {
  const handlers = {
    'desktop:info': () => updates.snapshot(),
    'desktop:check': () => updates.check(),
    'desktop:download': () => updates.download(),
    'desktop:install': () => close(true),
    'desktop:auto-check': (value) => updates.setAutoCheck(value),
    'desktop:language': async (value) => {
      if (value !== 'de' && value !== 'en') throw new TypeError('Unsupported language');
      await preferences.update({ language: value });
      return true;
    },
    'desktop:releases': async () => {
      await shell.openExternal(RELEASES_URL);
      return true;
    },
    'desktop:data-folder': async () => {
      await shell.openPath(dataDir);
      return true;
    },
    'desktop:close-ready': (result) => {
      if (
        typeof result?.token !== 'string' ||
        result.token.length > 64 ||
        typeof result.persisted !== 'boolean'
      )
        return false;
      return closeSession.finish(result);
    },
    'desktop:boot-ready': () => {
      onReady?.();
      return true;
    },
  };
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (event, ...args) => {
      if (!trustedSender(event, window)) throw new Error('Untrusted desktop sender');
      return handler(...args);
    });
  }
  return () => {
    for (const channel of Object.keys(handlers)) ipcMain.removeHandler(channel);
  };
}

module.exports = { installBridge };
