'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('the limited temp provider is used only by its reviewed installer consumer', () => {
  const lock = require('../package-lock.json');
  const consumers = Object.entries(lock.packages)
    .filter(([, metadata]) => metadata.dependencies?.temp)
    .map(([location]) => location);
  assert.deepEqual(consumers, ['node_modules/electron-winstaller']);
  assert.equal(lock.packages[consumers[0]].version, '5.4.0');
});

async function run(t, code) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'root-temp-provider-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const child = spawnSync(process.execPath, ['-e', code], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, TMPDIR: directory, TMP: directory, TEMP: directory },
    encoding: 'utf8',
    timeout: 10000,
    windowsHide: true,
  });
  assert.equal(child.status, 0, child.stderr);
  return { directory, result: JSON.parse(child.stdout) };
}

test('the real installer consumer receives unique tracked directories and exit cleanup', async (t) => {
  const { directory, result } = await run(
    t,
    `
    const assert = require('node:assert/strict');
    const { createTempDir } = require('electron-winstaller/lib/temp-utils');
    const fs = require('node:fs');
    (async () => {
      const a = await createTempDir('si-');
      const b = await createTempDir('si-');
      assert.notEqual(a, b);
      fs.writeFileSync(require('node:path').join(a, 'fixture'), 'synthetic');
      assert(fs.statSync(b).isDirectory());
      console.log(JSON.stringify({ a, b }));
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `,
  );
  for (const created of [result.a, result.b]) {
    // Windows can expose the same parent with a DOS short name or a long name.
    // Resolve both sides with the same native filesystem API before comparing.
    assert.equal(await fs.realpath(path.dirname(created)), await fs.realpath(directory));
    assert.match(path.basename(created), /^si-/);
    await assert.rejects(fs.stat(created), { code: 'ENOENT' });
  }
});

test('temp cleanup treats glob characters literally and preserves the target of a replaced directory link', async (t) => {
  const { result } = await run(
    t,
    `
    const assert = require('node:assert/strict');
    const fs = require('node:fs');
    const path = require('node:path');
    const os = require('node:os');
    const temp = require('./tools/desktop/build-temp');
    const mkdir = require('node:util').promisify(temp.mkdir);
    temp.track();
    (async () => {
      const created = await mkdir('si-[literal]-');
      const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'untracked-'));
      const sentinel = path.join(outside, 'sentinel');
      fs.writeFileSync(sentinel, 'preserve');
      fs.rmdirSync(created);
      fs.symlinkSync(outside, created, process.platform === 'win32' ? 'junction' : 'dir');
      temp.cleanupSync();
      assert.equal(fs.readFileSync(sentinel, 'utf8'), 'preserve');
      assert.equal(fs.existsSync(created), false);
      await assert.rejects(mkdir('../escape'), TypeError);
      console.log(JSON.stringify({ sentinel, preserved: true }));
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `,
  );
  assert.equal(result.preserved, true);
  assert.equal(await fs.readFile(result.sentinel, 'utf8'), 'preserve');
});

test('filesystem creation errors reject the actual installer helper promise', async (t) => {
  const { result } = await run(
    t,
    `
    const assert = require('node:assert/strict');
    const fs = require('node:fs');
    const os = require('node:os');
    const { createTempDir } = require('electron-winstaller/lib/temp-utils');
    (async () => {
      const root = os.tmpdir();
      // The per-child test root is empty. Simulate a cleaner removing it
      // after the provider resolved its root but before directory creation.
      fs.rmdirSync(root);
      try { await assert.rejects(createTempDir('si-'), { code: 'ENOENT' }); }
      finally { fs.mkdirSync(root); }
      console.log(JSON.stringify({ rejected: true }));
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `,
  );
  assert.equal(result.rejected, true);
});
