'use strict';

const path = require('node:path');
const { APP_URL, isAppUrl, isAppPage, externalUrl } = require('./security.cjs');

function createWindow({ BrowserWindow, session, shell, hidden = false }) {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1050,
    minHeight: 700,
    show: false,
    backgroundColor: '#101211',
    title: 'ROOT Cyberbunker',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      webviewTag: false,
      // Hidden diagnostics must exercise rendering; ordinary minimized windows
      // retain Electron's normal throttling and offline catch-up behavior.
      backgroundThrottling: !hidden,
    },
  });
  // First-person controls may lock the mouse and enter fullscreen. Other
  // capabilities, including camera/microphone/filesystem access, stay denied.
  const allowed = (contents, permission) =>
    contents === window.webContents &&
    isAppUrl(contents.getURL()) &&
    ['pointerLock', 'fullscreen'].includes(permission);
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) =>
    callback(allowed(contents, permission)),
  );
  session.defaultSession.setPermissionCheckHandler(
    (contents, permission, origin) => allowed(contents, permission) && isAppUrl(origin),
  );
  window.webContents.setWindowOpenHandler(({ url }) => {
    const allowed = externalUrl(url);
    if (allowed) shell.openExternal(allowed).catch(() => {});
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (isAppPage(url)) return;
    event.preventDefault();
    const allowed = externalUrl(url);
    if (allowed) shell.openExternal(allowed).catch(() => {});
  });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  if (!hidden) window.once('ready-to-show', () => window.show());
  return { window, load: () => window.loadURL(APP_URL) };
}

module.exports = { createWindow };
