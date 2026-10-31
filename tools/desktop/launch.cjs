'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const flags = process.argv.slice(2);
const smoke = flags.includes('--smoke');
const executableFlag = flags.find((value) => value.startsWith('--executable='));
const executable = executableFlag
  ? path.resolve(executableFlag.slice('--executable='.length))
  : require('electron');
const outputFlag = flags.find((value) => value.startsWith('--output='));
const output = outputFlag
  ? path.resolve(outputFlag.slice('--output='.length))
  : path.join(root, '.desktop-build', 'smoke-' + Date.now());
const args = executableFlag ? [] : [root];
if (smoke) {
  fs.mkdirSync(output, { recursive: true });
  args.push('--self-test', '--test-output=' + output);
}
// Codex and other Electron hosts may export this for their own helpers.
// Child applications must run as Electron, without changing the parent's env.
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
if (smoke) {
  const cache = path.join(output, 'os-cache');
  fs.mkdirSync(cache, { recursive: true });
  env.LOCALAPPDATA = cache;
  env.XDG_CACHE_HOME = cache;
}
const child = spawn(executable, args, { cwd: root, env, stdio: 'inherit', windowsHide: true });
let timeout;
if (smoke)
  timeout = setTimeout(() => {
    child.kill();
    process.exitCode = 1;
  }, 90000);
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
  clearTimeout(timeout);
});
child.on('exit', (code, signal) => {
  clearTimeout(timeout);
  process.exitCode = code === 0 && !signal ? 0 : 1;
  if (smoke) {
    try {
      const report = JSON.parse(fs.readFileSync(path.join(output, 'result.json'), 'utf8'));
      console.log(JSON.stringify(report, null, 2));
      if (!report.ok) process.exitCode = 1;
    } catch {
      console.error('Desktop smoke test produced no completion report.');
      process.exitCode = 1;
    }
  }
});
