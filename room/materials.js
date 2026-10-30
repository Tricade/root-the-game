/** 3D materials. The per-view context owns scene resources and mutable interaction state. */
export function createRoomMaterials(sceneContext) {
  function makeMaterials() {
    sceneContext.materials = {
      shell: new sceneContext.THREE.MeshStandardMaterial({
        color: 0x333b3a,
        metalness: 0.68,
        roughness: 0.31,
      }),
      shellDark: new sceneContext.THREE.MeshStandardMaterial({
        color: 0x141a1b,
        metalness: 0.62,
        roughness: 0.36,
      }),
      rail: new sceneContext.THREE.MeshStandardMaterial({
        color: 0x87908c,
        metalness: 0.82,
        roughness: 0.25,
      }),
      trim: new sceneContext.THREE.MeshStandardMaterial({
        color: 0x4b5755,
        metalness: 0.74,
        roughness: 0.27,
      }),
      face: new sceneContext.THREE.MeshStandardMaterial({
        color: 0x555e5b,
        metalness: 0.46,
        roughness: 0.33,
      }),
      panel: new sceneContext.THREE.MeshStandardMaterial({
        color: 0x303938,
        metalness: 0.48,
        roughness: 0.34,
      }),
      vent: new sceneContext.THREE.MeshStandardMaterial({
        color: 0x101717,
        metalness: 0.35,
        roughness: 0.54,
      }),
      floor: new sceneContext.THREE.MeshStandardMaterial({
        color: 0x798381,
        metalness: 0.15,
        roughness: 0.48,
      }),
      rubber: new sceneContext.THREE.MeshStandardMaterial({
        color: 0x121718,
        metalness: 0.08,
        roughness: 0.78,
      }),
      brushed: new sceneContext.THREE.MeshStandardMaterial({
        color: 0x69716e,
        metalness: 0.78,
        roughness: 0.28,
      }),
      wall: new sceneContext.THREE.MeshStandardMaterial({
        color: 0x202526,
        metalness: 0.34,
        roughness: 0.54,
      }),
      ceiling: new sceneContext.THREE.MeshStandardMaterial({
        color: 0x171d1e,
        metalness: 0.44,
        roughness: 0.52,
      }),
      black: new sceneContext.THREE.MeshStandardMaterial({
        color: 0x070c0d,
        metalness: 0.3,
        roughness: 0.56,
      }),
      green: new sceneContext.THREE.MeshStandardMaterial({
        color: 0x8bc75b,
        emissive: 0x4c9424,
        emissiveIntensity: 1.1,
        roughness: 0.25,
      }),
      amber: new sceneContext.THREE.MeshStandardMaterial({
        color: 0xe1b062,
        emissive: 0x75400b,
        emissiveIntensity: 0.9,
        roughness: 0.24,
      }),
      red: new sceneContext.THREE.MeshStandardMaterial({
        color: 0xf07060,
        emissive: 0x7a2119,
        emissiveIntensity: 0.95,
        roughness: 0.24,
      }),
      blue: new sceneContext.THREE.MeshStandardMaterial({
        color: 0x86d5e9,
        emissive: 0x236c83,
        emissiveIntensity: 0.86,
        roughness: 0.2,
      }),
      off: new sceneContext.THREE.MeshStandardMaterial({
        color: 0x172022,
        emissive: 0x071011,
        emissiveIntensity: 0.25,
        roughness: 0.4,
      }),
      indicator: new sceneContext.THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.65,
        roughness: 0.3,
      }),
      glow: new sceneContext.THREE.MeshBasicMaterial({ color: 0x9be064 }),
      lightWhite: new sceneContext.THREE.MeshBasicMaterial({ color: 0xdaedf4 }),
      cableLive: new sceneContext.THREE.MeshStandardMaterial({
        color: 0x87c858,
        emissive: 0x31591e,
        emissiveIntensity: 0.55,
        roughness: 0.42,
      }),
      cableDown: new sceneContext.THREE.MeshStandardMaterial({ color: 0x554a33, roughness: 0.5 }),
      grille: new sceneContext.THREE.MeshStandardMaterial({
        color: 0x293231,
        metalness: 0.42,
        roughness: 0.62,
      }),
      door: new sceneContext.THREE.MeshStandardMaterial({
        color: 0xc4d0cb,
        map: makeGrilleTexture(true),
        metalness: 0.56,
        roughness: 0.34,
        transparent: true,
        opacity: 0.32,
        alphaTest: 0.06,
        depthWrite: false,
        side: sceneContext.THREE.DoubleSide,
      }),
    };
    sceneContext.materials.grille.map = makeGrilleTexture();
    sceneContext.materials.grille.map.colorSpace = sceneContext.THREE.SRGBColorSpace;
    sceneContext.materials.grille.needsUpdate = true;
    // Micro-bead grain breaks up the uniform plastic look while staying self-contained.
    const brushed = document.createElement('canvas');
    brushed.width = 128;
    brushed.height = 128;
    const bg = brushed.getContext('2d');
    bg.fillStyle = '#777f7d';
    bg.fillRect(0, 0, 128, 128);
    let grain = 1187;
    for (let i = 0; i < 1700; i++) {
      grain = (grain * 1664525 + 1013904223) >>> 0;
      const y = grain % 128;
      const shade = grain & 1 ? '#ffffff0d' : '#10181810';
      bg.fillStyle = shade;
      bg.fillRect(0, y, 128, 1);
    }
    const grainMap = new sceneContext.THREE.CanvasTexture(brushed);
    grainMap.wrapS = grainMap.wrapT = sceneContext.THREE.RepeatWrapping;
    grainMap.repeat.set(2, 2);
    grainMap.colorSpace = sceneContext.THREE.SRGBColorSpace;
    sceneContext.materials.brushed.map = grainMap;
    sceneContext.materials.brushed.needsUpdate = true;
    const tiles = document.createElement('canvas');
    tiles.width = tiles.height = 256;
    const ctx = tiles.getContext('2d');
    ctx.fillStyle = '#596363';
    ctx.fillRect(0, 0, 256, 256);
    let seed = 37;
    for (let i = 0; i < 6000; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const x = seed % 256;
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const y = seed % 256;
      ctx.fillStyle = i % 2 ? '#ffffff09' : '#0000000d';
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.strokeStyle = '#242e30';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, 253, 253);
    ctx.strokeStyle = '#819190';
    ctx.lineWidth = 1;
    ctx.strokeRect(4.5, 4.5, 247, 247);
    for (const x of [12, 244])
      for (const y of [12, 244]) {
        ctx.fillStyle = '#263031';
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    const floorMap = new sceneContext.THREE.CanvasTexture(tiles);
    floorMap.wrapS = floorMap.wrapT = sceneContext.THREE.RepeatWrapping;
    floorMap.repeat.set(13.2, 22);
    floorMap.colorSpace = sceneContext.THREE.SRGBColorSpace;
    sceneContext.materials.floor.map = floorMap;
  }

  function makeGrilleTexture(door = false) {
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 96;
    const g = c.getContext('2d');
    if (door) {
      g.clearRect(0, 0, 96, 96);
      g.strokeStyle = 'rgba(207,222,215,.72)';
      g.lineWidth = 1.2;
      for (let x = 0; x <= 96; x += 8) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, 96);
        g.stroke();
      }
      for (let y = 0; y <= 96; y += 8) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(96, y);
        g.stroke();
      }
      const mesh = new sceneContext.THREE.CanvasTexture(c);
      mesh.wrapS = mesh.wrapT = sceneContext.THREE.RepeatWrapping;
      mesh.repeat.set(2, 3);
      mesh.colorSpace = sceneContext.THREE.SRGBColorSpace;
      return mesh;
    }
    g.fillStyle = '#26302f';
    g.fillRect(0, 0, 96, 96);
    // Staggered punched holes with a small highlight lip: reads as perforated steel at distance.
    for (let y = 3; y < 96; y += 8)
      for (let x = y % 16 ? 4 : 8; x < 96; x += 8) {
        g.fillStyle = '#101716';
        g.beginPath();
        g.ellipse(x, y, 1.55, 2.2, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#697571';
        g.lineWidth = 0.65;
        g.beginPath();
        g.ellipse(x - 0.4, y - 0.55, 1.45, 2.05, 0, Math.PI * 1.03, Math.PI * 1.78);
        g.stroke();
      }
    const texture = new sceneContext.THREE.CanvasTexture(c);
    texture.wrapS = texture.wrapT = sceneContext.THREE.RepeatWrapping;
    texture.repeat.set(2.4, 1.4);
    texture.colorSpace = sceneContext.THREE.SRGBColorSpace;
    return texture;
  }
  return { makeMaterials, makeGrilleTexture };
}
