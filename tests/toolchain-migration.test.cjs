'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { ESLint } = require('eslint');
const { FileMatcher } = require('app-builder-lib/out/fileMatcher');

async function fixture(t, files) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'root-toolchain-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(directory, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
  }
  return directory;
}

test('ESLint still finds code in nested/dot paths and excludes ignored files with the migrated matcher', async (t) => {
  const directory = await fixture(t, {
    'src/main.js': 'unknownMain();',
    'src/nested/module.cjs': 'unknownModule();',
    '.config/hidden.js': 'unknownHidden();',
    'src/skip.ignore.js': 'unknownIgnored();',
    'dist/generated.js': 'unknownGenerated();',
    'node_modules/vendor/index.js': 'unknownVendor();',
  });
  const eslint = new ESLint({
    cwd: directory,
    overrideConfigFile: true,
    overrideConfig: [
      { ignores: ['dist/**', '**/*.ignore.@(js|cjs)'] },
      { files: ['**/*.{js,cjs}'], rules: { 'no-undef': 'error' } },
    ],
  });
  const results = await eslint.lintFiles(['**/*.{js,cjs}']);
  assert.deepEqual(
    results.map((result) => path.relative(directory, result.filePath).replaceAll('\\', '/')).sort(),
    ['.config/hidden.js', 'src/main.js', 'src/nested/module.cjs'],
  );
  assert.ok(
    results.every(
      (result) => result.messages.length === 1 && result.messages[0].ruleId === 'no-undef',
    ),
  );
  assert.equal(await eslint.isPathIgnored(path.join(directory, 'dist', 'generated.js')), true);
  assert.equal(await eslint.isPathIgnored(path.join(directory, 'src', 'main.js')), false);
});

test('builder file traversal keeps includes, directory partial matches and private exclusions', async (t) => {
  const directory = await fixture(t, {
    'brand.js': 'public',
    'ui/public.js': 'public',
    'ui/private/secret.js': 'private',
    'data/save.json': 'private',
  });
  const matcher = new FileMatcher(directory, path.join(directory, 'out'), (value) => value, [
    '*.js',
    'ui/**',
    '!ui/private/**',
  ]);
  const filter = matcher.createFilter();
  for (const [name, expected] of [
    ['brand.js', true],
    ['ui', true],
    ['ui/public.js', true],
    ['ui/private/secret.js', false],
    ['data/save.json', false],
  ]) {
    const file = path.join(directory, name);
    assert.equal(filter(file, await fs.stat(file)), expected, name);
  }
});

test('ASAR 4 and Glob 14 preserve contents, dotfiles, Unicode paths and unpacked files', async (t) => {
  const directory = await fixture(t, {
    'source/index.js': 'module.exports = 42;',
    'source/.metadata.json': '{"synthetic":true}',
    'source/assets/Überblick panel.txt': 'synthetic asset',
    'source/native/addon.node': 'inert unpacking fixture',
    'source/secrets/save.json': 'must not be packaged',
  });
  const asar = await import('@electron/asar');
  const archive = path.join(directory, 'application.asar');
  await asar.createPackageWithOptions(path.join(directory, 'source'), archive, {
    globOptions: { cwd: path.join(directory, 'source'), ignore: ['**/secrets/**'] },
    unpack: '**/*.node',
  });
  const names = asar
    .listPackage(archive, { isPack: false })
    .map((name) => name.replaceAll('\\', '/'));
  assert.ok(names.includes('/.metadata.json'));
  assert.ok(names.includes('/assets/Überblick panel.txt'));
  assert.ok(!names.includes('/secrets/save.json'));
  assert.equal(asar.extractFile(archive, 'index.js').toString(), 'module.exports = 42;');
  assert.equal(asar.statFile(archive, 'native/addon.node', false).unpacked, true);
  assert.equal(
    await fs.readFile(archive + '.unpacked/native/addon.node', 'utf8'),
    'inert unpacking fixture',
  );
  asar.uncache(archive);
});

test('the modern template compiler retains the API used by builder MSI manifests', () => {
  const ejs = require('ejs');
  const render = ejs.compile(
    '<Title><%= title %></Title><% for (const item of items) { %><File><%= item %></File><% } %>',
  );
  assert.equal(
    render({ title: 'ROOT & Network OS', items: ['a<.js', 'b.js'] }),
    '<Title>ROOT &amp; Network OS</Title><File>a&lt;.js</File><File>b.js</File>',
  );
});
