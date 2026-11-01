import * as THREE from '../vendor/three.module.js';
import { metricBox } from '../room-surfaces.js';

/** Original metric service fittings. Ownership stays with the room that creates
 * the kit; shared hall materials are never disposed by a room transition. */
export function createUtilityKit(materials) {
  const geometries = new Set(),
    owned = new Set(),
    textures = new Set();
  const material = (color, roughness = 0.65, metalness = 0.25) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    owned.add(m);
    return m;
  };
  const paint = material(0x59676a),
    insulation = material(0x293e46, 0.93, 0.05),
    supply = material(0x5db6cf),
    returning = material(0x889bc0),
    gasket = material(0x171e22, 0.98, 0),
    steel = materials.brushed || paint;
  function mesh(parent, geometry, mat, position, name) {
    geometries.add(geometry);
    const result = new THREE.Mesh(geometry, mat);
    result.position.set(...position);
    result.name = name;
    result.castShadow = true;
    result.receiveShadow = true;
    parent.add(result);
    return result;
  }
  function box(parent, size, position, name, mat = paint) {
    const result = metricBox(size, mat);
    geometries.add(result.geometry);
    result.position.set(...position);
    result.name = name;
    result.castShadow = true;
    result.receiveShadow = true;
    parent.add(result);
    return result;
  }
  function rod(parent, from, to, radius, mat = steel, name = 'fitting') {
    const a = new THREE.Vector3(...from),
      b = new THREE.Vector3(...to),
      direction = b.clone().sub(a);
    const result = mesh(
      parent,
      new THREE.CylinderGeometry(radius, radius, direction.length(), 16),
      mat,
      a.clone().add(b).multiplyScalar(0.5).toArray(),
      name,
    );
    result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return result;
  }
  // Round bends in one continuous surface, rather than intersecting cylinders
  // with exposed cut ends. Straight sections remain exactly on the route.
  function pipe(parent, points, name, radius = 0.055) {
    const vertices = points.map((p) => new THREE.Vector3(...p)),
      path = new THREE.CurvePath();
    let cursor = vertices[0];
    for (let i = 1; i < vertices.length - 1; i++) {
      const corner = vertices[i],
        before = vertices[i - 1],
        after = vertices[i + 1],
        bend = Math.min(0.14, corner.distanceTo(before) / 3, corner.distanceTo(after) / 3),
        enter = corner.clone().add(before.clone().sub(corner).normalize().multiplyScalar(bend)),
        leave = corner.clone().add(after.clone().sub(corner).normalize().multiplyScalar(bend));
      path.add(new THREE.LineCurve3(cursor, enter));
      path.add(new THREE.QuadraticBezierCurve3(enter, corner, leave));
      cursor = leave;
    }
    path.add(new THREE.LineCurve3(cursor, vertices.at(-1)));
    const result = mesh(
      parent,
      new THREE.TubeGeometry(path, Math.max(12, points.length * 12), radius, 12, false),
      insulation,
      [0, 0, 0],
      name,
    );
    result.userData.route = points;
    return result;
  }
  function duct(parent, points, name, width = 0.14) {
    const group = new THREE.Group();
    group.name = name;
    group.userData.route = points;
    parent.add(group);
    // Butt joints avoid coplanar overlapping faces at every elbow.
    points.forEach((p) => box(group, [width, width, width], p, 'duct-elbow'));
    for (let i = 1; i < points.length; i++) {
      const a = new THREE.Vector3(...points[i - 1]),
        b = new THREE.Vector3(...points[i]),
        d = b.clone().sub(a),
        axis = ['x', 'y', 'z'].find((k) => Math.abs(d[k]) > 1e-5),
        size = { x: width, y: width, z: width };
      if (!axis || d.length() <= width) continue;
      size[axis] = d.length() - width - 0.001;
      box(group, [size.x, size.y, size.z], a.add(b).multiplyScalar(0.5).toArray(), 'duct-run');
    }
    return group;
  }
  // Every service passes through a sealed sleeve; neither ends in free air.
  function wallPort(parent, x, y, z, electrical = false) {
    box(parent, [0.22, 0.22, 0.06], [x, y, z], 'sealed-wall-penetration', paint);
    if (electrical) box(parent, [0.2, 0.2, 0.1], [x, y, z], 'bus-firestop', gasket);
    else rod(parent, [x, y, z - 0.06], [x, y, z + 0.06], 0.095, gasket, 'pipe-firestop');
  }
  function valve(parent, x, y, z, mat = supply) {
    rod(parent, [x, y - 0.1, z], [x, y + 0.1, z], 0.075, steel, 'valve-body');
    for (const offset of [-0.095, 0.095])
      rod(
        parent,
        [x, y + offset - 0.015, z],
        [x, y + offset + 0.015, z],
        0.09,
        mat,
        'valve-flange',
      );
    rod(parent, [x, y, z], [x, y, z + 0.19], 0.022, steel, 'valve-stem');
    mesh(
      parent,
      new THREE.TorusGeometry(0.105, 0.013, 8, 24),
      mat,
      [x, y, z + 0.2],
      'valve-handwheel',
    );
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      rod(
        parent,
        [x, y, z + 0.2],
        [x + Math.cos(angle) * 0.1, y + Math.sin(angle) * 0.1, z + 0.2],
        0.009,
        mat,
        'handwheel-spoke',
      );
    }
    rod(parent, [x, y, z + 0.18], [x, y, z + 0.22], 0.028, steel, 'handwheel-hub');
  }
  function support(parent, side, y, z, reach = 3.55) {
    box(parent, [0.03, 0.21, 0.16], [side * 4.075, y - 0.04, z], 'wall-anchor', steel);
    const end = reach - 0.12,
      length = 4.075 - end;
    box(
      parent,
      [length, 0.035, 0.08],
      [side * (end + length / 2), y - 0.09, z],
      'header-support',
      steel,
    );
  }
  function label(parent, text, position, width = 0.65, height = 0.12, turn = 0) {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = Math.round((768 * height) / width);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#172529';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#d8e7db';
    ctx.font = `600 ${Math.round(canvas.height * 0.46)}px Segoe UI`;
    ctx.fillText(text, 24, canvas.height * 0.66, 720);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.add(texture);
    const mat = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    owned.add(mat);
    const backing = box(
      parent,
      [width + 0.012, height + 0.012, 0.018],
      [position[0] - Math.sin(turn) * 0.011, position[1], position[2] - Math.cos(turn) * 0.011],
      'service-label-backing',
    );
    backing.rotation.y = turn;
    mesh(
      parent,
      new THREE.PlaneGeometry(width, height),
      mat,
      position,
      'service-label',
    ).rotation.y = turn;
  }
  function dispose() {
    geometries.forEach((g) => g.dispose());
    owned.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    geometries.clear();
    owned.clear();
    textures.clear();
  }
  return {
    box,
    rod,
    pipe,
    duct,
    wallPort,
    valve,
    support,
    label,
    paint,
    insulation,
    supply,
    returning,
    gasket,
    steel,
    dispose,
  };
}
