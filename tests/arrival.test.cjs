'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

async function harness() {
  const { createRoomLocation } = await import('../room/location.js');
  const events = [],
    storage = new Map();
  const context = {
    arrival: { dispose: () => events.push('dispose') },
    arrivalOverlay: { hidden: false },
    shell: { classList: { remove: (value) => events.push(value) } },
    exploring: false,
    mounted: true,
    hidden: false,
    pendingSession: null,
    camera: { position: { toArray: () => [0, 2.25, 3.9] } },
    locationId: 'hall',
    selectedFloor: 1,
    yaw: 0,
    pitch: 0,
    sizeRenderer: () => events.push('resize'),
    startExploration: () => {
      throw new Error('Intro must not start a walkthrough');
    },
    onArrivalComplete: () => events.push('dashboard'),
    syncAnimation: () => events.push('animation'),
  };
  const room = createRoomLocation(context, {
    document: { body: { classList: { remove: (value) => events.push(value) } } },
    sessionStorage: { setItem: (key, value) => storage.set(key, JSON.parse(value)) },
    performance: { now: () => 42 },
  });
  return { room, context, events, storage };
}

test('completed or skipped arrival returns to dashboard and records preview mode without entering 3D', async () => {
  const h = await harness();
  h.room.finishArrival();
  assert.equal(h.context.arrival, null);
  assert.equal(h.context.arrivalOverlay.hidden, true);
  assert.equal(h.context.exploring, false);
  assert.equal(h.storage.get('root.room.view').exploring, false);
  assert.equal(h.events.filter((item) => item === 'dashboard').length, 1);
  assert.ok(h.events.includes('root-room-open'));
  h.room.finishArrival();
  assert.equal(h.events.filter((item) => item === 'dashboard').length, 1);
});

test('cancelling arrival during navigation never overrides the chosen page or stored view', async () => {
  const h = await harness();
  h.room.finishArrival(false);
  assert.equal(h.context.arrivalOverlay.hidden, true);
  assert.equal(h.events.includes('dashboard'), false);
  assert.equal(h.storage.size, 0);
});
