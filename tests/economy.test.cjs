'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

test('automation adds revenue percentage points rather than compounding previous levels', () => {
  const state = E.createState(510),
    base = E.getMetrics(state);
  const gross = base.incomePerSecond + base.upkeep;
  for (const level of [0, 1, 2, 14, 20, 1000]) {
    state.upgrades.automation = level;
    const current = E.getMetrics(state);
    assert.ok(
      Math.abs((current.incomePerSecond + current.upkeep) / gross - (1 + level * 0.09)) < 1e-10,
    );
  }
});

test('early reputation income is preserved and the high-reputation tail has diminishing returns', () => {
  const state = E.createState(511);
  state.reputation = 0;
  const baseline = E.getMetrics(state).incomePerSecond;
  for (const rep of [12, 100, 999, 1000]) {
    state.reputation = rep;
    assert.ok(Math.abs(E.getMetrics(state).incomePerSecond - baseline - rep * 0.002) < 1e-10);
  }
  state.reputation = 1000;
  const low = E.getMetrics(state).incomePerSecond;
  state.reputation = 10000;
  const middle = E.getMetrics(state).incomePerSecond;
  state.reputation = 1000000;
  const high = E.getMetrics(state).incomePerSecond;
  assert.ok(high > middle && middle > low);
  assert.ok((high - middle) / 990000 < (middle - low) / 9000);
  assert.ok(
    high - baseline < 30,
    'one million reputation cannot mint thousands of passive credits/s',
  );
});

test('loading an existing wealthy network preserves accumulated money and research', () => {
  const state = E.createState(512);
  state.credits = 14294145;
  state.reputation = 41087;
  state.research = 132038;
  state.upgrades.automation = 14;
  const restored = E.normalizeState(state);
  assert.equal(restored.credits, state.credits);
  assert.equal(restored.research, state.research);
  assert.equal(restored.reputation, state.reputation);
  assert.equal(restored.upgrades.automation, 14);
  assert.ok(Number.isFinite(E.getMetrics(restored).incomePerSecond));
});
