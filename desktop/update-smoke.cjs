'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const semver = require('semver');
const { createUpdateController } = require('./updater.cjs');

// Exercise the actual SDK transport/checksum path with inert fixture bytes.
// This is called only by the explicit CLI self-test. Never execute/install them.
async function checkUpdateTransport({ directory, version }) {
  const extension = process.platform === 'win32' ? 'exe' : 'deb';
  const payload = Buffer.from('ROOT inert updater transport fixture\n'.repeat(2048));
  const digest = createHash('sha512').update(payload).digest('base64');
  let corrupt = false;
  const server = http.createServer((request, response) => {
    if (request.url.includes('.yml')) {
      const file = `ROOT-fixture-${corrupt ? 'bad' : 'good'}.${extension}`;
      const hash = corrupt ? createHash('sha512').update('wrong bytes').digest('base64') : digest;
      const metadata = {
        version: semver.inc(version, 'patch'),
        files: [{ url: file, sha512: hash, size: payload.length }],
        path: file,
        sha512: hash,
      };
      response.end(JSON.stringify(metadata));
    } else {
      response.writeHead(200, {
        'Content-Length': payload.length,
        'Content-Type': 'application/octet-stream',
      });
      response.end(payload);
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const url = `http://127.0.0.1:${server.address().port}/`;
  const { NsisUpdater, DebUpdater } = require('electron-updater');
  const Constructor = process.platform === 'win32' ? NsisUpdater : DebUpdater;
  async function exercise(bad) {
    corrupt = bad;
    const config = path.join(directory, bad ? 'bad-update.yml' : 'good-update.yml');
    await fs.writeFile(
      config,
      JSON.stringify({
        provider: 'generic',
        url,
        updaterCacheDirName: bad ? 'ROOT-smoke-bad' : 'ROOT-smoke-good',
      }),
    );
    let checksumFailure = false;
    const controller = createUpdateController({
      version,
      installation: { kind: process.platform === 'win32' ? 'nsis' : 'deb', canUpdate: true },
      preferences: { read: () => ({ autoCheck: false }), update: async () => {} },
      publish() {},
      createUpdater() {
        const sdk = new Constructor({ provider: 'generic', url });
        sdk.logger = null;
        // SDK exposes these explicitly for development/test configuration.
        sdk.forceDevUpdateConfig = true;
        sdk.updateConfigPath = config;
        sdk.disableDifferentialDownload = true;
        sdk.on('error', (error) => {
          if (error.code === 'ERR_CHECKSUM_MISMATCH') checksumFailure = true;
        });
        return sdk;
      },
    });
    try {
      assert.equal((await controller.check()).status, 'available');
      const completed = await controller.download();
      if (bad) {
        assert.equal(completed.status, 'error');
        assert.equal(controller.canInstall(), false);
        assert.equal(checksumFailure, true, 'SDK must reject the actual SHA-512 mismatch');
      } else {
        assert.equal(completed.status, 'downloaded');
        assert.equal(controller.canInstall(), true);
      }
    } finally {
      controller.dispose();
    }
  }
  try {
    await exercise(false);
    await exercise(true);
    return { downloaded: true, corruptPayloadRejected: true, installed: false };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

module.exports = { checkUpdateTransport };
