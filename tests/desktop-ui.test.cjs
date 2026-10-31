'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createWindow } = require('../desktop/window.cjs');

async function harness(language = 'en') {
  const { createDesktopUI } = await import('../ui/desktop.js');
  const callbacks = {};
  const calls = [];
  const buttons = ['check', 'download', 'install', 'releases', 'data'].map((command) => ({
    dataset: { desktopCommand: command },
  }));
  const nodes = { status: {}, progress: {}, checkbox: { parentElement: {} } };
  const section = {
    querySelector: (name) =>
      name === 'progress'
        ? nodes.progress
        : name === '[data-desktop-status]'
          ? nodes.status
          : nodes.checkbox,
    querySelectorAll: () => buttons,
  };
  const bridge = {
    info: async () => ({ status: 'manual', kind: 'portable', canUpdate: false, version: '1.5.0' }),
    onStatus: (fn) => {
      callbacks.status = fn;
    },
    onResume: (fn) => {
      callbacks.resume = fn;
    },
    onPrepareClose: (fn) => {
      callbacks.close = fn;
    },
    closeReady: (value) => calls.push(['saved', value]),
    setLanguage: async (value) => calls.push(['language', value]),
    bootReady: async () => calls.push(['ready']),
    openReleases: async () => calls.push(['releases']),
    checkUpdates: async () => calls.push(['check']),
    setAutoCheck: async (value) => ({ status: 'idle', autoCheck: value }),
  };
  const ctx = {
    I18N: { getLanguage: () => language },
    esc: (value) => String(value).replaceAll('<', '&lt;'),
    simulate: () => calls.push(['simulate']),
    save: async () => ({ persisted: true }),
  };
  const ui = createDesktopUI(ctx, {
    rootDesktop: bridge,
    document: {
      querySelectorAll: () => [section],
      addEventListener: (name, fn) => {
        callbacks[name] = fn;
      },
    },
  });
  await Promise.resolve();
  return { ui, ctx, calls, callbacks, nodes, buttons };
}

test('browser UI stays independent from Electron and desktop settings explain manual portable updates', async () => {
  const { createDesktopUI } = await import('../ui/desktop.js');
  const browser = createDesktopUI({}, {});
  assert.equal(browser.desktopSettings(), '');
  assert.equal(browser.desktopClosing(), false);
  const h = await harness();
  assert.match(h.ui.desktopSettings(), /ROOT-data/);
  assert.match(h.ui.desktopSettings(), /portable application/);
  assert.equal(h.buttons.find((button) => button.dataset.desktopCommand === 'check').hidden, true);
  assert.equal(
    h.buttons.find((button) => button.dataset.desktopCommand === 'install').hidden,
    true,
  );
  assert.equal(h.nodes.checkbox.parentElement.hidden, true);
  assert.equal(h.ui.handleDesktopCommand('__proto__'), false);
});

test('desktop status uses text content, clamps progress, and exposes install only after verified download', async () => {
  const h = await harness();
  h.callbacks.status({
    status: 'available',
    version: '<markup>',
    availableVersion: '<script>',
    canUpdate: true,
    kind: 'nsis',
  });
  assert.match(h.nodes.status.textContent, /<script>/);
  assert.match(h.ui.desktopSettings(), /&lt;markup>/);
  assert.equal(
    h.buttons.find((button) => button.dataset.desktopCommand === 'download').hidden,
    false,
  );
  assert.equal(
    h.buttons.find((button) => button.dataset.desktopCommand === 'install').hidden,
    true,
  );
  h.callbacks.status({ status: 'downloading', progress: 150 });
  assert.equal(h.nodes.progress.value, 100);
  assert.equal(h.nodes.progress.hidden, false);
  h.callbacks.status({ status: 'downloaded' });
  assert.equal(
    h.buttons.find((button) => button.dataset.desktopCommand === 'install').hidden,
    false,
  );
  assert.equal(
    h.buttons.find((button) => button.dataset.desktopCommand === 'download').hidden,
    true,
  );
  const german = await harness('de');
  assert.match(german.ui.desktopSettings(), /Speicherordner öffnen/);
});

test('renderer close pauses actions until its real asynchronous save result is acknowledged', async () => {
  const h = await harness();
  let finish;
  h.ctx.save = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const pending = h.callbacks.close({ token: 'test-nonce' });
  assert.equal(h.ui.desktopClosing(), true);
  assert.equal(
    h.calls.some(([name]) => name === 'saved'),
    false,
  );
  h.ui.handleDesktopCommand('releases');
  assert.equal(
    h.calls.some(([name]) => name === 'releases'),
    false,
  );
  finish({ persisted: false });
  await pending;
  assert.deepEqual(
    h.calls.find(([name]) => name === 'saved'),
    ['saved', { token: 'test-nonce', persisted: false }],
  );
  h.callbacks.resume();
  assert.equal(h.ui.desktopClosing(), false);
  h.ctx.save = async () => ({ persisted: true });
  await h.ui.desktopReady();
  assert.ok(h.calls.some(([name, value]) => name === 'language' && value === 'en'));
  assert.ok(h.calls.some(([name]) => name === 'ready'));
});

test('window keeps renderer sandboxed while permitting first-person mouse lock only to its own page', async () => {
  let config, permission, check, popup;
  const links = [];
  class Window extends EventEmitter {
    constructor(options) {
      super();
      config = options;
      this.webContents = new EventEmitter();
      Object.assign(this.webContents, {
        getURL: () => 'root://app/',
        setWindowOpenHandler: (fn) => {
          popup = fn;
        },
      });
    }
    loadURL(url) {
      return url;
    }
  }
  const { window, load } = createWindow({
    BrowserWindow: Window,
    session: {
      defaultSession: {
        setPermissionRequestHandler: (fn) => {
          permission = fn;
        },
        setPermissionCheckHandler: (fn) => {
          check = fn;
        },
      },
    },
    shell: { openExternal: async (url) => links.push(url) },
  });
  assert.equal(config.webPreferences.nodeIntegration, false);
  assert.equal(config.webPreferences.contextIsolation, true);
  assert.equal(config.webPreferences.sandbox, true);
  assert.equal(config.webPreferences.webSecurity, true);
  let answer;
  permission(window.webContents, 'pointerLock', (value) => {
    answer = value;
  });
  assert.equal(answer, true);
  permission(window.webContents, 'media', (value) => {
    answer = value;
  });
  assert.equal(answer, false);
  assert.equal(check(window.webContents, 'fullscreen', 'root://app'), true);
  assert.equal(check({}, 'pointerLock', 'root://app'), false);
  assert.equal(check(window.webContents, 'fullscreen', 'https://attacker.example'), false);
  assert.deepEqual(popup({ url: 'file:///arbitrary' }), { action: 'deny' });
  assert.equal(links.length, 0);
  assert.equal(await load(), 'root://app/');
});
