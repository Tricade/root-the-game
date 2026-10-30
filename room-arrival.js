import * as THREE from './vendor/three.module.js';
import { createBunkerSurfaces, metricBox } from './room-surfaces.js';

const ARRIVAL_DURATION = 11000;
const DOOR_WIDTH = 1.4;
const DOOR_HEIGHT = 2.4;

export function createArrival({ bank, environment }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111719);
  scene.fog = new THREE.Fog(0x111719, 24, 52);
  scene.environment = environment;
  scene.environmentIntensity = 0.22;

  const camera = new THREE.PerspectiveCamera(66, 1, 0.08, 90);
  const surfaces = createBunkerSurfaces(bank);
  const geometries = [];
  const ownedMaterials = [];
  const doors = [];

  const earth = surfaces.concrete.clone();
  earth.color.set(0x42483a);
  earth.roughness = 0.98;
  ownedMaterials.push(earth);

  const diffuser = new THREE.MeshBasicMaterial({ color: 0xc9d7c8 });
  const greenBeacon = new THREE.MeshBasicMaterial({ color: 0x91c58f });
  const amberBeacon = new THREE.MeshBasicMaterial({ color: 0xd89b4d });
  ownedMaterials.push(diffuser, greenBeacon, amberBeacon);

  function box(size, position, material, rotation = null) {
    const mesh = metricBox(size, material);
    mesh.position.set(...position);
    if (rotation) mesh.rotation.set(...rotation);
    scene.add(mesh);
    geometries.push(mesh.geometry);
    return mesh;
  }

  function pipeBetween(start, end, radius, material) {
    const a = new THREE.Vector3(...start);
    const b = new THREE.Vector3(...end);
    const direction = b.clone().sub(a);
    const geometry = new THREE.CylinderGeometry(radius, radius, direction.length(), 10, 1, false);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(a.add(b).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    geometries.push(geometry);
    return mesh;
  }

  function portalBulkhead({ z, width, height, depth, label }) {
    const sideWidth = (width - DOOR_WIDTH) / 2;
    const sideCenter = DOOR_WIDTH / 2 + sideWidth / 2;
    const lintelHeight = height - DOOR_HEIGHT;
    // Four concrete volumes create a genuine 1.4 × 2.4 m through-opening around the portal.
    box([sideWidth, height, depth], [-sideCenter, height / 2, z], surfaces.concrete);
    box([sideWidth, height, depth], [sideCenter, height / 2, z], surfaces.concrete);
    box([width, lintelHeight, depth], [0, DOOR_HEIGHT + lintelHeight / 2, z], surfaces.concrete);

    const portal = bank.make('airlock');
    portal.position.set(0, 0, z);
    scene.add(portal);
    const hinge = portal.getObjectByName('bunker_door_hinge');
    if (!hinge) throw new Error('Bunkerschleuse hat keinen bunker_door_hinge-Knoten.');
    doors.push({ hinge, z });

    // Independent heavy stop plates and contact threshold emphasize the doorway depth.
    box(
      [0.055, DOOR_HEIGHT - 0.1, depth + 0.08],
      [-0.675, DOOR_HEIGHT / 2 + 0.025, z],
      surfaces.steel,
    );
    box(
      [0.055, DOOR_HEIGHT - 0.1, depth + 0.08],
      [0.675, DOOR_HEIGHT / 2 + 0.025, z],
      surfaces.steel,
    );
    box([DOOR_WIDTH, 0.035, depth + 0.12], [0, 0.0175, z], surfaces.steel);
    box([width, 0.18, 0.18], [0, height - 0.09, z + depth / 2 + 0.09], surfaces.steel);

    // Recessed status plates stay close to the wall and use restrained, non-neon signals.
    for (const side of [-1, 1]) {
      box(
        [0.13, 0.32, 0.045],
        [side * (DOOR_WIDTH / 2 + 0.13), 1.68, z + depth / 2 + 0.026],
        surfaces.steel,
      );
      box(
        [0.038, 0.055, 0.014],
        [side * (DOOR_WIDTH / 2 + 0.13), 1.74, z + depth / 2 + 0.055],
        side < 0 ? greenBeacon : amberBeacon,
      );
    }
  }

  scene.add(new THREE.HemisphereLight(0xb8c7c7, 0x292f30, 0.9));
  const fill = new THREE.DirectionalLight(0xb8c8cc, 1.4);
  fill.position.set(-6, 9, 9);
  scene.add(fill);

  // The entry is cut into a broad, grounded reinforced-concrete retaining wall in the hillside.
  box([28, 0.32, 42], [0, -0.16, -7], surfaces.floor);
  portalBulkhead({ z: 1.15, width: 8.4, height: 4.2, depth: 1.35, label: 'hillside entry' });
  // A continuous embankment covers the tunnel, with a cut approach in front.
  const terrainGeometry = new THREE.PlaneGeometry(36, 42, 30, 30);
  terrainGeometry.rotateX(-Math.PI / 2);
  const terrainPosition = terrainGeometry.attributes.position;
  for (let i = 0; i < terrainPosition.count; i++) {
    const x = terrainPosition.getX(i),
      z = terrainPosition.getZ(i) - 7;
    const mound =
      5.8 * Math.exp(-((x * x) / 380 + ((z + 8) * (z + 8)) / 700)) +
      0.18 * Math.sin(x * 1.4) * Math.cos(z * 0.8);
    const approach = Math.max(0, Math.min(1, Math.max(Math.abs(x) - 4.2, 1.2 - z)));
    terrainPosition.setXYZ(i, x, -0.04 + Math.max(0, mound) * approach, z);
  }
  const terrainIndices = [];
  for (let i = 0; i < terrainGeometry.index.count; i += 3) {
    const ids = [0, 1, 2].map((offset) => terrainGeometry.index.getX(i + offset));
    const xs = ids.map((id) => terrainPosition.getX(id)),
      zs = ids.map((id) => terrainPosition.getZ(id));
    if (Math.min(...xs) < 4.4 && Math.max(...xs) > -4.4 && Math.max(...zs) > -1.8) continue;
    terrainIndices.push(...ids);
  }
  terrainGeometry.setIndex(terrainIndices);
  terrainGeometry.computeVertexNormals();
  geometries.push(terrainGeometry);
  const terrain = new THREE.Mesh(terrainGeometry, earth);
  terrain.receiveShadow = true;
  scene.add(terrain);
  for (const side of [-1, 1]) {
    box([0.45, 2.8, 5.6], [side * 4.0, 1.4, 3.25], surfaces.concrete);
    // Buttress piers transfer the entry wall into the cut rock face.
    for (const z of [-0.2, 1.55]) {
      box([0.22, 4.1, 0.26], [side * 1.82, 2.05, z], surfaces.steel);
    }
    box([0.15, 0.82, 0.15], [side * 1.8, 0.41, 5.4], surfaces.steel);
    box([0.16, 0.045, 0.16], [side * 1.8, 0.75, 5.4], amberBeacon);
    box([0.5, 0.12, 0.16], [side * 1.38, 3.55, 1.98], surfaces.steel);
    box([0.38, 0.025, 0.14], [side * 1.38, 3.48, 2.0], diffuser);
    const entranceLamp = new THREE.PointLight(0xd2dac7, 14, 7, 2);
    entranceLamp.position.set(side * 1.35, 3.35, 2.0);
    scene.add(entranceLamp);
  }
  box([8.4, 0.2, 1.65], [0, 4.2, 1.15], surfaces.concrete);
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 1024;
  signCanvas.height = 192;
  const signContext = signCanvas.getContext('2d');
  signContext.fillStyle = '#131c1d';
  signContext.fillRect(0, 0, 1024, 192);
  signContext.fillStyle = '#d0d6ca';
  signContext.font = '600 72px Segoe UI';
  signContext.fillText('ROOT / 01', 36, 92);
  signContext.fillStyle = '#a3b68b';
  signContext.font = '25px Consolas';
  signContext.fillText('UNDERGROUND OPERATIONS · AUTHORIZED ACCESS', 39, 150);
  const signTexture = new THREE.CanvasTexture(signCanvas);
  signTexture.colorSpace = THREE.SRGBColorSpace;
  const signMaterial = new THREE.MeshBasicMaterial({ map: signTexture, toneMapped: false });
  ownedMaterials.push(signMaterial);
  const signGeometry = new THREE.PlaneGeometry(2.7, 0.5);
  geometries.push(signGeometry);
  const sign = new THREE.Mesh(signGeometry, signMaterial);
  sign.position.set(0, 2.95, 1.84);
  scene.add(sign);

  // A continuous tunnel connects every blast door; each cross wall has a cut opening and a floor-bearing portal.
  const hallWidth = 3.6;
  const hallHeight = 3.55;
  const hallStart = 1.15;
  const hallEnd = -24.5;
  const hallLength = hallStart - hallEnd;
  const hallCenter = (hallStart + hallEnd) / 2;
  box([hallWidth, 0.24, hallLength], [0, -0.12, hallCenter], surfaces.floor);
  box([0.38, hallHeight, hallLength], [-1.61, hallHeight / 2, hallCenter], surfaces.concrete);
  box([0.38, hallHeight, hallLength], [1.61, hallHeight / 2, hallCenter], surfaces.concrete);
  box([hallWidth, 0.32, hallLength], [0, hallHeight + 0.16, hallCenter], surfaces.concrete);

  // The entry wall itself is the first portal; the two following bulkheads are fully tied into the hall walls.
  portalBulkhead({
    z: -6.15,
    width: hallWidth,
    height: hallHeight,
    depth: 0.52,
    label: 'inner pressure seal',
  });
  portalBulkhead({
    z: -13.35,
    width: hallWidth,
    height: hallHeight,
    depth: 0.52,
    label: 'corridor isolation seal',
  });

  // Structural ribs, cable trays and utility runs create scale and measurable tunnel depth.
  for (const z of [-2.2, -4.3, -8.2, -10.3, -15.4, -17.5, -21.4, -23.3]) {
    for (const side of [-1, 1]) {
      box([0.11, hallHeight, 0.18], [side * 1.39, hallHeight / 2, z], surfaces.steel);
      box([0.42, 0.08, 0.18], [side * 1.37, 2.9, z], surfaces.concrete);
    }
  }
  for (const side of [-1, 1]) {
    box([0.2, 0.15, hallLength - 0.3], [side * 0.93, 3.16, hallCenter], surfaces.steel);
    box([0.11, 0.11, hallLength - 0.3], [side * 1.23, 2.93, hallCenter], surfaces.steel);
    pipeBetween(
      [side * 1.38, 2.76, hallStart - 0.25],
      [side * 1.38, 2.76, hallEnd + 0.2],
      0.038,
      surfaces.steel,
    );
  }
  pipeBetween([0, 3.08, hallStart - 0.2], [0, 3.08, hallEnd + 0.2], 0.064, surfaces.steel);
  for (const z of [-0.8, -4.2, -8.1, -12.0, -15.9, -19.8, -23.1]) {
    box([0.86, 0.07, 0.25], [0, 3.2, z], surfaces.steel);
    box([0.64, 0.018, 0.12], [0, 3.151, z], diffuser);
    const lamp = new THREE.PointLight(0xcbd9d3, 7.5, 7.0, 1.8);
    lamp.position.set(0, 3.0, z);
    scene.add(lamp);
  }
  for (const { z } of doors) {
    // Top-of-door conduit bridges connect the access seals into the overhead service runs.
    box([1.15, 0.09, 0.12], [0, 3.02, z], surfaces.steel);
    for (const side of [-1, 1]) {
      pipeBetween([side * 1.22, 2.82, z], [side * 1.22, 2.82, z - 1.2], 0.026, surfaces.steel);
    }
  }

  const started = performance.now();
  return {
    render(renderer, now) {
      const t = THREE.MathUtils.clamp((now - started) / ARRIVAL_DURATION, 0, 1);
      const ease = t * t * (3 - 2 * t);
      camera.position.set(
        3.5 * Math.pow(1 - Math.min(1, t / 0.38), 2),
        1.68 + 0.95 * Math.pow(1 - t, 4),
        13 - ease * 32.5,
      );
      camera.lookAt(0, 1.62, Math.min(1.15, camera.position.z - 4.5));
      camera.aspect =
        renderer.domElement.clientWidth / Math.max(1, renderer.domElement.clientHeight);
      camera.updateProjectionMatrix();

      for (const { hinge, z } of doors) {
        const distance = camera.position.z - z;
        const opening = THREE.MathUtils.clamp((6.2 - distance) / 4.1, 0, 1);
        hinge.rotation.y = opening * 1.82;
      }

      renderer.render(scene, camera);
      const caption =
        t < 0.26
          ? 'EINGANG / SCHUTZBAU'
          : t < 0.58
            ? 'ÄUSSERE SCHLEUSE'
            : t < 0.82
              ? 'DRUCKSCHLEUSE'
              : 'ZUGANG ZUM FLUR';
      return { done: t >= 1, progress: t, caption };
    },
    dispose() {
      geometries.forEach((geometry) => geometry.dispose());
      ownedMaterials.forEach((material) => material.dispose());
      surfaces.dispose();
      signTexture.dispose();
    },
  };
}
