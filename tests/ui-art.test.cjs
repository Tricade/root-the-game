'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createStaticFiles } = require('../server/static-files.cjs');
const root = path.resolve(__dirname, '..');

test('all 64 original robot portraits are present, hash-pinned and served from the packaged local texture directory', () => {
  const manifest = require('../asset-pack/docs/personnel-manifest.json');
  const files = createStaticFiles(root);
  assert.equal(manifest.portraits, 64);
  assert.equal(manifest.sheets.length, 4);
  assert.ok(require('../electron-builder.config.cjs').files.includes('asset-pack/textures/**'));
  for (const sheet of manifest.sheets) {
    const file = path.join(root, 'asset-pack', sheet.file),
      data = fs.readFileSync(file);
    assert.equal(createHash('sha256').update(data).digest('hex'), sheet.sha256);
    assert.equal(data.subarray(1, 4).toString(), 'PNG');
    assert.equal(data.readUInt32BE(16), sheet.width);
    assert.equal(data.readUInt32BE(20), sheet.height);
    assert.equal(sheet.rows * sheet.columns, 16);
    const url = '/asset-pack/' + sheet.file;
    assert.ok(files.has(url), url);
    assert.equal(files.get(url)[1], 'image/png');
    assert.equal(path.resolve(root, files.get(url)[0]), file);
  }
});

test('each actual job category and research topic has its own local SVG schematic with no duplicate document IDs or remote sources', async () => {
  const { JOB_ART, RESEARCH_ART, workloadArt } = await import('../ui/workload-art.js');
  const E = require('../engine.js');
  assert.deepEqual(Object.keys(JOB_ART).sort(), Object.keys(E.jobProfiles).sort());
  assert.deepEqual(Object.keys(RESEARCH_ART).sort(), E.catalog.research.map((r) => r.id).sort());
  const diagrams = [
    ...Object.keys(JOB_ART).map((k) => workloadArt(k)),
    ...Object.keys(RESEARCH_ART).map((k) => workloadArt(k, true)),
  ];
  assert.equal(new Set(diagrams).size, 20);
  for (const svg of diagrams) {
    assert.match(svg, /viewBox="0 0 360 120"/);
    assert.match(svg, /aria-hidden="true"/);
    assert.doesNotMatch(svg, /\bid=|https?:|<script|<animate/);
  }
});
