const test = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs/promises'),
  path = require('node:path'),
  os = require('node:os');
const { execFile } = require('node:child_process'),
  { promisify } = require('node:util');
const run = promisify(execFile),
  root = path.resolve(__dirname, '..');
const tool = path.join(root, 'tools/asset-generator/generate.mjs');

async function temporary(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ROOT-asset-tool-'));
  t.after(async () => {
    const resolved = path.resolve(directory),
      temp = path.resolve(os.tmpdir()) + path.sep;
    assert.ok(resolved.startsWith(temp) && path.basename(resolved).startsWith('ROOT-asset-tool-'));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  return directory;
}
const build = (...args) =>
  run(process.execPath, [tool, ...args], { cwd: root, timeout: 20000, maxBuffer: 1024 * 1024 });

test('asset wrapper refuses runtime directories and preserves nonempty outputs', async (t) => {
  const directory = await temporary(t),
    sentinel = path.join(directory, 'keep.txt');
  await fs.writeFile(sentinel, 'unchanged');
  await assert.rejects(build('interiors', '--out', directory), (error) =>
    /not empty/.test(error.stderr),
  );
  assert.equal(await fs.readFile(sentinel, 'utf8'), 'unchanged');
  for (const destination of [root, path.join(root, 'asset-pack'), path.dirname(root)]) {
    await assert.rejects(build('interiors', '--out', destination), (error) =>
      /Runtime assets cannot be a build target/.test(error.stderr),
    );
  }
});

test('asset wrapper produces portable original furniture without changing the runtime pack', async (t) => {
  const directory = await temporary(t),
    destination = path.join(directory, 'output with spaces');
  const original = await fs.readFile(path.join(root, 'asset-pack/assets/interiors/sofa.glb'));
  const result = await build('interiors', '--out', destination);
  assert.match(result.stdout, /Built interiors/);
  assert.deepEqual(
    await fs.readFile(path.join(destination, 'asset-pack/assets/interiors/sofa.glb')),
    original,
  );
  assert.deepEqual(
    await fs.readFile(path.join(root, 'asset-pack/assets/interiors/sofa.glb')),
    original,
  );
  for (const key of ['chair', 'sofa', 'coffee', 'plant']) {
    const file = path.join(destination, 'asset-pack/assets/interiors', key + '.glb'),
      bytes = await fs.readFile(file);
    const document = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
    for (const image of document.images || [])
      if (image.uri) await fs.access(path.resolve(path.dirname(file), image.uri));
    await fs.access(path.join(destination, 'asset-pack/source/interiors', key + '.gltf'));
    await fs.access(path.join(destination, 'asset-pack/source/interiors', key + '.bin'));
  }
  await fs.access(path.join(destination, 'SUPPLIED-LICENSE.md'));
  await fs.access(path.join(destination, 'NOTICE.md'));
  assert.match(
    await fs.readFile(path.join(destination, 'ASSET-LICENSE.txt'), 'utf8'),
    /CC0 1.0 Universal/,
  );
  assert.match(
    await fs.readFile(path.join(destination, 'CODE-LICENSE.txt'), 'utf8'),
    /MIT License/,
  );
});

test('asset help and invalid targets do not create output', async (t) => {
  const directory = await temporary(t),
    destination = path.join(directory, 'absent');
  assert.match((await build('--help')).stdout, /No network requests/);
  await assert.rejects(build('unknown', '--out', destination), (error) =>
    /Choose base/.test(error.stderr),
  );
  await assert.rejects(fs.access(destination));
});
