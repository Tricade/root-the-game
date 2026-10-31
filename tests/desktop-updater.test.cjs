'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createUpdateController, DAY } = require('../desktop/updater.cjs');

function setup(kind = 'nsis') {
  const sdk = new EventEmitter();
  let checks = 0,
    downloads = 0,
    installs = 0,
    created = 0;
  const info = { version: '1.6.0' };
  const prefs = { autoCheck: true, lastCheck: 0 };
  const states = [];
  sdk.checkForUpdates = async () => {
    checks++;
    sdk.emit('update-available', info);
  };
  sdk.downloadUpdate = async () => {
    downloads++;
    sdk.emit('download-progress', { percent: 145 });
    sdk.emit('update-downloaded', info);
  };
  sdk.quitAndInstall = (silent, force) => {
    assert.equal(silent, false);
    assert.equal(force, true);
    installs++;
  };
  const controller = createUpdateController({
    installation: { kind, canUpdate: ['nsis', 'deb'].includes(kind) },
    version: '1.5.0',
    preferences: {
      read: () => ({ ...prefs }),
      update: async (patch) => Object.assign(prefs, patch),
    },
    createUpdater: () => {
      created++;
      return sdk;
    },
    publish: (value) => states.push(value),
    now: () => 10 * DAY,
  });
  return {
    controller,
    sdk,
    prefs,
    info,
    states,
    counts: () => ({ checks, downloads, installs, created }),
  };
}

test('portable and development modes never instantiate an updater or download/install', async () => {
  for (const kind of ['portable', 'development', 'manual']) {
    const h = setup(kind);
    await h.controller.check();
    await h.controller.download();
    assert.equal(h.controller.install(), false);
    assert.deepEqual(h.counts(), { checks: 0, downloads: 0, installs: 0, created: 0 });
    assert.equal(h.controller.snapshot().canUpdate, false);
  }
});

test('installed updates require a newer stable release, verified completion and explicit installation', async () => {
  for (const kind of ['nsis', 'deb']) {
    const h = setup(kind);
    assert.equal(h.controller.install(), false);
    await h.controller.check();
    assert.equal(h.controller.snapshot().status, 'available');
    assert.equal(h.counts().downloads, 0);
    assert.equal(h.sdk.autoDownload, false);
    assert.equal(h.sdk.autoInstallOnAppQuit, false);
    assert.equal(h.sdk.allowDowngrade, false);
    assert.equal(h.sdk.allowPrerelease, false);
    await h.controller.download();
    assert.ok(h.states.some((value) => value.status === 'downloading' && value.progress === 100));
    assert.equal(h.controller.snapshot().status, 'downloaded');
    assert.equal(h.counts().installs, 0);
    assert.ok(h.controller.install());
    assert.equal(h.counts().installs, 1);
    h.controller.dispose();
    assert.equal(h.controller.install(), false);
    assert.equal(h.sdk.listenerCount('error'), 0);
  }
});

test('invalid, prerelease or older versions and mismatched completed downloads cannot install', async () => {
  for (const version of ['1.4.0', '1.5.0', '1.6.0-beta.1', '<invalid>', 'x'.repeat(65)]) {
    const h = setup();
    h.info.version = version;
    await h.controller.check();
    assert.equal(h.controller.snapshot().status, 'error');
    assert.equal(h.controller.canInstall(), false);
    await h.controller.download();
    assert.equal(h.counts().downloads, 0);
  }
  const h = setup();
  await h.controller.check();
  h.sdk.emit('update-downloaded', { version: '1.7.0' });
  assert.equal(h.controller.canInstall(), false);
});

test('automatic checks obey opt-out and daily limit while explicit checks remain available', async () => {
  const h = setup();
  await h.controller.setAutoCheck(false);
  await h.controller.check(true);
  assert.equal(h.counts().checks, 0);
  await h.controller.check();
  assert.equal(h.counts().checks, 1);
  await h.controller.setAutoCheck(true);
  await h.controller.check(true);
  assert.equal(h.counts().checks, 1);
  await h.controller.check();
  assert.equal(h.counts().checks, 2);
  await assert.rejects(h.controller.setAutoCheck('yes'), /preference/);
});

test('concurrent checks coalesce and network or installer errors remain recoverable', async () => {
  const h = setup();
  let finish;
  h.sdk.checkForUpdates = () =>
    new Promise((resolve) => {
      finish = () => {
        h.sdk.emit('update-available', h.info);
        resolve();
      };
    });
  const first = h.controller.check();
  const second = h.controller.check();
  await new Promise((resolve) => setImmediate(resolve));
  finish();
  assert.equal((await first).status, 'available');
  assert.equal((await second).status, 'available');
  h.sdk.downloadUpdate = async () => {
    throw Object.assign(new Error('bad digest'), { code: 'ERR_CHECKSUM_MISMATCH' });
  };
  await h.controller.download();
  assert.equal(h.controller.snapshot().status, 'error');
  assert.equal(h.controller.canInstall(), false);
  h.sdk.emit('error', { statusCode: 404 });
  assert.equal(h.controller.snapshot().error, 'not-published');
});
