'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Execute the actual classic-script order, not a second hand-maintained bundle.
function loadBrowserEngine(instrument = []) {
  const root = path.resolve(__dirname, '../..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const files = [...html.matchAll(/<script src="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((file) => file === 'engine.js' || file.startsWith('engine/'));
  const sandbox = vm.createContext({
    calls: Object.fromEntries(instrument.map((name) => [name, 0])),
  });
  for (const file of files) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
    if (!file.startsWith('engine/')) continue;
    const key = path.basename(file, '.js'),
      factory = sandbox.RootEngineModules[key];
    sandbox.RootEngineModules[key] = (context) => {
      const methods = factory(context);
      for (const name of instrument)
        if (typeof methods[name] === 'function') {
          const original = methods[name];
          methods[name] = (...args) => {
            sandbox.calls[name]++;
            return original(...args);
          };
        }
      return methods;
    };
  }
  return { engine: sandbox.RootEngine, calls: sandbox.calls, files };
}
module.exports = { loadBrowserEngine };
