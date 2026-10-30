const { grantSpace } = require('./helpers/facility.cjs');
const test = require('node:test'),
  assert = require('node:assert/strict'),
  E = require('../engine.js');

function models(state) {
  const metrics = E.getMetrics(state),
    model = E.getRackModel(state, metrics);
  return {
    model,
    metrics,
    resilience: E.getResilience(state, model, metrics),
    layout: E.getFacilityLayout(state),
    central: E.getCentralInfrastructure(state),
  };
}

test('physical readouts use measured temperature and scope hardware and upgrades to the selected room', async () => {
  const { facilityReadout } = await import('../room-instruments.js'),
    state = E.createState(17);
  const snapshot = models(state),
    first = snapshot.model.racks[0];
  first.temperature = 58.3;
  first.powerW = 1234;
  const second = { ...first, id: 'rack-other', temperature: 90, powerW: 9000, servers: [] };
  snapshot.model.racks.push(second);
  snapshot.layout.rooms = [
    { id: 'room-1', number: 1, floor: 1, rackIds: [first.id] },
    { id: 'room-2', number: 2, floor: 1, rackIds: [second.id] },
  ];
  snapshot.model.operation = { rackId: second.id, label: 'Ausbau', total: 90, remaining: 45 };
  const read = facilityReadout({ ...snapshot, location: { id: 'room-1', floor: 1 } }, 'en');
  assert.equal(read.rows.find((row) => row[0] === 'Hottest rack')[1], '58.3 °C');
  assert.equal(read.rows.find((row) => row[0] === 'Power draw')[1], '1.2 kW');
  assert.equal(read.operation, null, 'another room does not show this rack operation');
  snapshot.model.operation.rackId = first.id;
  const active = facilityReadout({ ...snapshot, location: { id: 'room-1', floor: 1 } }, 'de');
  assert.equal(active.operation.progress, 0.5);
  assert.equal(active.operation.remaining, 45);
});

test('central screens show installed capacities, matching progress and new capacities after completion', async () => {
  const { facilityReadout } = await import('../room-instruments.js'),
    state = E.createState(19);
  state.sector = 10;
  state.credits = 1e6;
  grantSpace(state, { specialRooms: ['cooling'] });
  assert.equal(E.act(state, 'upgradeCentral', { system: 'cooling' }).ok, true);
  let snapshot = models(state),
    read = facilityReadout({ ...snapshot, location: { id: 'cooling', floor: 1 } }, 'en');
  assert.equal(read.reading, '0.0 kW');
  assert.equal(read.operation.progress, 0);
  assert.ok(read.operation.remaining > 0);
  assert.equal(
    facilityReadout({ ...snapshot, location: { id: 'ups', floor: 1 } }, 'en').operation,
    null,
  );
  E.advance(state, state.facility.centralOperation.total / 2);
  snapshot = models(state);
  read = facilityReadout({ ...snapshot, location: { id: 'cooling', floor: 1 } }, 'en');
  assert.ok(Math.abs(read.operation.progress - 0.5) < 0.02);
  assert.ok(read.operation.remaining > 0);
  E.advance(state, 1000);
  read = facilityReadout({ ...models(state), location: { id: 'cooling', floor: 1 } }, 'en');
  assert.equal(read.reading, '3.5 kW');
  assert.equal(read.operation, null);
});

test('live terminal faces reuse their texture, repaint only when changed and dispose their own resources', async (t) => {
  const THREE = await import('../vendor/three.module.js'),
    { buildFacilityInterior } = await import('../room-facility.js'),
    state = E.createState(21),
    snapshot = models(state);
  const previous = globalThis.document;
  let paints = 0;
  const ctx = new Proxy(
    {
      measureText: (text) => ({ width: String(text).length * 9 }),
      fillText() {
        paints++;
      },
    },
    { get: (object, key) => (key in object ? object[key] : () => {}) },
  );
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
  t.after(() => (globalThis.document = previous));
  const mat = new THREE.MeshStandardMaterial(),
    materials = new Proxy({}, { get: () => mat });
  const scene = new THREE.Scene(),
    interior = buildFacilityInterior({
      bank: { make: () => new THREE.Group() },
      scene,
      materials,
      location: { id: 'room-1', floor: 1, rackIds: snapshot.layout.rooms[0].rackIds },
      layout: snapshot.layout,
      central: snapshot.central,
    });
  const face = interior.group.getObjectByName('live-room-terminal'),
    texture = face.material.map;
  let disposed = 0;
  texture.addEventListener('dispose', () => disposed++);
  interior.update(snapshot, 0);
  const version = texture.version,
    first = paints;
  assert.ok(first > 0);
  interior.update(snapshot, 1000);
  assert.equal(paints, first, 'unchanged values do not upload the texture again');
  assert.equal(texture.version, version);
  snapshot.model.racks[0].temperature = 55;
  interior.update(snapshot, 2000);
  assert.ok(paints > first);
  assert.equal(face.material.map, texture, 'one persistent texture, no model rebuilding');
  assert.ok(texture.version > version);
  interior.dispose();
  assert.equal(disposed, 1);
  assert.equal(scene.children.length, 0);
});
