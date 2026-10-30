const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs/promises'),
  path = require('node:path');

async function assetScene(key, THREE) {
  const { GLTFLoader } = await import('../vendor/GLTFLoader.js');
  const loader = new GLTFLoader();
  // Geometry-only Node evidence. Real JPEG/PNG decoding is tested in the browser.
  loader.register(() => ({
    name: 'ROOT_geometry_test',
    loadTexture: async () => new THREE.Texture(),
  }));
  const bytes = await fs.readFile(path.join(__dirname, '../asset-pack/assets', key + '.glb'));
  const root = (
    await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    )
  ).scene;
  const remove = [];
  root.traverse((n) => {
    if (n.name === 'LOD1' || n.name.startsWith('collider_')) remove.push(n);
  });
  remove.forEach((n) => n.removeFromParent());
  return root;
}

test('power switchboard has a distinct broad profile and visible source isolators and outgoing breakers', async () => {
  const THREE = await import('../vendor/three.module.js');
  const ups = await assetScene('facility/ups_battery_cabinet', THREE),
    power = await assetScene('facility/power_distribution_ats', THREE);
  const u = new THREE.Box3().setFromObject(ups).getSize(new THREE.Vector3()),
    p = new THREE.Box3().setFromObject(power).getSize(new THREE.Vector3());
  assert.ok(p.x > u.x * 1.3, 'power board is clearly broader than the battery cabinet');
  assert.ok(p.z < u.z, 'power board is shallower even including its isolator handles');
  let breakers = 0,
    isolators = 0;
  power.traverse((node) => {
    breakers += node.userData.visibleOutgoingBreakers || 0;
    if (node.userData.externalSourceIsolator) isolators++;
  });
  assert.equal(breakers, 12);
  assert.equal(isolators, 2);
});

test('textured furniture keeps all scene roots and uses stable metric footprints clear of the central aisle', async () => {
  const THREE = await import('../vendor/three.module.js'),
    { createControlLounge } = await import('../room-lounge.js');
  const templates = new Map();
  for (const key of ['sofa', 'chair', 'coffee', 'plant']) {
    const root = await assetScene('interiors/' + key, THREE),
      bounds = new THREE.Box3().setFromObject(root),
      size = bounds.getSize(new THREE.Vector3());
    const expected = {
      sofa: [2.0, 2.5, 0.75, 1.1],
      chair: [0.6, 0.9, 1.0, 1.4],
      coffee: [2.0, 2.4, 1.4, 1.9],
      plant: [0.4, 0.75, 1.2, 1.7],
    }[key];
    assert.ok(size.x >= expected[0] && size.x <= expected[1], key + ' metric width');
    assert.ok(size.y >= expected[2] && size.y <= expected[3], key + ' metric height');
    const sourceRoot = root.children[0];
    assert.equal(sourceRoot.userData.provenance, 'original ROOT procedural model');
    assert.equal(sourceRoot.userData.source, 'tools/asset-generator/build_interiors.mjs');
    const center = bounds.getCenter(new THREE.Vector3());
    root.position.add(new THREE.Vector3(-center.x, -bounds.min.y, -center.z));
    templates.set(key, root);
  }
  const parent = new THREE.Group(),
    geometries = new Set(),
    materials = new Set();
  const lounge = createControlLounge({
    THREE,
    parent,
    bank: { make: (key) => templates.get(key).clone(true) },
    geometries,
    materials,
  });
  parent.updateMatrixWorld(true);
  for (const collider of lounge.colliders) {
    assert.ok(Math.abs(collider.x) - collider.hx > 0.9, 'the full central aisle remains clear');
    assert.ok(collider.z - collider.hz > -2, 'furniture does not obstruct the desks');
  }
  for (const name of ['control-sofa', 'control-chair', 'control-coffee']) {
    const bounds = new THREE.Box3().setFromObject(lounge.group.getObjectByName(name));
    assert.ok(bounds.min.y >= -1e-5 && bounds.min.y < 0.03, name + ' rests on floor or rug');
    assert.ok(bounds.min.x > -4.09 && bounds.max.x < 4.09, name + ' remains inside the walls');
  }
  assert.equal(lounge.group.children.filter((n) => n.name === 'control-chair').length, 2);
  geometries.forEach((item) => item.dispose());
  materials.forEach((item) => item.dispose());
});

test('control-room services cannot obscure any wall monitor while server-room services remain available', async (t) => {
  const THREE = await import('../vendor/three.module.js'),
    { buildAssetHall } = await import('../room-assets.js'),
    { createStations } = await import('../room-stations.js');
  const previous = globalThis.document;
  t.after(() => {
    if (previous) globalThis.document = previous;
    else delete globalThis.document;
  });
  const ctx = new Proxy(
    { measureText: (text) => ({ width: String(text).length * 9 }) },
    { get: (o, k) => (k in o ? o[k] : () => {}) },
  );
  globalThis.document = { createElement: () => ({ getContext: () => ctx }) };
  const templates = new Map();
  for (const key of ['tray', 'light', 'cooling'])
    templates.set(
      key,
      await assetScene(
        {
          tray: 'architecture/cable_tray_overhead',
          light: 'architecture/ceiling_light_linear',
          cooling: 'architecture/crac_cooling_unit',
        }[key],
        THREE,
      ),
    );
  const bank = {
    make(key) {
      if (templates.has(key)) return templates.get(key).clone(true);
      const g = new THREE.Group();
      if (key === 'desk')
        for (const name of ['monitor_screen', 'monitor_screen_01', 'monitor_screen_03']) {
          const m = new THREE.Mesh(
            new THREE.PlaneGeometry(0.3, 0.2),
            new THREE.MeshBasicMaterial(),
          );
          m.name = name;
          g.add(m);
        }
      return g;
    },
  };
  const scene = new THREE.Scene(),
    mat = new THREE.MeshStandardMaterial();
  const hall = buildAssetHall({ bank, scene, materials: new Proxy({}, { get: () => mat }) });
  hall.setServerRoom(false);
  const E = require('../engine.js'),
    state = E.createState(),
    stations = createStations({ THREE, scene, E, getState: () => state, assetBank: bank });
  t.after(() => stations.dispose());
  scene.updateMatrixWorld(true);
  const blockers = [];
  scene.traverse((node) => {
    if (
      !node.isMesh ||
      node.userData.roomKind ||
      node.material.visible === false ||
      node.material.opacity === 0
    )
      return;
    for (let p = node; p; p = p.parent) if (!p.visible) return;
    blockers.push(node);
  });
  const origin = new THREE.Vector3(0, 1.62, 4.6);
  for (const x of [-2.67, 0, 2.67])
    for (const dx of [-0.8, 0, 0.8])
      for (const y of [1.65, 2.12, 2.6]) {
        const target = new THREE.Vector3(x + dx, y, -5.051),
          distance = target.distanceTo(origin),
          ray = new THREE.Raycaster(
            origin,
            target.clone().sub(origin).normalize(),
            0,
            distance - 0.015,
          );
        assert.equal(
          ray.intersectObjects(blockers, false).length,
          0,
          `display (${x + dx},${y}) has a clear sightline`,
        );
      }
});
