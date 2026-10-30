'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server.cjs');
const { createState } = require('../engine.js');

async function withServer(t, fn) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'root-save-concurrency-'));
  const server = createServer({ port: 0, dataDir });
  t.after(async () => {
    if (server.listening) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
    await fs.rm(dataDir, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  await fn({ base: `http://127.0.0.1:${server.address().port}`, dataDir });
}

async function postSave(base, save, revision) {
  const headers = { 'content-type': 'application/json', origin: base };
  if (revision !== undefined) headers['X-Root-Revision'] = revision;
  const response = await fetch(`${base}/api/save`, {
    method: 'POST', headers, body: JSON.stringify(save), signal: AbortSignal.timeout(10000)
  });
  return { status: response.status, body: await response.json(), revision: response.headers.get('x-root-revision') };
}

test('parallel clients with one expected revision produce one winner and one conflict', { timeout: 30000 }, async t => {
  await withServer(t, async ({ base, dataDir }) => {
    const empty = await fetch(`${base}/api/save`, { signal: AbortSignal.timeout(10000) });
    assert.equal(empty.status, 200);
    assert.deepEqual(await empty.json(), { save: null }, 'GET body stays backward compatible');
    assert.equal(empty.headers.get('x-root-revision'), 'empty');

    const initial = createState(901);
    const initialized = await postSave(base, initial);
    assert.equal(initialized.status, 200);
    assert.equal(initialized.body.ok, true);
    assert.match(initialized.revision, /^[a-f0-9]{64}$/);

    const loadedResponse = await fetch(`${base}/api/save`, { signal: AbortSignal.timeout(10000) });
    const loaded = (await loadedResponse.json()).save;
    const expectedRevision = loadedResponse.headers.get('x-root-revision');
    const canonicalRevision = createHash('sha256').update(JSON.stringify(loaded), 'utf8').digest('hex');
    assert.equal(expectedRevision, canonicalRevision, 'GET revision hashes canonical normalized JSON');

    const clientA = structuredClone(loaded);
    const clientB = structuredClone(loaded);
    clientA.networkName = 'Netz A';
    clientB.networkName = 'Netz B';
    const responses = await Promise.all([
      postSave(base, clientA, expectedRevision),
      postSave(base, clientB, expectedRevision)
    ]);
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
    const winnerIndex = responses.findIndex(response => response.status === 200);
    const loserIndex = 1 - winnerIndex;
    assert.equal(responses[winnerIndex].body.ok, true);
    assert.equal(responses[winnerIndex].body.revision, responses[winnerIndex].revision);
    assert.deepEqual(responses[loserIndex].body, {
      conflict: true,
      message: 'Der Netzwerkstand wurde seit dem letzten Laden verändert. Lade ihn neu, bevor du erneut speicherst.'
    });

    const primaryPath = path.join(dataDir, 'save.json');
    const backupPath = path.join(dataDir, 'save.backup.json');
    const primaryAfterWinner = await fs.readFile(primaryPath);
    const backupAfterWinner = await fs.readFile(backupPath);
    const finalResponse = await fetch(`${base}/api/save`, { signal: AbortSignal.timeout(10000) });
    const finalBody = await finalResponse.json();
    assert.equal(finalBody.save.networkName, winnerIndex === 0 ? 'Netz A' : 'Netz B');
    assert.equal(finalResponse.headers.get('x-root-revision'), responses[winnerIndex].revision);

    const stale = structuredClone(loaded);
    stale.networkName = 'Veralteter Stand';
    const staleResponse = await postSave(base, stale, expectedRevision);
    assert.equal(staleResponse.status, 409);
    assert.equal(staleResponse.body.conflict, true);
    assert.deepEqual(await fs.readFile(primaryPath), primaryAfterWinner, 'stale request cannot change primary bytes');
    assert.deepEqual(await fs.readFile(backupPath), backupAfterWinner, 'stale request cannot change backup bytes');
  });
});
