'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const E = require('../engine.js');
const { startLocalService, readBody } = require('../desktop/service.cjs');

test('desktop protocol forwards the existing revision-safe API without exposing private files', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'root-desktop-service-'));
  const service = await startLocalService(dir);
  t.after(async () => {
    await service.stop();
    await fs.rm(dir, { recursive: true, force: true });
  });
  const get = (url) => service.forward(new Request('root://app' + url), fetch);
  const index = await get('/');
  assert.equal(index.status, 200);
  assert.match(await index.text(), /ui\/desktop|app\.js/);
  for (const url of ['/desktop.css', '/ui/desktop.js', '/vendor/three.module.js'])
    assert.equal((await get(url)).status, 200);
  for (const url of ['/desktop/main.cjs', '/package.json', '/network/save.json'])
    assert.equal((await get(url)).status, 404);
  const health = await (await get('/api/health')).json();
  assert.equal(health.release, require('../package.json').version);
  const first = await get('/api/save');
  assert.equal(first.headers.get('x-root-revision'), 'empty');
  const save = E.createState(481);
  const post = (revision) =>
    service.forward(
      new Request('root://app/api/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Root-Revision': revision,
          // The private bridge rewrites these to the trusted loopback endpoint.
          origin: 'root://app',
          'sec-fetch-site': 'same-origin',
        },
        body: JSON.stringify(save),
      }),
      fetch,
    );
  const written = await post('empty');
  assert.equal(written.status, 200);
  assert.equal((await written.json()).ok, true);
  assert.equal((await post('empty')).status, 409);
  assert.equal(JSON.parse(await fs.readFile(path.join(dir, 'save.json'), 'utf8')).seed, save.seed);
  assert.equal((await service.forward(new Request('root://evil/api/save'), fetch)).status, 403);
  assert.equal(
    (await service.forward(new Request('root://app/', { method: 'DELETE' }), fetch)).status,
    405,
  );
  await service.stop();
  assert.equal((await get('/')).status, 503);
});

test('protocol body reader rejects excessive streamed bodies and releases its reader', async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(5));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(readBody({ body }, 4), (error) => error.status === 413);
  assert.equal(cancelled, true);
  assert.equal(body.locked, false);
  assert.equal(await readBody({ body: null }), undefined);
});
