'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const { grantSpace } = require('./helpers/facility.cjs');
const { loadBrowserEngine } = require('./helpers/browser-engine.cjs');

function fleet(engine) {
  const state = grantSpace(engine.createState(31), { rooms: 3 });
  state.sector = 100;
  state.credits = 1e12;
  while (state.servers.length < 120) {
    if (!engine.act(state, 'buyServer', { type: 'compute' }).ok)
      assert.ok(engine.act(state, 'buyRack').ok);
  }
  return state;
}

test('shared read models agree with fresh models without retaining stale state', () => {
  const state = E.createState(17);
  state.credits = 1e9;
  for (const mutate of [
    () => {},
    () => {
      state.servers[0].powered = false;
    },
    () => {
      state.servers[0].powered = true;
      state.servers[0].bootRemaining = 15;
    },
    () => {
      state.servers[0].bootRemaining = 0;
      state.servers[0].status = 'failed';
    },
  ]) {
    mutate();
    const before = JSON.stringify(state),
      metrics = E.getMetrics(state),
      racks = E.getRackModel(state, metrics);
    assert.deepEqual(racks, E.getRackModel(state));
    assert.deepEqual(E.getResilience(state, racks, metrics), E.getResilience(state));
    assert.equal(JSON.stringify(state), before);
  }
});

test('protection overview computes metrics and rack model once through the actual browser modules', () => {
  const { engine, calls } = loadBrowserEngine(['getMetrics', 'getRackModel']);
  const state = fleet(engine);
  calls.getMetrics = calls.getRackModel = 0;
  assert.equal(engine.getResilience(state).servers.length, 120);
  assert.equal(calls.getMetrics, 1);
  assert.equal(calls.getRackModel, 1);
});

test('browser script order and Node facade produce the same actions, state and construction progress', () => {
  const { engine } = loadBrowserEngine();
  const a = E.normalizeState(E.createState(29));
  a.sector = 8;
  a.credits = 1e9;
  a.resilience.graceUntil = 1e9;
  const b = engine.normalizeState(structuredClone(a));
  for (const [action, payload] of [
    ['buildFloor', {}],
    ['buyRack', {}],
    ['buyServer', { type: 'compute' }],
  ]) {
    assert.equal(
      JSON.stringify(E.act(a, action, payload)),
      JSON.stringify(engine.act(b, action, payload)),
    );
  }
  E.advance(a, 7.25);
  engine.advance(b, 7.25);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
  assert.equal(JSON.stringify(E.getMetrics(a)), JSON.stringify(engine.getMetrics(b)));
});

test('fleet read models do not search the full rack array for every server', () => {
  const state = fleet(E);
  let searches = 0;
  state.facility.racks.find = function (...args) {
    searches++;
    return Array.prototype.find.apply(this, args);
  };
  E.getMetrics(state);
  E.getRackModel(state);
  E.getResilience(state);
  assert.ok(searches <= 5, `rack searches must stay bounded, got ${searches}`);
});
