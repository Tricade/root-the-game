const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appPath = path.join(__dirname, '..', 'app.js');
const appSource = fs.readFileSync(appPath, 'utf8')
  .replace(/^import \{ createRoom \} from '\.\/room\.js';\s*/, '')
  .replace(/  start\(\);/, `
  window.__rootTest = {
    save, replaceState, boot,
    set(options = {}) {
      if ('state' in options) state = options.state;
      if ('importing' in options) importing = options.importing;
      if ('initialized' in options) initialized = options.initialized;
      if ('remoteRevision' in options) remoteRevision = options.remoteRevision;
      if ('saveConflict' in options) saveConflict = options.saveConflict;
      if ('lastTick' in options) lastTick = options.lastTick;
      if ('exportSave' in options) exportSave = options.exportSave;
      if ('render' in options) render = options.render;
      if ('updateLive' in options) updateLive = options.updateLive;
      if ('shell' in options) shell = options.shell;
      if ('simulate' in options) simulate = options.simulate;
      if ('announceAchievements' in options) announceAchievements = options.announceAchievements;
      if ('toast' in options) toast = options.toast;
      if ('closeModal' in options) closeModal = options.closeModal;
    },
    state: () => state,
    conflict: () => saveConflict,
    pending: () => savePending,
    drain: () => saveDrainPromise,
  };
`);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function response(status, body = {}, revision = 'rev-next') {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    headers: { get: name => name.toLowerCase() === 'x-root-revision' ? revision : null },
  };
}

function makeHarness({ fetch = async () => response(200, { ok: true }), initialStorage = {}, advance = () => null } = {}) {
  const values = new Map(Object.entries(initialStorage));
  const listeners = new Map();
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
  const stateSeed = () => ({
    version: 3, savedAt: Date.now(), networkName: 'Testnetz',
    servers: [], agents: [], facility: { racks: [] }, achievements: {}, history: [],
  });
  const engine = {
    createState: stateSeed,
    normalizeState: value => value,
    advance,
    catalog: { achievements: [] },
  };
  const element = { addEventListener() {}, classList: { add() {}, remove() {}, toggle() {} } };
  const document = {
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(callback);
    },
    querySelector() { return element; },
    querySelectorAll() { return []; },
    hidden: false,
    body: { style: {} },
  };
  const window = {
    RootEngine: engine,
    ROOTI18N: null,
    RootRacks: { create: () => ({ select() {}, click: () => null, change: () => null }) },
    addEventListener() {},
  };
  const context = {
    window, document, localStorage,
    location: { protocol: 'http:' },
    navigator: {},
    createRoom: () => ({ isInRoom: () => false, isExploring: () => false, isArriving: () => false, hide() {} }),
    fetch,
    AbortSignal,
    Blob,
    URL,
    Intl,
    Date,
    Math,
    setTimeout: () => 0,
    clearTimeout() {},
    setInterval: () => 0,
    requestAnimationFrame() {},
    console,
  };
  vm.runInNewContext(appSource, context, { filename: appPath });
  return { app: window.__rootTest, values, context, listeners };
}

test('failed GET leaves revision unverified and boot never POSTs without a revision', async () => {
  const calls = [];
  const h = makeHarness({ fetch: async (...args) => { calls.push(args); throw new Error('offline'); } });
  h.app.set({ shell() {}, simulate: () => null, announceAchievements() {}, updateLive() {}, render() {} });
  await h.app.boot();

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], '/api/save');
  assert.equal(calls[0][1].method, undefined); // GET probe is read-only
  assert.equal(calls[0][1].cache, 'no-store');
  assert.equal(h.values.get('root.server.unverified'), '1');
  assert.equal(h.app.state().version, 3);
  assert.equal(h.values.get('root.network.save.v1'), JSON.stringify(h.app.state()));
});

test('conflicting local data does not replace an authoritative empty server', async () => {
  const oldLocal = {
    version: 3, savedAt: Date.now(), marker: 'old-browser-copy', networkName: 'Old local',
    servers: [], agents: [], facility: { racks: [] }, achievements: {}, history: [],
  };
  const calls = [];
  const h = makeHarness({
    initialStorage: {
      'root.network.save.v1': JSON.stringify(oldLocal),
      'root.server.revision': 'prior-nonempty-revision',
    },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return calls.length === 1
        ? response(200, { save: null }, 'empty')
        : response(200, { ok: true, revision: 'fresh-revision' }, 'fresh-revision');
    },
  });
  h.app.set({ shell() {}, simulate: () => null, announceAchievements() {}, updateLive() {}, render() {} });
  await h.app.boot();
  await h.app.drain();

  assert.equal(h.app.state().marker, undefined, 'new fresh state wins over stale local data');
  assert.equal(JSON.parse(h.values.get('root.conflict.save')).marker, 'old-browser-copy');
  assert.equal(calls.length, 2);
  assert.equal(JSON.parse(calls[1].options.body).marker, undefined);
  assert.equal(calls[1].options.headers['X-Root-Revision'], 'empty');
});

test('unrevisioned newer v3 browser state is backed up; saved server fleet wins and advances', async () => {
  const makeFleet = (rackCount, serverCount, name, savedAt) => ({
    version: 3, savedAt, networkName: name, marker: name,
    racks: Array.from({ length: rackCount }, (_, i) => ({ id: `rack-${name}-${i}`, name: `Rack ${i}` })),
    servers: Array.from({ length: serverCount }, (_, i) => ({ id: `server-${name}-${i}`, name: `Server ${i}` })),
    agents: Array.from({ length: 20 }, (_, i) => ({ id: `agent-${name}-${i}`, name: `Agent ${i}` })),
    facility: { racks: [] }, achievements: {}, history: [],
  });
  const localCopy = makeFleet(2, 16, 'newer-browser-copy', Date.now() + 60_000);
  const serverCopy = makeFleet(6, 20, 'server-save', Date.now() - 5_000);
  const calls = [];
  const advances = [];
  const h = makeHarness({
    initialStorage: { 'root.network.save.v1': JSON.stringify(localCopy) },
    advance: (state, seconds) => { advances.push({ state, seconds }); return null; },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return calls.length === 1
        ? response(200, { save: serverCopy }, 'server-revision')
        : response(200, { ok: true, revision: 'saved-revision' }, 'saved-revision');
    },
  });
  h.app.set({ shell() {}, announceAchievements() {}, updateLive() {}, render() {} });
  await h.app.boot();
  await h.app.drain();

  assert.equal(h.app.state().networkName, 'server-save');
  assert.equal(h.app.state().racks.length, 6);
  assert.equal(h.app.state().servers.length, 20);
  assert.equal(h.app.state().agents.length, 20);
  assert.equal(advances.length, 1);
  assert.equal(advances[0].state.networkName, 'server-save');
  assert.ok(advances[0].seconds >= 4, 'server state follows the normal elapsed-time advance');
  const backedUp = JSON.parse(h.values.get('root.conflict.save'));
  assert.equal(backedUp.networkName, 'newer-browser-copy');
  assert.equal(backedUp.racks.length, 2);
  assert.equal(backedUp.servers.length, 16);
  assert.equal(calls.length, 2);
  const posted = JSON.parse(calls[1].options.body);
  assert.equal(posted.networkName, 'server-save');
  assert.equal(posted.servers.length, 20);
  assert.equal(calls[1].options.headers['X-Root-Revision'], 'server-revision');
});

test('409 after a queued replacement freezes and exports the newest state', async () => {
  const firstPost = deferred();
  const calls = [];
  const h = makeHarness({ fetch: async (url, options) => {
    calls.push({ url, options });
    return firstPost.promise;
  } });
  const oldState = { savedAt: Date.now(), marker: 'old' };
  const newState = { savedAt: Date.now(), marker: 'replacement' };
  h.app.set({ state: oldState, initialized: true, remoteRevision: 'rev-0', lastTick: newState.savedAt,
    exportSave() {}, render() {}, updateLive() {}, closeModal() {}, toast() {} });

  const firstDrain = h.app.save();
  const replacement = h.app.replaceState(newState);
  assert.equal(calls.length, 1);
  firstPost.resolve(response(409, { conflict: true, message: 'conflict' }, 'rev-winner'));
  const [saveResult, replacementResult] = await Promise.all([firstDrain, replacement]);

  const exported = JSON.parse(h.values.get('root.conflict.save'));
  assert.equal(exported.marker, 'replacement');
  assert.equal(h.values.get('root.save.conflict'), '1');
  assert.equal(h.app.conflict(), true);
  assert.equal(saveResult.status, 'conflict');
  assert.equal(replacementResult, false);
  assert.equal(calls.length, 1, '409 must not trigger another POST');
});

test('second save waits for its own deferred POST before the drain resolves', async () => {
  const first = deferred();
  const second = deferred();
  const calls = [];
  const h = makeHarness({ fetch: async (url, options) => {
    calls.push({ url, options });
    return calls.length === 1 ? first.promise : second.promise;
  } });
  h.app.set({ state: { savedAt: Date.now(), marker: 'first' }, initialized: true, remoteRevision: 'rev-0',
    render() {}, updateLive() {} });
  let settled = false;
  const p1 = h.app.save().then(value => { settled = true; return value; });
  h.app.set({ state: { savedAt: Date.now(), marker: 'second' } });
  const p2 = h.app.save();
  assert.equal(calls.length, 1);

  first.resolve(response(200, { ok: true, revision: 'rev-1' }, 'rev-1'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 2);
  assert.equal(settled, false, 'drain must still await the second POST');
  assert.equal(JSON.parse(calls[1].options.body).marker, 'second');

  second.resolve(response(200, { ok: true, revision: 'rev-2' }, 'rev-2'));
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1.persisted, true);
  assert.equal(r2.persisted, true);
  assert.equal(h.values.get('root.server.revision'), 'rev-2');
});

test('failure of an older POST preserves a newer queued snapshot for one attempt', async () => {
  const first = deferred();
  const calls = [];
  const h = makeHarness({ fetch: async (url, options) => {
    calls.push({ url, options });
    return calls.length === 1 ? first.promise : response(200, { ok: true, revision: 'rev-1' }, 'rev-1');
  } });
  h.app.set({ state: { savedAt: Date.now(), marker: 'older' }, initialized: true, remoteRevision: 'rev-0',
    render() {}, updateLive() {} });
  const drain = h.app.save();
  h.app.set({ state: { savedAt: Date.now(), marker: 'newer' } });
  h.app.save();
  first.resolve(response(503, { ok: false }));

  const result = await drain;
  assert.equal(calls.length, 2);
  assert.equal(JSON.parse(calls[1].options.body).marker, 'newer');
  assert.equal(calls[1].options.headers['X-Root-Revision'], 'rev-0');
  assert.equal(result.persisted, true);
});

test('replaceState does not mutate a session already paused by conflict', async () => {
  const original = { savedAt: Date.now(), marker: 'original' };
  let exports = 0;
  const h = makeHarness();
  h.app.set({ state: original, initialized: true, remoteRevision: 'rev-0', saveConflict: true,
    exportSave() { exports++; }, toast() {} });

  const result = await h.app.replaceState({ savedAt: Date.now(), marker: 'replacement' });
  assert.equal(result, false);
  assert.equal(h.app.state(), original);
  assert.equal(exports, 0);
});

test('failed persistence after import reports failure, never persisted success', async () => {
  const notices = [];
  const h = makeHarness({ fetch: async () => response(503, { ok: false }) });
  h.app.set({ state: { savedAt: Date.now(), marker: 'before-import' }, initialized: true, remoteRevision: 'rev-0',
    exportSave() {}, render() {}, updateLive() {}, closeModal() {}, toast(message) { notices.push(message); },
    announceAchievements() {} });

  const imported = { savedAt: Date.now(), marker: 'imported' };
  h.app.set({ importing: imported });
  const target = { dataset: { command: 'import-confirm' }, disabled: false };
  target.closest = () => target;
  for (const listener of h.listeners.get('click')) listener({ target });
  const outcome = await h.app.drain();

  assert.equal(outcome.persisted, false);
  assert.equal(h.app.state().marker, 'imported');
  assert.ok(notices.some(message => message.includes('nur im Browser')));
  assert.ok(!notices.some(message => message.includes('ist bereit')));
});
