import * as THREE from './vendor/three.module.js';

const QUADRANTS = {
  concrete: { x: 0.5, y: 0.5, width: 0.5, height: 0.5 }, // clean architecture-atlas lower-right
  floor: { x: 0, y: 0.5, width: 0.5, height: 0.5 }, // mat_arch_floor atlas region
  steel: { x: 0.5, y: 0, width: 0.5, height: 0.5 } // mat_brushed_metal hardware-atlas region
};

function materialIn(root, name) {
  let found = null;
  root.traverse(node => {
    if (!node.isMesh) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) if (material?.name === name) found ||= material;
  });
  if (!found) throw new Error(`ROOT-Material nicht gefunden: ${name}`);
  return found;
}

function cropTexture(source, region, owned) {
  if (!source?.image) throw new Error('ROOT-Atlastextur ist noch nicht geladen.');
  const image = source.image;
  const width = image.naturalWidth || image.videoWidth || image.width;
  const height = image.naturalHeight || image.videoHeight || image.height;
  if (!width || !height) throw new Error('ROOT-Atlasbild hat keine lesbare Größe.');

  const sx = Math.round(width * region.x);
  const sy = Math.round(height * region.y);
  const sw = Math.max(1, Math.round(width * region.width));
  const sh = Math.max(1, Math.round(height * region.height));
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas-Kontext für ROOT-Materialien nicht verfügbar.');
  context.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = source.colorSpace || THREE.NoColorSpace;
  // GLTFLoader in the bundled r186.1 sets flipY=false; keep atlas orientation consistent.
  texture.flipY = false;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  owned.push(texture);
  return texture;
}

function rootNormalScale(source) {
  const scale = source?.normalScale || new THREE.Vector2(1, 1);
  return scale.clone(); // loadRootAssets already attenuates the shared normal maps.
}

function makeSurface(source, region, { color, metalness, roughness }, materials, textures) {
  const map = source.map ? cropTexture(source.map, region, textures) : null;
  const normalMap = source.normalMap ? cropTexture(source.normalMap, region, textures) : null;
  // glTFLoader maps the packed ORM atlas to both channels; Three reads G for roughness and B for metalness.
  const ormSource = source.roughnessMap || source.metalnessMap;
  const orm = ormSource ? cropTexture(ormSource, region, textures) : null;
  const material = new THREE.MeshStandardMaterial({
    color,
    map,
    normalMap,
    normalScale: rootNormalScale(source),
    roughnessMap: orm,
    metalnessMap: orm,
    metalness,
    roughness
  });
  materials.push(material);
  return material;
}

/** Build owned, tiled bunker materials from the loaded ROOT atlas images. */
export function createBunkerSurfaces(bank) {
  const wall = materialIn(bank.make('airlock'), 'mat_arch_steel');
  const floorSource = materialIn(bank.make('floor'), 'mat_arch_floor');
  const steelSource = materialIn(bank.make('airlock'), 'mat_brushed_metal');
  const ownedMaterials = [], ownedTextures = [];

  const surfaces = {
    concrete: makeSurface(wall, QUADRANTS.concrete,
      { color: 0xa9aaa4, metalness: 0, roughness: 0.96 }, ownedMaterials, ownedTextures),
    floor: makeSurface(floorSource, QUADRANTS.floor,
      { color: 0x737a7b, metalness: 0.12, roughness: 0.91 }, ownedMaterials, ownedTextures),
    steel: makeSurface(steelSource, QUADRANTS.steel,
      { color: 0x747b7e, metalness: 0.72, roughness: 0.86 }, ownedMaterials, ownedTextures),
    dispose() {
      ownedMaterials.forEach(material => material.dispose());
      ownedTextures.forEach(texture => texture.dispose());
    }
  };
  // The source quadrant is architectural steel. Reuse its grain as concrete,
  // but do not multiply concrete roughness by the steel ORM channel.
  surfaces.concrete.roughnessMap = null;
  surfaces.concrete.metalnessMap = null;
  surfaces.floor.roughnessMap = null;
  return surfaces;
}

/** A box whose UVs repeat one atlas tile per two metres on every face. Caller owns geometry disposal. */
export function metricBox(size, material) {
  const [width, height, depth] = size;
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const uv = geometry.getAttribute('uv');
  const faceDimensions = [
    [depth, height], [depth, height],
    [width, depth], [width, depth],
    [width, height], [width, height]
  ];
  for (let face = 0; face < 6; face++) {
    const [uLength, vLength] = faceDimensions[face];
    for (let vertex = face * 4; vertex < face * 4 + 4; vertex++) {
      uv.setXY(vertex, uv.getX(vertex) * uLength / 2, uv.getY(vertex) * vLength / 2);
    }
  }
  uv.needsUpdate = true;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
