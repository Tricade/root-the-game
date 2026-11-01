const test = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

async function asset(key, kind, THREE) {
  const { GLTFLoader } = await import('../vendor/GLTFLoader.js');
  const { prepareAssetGeometry } = await import('../room-assets.js');
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'geometry_only', loadTexture: async () => new THREE.Texture() }));
  const bytes = await fs.readFile(path.join(__dirname, '../asset-pack/assets', key + '.glb'));
  const root = (
    await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    )
  ).scene;
  prepareAssetGeometry(root, kind);
  return root;
}
function named(root, name) {
  const result = [];
  root.traverse((node) => {
    if (node.name === name) result.push(node);
  });
  return result;
}

test('connected room feeds meet the actual rack roofs and never populate empty slots', async () => {
  const THREE = await import('../vendor/three.module.js');
  const { buildSupplyFixtures } = await import('../room/supply-fixtures.js');
  const rack = await asset('racks/rack_42u', 'rack', THREE);
  const shared = new THREE.MeshStandardMaterial(),
    fixtures = buildSupplyFixtures({ brushed: shared });
  const geometryCount = () => {
    let n = 0;
    fixtures.group.traverse((m) => {
      if (m.isMesh) n++;
    });
    return n;
  };
  fixtures.set({ cooling: 'central', power: 'central' }, 3);
  const initialCount = geometryCount();
  for (let i = 0; i < 6; i++) {
    const feed = fixtures.group.getObjectByName(`rack-feed-${i + 1}`);
    assert.equal(feed.visible, i < 3);
    const side = i % 2 ? 1 : -1;
    const model = rack.clone(true);
    model.position.set(side * 1.65, 0, -Math.floor(i / 2) * 0.84 - 0.25);
    model.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    const bounds = new THREE.Box3().setFromObject(model);
    const end = feed.getObjectByName('rack-feed-branch').userData.route.at(-1);
    assert.ok(end[0] > bounds.min.x && end[0] < bounds.max.x, 'feed is over this cabinet');
    assert.ok(end[2] > bounds.min.z && end[2] < bounds.max.z, 'feed follows the real row spacing');
    assert.ok(Math.abs(end[1] - bounds.max.y) < 0.025, 'feed meets the roof, not free air');
  }
  fixtures.set({ cooling: 'hybrid', power: 'ups' }, 6);
  assert.equal(named(fixtures.group, 'rack-feed-branch').length, 6);
  assert.equal(geometryCount(), initialCount, 'mode/count changes reuse geometry');
  fixtures.set({ cooling: 'local', power: 'local' }, 1);
  assert.equal(fixtures.cooling.visible, false);
  assert.equal(fixtures.power.visible, false);
  const coils = named(fixtures.group, 'floor-plenum-outlet');
  assert.equal(coils.length, 2);
  for (const coil of coils) {
    const b = new THREE.Box3().setFromObject(coil);
    assert.ok(b.min.y <= 0 && b.max.y >= 0.59, 'coil outlet meets both equipment and floor');
  }
  fixtures.dispose();
});

test('all utility cabinets connect roof glands to bounded headers leaving their room; transitions release fittings', async (t) => {
  const THREE = await import('../vendor/three.module.js');
  const { buildFacilityInterior } = await import('../room-facility.js');
  const E = require('../engine.js'),
    { grantSpace } = require('./helpers/facility.cjs');
  const previous = globalThis.document;
  const ctx = new Proxy(
    { measureText: (text) => ({ width: String(text).length * 9 }) },
    { get: (o, k) => (k in o ? o[k] : () => {}) },
  );
  globalThis.document = { createElement: () => ({ getContext: () => ctx }) };
  t.after(() => {
    if (previous) globalThis.document = previous;
    else delete globalThis.document;
  });
  const state = E.createState();
  state.sector = 30;
  grantSpace(state, { specialRooms: ['cooling', 'ups', 'distribution'] });
  for (const id of ['cooling', 'ups', 'distribution']) state.facility.central[id] = 20;
  const layout = E.getFacilityLayout(state),
    central = E.getCentralInfrastructure(state);
  for (const [id, file] of [
    ['cooling', 'architecture/crac_cooling_unit'],
    ['ups', 'facility/ups_battery_cabinet'],
    ['distribution', 'facility/power_distribution_ats'],
  ]) {
    const model = await asset(file, id, THREE),
      body = new THREE.Box3().setFromObject(model);
    const shared = new THREE.MeshStandardMaterial();
    let sharedDisposed = 0;
    shared.addEventListener('dispose', () => sharedDisposed++);
    const scene = new THREE.Scene();
    const interior = buildFacilityInterior({
      scene,
      materials: new Proxy({}, { get: () => shared }),
      bank: { make: (key) => (key === id ? model.clone(true) : new THREE.Group()) },
      location: { id, name: id, floor: 1 },
      layout,
      central,
    });
    const services = interior.group.getObjectByName('plant-service-connections');
    assert.ok(services);
    const water = id === 'cooling',
      circuits = id === 'distribution' ? 3 : 2;
    const connections = named(
      services,
      water ? 'plant-water-connection' : 'plant-power-connection',
    );
    const headers = named(services, water ? 'plant-water-header' : 'plant-power-header');
    assert.equal(connections.length, 6 * circuits);
    for (const node of connections) {
      const [start, , end] = node.userData.route;
      assert.ok(
        Math.abs(start[1] - body.max.y) < 0.03,
        id + ' pipe/duct starts inside the actual roof',
      );
      assert.ok(
        headers.some((header) => {
          const [a, b] = header.userData.route;
          return (
            Math.abs(a[0] - end[0]) < 0.001 &&
            Math.abs(a[1] - end[1]) < 0.001 &&
            end[2] <= a[2] &&
            end[2] >= b[2]
          );
        }),
        'every branch meets a header',
      );
    }
    for (const header of headers)
      assert.ok(header.userData.route.at(-1)[2] < -5.4, 'header crosses the wall firestop');
    const bounds = new THREE.Box3().setFromObject(services);
    assert.ok(
      bounds.max.y < 2.85 && bounds.min.x > -4.1 && bounds.max.x < 4.1,
      'no services clip ceiling or side walls',
    );
    const ownedGeometries = new Set();
    let triangles = 0;
    services.traverse((node) => {
      if (!node.isMesh) return;
      ownedGeometries.add(node.geometry);
      triangles += (node.geometry.index?.count || node.geometry.attributes.position.count) / 3;
    });
    assert.ok(
      ownedGeometries.size < 320 && triangles < 65000,
      'fixed room geometry stays bounded at high plant levels',
    );
    let disposed = 0;
    ownedGeometries.forEach((g) => g.addEventListener('dispose', () => disposed++));
    interior.dispose();
    assert.equal(disposed, ownedGeometries.size, 'all fittings released once');
    assert.equal(sharedDisposed, 0, 'shared hall material retained');
    assert.equal(scene.children.length, 0);
  }
});
