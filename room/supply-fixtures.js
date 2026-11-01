import * as THREE from '../vendor/three.module.js';
import { createUtilityKit } from './utility-kit.js';

/** Original room-side services. Routes connect firestopped entries to the room
 * coil and only the racks that exist. Local equipment remains the fallback. */
export function buildSupplyFixtures(materials) {
  const group = new THREE.Group();
  group.name = 'central-room-connections';
  const cooling = new THREE.Group(),
    power = new THREE.Group();
  cooling.name = 'chilled-water-headers';
  power.name = 'central-power-bus';
  group.add(cooling, power);
  const kit = createUtilityKit(materials),
    feeds = [];
  // Separate depth planes keep the return riser clear of the supply cross-run.
  for (const [i, x, y, end] of [
    [0, 3.58, 2.42, -0.32],
    [1, 3.83, 2.65, 0.32],
  ]) {
    const endZ = i ? -5.12 : -4.93;
    kit.pipe(
      cooling,
      [
        [x, y, 5.43],
        [x, y, endZ],
        [end, y, endZ],
        [end, 1.48, endZ],
      ],
      'room-water-circuit',
    );
    kit.wallPort(cooling, x, y, 5.29);
    kit.valve(cooling, end, 1.89, endZ, i ? kit.returning : kit.supply);
    for (const z of [-3.1, 0.2, 3.2]) {
      kit.rod(
        cooling,
        [x, y, z - 0.04],
        [x, y, z + 0.04],
        0.066,
        i ? kit.returning : kit.supply,
        'water-identification-band',
      );
    }
  }
  for (const z of [-3.1, 0.2, 3.2]) {
    kit.support(cooling, 1, 2.42, z, 3.58);
    kit.support(cooling, 1, 2.65, z, 3.83);
  }
  // Chilled water exchanges heat with room air here. The rectangular outlets
  // enter the raised-floor plenum, rather than pretending a water pipe is a duct.
  kit.box(cooling, [1.7, 0.92, 0.44], [0, 1.05, -5.02], 'room-fan-coil');
  kit.box(cooling, [1.5, 0.53, 0.022], [0, 1.02, -4.788], 'coil-return-grille', kit.gasket);
  for (let y = 0.8; y <= 1.25; y += 0.06)
    kit.box(cooling, [1.48, 0.018, 0.025], [0, y, -4.77], 'coil-louvre', kit.steel);
  kit.label(cooling, 'CHW / ROOM COIL', [0, 1.395, -4.787], 0.95, 0.12);
  for (const x of [-0.49, 0.49]) {
    kit.box(cooling, [0.34, 0.61, 0.3], [x, 0.3, -5.02], 'floor-plenum-outlet');
    kit.box(cooling, [0.44, 0.055, 0.4], [x, 0.0275, -5.02], 'sealed-floor-boot', kit.gasket);
  }
  const busY = 2.28,
    wallX = 3.79;
  kit.duct(
    power,
    [
      [-wallX, busY, 5.43],
      [-wallX, busY, -3.15],
      [wallX, busY, -3.15],
      [wallX, busY, 0.65],
    ],
    'room-distribution-bus',
  );
  kit.wallPort(power, -wallX, busY, 5.29, true);
  kit.box(power, [0.24, 0.36, 0.48], [-wallX, busY - 0.04, 3.8], 'room-bus-isolator');
  kit.box(
    power,
    [0.05, 0.18, 0.09],
    [-wallX + 0.15, busY - 0.09, 3.8],
    'isolator-handle',
    kit.gasket,
  );
  kit.label(power, 'ATS / ROOM FEED', [-wallX + 0.126, busY + 0.09, 3.8], 0.34, 0.075, Math.PI / 2);
  for (const side of [-1, 1])
    for (const z of [-2.6, 0.4, 3.7]) {
      if (side > 0 && z > 0.65) continue;
      kit.support(power, side, busY, z);
    }
  for (let index = 0; index < 6; index++) {
    const feed = new THREE.Group(),
      side = index % 2 === 0 ? -1 : 1,
      z = -Math.floor(index / 2) * 0.84 - 0.25,
      x = side * 1.99;
    feed.name = `rack-feed-${index + 1}`;
    power.add(feed);
    // This roof position is on the rear half of the rotated rack42 model.
    // A busway tap feeds a removable rack through a flexible cable, not a
    // rigid duct. A small sag and roof gland keep its route easy to read.
    const cable = kit.pipe(
      feed,
      [
        [side * (wallX - 0.08), busY - 0.055, z],
        [side * 3.3, 2.16, z],
        [side * 2.45, 2.16, z],
        [x, 2.18, z],
        [x, 2.07, z],
      ],
      'rack-feed-branch',
      0.018,
    );
    cable.material = kit.gasket;
    kit.rod(
      feed,
      [side * (wallX - 0.1), busY - 0.055, z],
      [side * (wallX - 0.16), busY - 0.055, z],
      0.034,
      kit.gasket,
      'tap-cable-gland',
    );
    kit.box(feed, [0.15, 0.04, 0.15], [x, 2.075, z], 'rack-roof-gland', kit.gasket);
    kit.box(feed, [0.22, 0.25, 0.24], [side * wallX, busY - 0.025, z], 'bus-tap');
    feeds.push(feed);
  }
  return {
    group,
    cooling,
    power,
    set(supply = { cooling: 'local', power: 'local' }, rackCount = 0) {
      cooling.visible = supply.cooling !== 'local';
      power.visible = supply.power !== 'local';
      feeds.forEach((feed, i) => {
        feed.visible = i < rackCount;
      });
    },
    dispose: kit.dispose,
  };
}
