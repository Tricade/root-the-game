/** 3D primitives. The per-view context owns scene resources and mutable interaction state. */
export function createRoomPrimitives(sceneContext) {
  function boxGeometry(w, h, d, radius = 0) {
    radius = Math.min(radius, w / 2, h / 2, d / 2);
    const key = [w, h, d, radius].map((n) => n.toFixed(3)).join(':');
    if (!sceneContext.sharedGeometries.has(key))
      sceneContext.sharedGeometries.set(
        key,
        radius > 0.001
          ? new sceneContext.RoundedBoxGeometry(w, h, d, 1, radius)
          : new sceneContext.THREE.BoxGeometry(w, h, d),
      );
    return sceneContext.sharedGeometries.get(key);
  }

  function sphereGeometry(radius, segments = 10) {
    const key = 's:' + radius + ':' + segments;
    if (!sceneContext.sharedGeometries.has(key))
      sceneContext.sharedGeometries.set(
        key,
        new sceneContext.THREE.SphereGeometry(radius, segments, Math.max(6, segments - 2)),
      );
    return sceneContext.sharedGeometries.get(key);
  }

  function cylinderGeometry(radiusTop, radiusBottom, height, segments = 12) {
    const key = ['c', radiusTop, radiusBottom, height, segments].join(':');
    if (!sceneContext.sharedGeometries.has(key))
      sceneContext.sharedGeometries.set(
        key,
        new sceneContext.THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
      );
    return sceneContext.sharedGeometries.get(key);
  }

  function planeGeometry(w, h) {
    const key = ['p', w, h].join(':');
    if (!sceneContext.sharedGeometries.has(key))
      sceneContext.sharedGeometries.set(key, new sceneContext.THREE.PlaneGeometry(w, h));
    return sceneContext.sharedGeometries.get(key);
  }

  function addBox(parent, w, h, d, material, x = 0, y = 0, z = 0, options = {}) {
    const mesh = new sceneContext.THREE.Mesh(boxGeometry(w, h, d, options.radius || 0), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = options.castShadow !== false;
    mesh.receiveShadow = options.receiveShadow !== false;
    if (options.rotation)
      mesh.rotation.set(options.rotation[0], options.rotation[1], options.rotation[2]);
    if (options.scale) mesh.scale.set(options.scale[0], options.scale[1], options.scale[2]);
    parent.add(mesh);
    return mesh;
  }

  function addBoxInstances(parent, w, h, d, material, positions, persistent = false, radius = 0) {
    const mesh = new sceneContext.THREE.InstancedMesh(
      boxGeometry(w, h, d, radius),
      material,
      positions.length,
    );
    const transform = new sceneContext.THREE.Object3D();
    positions.forEach((point, index) => {
      transform.position.set(point[0], point[1], point[2]);
      transform.rotation.set(point[3] || 0, point[4] || 0, point[5] || 0);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    parent.add(mesh);
    (persistent ? sceneContext.staticInstances : sceneContext.dynamicInstances).push(mesh);
    return mesh;
  }

  function addDotInstances(parent, radius, material, positions, offColor = 0x172022) {
    const mesh = new sceneContext.THREE.InstancedMesh(
      sphereGeometry(radius),
      material,
      positions.length,
    );
    const transform = new sceneContext.THREE.Object3D();
    positions.forEach((point, index) => {
      transform.position.set(point[0], point[1], point[2]);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
      mesh.setColorAt(index, new sceneContext.THREE.Color(offColor));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    parent.add(mesh);
    sceneContext.dynamicInstances.push(mesh);
    return mesh;
  }

  function addDot(parent, x, y, z, material, radius = 0.026) {
    const mesh = new sceneContext.THREE.Mesh(sphereGeometry(radius), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    parent.add(mesh);
    return mesh;
  }

  function labelTexture(lines, options = {}) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = options.bg || '#171f20';
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = options.accent || '#a6d876';
    g.fillRect(0, 0, 7, c.height);
    g.font = '600 32px Segoe UI, Arial';
    g.fillStyle = '#e3e9e3';
    g.fillText(String(lines[0] || '').slice(0, 28), 24, 54);
    g.font = '20px Consolas, monospace';
    g.fillStyle = '#90a09f';
    g.fillText(String(lines[1] || '').slice(0, 36), 24, 93);
    const t = new sceneContext.THREE.CanvasTexture(c);
    t.colorSpace = sceneContext.THREE.SRGBColorSpace;
    sceneContext.dynamicTextures.push(t);
    return t;
  }

  function labelMaterial(lines, options) {
    const material = new sceneContext.THREE.MeshBasicMaterial({
      map: labelTexture(lines, options),
      color: 0xffffff,
      toneMapped: false,
      side: sceneContext.THREE.DoubleSide,
    });
    sceneContext.dynamicMaterials.push(material);
    return material;
  }
  return {
    boxGeometry,
    sphereGeometry,
    cylinderGeometry,
    planeGeometry,
    addBox,
    addBoxInstances,
    addDotInstances,
    addDot,
    labelTexture,
    labelMaterial,
  };
}
