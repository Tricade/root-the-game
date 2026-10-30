const { grantSpace } = require('./helpers/facility.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

test('tab view restores owned rooms and floors, rejecting stale or malformed destinations', async () => {
  const { readRoomSession } = await import('../room.js');
  const state = E.createState();
  state.sector = 30;
  state.facility.racks = Array.from({ length: 25 }, (_, i) => ({
    ...state.facility.racks[0],
    id: 'rack-' + (i + 1),
  }));
  grantSpace(state, { specialRooms: ['control', 'ups'] });
  const layout = E.getFacilityLayout(state),
    central = E.getCentralInfrastructure(state);
  const view = {
    version: 1,
    id: 'room-5',
    floor: 2,
    exploring: true,
    position: [0.5, 1.62, -1.8],
    yaw: 1.1,
    pitch: -0.1,
  };
  const read = (value) =>
    readRoomSession({ getItem: () => JSON.stringify(value) }, layout, central);
  assert.deepEqual(
    read(view),
    Object.fromEntries(Object.entries(view).filter(([key]) => key !== 'version')),
  );
  assert.equal(read({ ...view, id: 'room-6' }), null, 'removed room is not resurrected');
  assert.equal(read({ ...view, floor: 1 }), null, 'a room cannot move to another floor');
  assert.equal(read({ ...view, id: 'hall', floor: 3 }), null, 'unowned floor is rejected');
  assert.equal(read({ ...view, id: 'hall', floor: 1.2 }), null);
  assert.equal(read({ ...view, id: 'ups', floor: 1 }).id, 'ups');
  assert.equal(
    readRoomSession({ getItem: () => JSON.stringify({ ...view, id: 'ups', floor: 1 }) }, layout, {
      systems: central.systems.map((s) => ({ ...s, available: false })),
    }),
    null,
    'locked plant rooms cannot be restored',
  );
  for (const position of [
    [1, null, 2],
    [1, 2],
    ['0', 1, 2],
  ])
    assert.equal(read({ ...view, position }), null);
  assert.equal(read({ ...view, version: 99 }), null);
  assert.equal(
    readRoomSession(
      {
        getItem() {
          throw new Error('storage blocked');
        },
      },
      layout,
      central,
    ),
    null,
  );
  assert.equal(readRoomSession({ getItem: () => '{broken' }, layout, central), null);
});

test('real session writer and restore retain mode and orientation; blocked positions use a safe entrance', async () => {
  const THREE = await import('../vendor/three.module.js');
  const { createRoomLocation } = await import('../room/location.js');
  let stored, restored;
  const context = {
    camera: new THREE.PerspectiveCamera(),
    mounted: true,
    hidden: false,
    arrival: null,
    pendingSession: null,
    locationId: 'control',
    selectedFloor: 1,
    exploring: true,
    yaw: 0.7,
    pitch: 0.14,
    eyeHeight: 1.62,
    lastSessionValue: '',
    performance: { now: () => 42 },
    sessionStorage: {
      setItem(key, value) {
        assert.equal(key, 'root.room.view');
        stored = JSON.parse(value);
      },
    },
    canStand: (x, z) => x === 0.5 && z === 2,
    facilityInterior: { stairAt: () => null },
    assetBank: {},
    startExploration(pointer, view) {
      assert.equal(pointer, false, 'refresh does not request pointer lock');
      restored = view;
    },
  };
  Object.assign(context, createRoomLocation(context, context));
  context.camera.position.set(0.5, 1.62, 2);
  context.saveRoomSession();
  assert.deepEqual(stored, {
    version: 1,
    id: 'control',
    floor: 1,
    exploring: true,
    position: [0.5, 1.62, 2],
    yaw: 0.7,
    pitch: 0.14,
  });
  context.pendingSession = stored;
  context.applyRoomSession();
  assert.deepEqual(restored.position, [0.5, 1.62, 2]);
  assert.equal(restored.yaw, 0.7);
  assert.equal(restored.pitch, 0.14);
  context.pendingSession = { ...stored, position: [99, 999, 99] };
  context.applyRoomSession();
  assert.equal(JSON.stringify(restored.position), JSON.stringify([0, 1.62, 4.6]));
  context.pendingSession = stored;
  context.hidden = true;
  restored = null;
  context.applyRoomSession();
  assert.equal(restored, null);
  context.hidden = false;
  context.pendingSession = { ...stored, exploring: false };
  context.applyRoomSession();
  assert.deepEqual(
    context.camera.position.toArray(),
    [0, 2.25, 3],
    'web preview keeps its room and uses its overview camera',
  );
  context.sessionStorage.setItem = () => {
    throw new Error('quota');
  };
  assert.doesNotThrow(() => context.saveRoomSession());
});
