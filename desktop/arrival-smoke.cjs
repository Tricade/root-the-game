'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const BRAND = require('../brand.js');

// Observe real renderer transitions; no synthetic timer advancement or state
// mutation substitutes for the intro finishing and the dashboard appearing.
async function checkArrival({ window, output }) {
  const contents = window.webContents;
  if (process.env.ROOT_CAPTURE_INTRO === '1')
    await contents.executeJavaScript("window.ROOTI18N.setLanguage('en')");
  const evaluate = (code) => contents.executeJavaScript(code);
  const waitFor = (predicate) =>
    evaluate(`new Promise((resolve, reject) => {
    const ready = () => Boolean(${predicate});
    if (ready()) return resolve();
    const deadline = setTimeout(() => { observer.disconnect(); reject(new Error('Arrival transition timeout')); }, 25000);
    const observer = new MutationObserver(() => {
      if (!ready()) return;
      clearTimeout(deadline); observer.disconnect(); resolve();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  })`);
  assert.equal(window.getTitle(), BRAND.title);
  const reducedMotion = await evaluate(`matchMedia('(prefers-reduced-motion: reduce)').matches`);
  if (reducedMotion) {
    assert.equal(await evaluate(`document.body.classList.contains('root-room-open')`), false);
    return { reducedMotion: true, dashboard: true };
  }
  await waitFor(`document.querySelector('.root-room.arriving')`);
  const branding = await evaluate(`({ title: document.title,
    mark: document.querySelector('.arrival-brand h2').textContent,
    label: document.querySelector('.arrival-brand-label').textContent,
    accessible: document.querySelector('.arrival-brand').getAttribute('aria-label') })`);
  assert.equal(branding.title, BRAND.title);
  assert.equal(branding.mark, 'root.');
  assert.equal(branding.label, BRAND.label);
  assert.equal(branding.accessible, BRAND.title);
  const frames = path.join(output, 'intro-frames');
  const recording = process.env.ROOT_CAPTURE_INTRO === '1';
  if (recording) await fs.mkdir(frames, { recursive: true });
  let count = 0;
  const writes = [];
  const timestamps = [];
  let lastFrame = -Infinity;
  let captureStyle;
  if (recording) {
    // Native presentation frames avoid slowing the real intro with sequential
    // capturePage readbacks. Capture-only styling keeps achievement toasts out
    // of the documentation; normal diagnostics and application UI are intact.
    captureStyle = await contents.insertCSS('#toast-root { visibility: hidden !important; }');
    contents.beginFrameSubscription(false, (image) => {
      const now = performance.now();
      if (now - lastFrame < 95 || count >= 160) return;
      lastFrame = now;
      timestamps.push(now);
      writes.push(
        fs.writeFile(
          path.join(frames, String(count++).padStart(3, '0') + '.png'),
          image.resize({ width: 1200 }).toPNG(),
        ),
      );
    });
  }
  try {
    await waitFor(`!document.querySelector('.root-room.arriving')`);
  } finally {
    if (recording) {
      contents.endFrameSubscription();
      await contents.removeInsertedCSS(captureStyle);
      await Promise.all(writes);
      await fs.writeFile(path.join(frames, 'timestamps.json'), JSON.stringify(timestamps));
    }
  }
  const dashboard = () =>
    evaluate(`!document.body.classList.contains('root-room-open') &&
    !document.querySelector('.root-room.exploring') &&
    Boolean(document.querySelector('#main h1')) &&
    Boolean(document.querySelector('[data-nav="overview"].active'))`);
  assert.equal(await dashboard(), true);
  await evaluate(
    `document.querySelector('[data-modal="settings"]').click(); document.querySelector('[data-command="replay-arrival"]').click();`,
  );
  await waitFor(`document.querySelector('.root-room.arriving')`);
  await evaluate(`document.querySelector('[data-arrival-skip]').click()`);
  await waitFor(`!document.querySelector('.root-room.arriving')`);
  assert.equal(await dashboard(), true);
  // The user can deliberately enter after either completion path.
  await evaluate(`document.querySelector('[data-room-enter]').click()`);
  await waitFor(`document.querySelector('.root-room.exploring')`);
  return {
    dashboard: true,
    skipReturnsToDashboard: true,
    deliberateWalkthrough: true,
    frames: count,
    branding,
  };
}

module.exports = { checkArrival };
