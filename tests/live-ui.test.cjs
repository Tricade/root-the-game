'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const { grantSpace } = require('./helpers/facility.cjs');
const format = (value) => String(Math.round(value || 0));

test('ordinary live UI updates safely when no device elements are mounted', async () => {
  const { createTelemetryUI } = await import('../ui/telemetry.js');
  const state = E.createState(21);
  let hardwareUpdates = 0,
    roomUpdates = 0;
  const context = {
    state,
    E,
    view: 'overview',
    saveMode: 'saved',
    lastChartTime: -1,
    agentOperations: () => E.getAgentOperations(state),
    pendingAchievements: () => [],
    fmt: format,
    dec: format,
    compact: format,
    clock: format,
    duration: format,
    tr: (value) => value,
    $: () => null,
    $$: () => [],
    R: {
      updateLive(model) {
        assert.ok(model.racks.length);
        hardwareUpdates++;
      },
    },
    Room: {
      isInRoom: () => false,
      update() {
        roomUpdates++;
      },
    },
  };
  createTelemetryUI(context).updateLive();
  assert.equal(hardwareUpdates, 1);
  assert.equal(roomUpdates, 1);
});

test('hardware telemetry indexes DOM attributes once even for a large unmounted fleet', async (t) => {
  const { createRackTelemetry } = await import('../ui/racks/telemetry.js');
  const state = grantSpace(E.createState(22), { rooms: 3 });
  state.sector = 100;
  state.credits = 1e12;
  while (state.servers.length < 120)
    if (!E.act(state, 'buyServer', { type: 'compute' }).ok) assert.ok(E.act(state, 'buyRack').ok);
  let scans = 0;
  const previous = global.document;
  global.document = {
    querySelectorAll() {
      scans++;
      return [];
    },
  };
  t.after(() => {
    if (previous === undefined) delete global.document;
    else global.document = previous;
  });
  const ctx = {
    E,
    state: () => state,
    fmt: format,
    dec: format,
    watts: format,
    speed: format,
    duration: format,
    rackKey: (id, key) => id + ':' + key,
    nodeKey: (id, key) => id + ':' + key,
    names: { online: 'Online' },
    wireLayer: 'network',
    drawCables() {},
  };
  createRackTelemetry(ctx).updateLive(E.getRackModel(state));
  assert.ok(scans <= 25, `only attribute indexes should scan the DOM, got ${scans}`);
});
