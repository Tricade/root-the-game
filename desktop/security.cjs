'use strict';

const APP_URL = 'root://app/';
const RELEASES_URL = 'https://github.com/Tricade/root-the-game/releases/latest';

function isAppUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'root:' &&
      url.hostname === 'app' &&
      !url.port &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function trustedSender(event, window) {
  return Boolean(
    window &&
    !window.isDestroyed() &&
    event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame &&
    isAppPage(event.senderFrame?.url),
  );
}

function isAppPage(value) {
  return isAppUrl(value) && ['/', '/index.html'].includes(new URL(value).pathname);
}

function externalUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (url.hostname !== 'github.com' && url.hostname !== 'ko-fi.com') return null;
    return url.href;
  } catch {
    return null;
  }
}

module.exports = { APP_URL, RELEASES_URL, isAppUrl, isAppPage, trustedSender, externalUrl };
