'use strict';

// electron-winstaller 5.4.0 uses only temp.track() and promisify(temp.mkdir)
// with the prefix "si-". Replace its unmaintained rimraf/glob subtree with
// Node's exclusive directory creation and literal-path cleanup. This is a
// project-owned provider, not a general implementation of the temp package.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = fs.realpathSync(os.tmpdir());
const tracked = new Set();
let tracking = false;
let listening = false;

function track(enabled = true) {
  tracking = enabled !== false;
  if (tracking && !listening) {
    process.once('exit', cleanupSync);
    listening = true;
  }
  return module.exports;
}

function mkdir(prefix, callback) {
  if (typeof prefix === 'function') {
    callback = prefix;
    prefix = undefined;
  }
  if (typeof callback !== 'function') throw new TypeError('mkdir requires a callback');
  prefix ??= 'root-build-';
  if (typeof prefix !== 'string' || !prefix || /[/\\\0]/.test(prefix) || /^\.\.?$/.test(prefix)) {
    queueMicrotask(() => callback(new TypeError('Expected a literal temporary-directory prefix')));
    return;
  }
  fs.mkdtemp(path.join(root, prefix), (error, directory) => {
    if (!error && tracking) tracked.add(directory);
    callback(error, directory);
  });
}

function cleanupSync() {
  let count = 0;
  for (const directory of tracked) {
    const target = path.resolve(directory);
    const relative = path.relative(root, target);
    if (
      !relative ||
      relative === '..' ||
      relative.startsWith('..' + path.sep) ||
      path.isAbsolute(relative)
    ) {
      throw new Error('Refusing cleanup outside the temporary-directory root');
    }
    // rm removes a substituted symlink itself instead of traversing its target.
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 });
    tracked.delete(directory);
    count++;
  }
  return { dirs: count, files: 0 };
}

module.exports = { track, mkdir, cleanupSync };
