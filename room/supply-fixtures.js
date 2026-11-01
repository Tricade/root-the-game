import * as THREE from '../vendor/three.module.js';
import { metricBox } from '../room-surfaces.js';

/** Original modular headers, isolation valves and bus duct. Dimensions are metres.
 * Mounted above the walking/door envelope; no external models or textures. */
export function buildSupplyFixtures(materials) {
  const group = new THREE.Group();
  group.name = 'central-room-connections';
  const cooling = new THREE.Group();
  cooling.name = 'chilled-water-headers';
  group.add(cooling);
  const power = new THREE.Group();
  power.name = 'central-power-bus';
  group.add(power);
  const insulated = new THREE.MeshStandardMaterial({
    color: 0x2c3c45,
    roughness: 0.76,
    metalness: 0.18,
  });
  const blue = new THREE.MeshStandardMaterial({ color: 0x4a9abd, roughness: 0.5, metalness: 0.25 });
  function box(parent, size, pos, material, name) {
    const m = metricBox(size, material);
    m.position.set(...pos);
    m.name = name;
    parent.add(m);
    return m;
  }
  function pipe(parent, from, to, radius, material, name) {
    const a = new THREE.Vector3(...from),
      b = new THREE.Vector3(...to),
      axis = b.clone().sub(a);
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, axis.length(), 12),
      material,
    );
    mesh.position.copy(a.add(b).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
    mesh.name = name;
    parent.add(mesh);
    return mesh;
  }
  for (const offset of [-0.12, 0.12]) {
    const x = 3.7 + offset;
    pipe(cooling, [x, 2.62, -4.8], [x, 2.62, 4.7], 0.065, insulated, 'insulated-supply-return');
    pipe(cooling, [x, 1.1, 4.7], [x, 2.62, 4.7], 0.065, insulated, 'entry-riser');
    for (const z of [-4.6, -1.6, 1.6, 4.5]) {
      pipe(cooling, [x, 2.62, z - 0.035], [x, 2.62, z + 0.035], 0.08, blue, 'flow-band');
    }
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.014, 6, 20), blue);
    wheel.position.set(x - 0.08, 1.48, 4.81);
    wheel.name = 'isolation-valve';
    cooling.add(wheel);
    const end = 3.2 + offset;
    pipe(cooling, [x, 2.62, -4.8], [x, 2.62, -5.08], 0.065, insulated, 'rear-pipe-elbow');
    pipe(cooling, [x, 2.62, -5.08], [end, 2.62, -5.08], 0.065, insulated, 'rear-pipe-link');
    pipe(cooling, [end, 2.62, -5.08], [end, 2.38, -5.08], 0.065, insulated, 'header-connection');
  }
  for (const z of [-4.6, -1.6, 1.6, 4.5]) {
    box(cooling, [0.55, 0.035, 0.08], [3.795, 2.52, z], materials.brushed, 'pipe-wall-bracket');
    box(cooling, [0.02, 0.15, 0.18], [4.08, 2.52, z], materials.brushed, 'pipe-anchor-plate');
  }
  // Rear supply header feeds the raised-floor plenum; return runs remain visible.
  box(cooling, [6.9, 0.24, 0.22], [0, 2.38, -5.08], materials.brushed, 'plenum-header');
  for (const x of [-2.2, 2.2])
    box(cooling, [0.26, 1.88, 0.18], [x, 1.32, -5.08], materials.shellDark, 'plenum-drop');
  box(
    cooling,
    [0.42, 0.3, 0.15],
    [3.72, 1.88, 4.7],
    materials.shellDark,
    'cooling-isolation-control',
  );
  box(cooling, [0.28, 0.12, 0.015], [3.72, 1.91, 4.785], blue, 'cooling-control-screen');
  box(
    cooling,
    [0.36, 0.08, 0.12],
    [3.99, 1.88, 4.7],
    materials.brushed,
    'cooling-panel-wall-mount',
  );
  box(power, [0.19, 0.16, 9.6], [-3.72, 2.62, 0], materials.brushed, 'insulated-power-bus');
  box(power, [0.19, 1.52, 0.16], [-3.72, 1.86, 4.72], materials.brushed, 'power-entry-riser');
  for (const z of [-3.4, 0, 3.4]) {
    box(power, [0.32, 0.27, 0.4], [-3.72, 2.56, z], materials.shellDark, 'bus-tap');
    box(power, [2.06, 0.08, 0.08], [-2.6, 2.58, z], materials.trim, 'rack-feed-branch');
    box(power, [0.035, 0.23, 0.18], [-3.54, 2.56, z], materials.green, 'breaker-status-strip');
  }
  box(power, [0.46, 0.55, 0.2], [-3.72, 1.44, 4.72], materials.shellDark, 'room-isolator');
  box(power, [0.09, 0.2, 0.06], [-3.72, 1.44, 4.86], materials.brushed, 'lockable-disconnect');
  box(power, [0.36, 0.12, 0.14], [-3.99, 1.44, 4.72], materials.brushed, 'power-panel-wall-mount');
  for (const z of [-3.4, 0, 3.4])
    box(power, [0.35, 0.05, 0.12], [-3.91, 2.51, z], materials.brushed, 'power-bus-wall-mount');
  return {
    group,
    cooling,
    power,
    set(supply = { cooling: 'local', power: 'local' }) {
      cooling.visible = supply.cooling !== 'local';
      power.visible = supply.power !== 'local';
    },
  };
}
