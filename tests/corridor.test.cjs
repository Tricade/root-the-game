'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const threePromise = import('../vendor/three.module.js');
const facilityPromise = import('../room-facility.js');

function testCanvasDocument() {
  const context = {
    fillStyle: '',
    font: '',
    fillRect() {},
    fillText() {},
  };
  return {
    createElement(name) {
      assert.equal(name, 'canvas');
      return { width: 0, height: 0, getContext: (kind) => (kind === '2d' ? context : null) };
    },
  };
}

function fakeBank(THREE) {
  return {
    make(key) {
      const root = new THREE.Group();
      root.name = `fake-${key}`;
      if (key === 'airlock') {
        const hinge = new THREE.Group();
        hinge.name = 'bunker_door_hinge';
        root.add(hinge);
      }
      return root;
    },
  };
}

function makeMaterials(THREE) {
  const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  return {
    bunkerConcrete: mat(0x888888),
    bunkerSteel: mat(0x777777),
    bunkerFloor: mat(0x666666),
    floor: mat(0x666666),
    wall: mat(0x888888),
    brushed: mat(0x777777),
    shellDark: mat(0x222222),
    lightWhite: mat(0xffffff),
  };
}

function centralWithAllSystems() {
  return {
    systems: [
      { id: 'cooling', name: 'Kühlung', available: true, level: 1 },
      { id: 'ups', name: 'USV', available: true, level: 1 },
      { id: 'distribution', name: 'Verteilung', available: true, level: 1 },
    ],
  };
}

function layoutWithFloors(floorCount) {
  const rooms = Array.from({ length: floorCount * 4 }, (_, index) => ({
    id: `room-${index + 1}`,
    floor: Math.floor(index / 4) + 1,
    number: index + 1,
    rackIds: [`rack-${index + 1}`],
    rackCount: 1,
    serverCount: 0,
  }));
  return { rooms, floorCount };
}

test('local terminals face the free entrance wall and route to the map, room hardware or plant controls', async (t) => {
  const [THREE, { buildFacilityInterior, roomLocation }] = await Promise.all([
    threePromise,
    facilityPromise,
  ]);
  const previous = globalThis.document;
  globalThis.document = testCanvasDocument();
  t.after(() => {
    globalThis.document = previous;
  });
  const layout = layoutWithFloors(2),
    central = centralWithAllSystems();
  for (const [id, view] of [
    ['hall', 'facility'],
    ['room-5', 'network'],
    ['cooling', 'facility'],
    ['ups', 'facility'],
    ['distribution', 'facility'],
  ]) {
    const scene = new THREE.Group(),
      location = roomLocation(layout, id, 2);
    const interior = buildFacilityInterior({
      bank: fakeBank(THREE),
      scene,
      materials: makeMaterials(THREE),
      location,
      layout,
      central,
    });
    scene.updateMatrixWorld(true);
    const terminal = interior.picks.find((pick) => pick.userData.roomKind === 'station');
    assert.equal(terminal.userData.view, view);
    const at = terminal.getWorldPosition(new THREE.Vector3());
    assert.ok(
      at.z > (id === 'hall' ? 4.4 : 4.9),
      'terminal is on the entrance wall, clear of equipment and service ribs',
    );
    assert.ok(at.y > 1 && at.y < 1.6, 'display is at an accessible eye-level height');
    const origin = new THREE.Vector3(at.x, 1.4, at.z - 0.7);
    const hits = new THREE.Raycaster(
      origin,
      at.clone().sub(origin).normalize(),
      0,
      1.5,
    ).intersectObjects([terminal], false);
    assert.ok(hits.length, 'screen faces into the room and is reachable from its walking area');
    if (id === 'room-5')
      assert.equal(
        terminal.userData.rackId,
        location.rackIds[0],
        'hardware opens a rack in this room',
      );
    interior.dispose();
  }
});

test('terminal activation selects local hardware and opens the corridor navigator without a console detour', async () => {
  const { createRoomLocation } = await import('../room/location.js');
  const calls = [];
  const context = {
    keys: {
      clear() {
        calls.push('clear');
      },
    },
    shell: {
      classList: {
        add(value) {
          calls.push(value);
        },
      },
    },
    placeNav: {
      querySelector(selector) {
        return {
          focus() {
            calls.push(selector);
          },
        };
      },
    },
    openRack: (id) => calls.push('rack:' + id),
    openView: (id) => calls.push('view:' + id),
  };
  Object.assign(context, createRoomLocation(context));
  context.activateStation({ view: 'map' });
  assert.deepEqual(calls, ['clear', 'show-map', '[data-room-location]']);
  calls.length = 0;
  context.activateStation({ view: 'network', rackId: 'rack-25' });
  assert.deepEqual(calls, ['rack:rack-25']);
  calls.length = 0;
  context.activateStation({ view: 'facility' });
  assert.deepEqual(calls, ['view:facility']);
});

test('corridor destinations map each owned room once and central destinations only to UG 1', async () => {
  const { corridorPlan, roomLocation } = await facilityPromise;
  const central = centralWithAllSystems();

  for (let floorCount = 1; floorCount <= 3; floorCount++) {
    const layout = layoutWithFloors(floorCount);
    const allDestinations = [];
    for (let floor = 1; floor <= floorCount; floor++) {
      const plan = corridorPlan(layout, central, floor);
      allDestinations.push(...plan.doors.map((door) => door.id));
      assert.deepEqual(
        plan.stairs.map((stair) => stair.floor).sort((a, b) => a - b),
        [floor > 1 ? floor - 1 : null, floor < floorCount ? floor + 1 : null].filter(
          Number.isInteger,
        ),
      );
      assert.ok(plan.stairs.every((stair) => Math.abs(stair.floor - floor) === 1));
    }

    for (const room of layout.rooms) {
      assert.equal(
        allDestinations.filter((id) => id === room.id).length,
        1,
        `${room.id} has one corridor door`,
      );
      const mapped = roomLocation(layout, room.id);
      assert.equal(mapped.id, room.id);
      assert.equal(mapped.floor, room.floor);
      assert.deepEqual(mapped.rackIds, room.rackIds);
    }
    for (const id of ['control', 'cooling', 'ups', 'distribution']) {
      assert.equal(roomLocation(layout, id, floorCount).floor, 1, `${id} is on UG 1`);
      assert.equal(
        allDestinations.filter((destination) => destination === id).length,
        1,
        `${id} has one UG 1 corridor door`,
      );
    }
    assert.equal(allDestinations.length, layout.rooms.length + 4);
  }
});

test('hall portals have a walkable open threshold, block it when closed, and expose no front portal', async (t) => {
  const [THREE, { buildFacilityInterior }] = await Promise.all([threePromise, facilityPromise]);
  const previousDocument = globalThis.document;
  globalThis.document = testCanvasDocument();
  t.after(() => {
    globalThis.document = previousDocument;
  });

  const scene = new THREE.Group();
  const interior = buildFacilityInterior({
    bank: fakeBank(THREE),
    scene,
    materials: makeMaterials(THREE),
    location: { id: 'hall', floor: 1 },
    layout: layoutWithFloors(2),
    central: centralWithAllSystems(),
  });
  t.after(() => interior.dispose());

  assert.equal(
    interior.portals.some((portal) => portal.id === 'hall'),
    false,
    'hall has no front portal',
  );
  const sideDoor = interior.portals.find((portal) => portal.id === 'control');
  assert.ok(sideDoor);
  const direction = Math.sign(sideDoor.x);
  const z = sideDoor.z;
  assert.equal(interior.canWalk(0, z), true, 'hall center is walkable');
  assert.equal(
    interior.canWalk(direction * 1.9, z),
    false,
    'closed side door blocks the wall approach',
  );

  interior.openPortal(sideDoor.id);
  const pathSamples = [0, 1.5, 1.9, 2.05, 2.2, 2.32].map((distance) => [direction * distance, z]);
  assert.ok(
    pathSamples.every(([x, sampleZ]) => interior.canWalk(x, sampleZ)),
    'open doorway provides continuous samples from hall center through the threshold',
  );
  const crossed = interior.crossing(direction * 2.36, z);
  assert.equal(crossed, sideDoor);
  assert.equal(crossed.destination, 'control');
});

test('room exit is continuous from the front threshold and reports hall crossing', async (t) => {
  const [THREE, { buildFacilityInterior }] = await Promise.all([threePromise, facilityPromise]);
  const previousDocument = globalThis.document;
  globalThis.document = testCanvasDocument();
  t.after(() => {
    globalThis.document = previousDocument;
  });

  const interior = buildFacilityInterior({
    bank: fakeBank(THREE),
    scene: new THREE.Group(),
    materials: makeMaterials(THREE),
    location: { id: 'room-1', floor: 1, name: 'Raum 1', rackIds: [] },
    layout: layoutWithFloors(1),
    central: centralWithAllSystems(),
  });
  t.after(() => interior.dispose());
  assert.equal(interior.portals.length, 1);
  const exit = interior.portals[0];
  interior.openPortal('hall');
  for (const z of [5.05, 5.15, 5.25, 5.35, 5.45, 5.55, 5.6]) {
    assert.equal(interior.canWalk(0, z), true, `exit path is walkable at z=${z}`);
  }
  const crossed = interior.crossing(0, 5.6);
  assert.equal(crossed, exit);
  assert.equal(crossed.destination, 'hall');
});

test('stair height follows either flight and the walkable width is bounded', async (t) => {
  const [THREE, { buildFacilityInterior, corridorPlan, stairHeight }] = await Promise.all([
    threePromise,
    facilityPromise,
  ]);
  const previousDocument = globalThis.document;
  globalThis.document = testCanvasDocument();
  t.after(() => {
    globalThis.document = previousDocument;
  });
  const layout = layoutWithFloors(3);
  const central = centralWithAllSystems();
  for (const floor of [1, 2, 3]) {
    const plan = corridorPlan(layout, central, floor);
    for (const stair of plan.stairs) {
      assert.ok(Math.abs(stairHeight(stair, stair.startZ)) < 1e-9);
      assert.ok(Math.abs(stairHeight(stair, stair.endZ) - stair.rise) < 1e-9);
      const interior = buildFacilityInterior({
        bank: fakeBank(THREE),
        scene: new THREE.Group(),
        materials: makeMaterials(THREE),
        location: { id: 'hall', floor },
        layout,
        central,
      });
      t.after(() => interior.dispose());
      const z = (stair.startZ + stair.endZ) / 2;
      assert.equal(interior.canWalk(stair.x, z), true);
      assert.equal(
        interior.canWalk(stair.x + Math.sign(stair.x) * 0.6, z),
        false,
        'outside the stair route is not walkable',
      );
    }
  }
});

test('stair headers have no shared exposed front patch with the central wall on any floor', async (t) => {
  const [THREE, { buildFacilityInterior }, { coplanarOverlaps }] = await Promise.all([
    threePromise,
    facilityPromise,
    import('../tools/audit-assets.mjs'),
  ]);
  const previous = globalThis.document;
  globalThis.document = testCanvasDocument();
  t.after(() => (globalThis.document = previous));
  const layout = layoutWithFloors(3);
  for (const floor of [1, 2, 3]) {
    const interior = buildFacilityInterior({
      bank: fakeBank(THREE),
      scene: new THREE.Group(),
      materials: makeMaterials(THREE),
      location: { id: 'hall', floor },
      layout,
      central: centralWithAllSystems(),
    });
    t.after(() => interior.dispose());
    const shared = coplanarOverlaps(interior.group, { differentMaterials: false }).filter(
      (r) =>
        [r.a.node, r.b.node].includes('stair-sign-header') && r.plane.startsWith('0:0:1000000:'),
    );
    assert.equal(
      shared.length,
      0,
      `UG ${floor}: the visible header front must not overlap the divider or adjacent walls`,
    );
  }
});

test('open room door interaction follows the leaf and is reachable from both sides', async (t) => {
  const [THREE, { buildFacilityInterior }] = await Promise.all([threePromise, facilityPromise]);
  const previous = globalThis.document;
  globalThis.document = testCanvasDocument();
  t.after(() => (globalThis.document = previous));
  const { loadGeometry } = await import('../tools/audit-assets.mjs');
  const door = await loadGeometry(
    path.join(__dirname, '../asset-pack/assets/facility/cyber_bunker_airlock.glb'),
  );
  const bank = { make: (key) => (key === 'airlock' ? door.clone(true) : new THREE.Group()) };
  const interior = buildFacilityInterior({
    bank,
    scene: new THREE.Group(),
    materials: makeMaterials(THREE),
    location: { id: 'room-1', floor: 1, rackIds: [] },
    layout: layoutWithFloors(1),
    central: centralWithAllSystems(),
  });
  t.after(() => interior.dispose());
  const p = interior.portals[0],
    hit = interior.picks.find((p) => p.userData.roomKind === 'portal');
  interior.group.updateMatrixWorld(true);
  const closed = hit.getWorldPosition(new THREE.Vector3());
  interior.openPortal('hall');
  interior.group.updateMatrixWorld(true);
  const center = hit.getWorldPosition(new THREE.Vector3()),
    normal = new THREE.Vector3(0, 0, 1).transformDirection(hit.matrixWorld);
  assert.ok(closed.distanceTo(center) > 0.6, 'interaction box moves with the leaf');
  for (const side of [-1, 1]) {
    const origin = center.clone().addScaledVector(normal, side * 0.5),
      direction = normal.clone().multiplyScalar(-side);
    assert.ok(
      new THREE.Raycaster(origin, direction, 0, 1).intersectObject(hit, false).length,
      'either side can close the door',
    );
  }
  assert.equal(hit.parent, p.hinge);
});

test('room doors close after a crossing only when the player has cleared the swing area', async (t) => {
  const [THREE, { buildFacilityInterior }] = await Promise.all([threePromise, facilityPromise]);
  const previous = globalThis.document;
  globalThis.document = testCanvasDocument();
  t.after(() => (globalThis.document = previous));
  const interior = buildFacilityInterior({
    bank: fakeBank(THREE),
    scene: new THREE.Group(),
    materials: makeMaterials(THREE),
    location: { id: 'room-1', floor: 1, rackIds: [] },
    layout: layoutWithFloors(1),
    central: centralWithAllSystems(),
  });
  t.after(() => interior.dispose());
  const door = interior.portals[0];
  interior.openPortal('hall');
  interior.animate(5, true, { x: 0, z: 2 });
  assert.equal(door.open, true, 'manual opening is not a timed trap');
  interior.openPortal('hall', true);
  interior.animate(2, true, { x: 0, z: 4.6 });
  assert.equal(door.open, true, 'hold open beside the threshold');
  interior.animate(0.1, true, { x: 0, z: 3.5 });
  assert.equal(door.open, false, 'clear of the leaf, the door closes');
  assert.equal(door.progress, 0);
  interior.openPortal('hall', true);
  interior.togglePortal(door);
  assert.equal(door.open, false);
  assert.equal(door.autoClose, false, 'manual control overrides the closer');
});
