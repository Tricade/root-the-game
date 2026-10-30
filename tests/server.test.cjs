'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createServer, maxBody } = require('../server.cjs');

async function withServer(t, fn) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'root-server-test-'));
  const server = createServer({ port: 0, dataDir });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(dataDir, { recursive: true, force: true });
  });
  await fn({ base, dataDir });
}

function fixture() {
  const enginePath = path.join(__dirname, '..', 'engine.js');
  const engine = require(enginePath);
  return engine.createState(24680);
}

async function legacyFixture() {
  return JSON.parse(await fs.readFile(path.join(__dirname, 'fixtures', 'v1-save.json'), 'utf8'));
}

async function v2Fixture() {
  return JSON.parse(await fs.readFile(path.join(__dirname, 'fixtures', 'v2-save.json'), 'utf8'));
}

test('health endpoint, loopback-only static allowlist, and API boundaries', async (t) => {
  await withServer(t, async ({ base }) => {
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { app: 'ROOT', version: 3, release: '1.4.0' });
    for (const file of ['/server.cjs', '/data/save.json', '/package.json', '/missing']) {
      assert.equal((await fetch(`${base}${file}`)).status, 404, `${file} is not publicly served`);
    }
    for (const [url, mime] of [['/rack-ui.js', /^text\/javascript/], ['/racks.css', /^text\/css/], ['/room.js', /^text\/javascript/], ['/room.css', /^text\/css/], ['/vendor/three.module.js', /^text\/javascript/], ['/vendor/three.core.js', /^text\/javascript/], ['/vendor/RoomEnvironment.js', /^text\/javascript/], ['/vendor/RoundedBoxGeometry.js', /^text\/javascript/], ['/room-stations.js', /^text\/javascript/]]) {
      const asset = await fetch(`${base}${url}`);
      assert.equal(asset.status, 200, `${url} is available from the static allowlist`);
      assert.match(asset.headers.get('content-type'), mime);
    }
    const faviconPath = path.join(__dirname, '..', 'favicon.svg');
    try {
      await fs.access(faviconPath);
      const favicon = await fetch(`${base}/favicon.svg`);
      assert.equal(favicon.status, 200);
      assert.match(favicon.headers.get('content-type'), /^image\/svg\+xml/);
      assert.match(favicon.headers.get('content-security-policy'), /style-src 'self' 'unsafe-inline'/);
      assert.match(favicon.headers.get('content-security-policy'), /script-src 'self'/);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    assert.equal((await fetch(`${base}/api/health`, { method: 'POST' })).status, 405);
    const denied = await fetch(`${base}/api/save`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://attacker.example' },
      body: JSON.stringify(fixture()),
    });
    assert.equal(denied.status, 403);
  });
});

test('save round-trip persists data and preserves the previous save as backup', async (t) => {
  await withServer(t, async ({ base, dataDir }) => {
    assert.deepEqual(await (await fetch(`${base}/api/save`)).json(), { save: null });
    const first = fixture();
    const second = fixture();
    second.savedAt = (second.savedAt || 0) + 1;
    for (const save of [first, second]) {
      const response = await fetch(`${base}/api/save`, {
        method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify(save),
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ok: true });
    }
    const stored = JSON.parse(await fs.readFile(path.join(dataDir, 'save.json'), 'utf8'));
    const backup = JSON.parse(await fs.readFile(path.join(dataDir, 'save.backup.json'), 'utf8'));
    assert.equal(stored.version, 3);
    assert.equal(backup.version, 3);
    if (second.marker) assert.equal(stored.marker, 'fixture');
    assert.ok(await (await fetch(`${base}/api/save`)).json());
  });
});

test('rejects stale v1 and v2 writes with updateRequired without creating or overwriting either copy', async (t) => {
  const staleStates = [await legacyFixture(), await v2Fixture()];
  await withServer(t, async ({ base, dataDir }) => {
    for (const stale of staleStates) {
      const response = await fetch(`${base}/api/save`, {
        method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify(stale),
      });
      assert.equal(response.status, 409);
      assert.deepEqual(await response.json(), {
        ok: false,
        updateRequired: true,
        error: 'Diese Oberfläche stammt aus einer älteren Version. Lade sie neu, bevor du fortfährst.',
      });
    }
    await assert.rejects(fs.access(path.join(dataDir, 'save.json')));
    await assert.rejects(fs.access(path.join(dataDir, 'save.backup.json')));

    const current = require('../engine.js').createState(654);
    const currentResponse = await fetch(`${base}/api/save`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify(current),
    });
    assert.equal(currentResponse.status, 200);
    const currentBytes = await fs.readFile(path.join(dataDir, 'save.json'), 'utf8');
    for (const stale of staleStates) {
      const staleAgain = await fetch(`${base}/api/save`, {
        method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify(stale),
      });
      assert.equal(staleAgain.status, 409);
      assert.equal(await fs.readFile(path.join(dataDir, 'save.json'), 'utf8'), currentBytes);
    }
    await assert.rejects(fs.access(path.join(dataDir, 'save.backup.json')));
  });
});

test('GET migrates a v1 source in memory and retains its bytes until the explicit v3 save', async (t) => {
  const engine = require('../engine.js');
  const legacy = await legacyFixture();
  await withServer(t, async ({ base, dataDir }) => {
    legacy.credits = 2345;
    legacy.research = 67;
    legacy.servers[0].level = 4;
    const originalBytes = `${JSON.stringify(legacy)}\n`;
    const source = path.join(dataDir, 'save.json');
    await fs.writeFile(source, originalBytes, 'utf8');

    const response = await fetch(`${base}/api/save`);
    assert.equal(response.status, 200);
    const migrated = (await response.json()).save;
    assert.equal(migrated.version, 3);
    assert.equal(migrated.credits, legacy.credits);
    assert.equal(migrated.research, legacy.research);
    assert.equal(migrated.servers[0].id, legacy.servers[0].id);
    assert.equal(migrated.servers[0].level, legacy.servers[0].level);
    assert.deepEqual(migrated.agents.map(({ id, role, level }) => ({ id, role, level })), legacy.agents.map(({ id, role, level }) => ({ id, role, level })));
    assert.deepEqual(migrated.jobs.map(({ id, title, work, totalWork }) => ({ id, title, work, totalWork })), legacy.jobs.map(({ id, title, work, totalWork }) => ({ id, title, work, totalWork })));
    assert.deepEqual(migrated.upgrades, legacy.upgrades);
    for (const key of ['power', 'autocontract', 'autorepair', 'priority']) assert.equal(migrated.policies[key], legacy.policies[key]);
    assert.equal(migrated.resilience.parts, 3);
    assert.equal(migrated.resilience.graceUntil, legacy.time + 600);
    assert.equal(migrated.resilience.backup, null);
    assert.equal(migrated.policies.autobackup, true);
    assert.equal(migrated.policies.repairBudget, 300);
    assert.equal(migrated.policies.reserve, 250);
    assert.equal(await fs.readFile(source, 'utf8'), originalBytes);

    const saved = await fetch(`${base}/api/save`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify(migrated),
    });
    assert.equal(saved.status, 200);
    assert.equal(JSON.parse(await fs.readFile(source, 'utf8')).version, 3);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(dataDir, 'save.backup.json'), 'utf8')), legacy);
    assert.equal((await (await fetch(`${base}/api/save`)).json()).save.version, 3);
    assert.equal(engine.normalizeState(migrated).version, 3);
  });
});

test('GET migrates a v2 source in memory and retains its bytes until the explicit v3 save', async (t) => {
  const engine = require('../engine.js');
  const legacy = await v2Fixture();
  await withServer(t, async ({ base, dataDir }) => {
    legacy.networkName = 'Bestand Rack 02';
    legacy.credits = 3210;
    legacy.servers[0].condition = 61;
    const originalBytes = `${JSON.stringify(legacy)}\n`;
    const source = path.join(dataDir, 'save.json');
    await fs.writeFile(source, originalBytes, 'utf8');

    const response = await fetch(`${base}/api/save`);
    assert.equal(response.status, 200);
    const migrated = (await response.json()).save;
    assert.equal(migrated.version, 3);
    assert.equal(migrated.networkName, legacy.networkName);
    assert.equal(migrated.credits, legacy.credits);
    assert.equal(migrated.servers[0].id, legacy.servers[0].id);
    assert.equal(migrated.servers[0].condition, legacy.servers[0].condition);
    assert.equal(migrated.facility.racks.length > 0, true);
    const rackIds = new Set(migrated.facility.racks.map((rack) => rack.id));
    assert.ok(migrated.servers.every((server) => rackIds.has(server.rackId)));
    assert.equal(await fs.readFile(source, 'utf8'), originalBytes);

    const saved = await fetch(`${base}/api/save`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify(migrated),
    });
    assert.equal(saved.status, 200);
    assert.equal(JSON.parse(await fs.readFile(source, 'utf8')).version, 3);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(dataDir, 'save.backup.json'), 'utf8')), legacy);
    assert.equal((await (await fetch(`${base}/api/save`)).json()).save.version, 3);
    assert.equal(engine.normalizeState(migrated).version, 3);
  });
});

test('v3 save round-trip preserves resilience settings, condition and protected backup research', async (t) => {
  const engine = require('../engine.js');
  const fixture = engine.createState(2026);
  assert.equal(fixture.version, 3);
  fixture.servers[0].condition = 73;
  fixture.servers[0].status = 'online';
  fixture.servers[0].fault = null;
  fixture.policies.autobackup = false;
  fixture.policies.repairBudget = 100;
  fixture.policies.reserve = 1000;
  fixture.resilience.parts = 9;
  fixture.resilience.integrity = 86;
  fixture.resilience.backup = {
    createdAt: fixture.time,
    research: fixture.research,
    protectedResearch: Math.max(0, fixture.research - 2),
    jobs: [],
  };
  const expected = engine.normalizeState(fixture);
  await withServer(t, async ({ base }) => {
    const saved = await fetch(`${base}/api/save`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify(expected),
    });
    assert.equal(saved.status, 200);
    const loaded = await (await fetch(`${base}/api/save`)).json();
    assert.deepEqual(loaded.save, expected);
    assert.equal(loaded.save.servers[0].condition, 73);
    assert.equal(loaded.save.policies.autobackup, false);
    assert.equal(loaded.save.resilience.parts, 9);
    assert.equal(loaded.save.resilience.integrity, 86);
    assert.equal(loaded.save.resilience.backup.protectedResearch, expected.resilience.backup.protectedResearch);
  });
});

test('rejects non-JSON and bodies above the configured size limit without writing a save', async (t) => {
  await withServer(t, async ({ base, dataDir }) => {
    const wrongType = await fetch(`${base}/api/save`, {
      method: 'POST', headers: { origin: base, 'content-type': 'text/plain' }, body: 'hello',
    });
    assert.equal(wrongType.status, 415);
    const tooLarge = await fetch(`${base}/api/save`, {
      method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: ' '.repeat(maxBody + 1),
    });
    assert.equal(tooLarge.status, 413);
    await assert.rejects(fs.access(path.join(dataDir, 'save.json')));
  });
});

test('rejects a corrupt or unsupported save through the engine normalizer', async (t) => {
  const enginePath = path.join(__dirname, '..', 'engine.js');
  let engine;
  try { engine = require(enginePath); }
  catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') return t.skip('engine.js is not present yet');
    throw error;
  }
  await withServer(t, async ({ base, dataDir }) => {
    const bad = await fetch(`${base}/api/save`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify({ ...engine.createState(2), version: 999 }),
    });
    assert.equal(bad.status, 400);
    await assert.rejects(fs.access(path.join(dataDir, 'save.json')));
  });
});

test('corrupt primary recovers from a valid backup and never clobbers it during recovery save', async (t) => {
  const enginePath = path.join(__dirname, '..', 'engine.js');
  let engine;
  try { engine = require(enginePath); }
  catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') return t.skip('engine.js is not present yet');
    throw error;
  }
  await withServer(t, async ({ base, dataDir }) => {
    const backup = engine.createState(502);
    const backupBytes = `${JSON.stringify(backup)}\n`;
    await fs.writeFile(path.join(dataDir, 'save.json'), '{broken', 'utf8');
    await fs.writeFile(path.join(dataDir, 'save.backup.json'), backupBytes, 'utf8');

    const recovered = await fetch(`${base}/api/save`);
    assert.equal(recovered.status, 200);
    const recoveredBody = await recovered.json();
    assert.equal(recoveredBody.save.version, backup.version);

    const replacement = engine.createState(503);
    replacement.networkName = 'Recovery check';
    const saved = await fetch(`${base}/api/save`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify(replacement),
    });
    assert.equal(saved.status, 200);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(dataDir, 'save.backup.json'), 'utf8')), backup);

    await fs.writeFile(path.join(dataDir, 'save.json'), '{broken again', 'utf8');
    await fs.rm(path.join(dataDir, 'save.backup.json'));
    const unavailable = await fetch(`${base}/api/save`);
    assert.equal(unavailable.status, 500);
    assert.equal(await fs.readFile(path.join(dataDir, 'save.json'), 'utf8'), '{broken again');
  });
});
