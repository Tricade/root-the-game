'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const asar = require('@electron/asar');

const resources = path.resolve(process.argv[2]);
const archive = path.join(resources, 'app.asar');
const files = asar.listPackage(archive).map((file) => file.replaceAll('\\', '/'));
for (const file of files) {
  assert.ok(
    !/^\/(?:data|tests|tools|screenshots|\.git|\.local-data|\.desktop-build)(?:\/|$)/.test(file),
    'Private/build source in package: ' + file,
  );
  assert.ok(
    !/^\/asset-pack\/(?:source|docs\/runtime_inventory)/.test(file),
    'Build assets in runtime: ' + file,
  );
}
for (const file of [
  '/desktop/main.cjs',
  '/desktop/preload.cjs',
  '/ui/desktop.js',
  '/server.cjs',
  '/engine.js',
  '/vendor/LICENSE',
  '/LICENSE',
])
  assert.ok(files.includes(file), 'Missing runtime file: ' + file);
const metadata = JSON.parse(asar.extractFile(archive, 'package.json').toString());
assert.equal(metadata.author.name, 'Tricade');
assert.equal(metadata.author.email, '6281655+Tricade@users.noreply.github.com');
assert.equal(metadata.version, require('../../package.json').version);
assert.ok(files.some((file) => file.startsWith('/node_modules/electron-updater/')));
assert.ok(!files.some((file) => file.startsWith('/node_modules/electron-builder/')));
for (const file of ['LICENSE.electron.txt', 'LICENSES.chromium.html'])
  assert.ok(fs.existsSync(path.join(resources, '..', file)), 'Missing framework notices: ' + file);
console.log('Packaged runtime, save exclusion, public identity and framework notices verified.');
