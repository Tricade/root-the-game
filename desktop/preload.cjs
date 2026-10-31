'use strict';

const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  if (typeof callback !== 'function') throw new TypeError('Expected a callback');
  const listener = (_event, data) => callback(data);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

// No filesystem, shell, URL or generic IPC primitive crosses this bridge.
contextBridge.exposeInMainWorld(
  'rootDesktop',
  Object.freeze({
    info: () => ipcRenderer.invoke('desktop:info'),
    checkUpdates: () => ipcRenderer.invoke('desktop:check'),
    downloadUpdate: () => ipcRenderer.invoke('desktop:download'),
    installUpdate: () => ipcRenderer.invoke('desktop:install'),
    setAutoCheck: (value) => ipcRenderer.invoke('desktop:auto-check', value),
    setLanguage: (value) => ipcRenderer.invoke('desktop:language', value),
    openReleases: () => ipcRenderer.invoke('desktop:releases'),
    openDataFolder: () => ipcRenderer.invoke('desktop:data-folder'),
    closeReady: (result) => ipcRenderer.invoke('desktop:close-ready', result),
    bootReady: () => ipcRenderer.invoke('desktop:boot-ready'),
    onStatus: (callback) => subscribe('desktop:status', callback),
    onPrepareClose: (callback) => subscribe('desktop:prepare-close', callback),
    onResume: (callback) => subscribe('desktop:resume', callback),
  }),
);
