'use strict';

// Explicit CLI diagnostics use a fresh synthetic profile, never a real save.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

async function runSelfTest({ app, output, startDesktop }) {
  await fs.mkdir(output, { recursive: true });
  const result = { ok: false, version: app.getVersion(), runtime: { ...process.versions } };
  const write = () =>
    fs.writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  const deadline = setTimeout(async () => {
    result.error = 'Desktop did not finish within 60 seconds';
    await write();
    app.exit(1);
  }, 60000);
  async function fail(error) {
    clearTimeout(deadline);
    result.error = error.message;
    await write();
    app.exit(1);
  }
  await startDesktop({
    profile: path.join(output, 'synthetic-profile'),
    hidden: true,
    smoke: true,
    onReady(context) {
      inspect(context).catch(fail);
    },
    async beforeQuit({ saved }) {
      assert.equal(saved, true, 'Renderer must confirm its last disk save');
      result.ok = true;
      await write();
      clearTimeout(deadline);
    },
  }).catch(fail);

  async function inspect({ window, installation, close, reload, dataDir }) {
    const contents = window.webContents;
    result.installation = installation.kind;
    if (process.env.ROOT_EXPECT_INSTALLATION)
      assert.equal(installation.kind, process.env.ROOT_EXPECT_INSTALLATION);
    const initial = await contents.executeJavaScript(`(async () => {
      const health = await (await fetch('/api/health')).json();
      const stored = await (await fetch('/api/save')).json();
      const info = await window.rootDesktop.info();
      localStorage.setItem('root.desktop.smoke', 'retained');
      return { origin: location.origin, node: typeof process, require: typeof require,
        health, network: stored.save.networkName, servers: stored.save.servers.length,
        racks: stored.save.facility.racks.length, canUpdate: info.canUpdate,
        settingsButton: Boolean(document.querySelector('[data-modal="settings"]')) };
    })()`);
    assert.equal(initial.origin, 'root://app');
    assert.equal(initial.node, 'undefined');
    assert.equal(initial.require, 'undefined');
    assert.equal(initial.health.release, app.getVersion());
    assert.equal(initial.servers, 1);
    assert.equal(initial.racks, 1);
    assert.equal(initial.settingsButton, true);
    assert.equal(initial.canUpdate, ['nsis', 'deb'].includes(installation.kind));
    result.initial = initial;
    // Reload the same origin while the loopback service keeps its ephemeral port.
    assert.equal(await reload(), true);
    const reloaded = await contents.executeJavaScript(`(async () => {
      const saved = await (await fetch('/api/save')).json();
      return { marker: localStorage.getItem('root.desktop.smoke'), network: saved.save.networkName };
    })()`);
    assert.equal(reloaded.marker, 'retained');
    assert.equal(reloaded.network, initial.network);
    // The boot-ready bridge fires once per renderer. Wait for the real settings
    // control rather than treating did-finish-load as simulation readiness.
    await contents.executeJavaScript(`new Promise((resolve, reject) => {
      if (document.querySelector('[data-modal="settings"]')) return resolve();
      const deadline = setTimeout(() => { observer.disconnect(); reject(new Error('UI boot timeout')); }, 15000);
      const observer = new MutationObserver(() => {
        if (!document.querySelector('[data-modal="settings"]')) return;
        clearTimeout(deadline); observer.disconnect(); resolve();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    })`);
    await contents.executeJavaScript(`document.querySelector('[data-modal="settings"]').click()`);
    const settings = await contents.executeJavaScript(`({
      visible: Boolean(document.querySelector('[data-desktop-section]')),
      checkVisible: !document.querySelector('[data-desktop-command="check"]').hidden,
      installHidden: document.querySelector('[data-desktop-command="install"]').hidden,
      downloadHidden: document.querySelector('[data-desktop-command="download"]').hidden,
    })`);
    assert.equal(settings.visible, true);
    assert.equal(settings.checkVisible, initial.canUpdate);
    assert.equal(settings.installHidden, true);
    assert.equal(settings.downloadHidden, true);
    result.settings = settings;
    await contents.executeJavaScript(
      'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
    );
    const image = await contents.capturePage();
    await fs.writeFile(path.join(output, 'desktop.png'), image.toPNG());
    const save = JSON.parse(await fs.readFile(path.join(dataDir, 'save.json'), 'utf8'));
    assert.equal(save.networkName, initial.network);
    assert.equal(save.servers.length, 1);
    result.saved = true;
    result.reloaded = reloaded;
    // Completion is written only after the renderer confirms the final disk save.
    const accepted = await close();
    assert.equal(accepted, true);
  }
}

module.exports = { runSelfTest };
