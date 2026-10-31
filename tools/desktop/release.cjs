'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { version } = require('../../package.json');

async function main() {
  const tag = process.env.GITHUB_REF_NAME;
  if (tag !== 'v' + version) throw new Error('Release tag must match package.json');
  const dir = path.resolve('dist');
  const expected = [
    `ROOT-${version}-windows-x64-setup.exe`,
    `ROOT-${version}-windows-x64-setup.exe.blockmap`,
    `ROOT-${version}-windows-x64-portable.exe`,
    `ROOT-${version}-linux-x64.deb`,
    `ROOT-${version}-linux-x64-portable.AppImage`,
    'latest.yml',
    'latest-linux.yml',
  ];
  const checksums = [];
  for (const name of expected) {
    const bytes = await fs.readFile(path.join(dir, name));
    if (!bytes.length) throw new Error('Empty release asset: ' + name);
    checksums.push(createHash('sha256').update(bytes).digest('hex') + '  ' + name);
  }
  await fs.writeFile(path.join(dir, 'SHA256SUMS.txt'), checksums.join('\n') + '\n');
  // gh stages asset uploads in a draft and publishes only after they succeed.
  // Do not clobber an existing release; a failed draft requires review.
  const command = spawnSync(
    'gh',
    [
      'release',
      'create',
      tag,
      ...expected.map((name) => path.join(dir, name)),
      path.join(dir, 'SHA256SUMS.txt'),
      '--verify-tag',
      '--title',
      'ROOT Cyberbunker ' + version,
      '--notes-file',
      'docs/releases/v' + version + '.md',
      '--latest',
    ],
    { stdio: 'inherit', shell: false },
  );
  if (command.error) throw command.error;
  if (command.status !== 0) throw new Error('Release publication did not complete');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
