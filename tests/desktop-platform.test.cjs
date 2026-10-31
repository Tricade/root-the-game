'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { isAppUrl, isAppPage, trustedSender, externalUrl } = require('../desktop/security.cjs');
const {
  detectInstallation,
  profilePath,
  prepareProfile,
  createPreferences,
} = require('../desktop/profile.cjs');
const { createCloseSession } = require('../desktop/close-session.cjs');
const { installBridge } = require('../desktop/ipc.cjs');

test('profile redirects Chromium storage synchronously before the ready boundary', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'root-profile-start-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const paths = new Map();
  const app = {
    setPath(name, value) {
      assert.equal(require('node:fs').existsSync(value), true);
      paths.set(name, value);
    },
  };
  const result = prepareProfile(app, dir);
  assert.equal(result, undefined);
  assert.equal(paths.get('userData'), dir);
  assert.equal(paths.get('sessionData'), path.join(dir, 'chromium'));
});

test('desktop bridge accepts only its own main document and exact safe origins', () => {
  for (const value of ['root://app/', 'root://app/index.html', 'root://app/ui/desktop.js'])
    assert.ok(isAppUrl(value));
  for (const value of [
    'root://evil/',
    'root://app.attacker/',
    'root://user@app/',
    'root://app:80/',
    'https://app/',
    'invalid',
  ])
    assert.equal(isAppUrl(value), false);
  assert.ok(isAppPage('root://app/#main'));
  assert.equal(isAppPage('root://app/api/save'), false);
  const frame = { url: 'root://app/' };
  const contents = { mainFrame: frame };
  const window = { isDestroyed: () => false, webContents: contents };
  assert.ok(trustedSender({ sender: contents, senderFrame: frame }, window));
  assert.equal(trustedSender({ sender: contents, senderFrame: { url: frame.url } }, window), false);
  assert.equal(trustedSender({ sender: {}, senderFrame: frame }, window), false);
  frame.url = 'https://github.com/Tricade/root-the-game';
  assert.equal(trustedSender({ sender: contents, senderFrame: frame }, window), false);
  assert.equal(
    externalUrl('https://github.com/Tricade/root-the-game'),
    'https://github.com/Tricade/root-the-game',
  );
  for (const value of [
    'file:///etc/passwd',
    'http://github.com/',
    'https://github.com.evil/',
    'https://x@github.com/',
    'https://github.com:444/',
  ])
    assert.equal(externalUrl(value), null);
});

test('portable launchers always choose manual updates and adjacent persistent data', () => {
  const win = detectInstallation({
    packaged: true,
    platform: 'win32',
    env: { PORTABLE_EXECUTABLE_FILE: 'D:\\Apps\\ROOT.exe' },
  });
  assert.equal(win.kind, 'portable');
  assert.equal(win.canUpdate, false);
  assert.equal(profilePath(win, 'unused'), 'D:\\Apps\\ROOT-data');
  const linux = detectInstallation({
    packaged: true,
    platform: 'linux',
    env: { APPIMAGE: '/mnt/apps/ROOT.AppImage' },
  });
  assert.equal(profilePath(linux, 'unused'), '/mnt/apps/ROOT-data');
  assert.equal(linux.canUpdate, false);
  const options = { packaged: true, platform: 'linux', env: {}, resourcesPath: '/resources' };
  assert.equal(detectInstallation({ ...options, readFile: () => 'deb\n' }).kind, 'deb');
  assert.equal(detectInstallation({ ...options, readFile: () => 'rpm' }).canUpdate, false);
  assert.equal(
    detectInstallation({
      ...options,
      readFile: () => {
        throw new Error('missing');
      },
    }).kind,
    'manual',
  );
  assert.equal(detectInstallation({ ...options, platform: 'win32' }).kind, 'nsis');
  assert.equal(detectInstallation({ ...options, packaged: false }).canUpdate, false);
  assert.equal(profilePath({ portableDir: null }, '/profile'), '/profile');
});

test('desktop preferences persist serialized updates and recover from invalid settings', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'root-desktop-prefs-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const prefs = createPreferences(dir);
  await Promise.all([
    prefs.update({ autoCheck: false }),
    prefs.update({ language: 'en', lastCheck: 42 }),
  ]);
  await prefs.drain();
  assert.deepEqual(createPreferences(dir).read(), {
    autoCheck: false,
    language: 'en',
    lastCheck: 42,
  });
  const copy = prefs.read();
  copy.language = 'de';
  assert.equal(prefs.read().language, 'en');
  await fs.writeFile(path.join(dir, 'desktop-settings.json'), '{broken');
  assert.deepEqual(createPreferences(dir).read(), {
    autoCheck: true,
    language: 'de',
    lastCheck: 0,
  });
  assert.deepEqual(
    (await fs.readdir(dir)).filter((file) => file.endsWith('.tmp')),
    [],
  );
});

test('close handshake needs a matching nonce AND confirmed persistence; duplicate closes coalesce', async () => {
  const sent = [];
  const session = createCloseSession({ send: (channel, data) => sent.push({ channel, ...data }) });
  const first = session.request();
  assert.equal(session.request(), first);
  assert.equal(sent.length, 1);
  assert.equal(session.finish({ token: 'other', persisted: true }), false);
  assert.equal(session.finish({ token: sent[0].token, persisted: false }), true);
  assert.equal(await first, false);
  const second = session.request();
  assert.notEqual(sent[1].token, sent[0].token);
  session.finish({ token: sent[1].token, persisted: true });
  assert.equal(await second, true);
  const expired = session.request();
  session.cancel();
  assert.equal(await expired, false);
});

test('close handshake fails closed on a timeout or broken renderer', async () => {
  let expire;
  const session = createCloseSession({
    send() {},
    timers: {
      setTimeout(fn) {
        expire = fn;
      },
      clearTimeout() {},
    },
  });
  const pending = session.request();
  expire();
  assert.equal(await pending, false);
  const broken = createCloseSession({
    send() {
      throw new Error('Renderer gone');
    },
  });
  assert.equal(await broken.request(), false);
});

test('IPC enforces sender and payload validation before any privileged side effect', async () => {
  const handlers = new Map();
  const calls = [];
  const frame = { url: 'root://app/' };
  const window = { isDestroyed: () => false, webContents: { mainFrame: frame } };
  const event = { sender: window.webContents, senderFrame: frame };
  const cleanup = installBridge({
    ipcMain: {
      handle: (name, fn) => handlers.set(name, fn),
      removeHandler: (name) => handlers.delete(name),
    },
    window,
    updates: { snapshot: () => ({ status: 'manual' }), check: () => calls.push('check') },
    preferences: { update: (patch) => calls.push(patch) },
    closeSession: { finish: (value) => calls.push(value) },
    shell: { openExternal: (url) => calls.push(url), openPath: (dir) => calls.push(dir) },
    close: (install) => calls.push(install),
    dataDir: '/test-owned/network',
  });
  assert.throws(() => handlers.get('desktop:check')({ ...event, sender: {} }), /Untrusted/);
  assert.deepEqual(calls, []);
  await assert.rejects(handlers.get('desktop:language')(event, '../../arbitrary'), /language/);
  assert.equal(
    handlers.get('desktop:close-ready')(event, { token: 'x', persisted: 'true' }),
    false,
  );
  await handlers.get('desktop:releases')(event, 'file:///untrusted');
  assert.equal(calls[0], 'https://github.com/Tricade/root-the-game/releases/latest');
  await handlers.get('desktop:data-folder')(event, '/untrusted');
  assert.equal(calls[1], '/test-owned/network');
  cleanup();
  assert.equal(handlers.size, 0);
});
