import * as THREE from '../vendor/three.module.js';
import { createUtilityKit } from './utility-kit.js';

/** Source-side services for the same circuits represented in converted rooms.
 * The streamed room boundary is a sealed service penetration, not a loose end.
 * Units are the bounded visible plant modules, never the unbounded level count. */
export function buildPlantConnections(materials, systemId, units, hasUPS = false) {
  const group = new THREE.Group(),
    kit = createUtilityKit(materials);
  group.name = 'plant-service-connections';
  const cooling = systemId === 'cooling';
  const circuits = cooling
    ? ['CHW / SUPPLY', 'CHW / RETURN']
    : systemId === 'ups'
      ? ['GRID / IN', 'UPS / OUT']
      : hasUPS
        ? ['GRID / A', 'UPS / B', 'ATS / OUT']
        : ['GRID / A', 'ATS / OUT'];
  for (const side of [-1, 1]) {
    const row = units.filter((unit) => Math.sign(unit.x) === side);
    if (!row.length) continue;
    circuits.forEach((circuit, index) => {
      const x = side * (circuits.length === 3 ? 3.31 + index * 0.27 : 3.55 + index * 0.27),
        y = circuits.length === 3 ? 2.35 + index * 0.17 : 2.48 + index * 0.17,
        firstZ = Math.max(...row.map((unit) => unit.z)) + 0.72;
      if (cooling) {
        kit.pipe(
          group,
          [
            [x, y, firstZ],
            [x, y, -5.43],
          ],
          'plant-water-header',
        );
        kit.rod(
          group,
          [x, y, firstZ - 0.025],
          [x, y, firstZ + 0.025],
          0.066,
          index ? kit.returning : kit.supply,
          'header-end-cap',
        );
      } else
        kit.duct(
          group,
          [
            [x, y, firstZ],
            [x, y, -5.43],
          ],
          'plant-power-header',
          0.12,
        );
      kit.wallPort(group, x, y, -5.35, !cooling);
      // The identification plate is mounted on the room-facing duct/header.
      kit.label(group, circuit, [x, y - 0.24, -5.298], 0.24, 0.07);
      for (const unit of row) {
        const connectionX = unit.x + side * 0.25,
          z = unit.z + (index - (circuits.length - 1) / 2) * 0.25,
          route = [
            [connectionX, unit.roof - 0.01, z],
            [connectionX, y, z],
            [x, y, z],
          ];
        if (cooling) {
          kit.pipe(group, route, 'plant-water-connection', 0.043);
          kit.rod(
            group,
            [connectionX, unit.roof - 0.015, z],
            [connectionX, unit.roof + 0.035, z],
            0.075,
            kit.steel,
            'cabinet-water-gland',
          );
          const valve = new THREE.Group();
          valve.position.set(connectionX, unit.roof + 0.13, z);
          valve.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
          group.add(valve);
          kit.valve(valve, 0, 0, 0, index ? kit.returning : kit.supply);
        } else {
          kit.duct(group, route, 'plant-power-connection', 0.1);
          kit.box(
            group,
            [0.17, 0.045, 0.17],
            [connectionX, unit.roof, z],
            'cabinet-power-gland',
            kit.gasket,
          );
        }
      }
    });
    for (const z of [-4.2, -1.7, 0.8])
      kit.support(group, side, circuits.length === 3 ? 2.35 : 2.48, z);
  }
  return { group, dispose: kit.dispose };
}
