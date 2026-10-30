import * as THREE from './vendor/three.module.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { createStations } from './room-stations.js';
import { loadRootAssets, buildAssetRack, updateAssetRack, animateAssetRack, buildAssetHall } from './room-assets.js';
import { roomLocation, corridorPlan, stairHeight, buildFacilityInterior } from './room-facility.js';
import { createBunkerSurfaces } from './room-surfaces.js';
import { createArrival } from './room-arrival.js';

// Keyup stops immediately; the lease also clears a release lost by an embedded browser.
// Repeats from any held key preserve diagonals, while stale repeats cannot revive a reset.
export function createMovementKeys(now = () => performance.now()) {
  const held = new Set();
  let lastSignal = 0, repeating = false;
  return {
    press(code, repeat = false) {
      if (repeat && !held.has(code)) return;
      held.add(code); lastSignal = now(); repeating = repeat;
    },
    delete(code) { held.delete(code); },
    has(code) { return held.has(code); },
    get size() { return held.size; },
    clear() { held.clear(); repeating = false; },
    expire() { if (held.size && now() - lastSignal > (repeating ? 450 : 1500)) this.clear(); }
  };
}

const STATUS_TEXT = {
  online: 'Online', failed: 'Defekt', repairing: 'In Reparatur', standby: 'Ausgeschaltet',
  booting: 'Startet', disconnected: 'Kein Link', maintenance: 'Wartungsfenster', limited: 'Begrenzt'
};

export function rackInteraction(cabinet,hitDoor=false) {
  if(!cabinet)return 'hardware';
  if(!cabinet.doorOpen)return 'open-door';
  if(hitDoor)return 'close-door';
  if(cabinet.doors.some(door=>Math.abs(door.rotation.y)<1.1))return 'opening';
  return 'hardware';
}

// A tab-local view is intentionally separate from the portable simulation save.
export function readRoomSession(storage, layout, central) {
  try {
    const view = JSON.parse(storage.getItem('root.room.view'));
    if (!view || view.version !== 1 || typeof view.id !== 'string' || !Number.isInteger(view.floor)) return null;
    const destination = roomLocation(layout, view.id, view.floor);
    if (destination.id !== view.id || destination.floor !== view.floor) return null;
    const system = central.systems.find(item => item.id === view.id);
    if (system && !system.available) return null;
    if (typeof view.exploring !== 'boolean' || !Array.isArray(view.position) || view.position.length !== 3 ||
        !view.position.every(Number.isFinite) || !Number.isFinite(view.yaw) || !Number.isFinite(view.pitch)) return null;
    return { id: view.id, floor: view.floor, exploring: view.exploring, position: view.position,
      yaw: view.yaw % (Math.PI * 2), pitch: THREE.MathUtils.clamp(view.pitch, -1.15, 1.15) };
  } catch { return null; }
}

export function createRoom({ E, getState, openRack, openServer, openProtection, openView, onExit, esc, fmt, dec }) {
  let scene, camera, renderer, shell, canvas, stage, nav, summary, statusLine, fallback;
  let resizeObserver, mounted = false, hidden = true, exploring = false, pointerLocked = false;
  let inViewport=true, visibilityObserver;
  let assetBank = null, worldLoading = null, assetHitMaterial, assetHall;
  let consoleOpen=false, consolePanel, consoleContent, stationSystem, targetStation=null;
  let animationFrame = 0, lastFrame = 0, lastFrameTime = 0, lastTargetAt = 0;
  let yaw = 0, pitch = -0.02, dragPoint = null, dragMoved = false, eyeHeight = 1.62;
  let targetRack = null, targetServer = null, targetDoor = false;
  let locationId='hall', selectedFloor=1, facilityInterior, targetPortal=null, placeNav, placeSignature='', roomTransitionUntil=0;
  let arrival=null,arrivalOverlay,arrivalRequested=false;
  let sessionRestored=false, explicitDestination=false, pendingSession=null, lastSessionWrite=0, lastSessionValue='';
  const tr=text=>window.ROOTI18N?.translate(String(text))||String(text);
  const facilityLayout=()=>E.getFacilityLayout(getState());
  const centralModel=()=>E.getCentralInfrastructure(getState());
  const currentLocation=()=>roomLocation(facilityLayout(),locationId,selectedFloor);
  const visibleRacks=racks=>{const ids=new Set(currentLocation().rackIds);return racks.filter(rack=>ids.has(rack.id));};
  let structuralSignature = '', lastRoomLanguage = '', rackGeneration = 0, rackGroups = new Map(), serverGroups = new Map(), rackRefs = new Map(), serverRefs = new Map(), currentRacks = [], pickTargets = [];
  let dynamicTextures = [], dynamicMaterials = [], dynamicGeometries = [], dynamicInstances = [], staticInstances = [], sharedGeometries = new Map(), materials = {};
  let isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const keys = createMovementKeys();
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  const escapeHtml = value => esc ? esc(String(value ?? '')) : String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const duration = seconds => {
    const n = Math.max(0, Math.ceil(seconds || 0));
    return n >= 3600 ? Math.floor(n / 3600) + ' h ' + Math.floor(n % 3600 / 60) + ' min' : n >= 60 ? Math.floor(n / 60) + ' min ' + n % 60 + ' s' : n + ' s';
  };
  const number = value => fmt ? fmt(value) : Math.round(value || 0).toLocaleString('de-DE');
  const decimal = value => dec ? dec(value) : Number(value || 0).toFixed(1).replace('.', ',');
  const watts = value => value >= 1000 ? decimal(value / 1000) + ' kW' : number(value) + ' W';
  const allRacks = () => E.getRackModel(getState()).racks;

  function markup() {
    return '<div class="root-room-host"><div class="root-room-slot" data-room-slot></div></div>';
  }

  function makeMaterials() {
    materials = {
      shell: new THREE.MeshStandardMaterial({ color: 0x333b3a, metalness: 0.68, roughness: 0.31 }),
      shellDark: new THREE.MeshStandardMaterial({ color: 0x141a1b, metalness: 0.62, roughness: 0.36 }),
      rail: new THREE.MeshStandardMaterial({ color: 0x87908c, metalness: 0.82, roughness: 0.25 }),
      trim: new THREE.MeshStandardMaterial({ color: 0x4b5755, metalness: 0.74, roughness: 0.27 }),
      face: new THREE.MeshStandardMaterial({ color: 0x555e5b, metalness: 0.46, roughness: 0.33 }),
      panel: new THREE.MeshStandardMaterial({ color: 0x303938, metalness: 0.48, roughness: 0.34 }),
      vent: new THREE.MeshStandardMaterial({ color: 0x101717, metalness: 0.35, roughness: 0.54 }),
      floor: new THREE.MeshStandardMaterial({ color: 0x798381, metalness: 0.15, roughness: 0.48 }),
      rubber: new THREE.MeshStandardMaterial({ color: 0x121718, metalness: 0.08, roughness: 0.78 }),
      brushed: new THREE.MeshStandardMaterial({ color: 0x69716e, metalness: 0.78, roughness: 0.28 }),
      wall: new THREE.MeshStandardMaterial({ color: 0x202526, metalness: 0.34, roughness: 0.54 }),
      ceiling: new THREE.MeshStandardMaterial({ color: 0x171d1e, metalness: 0.44, roughness: 0.52 }),
      black: new THREE.MeshStandardMaterial({ color: 0x070c0d, metalness: 0.3, roughness: 0.56 }),
      green: new THREE.MeshStandardMaterial({ color: 0x8bc75b, emissive: 0x4c9424, emissiveIntensity: 1.1, roughness: 0.25 }),
      amber: new THREE.MeshStandardMaterial({ color: 0xe1b062, emissive: 0x75400b, emissiveIntensity: 0.9, roughness: 0.24 }),
      red: new THREE.MeshStandardMaterial({ color: 0xf07060, emissive: 0x7a2119, emissiveIntensity: 0.95, roughness: 0.24 }),
      blue: new THREE.MeshStandardMaterial({ color: 0x86d5e9, emissive: 0x236c83, emissiveIntensity: 0.86, roughness: 0.2 }),
      off: new THREE.MeshStandardMaterial({ color: 0x172022, emissive: 0x071011, emissiveIntensity: 0.25, roughness: 0.4 }),
      indicator: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.65, roughness: 0.3 }),
      glow: new THREE.MeshBasicMaterial({ color: 0x9be064 }),
      lightWhite: new THREE.MeshBasicMaterial({ color: 0xdaedf4 }),
      cableLive: new THREE.MeshStandardMaterial({ color: 0x87c858, emissive: 0x31591e, emissiveIntensity: 0.55, roughness: 0.42 }),
      cableDown: new THREE.MeshStandardMaterial({ color: 0x554a33, roughness: 0.5 }),
      grille: new THREE.MeshStandardMaterial({ color: 0x293231, metalness: 0.42, roughness: 0.62 }),
      door: new THREE.MeshStandardMaterial({ color: 0xc4d0cb, map: makeGrilleTexture(true), metalness: 0.56, roughness: 0.34, transparent: true, opacity: 0.32, alphaTest: 0.06, depthWrite: false, side: THREE.DoubleSide })
    };
    materials.grille.map = makeGrilleTexture();
    materials.grille.map.colorSpace = THREE.SRGBColorSpace;
    materials.grille.needsUpdate = true;
    // Micro-bead grain breaks up the uniform plastic look while staying self-contained.
    const brushed = document.createElement('canvas'); brushed.width = 128; brushed.height = 128;
    const bg = brushed.getContext('2d'); bg.fillStyle = '#777f7d'; bg.fillRect(0, 0, 128, 128);
    let grain = 1187;
    for (let i = 0; i < 1700; i++) { grain = (grain * 1664525 + 1013904223) >>> 0; const y = grain % 128; const shade = grain & 1 ? '#ffffff0d' : '#10181810'; bg.fillStyle = shade; bg.fillRect(0, y, 128, 1); }
    const grainMap = new THREE.CanvasTexture(brushed); grainMap.wrapS = grainMap.wrapT = THREE.RepeatWrapping; grainMap.repeat.set(2, 2); grainMap.colorSpace = THREE.SRGBColorSpace;
    materials.brushed.map = grainMap; materials.brushed.needsUpdate = true;
    const tiles = document.createElement('canvas'); tiles.width = tiles.height = 256;
    const ctx = tiles.getContext('2d');
    ctx.fillStyle='#596363';ctx.fillRect(0,0,256,256);
    let seed=37;
    for(let i=0;i<6000;i++){seed=(seed*1664525+1013904223)>>>0;const x=seed%256;seed=(seed*1664525+1013904223)>>>0;const y=seed%256;ctx.fillStyle=i%2?'#ffffff09':'#0000000d';ctx.fillRect(x,y,1,1);}
    ctx.strokeStyle='#242e30';ctx.lineWidth=3;ctx.strokeRect(1.5,1.5,253,253);
    ctx.strokeStyle='#819190';ctx.lineWidth=1;ctx.strokeRect(4.5,4.5,247,247);
    for(const x of [12,244])for(const y of [12,244]){ctx.fillStyle='#263031';ctx.beginPath();ctx.arc(x,y,2,0,Math.PI*2);ctx.fill();}
    const floorMap=new THREE.CanvasTexture(tiles);floorMap.wrapS=floorMap.wrapT=THREE.RepeatWrapping;floorMap.repeat.set(13.2,22);floorMap.colorSpace=THREE.SRGBColorSpace;
    materials.floor.map=floorMap;
  }

  function makeGrilleTexture(door = false) {
    const c = document.createElement('canvas'); c.width = 96; c.height = 96;
    const g = c.getContext('2d');
    if (door) {
      g.clearRect(0, 0, 96, 96); g.strokeStyle = 'rgba(207,222,215,.72)'; g.lineWidth = 1.2;
      for (let x = 0; x <= 96; x += 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 96); g.stroke(); }
      for (let y = 0; y <= 96; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(96, y); g.stroke(); }
      const mesh = new THREE.CanvasTexture(c); mesh.wrapS = mesh.wrapT = THREE.RepeatWrapping; mesh.repeat.set(2, 3); mesh.colorSpace = THREE.SRGBColorSpace; return mesh;
    }
    g.fillStyle = '#26302f'; g.fillRect(0, 0, 96, 96);
    // Staggered punched holes with a small highlight lip: reads as perforated steel at distance.
    for (let y = 3; y < 96; y += 8) for (let x = (y % 16 ? 4 : 8); x < 96; x += 8) {
      g.fillStyle = '#101716'; g.beginPath(); g.ellipse(x, y, 1.55, 2.2, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#697571'; g.lineWidth = 0.65; g.beginPath(); g.ellipse(x - 0.4, y - 0.55, 1.45, 2.05, 0, Math.PI * 1.03, Math.PI * 1.78); g.stroke();
    }
    const texture = new THREE.CanvasTexture(c); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(2.4, 1.4); texture.colorSpace = THREE.SRGBColorSpace; return texture;
  }

  function boxGeometry(w, h, d, radius = 0) {
    radius = Math.min(radius, w / 2, h / 2, d / 2);
    const key = [w, h, d, radius].map(n => n.toFixed(3)).join(':');
    if (!sharedGeometries.has(key)) sharedGeometries.set(key, radius > 0.001 ? new RoundedBoxGeometry(w, h, d, 1, radius) : new THREE.BoxGeometry(w, h, d));
    return sharedGeometries.get(key);
  }

  function sphereGeometry(radius, segments = 10) {
    const key = 's:' + radius + ':' + segments;
    if (!sharedGeometries.has(key)) sharedGeometries.set(key, new THREE.SphereGeometry(radius, segments, Math.max(6, segments - 2)));
    return sharedGeometries.get(key);
  }

  function cylinderGeometry(radiusTop, radiusBottom, height, segments = 12) {
    const key = ['c', radiusTop, radiusBottom, height, segments].join(':');
    if (!sharedGeometries.has(key)) sharedGeometries.set(key, new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments));
    return sharedGeometries.get(key);
  }

  function planeGeometry(w, h) {
    const key = ['p', w, h].join(':');
    if (!sharedGeometries.has(key)) sharedGeometries.set(key, new THREE.PlaneGeometry(w, h));
    return sharedGeometries.get(key);
  }

  function addBox(parent, w, h, d, material, x = 0, y = 0, z = 0, options = {}) {
    const mesh = new THREE.Mesh(boxGeometry(w, h, d, options.radius || 0), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = options.castShadow !== false;
    mesh.receiveShadow = options.receiveShadow !== false;
    if (options.rotation) mesh.rotation.set(options.rotation[0], options.rotation[1], options.rotation[2]);
    if (options.scale) mesh.scale.set(options.scale[0], options.scale[1], options.scale[2]);
    parent.add(mesh); return mesh;
  }

  function addBoxInstances(parent, w, h, d, material, positions, persistent = false, radius = 0) {
    const mesh = new THREE.InstancedMesh(boxGeometry(w, h, d, radius), material, positions.length);
    const transform = new THREE.Object3D();
    positions.forEach((point, index) => {
      transform.position.set(point[0], point[1], point[2]);
      transform.rotation.set(point[3] || 0, point[4] || 0, point[5] || 0);
      transform.updateMatrix(); mesh.setMatrixAt(index, transform.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = false; mesh.receiveShadow = false; parent.add(mesh); (persistent ? staticInstances : dynamicInstances).push(mesh); return mesh;
  }

  function addDotInstances(parent, radius, material, positions, offColor = 0x172022) {
    const mesh = new THREE.InstancedMesh(sphereGeometry(radius), material, positions.length);
    const transform = new THREE.Object3D();
    positions.forEach((point, index) => {
      transform.position.set(point[0], point[1], point[2]); transform.updateMatrix(); mesh.setMatrixAt(index, transform.matrix);
      mesh.setColorAt(index, new THREE.Color(offColor));
    });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = false; mesh.receiveShadow = false; parent.add(mesh); dynamicInstances.push(mesh); return mesh;
  }

  function addDot(parent, x, y, z, material, radius = 0.026) {
    const mesh = new THREE.Mesh(sphereGeometry(radius), material); mesh.position.set(x, y, z); mesh.castShadow = false; parent.add(mesh); return mesh;
  }

  function labelTexture(lines, options = {}) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = options.bg || '#171f20'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = options.accent || '#a6d876'; g.fillRect(0, 0, 7, c.height);
    g.font = '600 32px Segoe UI, Arial'; g.fillStyle = '#e3e9e3'; g.fillText(String(lines[0] || '').slice(0, 28), 24, 54);
    g.font = '20px Consolas, monospace'; g.fillStyle = '#90a09f'; g.fillText(String(lines[1] || '').slice(0, 36), 24, 93);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; dynamicTextures.push(t); return t;
  }

  function labelMaterial(lines, options) {
    const material = new THREE.MeshBasicMaterial({ map: labelTexture(lines, options), color: 0xffffff, toneMapped: false, side: THREE.DoubleSide });
    dynamicMaterials.push(material); return material;
  }

  function buildWorld() {
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x101516); scene.fog = new THREE.Fog(0x101516, 15, 50);
    camera = new THREE.PerspectiveCamera(68, 1, 0.08, 90); camera.position.set(0, eyeHeight, 5.4);
    scene.add(new THREE.HemisphereLight(0xe6f1ef, 0x46504b, 2.05));
    // Broad frontal fill keeps dark hardware legible without bleaching the aisle floor.
    scene.add(new THREE.AmbientLight(0xc5d2d0, 0.32));
    const key = new THREE.DirectionalLight(0xe6f0f0, 0.95); key.position.set(-3.8, 8.5, 2.5); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -10; key.shadow.camera.right = 10; key.shadow.camera.top = 12; key.shadow.camera.bottom = -40; key.shadow.bias = -0.0003; key.shadow.normalBias = 0.025;
    scene.add(key); scene.add(key.target);
    const ambience = new THREE.DirectionalLight(0xc3d4d1, 0.68); ambience.position.set(0, 4.0, 2); scene.add(ambience);
    makeMaterials();
    if(assetBank){const surfaces=createBunkerSurfaces(assetBank);materials.bunkerConcrete=surfaces.concrete;materials.bunkerFloor=surfaces.floor;materials.bunkerSteel=surfaces.steel;}
    const initialRacks = visibleRacks(allRacks());
    const rackLimit = E.getRackModel(getState()).rackLimit || initialRacks.length;
    if (assetBank) assetHall=buildAssetHall({bank:assetBank,scene,materials});
    else buildStaticHall(22);
    rebuildRacks(initialRacks);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
    const environment=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);
    scene.environment=pmrem.fromScene(environment,0.04).texture;scene.environmentIntensity=0.65;
    environment.dispose();pmrem.dispose();
    canvas = renderer.domElement; canvas.className = 'root-room-canvas'; canvas.setAttribute('aria-label', 'Dreidimensionaler, simulierter Serverraum. Tastatur und Maus zum Erkunden; Server und Racks öffnen die Verwaltung.'); canvas.setAttribute('role', 'img'); canvas.tabIndex = 0;
    stage.appendChild(canvas);
    bindCanvas();
    if (resizeObserver) resizeObserver.observe(stage);
    stationSystem=createStations({THREE,scene,E,getState,assetBank});
    stationSystem.setVisible(locationId==='control');
  }

  function buildStaticHall(minLength) {
    const hallLength = Math.max(22, minLength), front = 6.2, center = front - hallLength / 2, back = front - hallLength;
    addBox(scene, 13.2, 0.18, hallLength, materials.floor, 0, -0.14, center, { castShadow: false });
    addBox(scene, 13.2, 0.22, hallLength, materials.ceiling, 0, 4.35, center, { castShadow: false });
    addBox(scene, 0.22, 4.55, hallLength, materials.wall, -6.6, 2.12, center, { castShadow: false });
    addBox(scene, 0.22, 4.55, hallLength, materials.wall, 6.6, 2.12, center, { castShadow: false });
    addBox(scene, 13.2, 4.55, 0.2, materials.wall, 0, 2.12, front, { castShadow: false });
    addBox(scene, 13.2, 4.55, 0.2, materials.wall, 0, 2.12, back, { castShadow: false });
    // A closed, serviceable fire door makes the corridor read as a room, not an infinite set.
    addBox(scene, 2.25, 3.35, 0.08, materials.shellDark, 0, 1.77, back + 0.14, { castShadow: false, radius: 0.035 });
    addBox(scene, 2.06, 3.16, 0.045, materials.face, 0, 1.78, back + 0.085, { castShadow: false, radius: 0.025 });
    addBox(scene, 0.12, 2.15, 0.018, materials.black, -0.68, 1.83, back + 0.055, { castShadow: false, radius: 0.012 });
    addBox(scene, 0.16, 0.045, 0.045, materials.brushed, 0.71, 1.35, back + 0.045, { castShadow: false, radius: 0.015 });
    addBox(scene, 0.48, 0.12, 0.025, materials.panel, 0, 3.55, back + 0.07, { castShadow: false, radius: 0.018 });
    const roomSign = new THREE.Mesh(planeGeometry(0.4, 0.09), labelMaterial(['ROOT · DATENHALLE', 'KALTGANG / ZUTRITT'], { accent: '#a1d56a', bg: '#202a26' }));
    roomSign.position.set(0, 3.55, back + 0.05); scene.add(roomSign);
    // Recessed green floor guides, a bright reference stripe, and cable lanes.
    for (const x of [-2.85, 2.85]) {
      addBox(scene, 0.07, 0.018, hallLength - 2.6, materials.glow, x, -0.035, center, { castShadow: false });
      addBox(scene, 0.18, 0.015, hallLength - 2.6, materials.black, x * 1.08, -0.038, center, { castShadow: false });
    }
    for (const x of [-5.7, 5.7]) {
      addBox(scene, 0.38, 0.12, hallLength - 1.5, materials.shellDark, x, 4.02, center, { castShadow: false });
      addBox(scene, 0.045, 0.02, hallLength - 1.8, materials.green, x, 3.94, center, { castShadow: false });
    }
    // Replaceable raised-floor panels and continuous perforated return-air trenches.
    const seams = [], ventRows = [];
    for (let z = front - 1.8; z > back + 1.2; z -= 1.8) {
      seams.push([-4.9, -0.044, z], [-2.45, -0.044, z], [0, -0.044, z], [2.45, -0.044, z], [4.9, -0.044, z]);
      for (const x of [-4.05, 4.05]) ventRows.push([x, -0.018, z]);
    }
    if (seams.length) addBoxInstances(scene, 0.012, 0.008, 0.075, materials.trim, seams, true);
    if (ventRows.length) {
      addBox(scene, 0.45, 0.008, hallLength - 2.8, materials.black, -4.05, -0.048, center, { castShadow: false });
      addBox(scene, 0.45, 0.008, hallLength - 2.8, materials.black, 4.05, -0.048, center, { castShadow: false });
      const slats = [];
      for (const [x, , z] of ventRows) for (let i = -8; i <= 8; i++) slats.push([x, -0.04, z + i * 0.08]);
      addBoxInstances(scene, 0.38, 0.008, 0.015, materials.rail, slats, true);
    }
    // Ceiling grid and cool white service lights repeat down the hall.
    const rows = Math.max(4, Math.ceil((hallLength - 2.6) / 3.6));
    for (let i = 0; i < rows; i++) {
      const z = front - i * 3.6 - 1.8;
      addBox(scene, 13.0, 0.07, 0.07, materials.trim, 0, 4.18, z, { castShadow: false });
      addBox(scene, 0.7, 0.045, 1.55, materials.grille, 0, 4.18, z - 0.8, { castShadow: false });
      for(const x of [-1.3,1.3])addBox(scene, 0.14, 0.035, 2.25, materials.lightWhite, x, 4.14, z - 0.8, { castShadow: false });
      if (i < 6) {
        for (const x of [-1.8, 1.8]) { const light = new THREE.PointLight(0xe2eff0, 2.4, 7.5, 1.9); light.position.set(x, 3.8, z); scene.add(light); }
      }
    }
    // Paired overhead cable ladders carry recognizable power and data looms.
    for (const x of [-5.0, 5.0]) {
      addBox(scene, 0.16, 0.08, hallLength - 2, materials.rail, x, 3.78, center, { castShadow: false, radius: 0.018 });
      addBox(scene, 0.16, 0.08, hallLength - 2, materials.rail, x, 3.52, center, { castShadow: false, radius: 0.018 });
      for (let i = 0; i < rows; i++) addBox(scene, 0.2, 0.035, 0.16, materials.trim, x, 3.64, front - i * 3.6 - 1.8, { castShadow: false, radius: 0.008 });
      for (let bundle = 0; bundle < 5; bundle++) addBox(scene, 0.028, 0.028, hallLength - 2.5, bundle % 2 ? materials.cableLive : materials.black, x + (bundle - 2) * 0.035, 3.68, center, { castShadow: false, radius: 0.013 });
    }
    for (let i = 0; i < rows; i++) {
      const z = front - i * 3.6 - 1.1;
      addBox(scene, 0.035, 0.008, 0.55, materials.green, -2.86, -0.037, z, { castShadow: false });
      addBox(scene, 0.035, 0.008, 0.55, materials.green, 2.86, -0.037, z, { castShadow: false });
    }
    // In-row precision-cooling cabinets: intake grille, status panel, and paired fan discs.
    for (const x of [-6.12, 6.12]) {
      const unit = new THREE.Group(); unit.position.set(x, 0, back + 3.2); scene.add(unit);
      addBox(unit, 0.72, 2.55, 1.0, materials.shell, 0, 1.28, 0, { castShadow: false, radius: 0.05 });
      addBox(unit, 0.61, 2.23, 0.035, materials.grille, 0, 1.27, 0.52, { castShadow: false, radius: 0.025 });
      addBox(unit, 0.24, 0.12, 0.03, materials.green, 0, 2.27, 0.55, { castShadow: false, radius: 0.02 });
      for (const y of [0.68, 1.15, 1.62]) {
        const fan = new THREE.Mesh(cylinderGeometry(0.16, 0.16, 0.045, 20), materials.black); fan.position.set(0, y, 0.56); unit.add(fan);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.012, 5, 24), materials.rail); ring.position.set(0, y, 0.59); unit.add(ring);
      }
      addBox(unit, 0.025, 2.05, 0.045, materials.trim, -0.26, 1.27, 0.57, { castShadow: false, radius: 0.01 });
    }
  }

  function makeFan(parent, x, y, z, material) {
    const fan = new THREE.Group(); fan.position.set(x, y, z); parent.add(fan);
    const base = new THREE.Mesh(cylinderGeometry(0.23, 0.23, 0.075, 24), materials.black); base.rotation.x = Math.PI / 2; fan.add(base);
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.012, 5, 24), materials.rail); guard.position.z = 0.047; fan.add(guard);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, point = addBox(fan, 0.012, 0.043, 0.012, materials.rail, Math.sin(a) * 0.19, Math.cos(a) * 0.19, 0.045, { castShadow: false, radius: 0.004 });
      point.rotation.z = -a;
    }
    const rotor = new THREE.Group(); fan.add(rotor);
    let bladeGeometry = sharedGeometries.get('fanBlade');
    if (!bladeGeometry) {
      const shape = new THREE.Shape(); shape.moveTo(0.008, 0.025); shape.quadraticCurveTo(0.025, 0.09, 0.16, 0.17); shape.quadraticCurveTo(0.205, 0.20, 0.18, 0.145); shape.quadraticCurveTo(0.135, 0.055, 0.04, 0.012); shape.quadraticCurveTo(0.018, 0.006, 0.008, 0.025);
      bladeGeometry = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 0.003, bevelThickness: 0.002, curveSegments: 3 }); bladeGeometry.translate(-0.08, -0.075, -0.006); sharedGeometries.set('fanBlade', bladeGeometry);
    }
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      const blade = new THREE.Mesh(bladeGeometry, material); blade.rotation.z = angle; blade.position.z = 0.012; blade.castShadow = false; rotor.add(blade);
    }
    const hub = new THREE.Mesh(sphereGeometry(0.055, 12), materials.rail); hub.position.z = 0.02; rotor.add(hub);
    return rotor;
  }

  function buildRack(rack, index, total) {
    if (assetBank) {
      assetHitMaterial ||= new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false});
      const ref=buildAssetRack({bank:assetBank,rack,index,scene,hitMaterial:assetHitMaterial});
      rackGroups.set(rack.id,ref.group);rackRefs.set(rack.id,ref);pickTargets.push(...ref.picks);
      for(const [id,item] of ref.servers){serverGroups.set(id,item.root);serverRefs.set(id,item);}
      return ref.group;
    }
    const group = new THREE.Group(); group.userData.roomKind = 'rack'; group.userData.rackId = rack.id;
    const side = index % 2 === 0 ? -1 : 1;
    const row = Math.floor(index / 2);
    const frontX = side * 3.3;
    group.position.set(frontX, 0, -row * 4.2 - 1.0);
    group.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(group); rackGroups.set(rack.id, group); rackRefs.set(rack.id, { group, leds: [], tempStrip: null, fans: [], panel: null, cables: [] });
    const h = 2.72, w = 1.6, d = 1.0, halfW = w / 2, halfD = d / 2;
    addBox(group, 0.1, h, 0.12, materials.rail, -halfW + 0.06, h / 2, 0, { radius: 0.02 });
    addBox(group, 0.1, h, 0.12, materials.rail, halfW - 0.06, h / 2, 0, { radius: 0.02 });
    addBox(group, w, 0.13, d, materials.shell, 0, 0.08, 0, { radius: 0.035 });
    addBox(group, w, 0.13, d, materials.shell, 0, h - 0.07, 0, { radius: 0.035 });
    addBox(group, w - 0.14, 0.055, 0.04, materials.trim, 0, h - 0.15, halfD + 0.035, { radius: 0.012 });
    addBox(group, w - 0.14, 0.055, 0.04, materials.trim, 0, 0.18, halfD + 0.035, { radius: 0.012 });
    addBox(group, 0.09, h - 0.33, 0.04, materials.trim, -halfW + 0.14, h / 2, halfD + 0.035, { radius: 0.014 });
    addBox(group, 0.09, h - 0.33, 0.04, materials.trim, halfW - 0.14, h / 2, halfD + 0.035, { radius: 0.014 });
    // Recessed chassis back, side panels, and 16 usable height-unit rails.
    addBox(group, w - 0.21, h - 0.23, 0.1, materials.shellDark, 0, h / 2, -halfD + 0.06);
    addBox(group, 0.055, h - 0.3, d - 0.15, materials.shell, -halfW + 0.03, h / 2, 0);
    addBox(group, 0.055, h - 0.3, d - 0.15, materials.shell, halfW - 0.03, h / 2, 0);
    for (const x of [-halfW - 0.01, halfW + 0.01]) {
      addBox(group, 0.018, 0.56, 0.48, materials.panel, x, h * 0.55, -0.11, { castShadow: false, radius: 0.012 });
      addBox(group, 0.02, 0.2, 0.045, materials.rubber, x * 1.006, h * 0.55, 0.17, { castShadow: false, radius: 0.008 });
    }
    const sideLouvers = [];
    for (const x of [-halfW - 0.02, halfW + 0.02]) for (let i = 0; i < 9; i++) sideLouvers.push([x, 0.62 + i * 0.057, -0.11]);
    addBoxInstances(group, 0.012, 0.012, 0.39, materials.brushed, sideLouvers, false, 0.003);
    const unitH = 0.1125, unitBase = 0.32;
    const occupied=new Set(rack.servers.flatMap(s=>Array.from({length:s.units},(_,i)=>s.unit+i)));
    for(let u=2;u<=17;u++)if(!occupied.has(u)){
      const y=unitBase+(u-1.5)*unitH;
      addBox(group,1.29,unitH-0.015,0.035,materials.grille,0,y,halfD+0.025,{castShadow:false,radius:0.007});
      addBox(group,0.022,0.026,0.012,materials.rail,-0.60,y,halfD+0.049,{castShadow:false});
      addBox(group,0.022,0.026,0.012,materials.rail,0.60,y,halfD+0.049,{castShadow:false});
    }
    const unitRails = [], unitClips = [];
    for (let u = 0; u <= 16; u++) {
      const y = unitBase + u * unitH;
      unitRails.push([0, y, halfD + 0.018]);
      if (u < 16) unitClips.push([-halfW + 0.18, y + 0.063, halfD + 0.022]);
    }
    addBoxInstances(group, w - 0.18, 0.018, 0.035, materials.rail, unitRails);
    addBoxInstances(group, 0.12, 0.024, 0.035, materials.amber, unitClips);
    const rackScrews = [];
    for (let u = 1; u <= 16; u += 2) for (const x of [-0.69, 0.69]) rackScrews.push([x, unitBase + (u - 0.5) * unitH, halfD + 0.045]);
    addBoxInstances(group, 0.026, 0.026, 0.012, materials.brushed, rackScrews, false, 0.006);
    // Top fascia and a physically legible rack nameplate.
    addBox(group, w - 0.16, 0.25, 0.055, materials.panel, 0, h - 0.27, halfD + 0.05, { radius: 0.028 });
    const rackTag = new THREE.Mesh(planeGeometry(1.1, 0.18), labelMaterial([rack.name.toUpperCase(), 'ROOT / CABINET 19 IN'], { accent: '#9ce265' }));
    rackTag.position.set(0, h - 0.27, halfD + 0.082); group.add(rackTag);
    const rackLights = [materials.off, materials.off, materials.off].map((m, i) => addDot(group, -0.58 + i * 0.1, h - 0.36, halfD + 0.086, m, 0.025));
    const innerFill = addBox(group, 0.035, 0.11, 0.012, materials.green, halfW - 0.19, h / 2, halfD + 0.09, { castShadow: false });
    const bottomFascia = addBox(group, w - 0.16, 0.19, 0.055, materials.panel, 0, 0.23, halfD + 0.05, { radius: 0.02 });
    const pdu = addBox(group, w - 0.25, 0.13, 0.055, materials.face, 0, 0.21, halfD + 0.088, { castShadow: false, radius: 0.018 });
    const pduDisplay = addBox(group, 0.2, 0.07, 0.014, materials.green, 0, 0.21, halfD + 0.12, { castShadow: false, radius: 0.01 });
    const pduPositions = [], pduLedPositions = [];
    for (let port = 0; port < 16; port++) {
      const px = -0.56 + port * 0.074;
      pduPositions.push([px, 0.21, halfD + 0.12]); pduLedPositions.push([px, 0.21 + 0.033, halfD + 0.14]);
    }
    addBoxInstances(group, 0.045, 0.072, 0.028, materials.black, pduPositions, false, 0.006);
    const pduOutletLights = addDotInstances(group, 0.012, materials.indicator, pduLedPositions);
    // Switch sits above the 16U server bay; the PDU occupies its own base.
    const switchMesh = addBox(group, w - 0.25, 0.12, 0.28, materials.face, 0, h - 0.48, halfD + 0.12, { castShadow: false, radius: 0.018 });
    const switchSocketPositions = [], switchLinkPositions = [], switchTrafficPositions = [], switchPorts = [];
    for (let p = 0; p < Math.min(16, rack.ports.length); p++) {
      const px = -0.58 + p * 0.075;
      switchSocketPositions.push([px, h - 0.48, halfD + 0.27]);
      switchLinkPositions.push([px - 0.009, h - 0.435, halfD + 0.29]);
      switchTrafficPositions.push([px + 0.011, h - 0.435, halfD + 0.29]);
      switchPorts.push({ number: p + 1, traffic: false, linked: false });
    }
    addBoxInstances(group, 0.05, 0.055, 0.03, materials.black, switchSocketPositions, false, 0.006);
    const switchLinkLights = addDotInstances(group, 0.01, materials.indicator, switchLinkPositions);
    const switchTrafficLights = addDotInstances(group, 0.01, materials.indicator, switchTrafficPositions);
    addBox(group, 0.18, 0.07, 0.04, materials.green, 0.56, h - 0.48, halfD + 0.28, { castShadow: false });
    const fans = [makeFan(group, -0.45, h + 0.03, 0, materials.green), makeFan(group, 0.45, h + 0.03, 0, materials.green)];
    const topStrip = addBox(group, 0.035, 0.05, 0.9, materials.green, side < 0 ? halfW - 0.035 : -halfW + 0.035, h - 0.38, 0, { castShadow: false });
    rackRefs.get(rack.id).leds = rackLights; rackRefs.get(rack.id).tempStrip = topStrip; rackRefs.get(rack.id).fans = fans;
    rackRefs.get(rack.id).switchPorts = switchPorts;
    rackRefs.get(rack.id).switchLinkLights = switchLinkLights; rackRefs.get(rack.id).switchTrafficLights = switchTrafficLights;
    rackRefs.get(rack.id).pduOutletLights = pduOutletLights;
    rackRefs.get(rack.id).panel = innerFill; rackRefs.get(rack.id).switch = switchMesh; rackRefs.get(rack.id).pdu = pdu; rackRefs.get(rack.id).pduDisplay = pduDisplay;
    // Servers use the real 1/2/3U placements and have drive bays, ventilation, ports, and state LEDs.
    for (const server of rack.servers) buildServer(group, rack, server, unitBase, unitH, h, halfD);
    // Fine wire-mesh door sits ahead of the live hardware; transparent cells preserve legibility.
    const door = new THREE.Mesh(planeGeometry(w - 0.16, h - 0.36), materials.door);
    door.position.set(0, h / 2, halfD + 0.585); door.renderOrder = 2; door.castShadow = false; group.add(door);
    addBox(group, 0.045, h - 0.36, 0.065, materials.shell, -halfW + 0.11, h / 2, halfD + 0.6, { castShadow: false, radius: 0.015 });
    addBox(group, 0.045, h - 0.36, 0.065, materials.shell, halfW - 0.11, h / 2, halfD + 0.6, { castShadow: false, radius: 0.015 });
    addBox(group, 0.035, 0.31, 0.055, materials.brushed, -halfW + 0.13, h / 2, halfD + 0.63, { castShadow: false, radius: 0.014 });
    // Side-mounted rack access tag is also a valid pick target for rack-level management.
    const hitMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.001, depthWrite: false, color: 0xffffff }); dynamicMaterials.push(hitMaterial);
    const hit = addBox(group, w - 0.15, h - 0.38, 0.025, hitMaterial, 0, h / 2, halfD - 0.08, { castShadow: false });
    hit.userData.roomKind = 'rack'; hit.userData.rackId = rack.id;
    pickTargets.push(hit);
    return group;
  }

  function buildServer(rackGroup, rack, server, unitBase, unitH, rackH, halfD) {
    const group = new THREE.Group(); group.userData.roomKind = 'server'; group.userData.rackId = rack.id; group.userData.serverId = server.id;
    const y = unitBase + ((server.unit - 2) + server.units / 2) * unitH;
    const h = server.units * unitH - 0.018, w = 1.29;
    group.position.set(0, y, halfD - 0.33); rackGroup.add(group); serverGroups.set(server.id, group);
    const base = addBox(group, w, h, 0.66, materials.shellDark, 0, 0, 0, { castShadow: false, radius: 0.035 });
    // Thin stamped front plate, rolled perimeter, rack ears and flush fasteners.
    const face = addBox(group, w - 0.08, h - 0.025, 0.045, materials.face, 0, 0, 0.35, { castShadow: false, radius: 0.018 });
    addBox(group, 0.065, h - 0.055, 0.024, materials.brushed, -w / 2 + 0.055, 0, 0.38, { castShadow: false, radius: 0.01 });
    addBox(group, 0.065, h - 0.055, 0.024, materials.brushed, w / 2 - 0.055, 0, 0.38, { castShadow: false, radius: 0.01 });
    const earScrews = [];
    for (const x of [-w / 2 + 0.055, w / 2 - 0.055]) for (const y of [-h * 0.34, h * 0.34]) earScrews.push([x, y, 0.395]);
    addBoxInstances(group, 0.018, 0.018, 0.006, materials.rail, earScrews, false, 0.004);
    const isAi = server.type === 'ai' && (server.gpuCount || 0) > 0;
    const grilleW = isAi ? 0.22 : server.units > 1 ? 0.32 : 0.24;
    const grilleX = isAi ? -0.43 : -0.39;
    const grille = addBox(group, grilleW, Math.max(0.055, h - 0.055), 0.016, materials.grille, grilleX, 0, 0.382, { castShadow: false, radius: 0.008 });
    const drives = Math.max(1, Math.min(8, server.driveBays));
    const bayW = 0.42 / drives, bayCenters = [], bayInner = [], driveLEDs = [];
    for (let i = 0; i < drives; i++) {
      const x = 0.015 + bayW * (i + 0.5), bayHeight = Math.max(0.052, Math.min(0.12, h - 0.035));
      bayCenters.push([x, 0, 0.39]); bayInner.push([x, 0.004, 0.412]);
      // Carrier release tab and latch seam are modeled as small, repeatable pieces.
      const led = addDot(group, x + bayW * 0.34, -Math.max(0.014, h / 2 - 0.024), 0.416, materials.off, 0.011); driveLEDs.push(led);
    }
    addBoxInstances(group, bayW - 0.008, Math.max(0.052, Math.min(0.12, h - 0.035)), 0.035, materials.panel, bayCenters, false, 0.008);
    addBoxInstances(group, bayW - 0.028, Math.max(0.025, Math.min(0.065, h - 0.07)), 0.008, materials.black, bayInner, false, 0.004);
    const latchPoints = bayCenters.map(([x]) => [x - bayW * 0.31, 0, 0.414]);
    addBoxInstances(group, 0.009, Math.max(0.035, Math.min(0.06, h - 0.04)), 0.009, materials.brushed, latchPoints, false, 0.003);
    // Louvered exhaust zone doubles as a tactile grip and visible airflow path.
    addBox(group, 0.13, Math.max(0.05, Math.min(0.12, h - 0.04)), 0.018, materials.rubber, 0.52, 0, 0.39, { castShadow: false, radius: 0.01 });
    const louvers = [];
    for (let i = 0; i < 4; i++) louvers.push([0.52, (i - 1.5) * Math.min(0.018, h / 7), 0.404]);
    addBoxInstances(group, 0.105, 0.004, 0.008, materials.rail, louvers);
    addBox(group, 0.025, Math.max(0.042, Math.min(0.08, h - 0.045)), 0.012, materials.black, 0.635, 0, 0.399, { castShadow: false, radius: 0.01 });
    const ledRefs = {
      power: addDot(group, 0.49, 0.02, 0.417, materials.off, 0.013),
      activity: addDot(group, 0.54, 0.02, 0.417, materials.off, 0.013),
      fault: addDot(group, 0.59, 0.02, 0.417, materials.off, 0.013),
      boot: addDot(group, 0.635, 0.02, 0.417, materials.off, 0.013)
    };
    const modelLine = isAi ? `${server.gpuCount} × GPU · ${server.vramGB} GB VRAM` : server.model + '  ·  L' + server.level;
    const nameTexture = labelMaterial([server.name, modelLine], { accent: isAi ? '#be91ff' : '#9bd76d' });
    const label = new THREE.Mesh(planeGeometry(0.40, Math.min(0.065, h - 0.035)), nameTexture); label.position.set(isAi ? 0.20 : -0.34, isAi ? h * 0.31 : 0, 0.414); group.add(label);
    const gpuLoadBars = [];
    if (isAi) {
      const gpuCount = Math.min(8, Math.max(1, Math.round(server.gpuCount))), carrierPoints = [], carrierFaces = [], carrierRibs = [];
      for (let i = 0; i < gpuCount; i++) {
        const x = -0.55 + i * 0.065;
        carrierPoints.push([x, -0.055, 0.397]); carrierFaces.push([x, -0.055, 0.417]);
        carrierRibs.push([x, -0.055 + 0.091, 0.424], [x, -0.055, 0.424], [x, -0.055 - 0.091, 0.424]);
        const baseY = -0.055, barHeight = 0.17;
        const baseBar = addBox(group, 0.018, barHeight, 0.008, materials.black, x + 0.023, baseY, 0.42, { castShadow: false, radius: 0.004 });
        const loadBar = addBox(group, 0.011, barHeight, 0.009, materials.blue, x + 0.023, baseY - barHeight / 2, 0.428, { castShadow: false, radius: 0.003 });
        gpuLoadBars.push({ mesh: loadBar, base: baseBar, baseY, height: barHeight });
      }
      addBoxInstances(group, 0.052, 0.24, 0.034, materials.black, carrierPoints, false, 0.008);
      addBoxInstances(group, 0.041, 0.225, 0.008, materials.panel, carrierFaces, false, 0.005);
      addBoxInstances(group, 0.034, 0.009, 0.008, materials.brushed, carrierRibs, false, 0.003);
      const gpuLeds = carrierPoints.map(([x]) => addDot(group, x, -0.18, 0.429, materials.off, 0.009));
      serverRefs.set(server.id, { gpuLoadBars, gpuLeds });
    }
    addBox(group,0.028,0.035,0.025,materials.black,0.57,-0.015,0.424,{castShadow:false,radius:0.008});
    const progressBase = addBox(group, 0.88, 0.018, 0.012, materials.black, 0, -h / 2 + 0.025, 0.418, { castShadow: false });
    const progress = addBox(group, 0.88, 0.012, 0.014, materials.blue, -0.435, -h / 2 + 0.025, 0.428, { castShadow: false });
    progressBase.userData.roomServerId = server.id;
    const pickMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.001, depthWrite: false, color: 0xffffff }); dynamicMaterials.push(pickMaterial);
    const pick = new THREE.Mesh(boxGeometry(w, h, 0.018), pickMaterial); pick.position.set(0, 0, 0.44); pick.userData.roomKind = 'server'; pick.userData.rackId = rack.id; pick.userData.serverId = server.id; pickTargets.push(pick); group.add(pick);
    const rackId = rackGroup.userData.rackId;
    const parentRack = rackRefs.get(rackId);
    const portX = -0.58 + (server.port - 1) * 0.075;
    const portY = rackH - 0.48;
    const serverY = unitBase + ((server.unit - 2) + server.units / 2) * unitH;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(portX, portY, halfD + 0.29),
      new THREE.Vector3(0.74, portY - 0.14, halfD + 0.20),
      new THREE.Vector3(0.74, serverY + 0.06, halfD + 0.12),
      new THREE.Vector3(0.57, serverY - 0.015, halfD + 0.10)
    ]);
    const cableGeometry = new THREE.TubeGeometry(curve, 12, 0.012, 5, false); dynamicGeometries.push(cableGeometry);
    const cable = new THREE.Mesh(cableGeometry, materials.cableLive); cable.castShadow = false; rackGroup.add(cable);
    if (parentRack) parentRack.cables.push({ mesh: cable, serverId: server.id });
    serverRefs.set(server.id, { ...serverRefs.get(server.id), group, leds: ledRefs, driveLEDs, progress, progressBase, cable, face, grille, unit: server.unit, units: server.units });
  }

  function clearDynamicRacks() {
    facilityInterior?.dispose();facilityInterior=null;
    for (const ref of rackRefs.values()) if (ref.asset) ref.dispose();
    for (const material of dynamicMaterials) material.dispose();
    dynamicMaterials = [];
    for (const mesh of dynamicInstances) mesh.dispose();
    dynamicInstances = [];
    for (const geometry of dynamicGeometries) geometry.dispose();
    dynamicGeometries = [];
    for (const texture of dynamicTextures) texture.dispose();
    dynamicTextures = [];
    for (const group of rackGroups.values()) scene.remove(group);
    rackGroups.clear(); serverGroups.clear(); rackRefs.clear(); serverRefs.clear(); pickTargets = [];
  }

  function rebuildRacks(racks) {
    rackGeneration++;
    clearDynamicRacks();
    const rows = Math.max(1, Math.ceil(racks.length / 2));
    racks.forEach((rack, index) => buildRack(rack, index, racks.length));
    if(assetBank){
      facilityInterior=buildFacilityInterior({bank:assetBank,scene,materials,location:currentLocation(),layout:facilityLayout(),central:centralModel()});
      pickTargets.push(...facilityInterior.picks);
      assetHall.group.visible=locationId!=='hall';
      assetHall.setServerRoom(locationId.startsWith('room-'));
    }
    stationSystem?.setVisible(locationId==='control');
    const rear = Math.max(5.4, (rows - 1) * 4.2 + 1.5);
    scene.fog = new THREE.Fog(0x101516, Math.max(15, rear * 0.44), Math.max(30, rear + 14));
    const bounds = rear + 5;
    camera.userData.backLimit = assetBank ? -4.85 : -Math.max(bounds,14.5);
    structuralSignature = getStructureSignature(racks);
    lastRoomLanguage = window.ROOTI18N?.getLanguage();
    updateAccessibleNavigation(racks);
  }

  function getStructureSignature(racks) {
    return [locationId,selectedFloor,facilityLayout().roomCount,centralModel().systems.map(s=>[s.id,s.level,s.available]).join('|'),racks.map(rack => rack.id + ':' + rack.switchLevel + ':' + rack.powerLevel + ':' + rack.coolingLevel + ':' + rack.ports.length + '[' + rack.servers.map(server => [server.id, server.type, server.unit, server.units, server.port, server.level, server.name, server.model, server.driveBays].join(':')).join(',') + ']').join('|')].join('/');
  }

  function refreshRoomLanguage(racks) {
    const language=window.ROOTI18N?.getLanguage();
    if(language===lastRoomLanguage)return;
    lastRoomLanguage=language;
    if(facilityInterior){
      const open=facilityInterior.portals.filter(portal=>portal.open).map(portal=>({id:portal.destination,autoClose:portal.autoClose,delay:portal.closeDelay}));
      const oldPicks=new Set(facilityInterior.picks);pickTargets=pickTargets.filter(target=>!oldPicks.has(target));
      facilityInterior.dispose();
      facilityInterior=buildFacilityInterior({bank:assetBank,scene,materials,location:currentLocation(),layout:facilityLayout(),central:centralModel()});
      open.forEach(saved=>{facilityInterior.openPortal(saved.id,saved.autoClose);facilityInterior.portals.find(portal=>portal.id===saved.id).closeDelay=saved.delay;});pickTargets.push(...facilityInterior.picks);
    }
    for(const ref of rackRefs.values())ref.group?.traverse(node=>node.userData.refreshLabel?.());
    updateAccessibleNavigation(racks);
  }

  function changeLocation(id,floor=selectedFloor,entry=null){
    arrivalRequested=false;
    explicitDestination=true;pendingSession=null;
    finishArrival(false);
    const previous=locationId;
    const next=roomLocation(facilityLayout(),id,floor),system=centralModel().systems.find(s=>s.id===id);
    if(system&&!system.available)return;
    locationId=next.id;selectedFloor=next.floor;keys.clear();dragPoint=null;targetRack=null;targetServer=null;targetPortal=null;
    roomTransitionUntil=performance.now()+800;structuralSignature='';placeSignature='';
    if(camera){
      camera.position.set(0,eyeHeight,next.id==='hall'?3.9:4.6);yaw=0;pitch=-.02;
      if(entry==='threshold'&&next.id==='hall'){
        const door=corridorPlan(facilityLayout(),centralModel(),next.floor).doors.find(d=>d.id===previous);
        if(door){camera.position.set(door.x+Math.sin(door.turn)*.75,eyeHeight,door.z+Math.cos(door.turn)*.75);yaw=door.turn+Math.PI;}
      }else if(entry==='stairs'){
        const plan=corridorPlan(facilityLayout(),centralModel(),next.floor);
        camera.position.set(0,eyeHeight,plan.endZ+.85);yaw=Math.PI;
      }
      applyCameraRotation();
    }
    shell?.classList.remove('show-nav');shell?.querySelector('[data-room-navigation]').setAttribute('aria-expanded','false');
    update();if(entry==='threshold')facilityInterior?.openPortal(next.id==='hall'?previous:'hall',true);
    if(entry){shell?.classList.add('room-crossing');setTimeout(()=>shell?.classList.remove('room-crossing'),160);}
    if(exploring)canvas?.focus({preventScroll:true});
    saveRoomSession();
  }

  function saveRoomSession() {
    if (!camera || !mounted || hidden || arrival || pendingSession) return;
    try {
      const value=JSON.stringify({ version: 1, id: locationId, floor: selectedFloor, exploring, position: camera.position.toArray(), yaw, pitch });
      if(value!==lastSessionValue){sessionStorage.setItem('root.room.view',value);lastSessionValue=value;}
    } catch { /* Storage can be disabled. */ }
    lastSessionWrite = performance.now();
  }

  function applyRoomSession() {
    if (!pendingSession || !mounted || hidden) return;
    const view=pendingSession;pendingSession=null;
    if (view.exploring) {
      const [x,,z]=view.position;
      if (!canStand(x,z)) view.position=[0,eyeHeight,locationId==='hall'?3.9:4.6];
      const stair=facilityInterior?.stairAt(view.position[0],view.position[2]);
      view.position[1]=eyeHeight+(stair?stairHeight(stair,view.position[2]):0);
      startExploration(false,view);
    } else {
      camera.position.set(0,assetBank?2.25:3.25,assetBank?(locationId==='hall'?3.9:3):5.3);
      camera.lookAt(0,1.3,assetBank?-.8:-3);
    }
  }

  function finishArrival(enterHall=true){
    if(!arrival)return;
    arrival.dispose();arrival=null;arrivalOverlay.hidden=true;shell.classList.remove('arriving');
    if(!exploring)document.body.classList.remove('root-room-open');
    sizeRenderer();
    if(enterHall){changeLocation('hall',1);startExploration(false);}
  }
  function startArrival(force=false){
    if(force)arrivalRequested=true;
    const replay=force||arrivalRequested;
    // An explicit destination selected while assets load takes priority over the automatic intro.
    if(!replay&&(sessionRestored||locationId!=='hall'))return;
    if(!mounted||hidden||!assetBank||!renderer||isReducedMotion||arrival||document.querySelector('#modal-root .modal'))return;
    try{if(!replay&&(localStorage.getItem('root.arrival.enabled')==='0'||sessionStorage.getItem('root.arrival.shown')==='1'))return;sessionStorage.setItem('root.arrival.shown','1');}catch{}
    arrivalRequested=false;
    if(exploring)leave();
    arrival=createArrival({bank:assetBank,environment:scene.environment});arrivalOverlay.hidden=false;
    shell.classList.add('arriving');document.body.classList.add('root-room-open');sizeRenderer();syncAnimation();
  }

  function updatePlaceNavigation(){
    if(!placeNav)return;
    const layout=facilityLayout(),location=currentLocation(),systems=centralModel().systems;
    const key=JSON.stringify([location.id,location.floor,layout.rooms,systems.map(s=>[s.id,s.available]),window.ROOTI18N?.getLanguage()]);
    if(key===placeSignature)return;placeSignature=key;
    const roomTitle=shell?.querySelector('[data-room-place-label]');if(roomTitle)roomTitle.textContent=tr(location.name);
    const floors=Array.from({length:layout.floorCount},(_,i)=>`<option value="${i+1}" ${i+1===location.floor?'selected':''}>${tr('Untergeschoss')} ${i+1}</option>`).join('');
    const destinations=[{id:'hall',name:'Verbindungsflur'},...(location.floor===1?[{id:'control',name:'Kontrollraum'}]:[]),...layout.rooms.filter(r=>r.floor===location.floor).map(r=>({id:r.id,name:`Raum ${r.number}`})),...(location.floor===1?systems.filter(s=>s.available):[])];
    placeNav.innerHTML=`<div class="room-location-title"><span>${tr('Standort')}</span><strong>${escapeHtml(tr(location.name))}</strong><small>${location.rackIds.length} ${tr(location.rackIds.length===1?'Rack in diesem Raum':'Racks in diesem Raum')}</small></div><label>${tr('Untergeschoss')}<select data-room-floor aria-label="${tr('Untergeschoss')}">${floors}</select></label><label>${tr('Raum wechseln')}<select data-room-location aria-label="${tr('Raum wechseln')}">${destinations.map(d=>`<option value="${d.id}" ${d.id===location.id?'selected':''}>${escapeHtml(tr(d.name))}</option>`).join('')}</select></label><button type="button" data-room-control>${tr('Zum Kontrollraum')}</button>`;
    placeNav.querySelector('[data-room-floor]').addEventListener('change',event=>changeLocation('hall',Number(event.target.value)));
    placeNav.querySelector('[data-room-location]').addEventListener('change',event=>changeLocation(event.target.value));
    placeNav.querySelector('[data-room-control]').addEventListener('click',()=>changeLocation('control',1));
  }

  function activateStation(station){
    if(station.view==='lift'||station.view==='map'){
      keys.clear();shell.classList.add('show-map');
      placeNav.querySelector(station.view==='map'?'[data-room-location]':'[data-room-floor]')?.focus();
    }else if(station.rackId)openRack?.(station.rackId);
    else openView?.(station.view);
  }

  function buildShell() {
    shell = document.createElement('section'); shell.className = 'root-room'; shell.setAttribute('aria-label', 'Simulierter Serverraum');
    shell.innerHTML = '<div class="root-room-stage"><div class="root-room-empty"><span class="root-room-mark">ROOT<span>.</span></span><p>Lokale Infrastruktur · Live-Simulation</p></div><div class="root-room-top"><div class="root-room-brand"><strong>ROOT<span>.</span></strong><i></i><span data-room-place-label>SERVERRAUM</span></div><div class="root-room-live"><i class="root-room-led"></i><span data-room-system>SYSTEM ONLINE</span><span class="root-room-badge">SIMULATION</span></div></div><div class="root-room-reticle" aria-hidden="true"></div><div class="root-room-target" data-room-target></div><div class="root-room-summary" data-room-summary></div><div class="root-room-controls"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Bewegen</span><span data-room-mouse-help><kbd>Maus</kbd> Ziehen / ← → drehen</span><span><kbd>E</kbd> Öffnen</span><button type="button" data-room-enter>Raum betreten</button><button type="button" data-room-leave hidden>Leitstelle</button><button type="button" data-room-navigation aria-expanded="false">Geräte-Liste</button><button type="button" class="root-room-incident-action" data-room-incident hidden>Vorfall bearbeiten</button></div><div class="root-room-fallback" hidden></div></div><div class="root-room-nav" aria-label="Racks und Server"></div>';
    stage = shell.querySelector('.root-room-stage'); nav = shell.querySelector('.root-room-nav'); summary = shell.querySelector('[data-room-summary]'); statusLine = shell.querySelector('[data-room-system]'); fallback = shell.querySelector('.root-room-fallback');
    placeNav=document.createElement('div');placeNav.className='room-location-nav';shell.insertBefore(placeNav,stage);
    arrivalOverlay=document.createElement('div');arrivalOverlay.className='room-arrival-overlay';arrivalOverlay.hidden=true;
    arrivalOverlay.innerHTML='<div><span>ROOT / UNDERGROUND OPERATIONS</span><h2>CYBERBUNKER</h2><p data-arrival-caption>Zugangsschleuse</p></div><button type="button" data-arrival-skip>Überspringen · Esc</button><div class="arrival-progress"><i></i></div>';shell.appendChild(arrivalOverlay);
    arrivalOverlay.querySelector('[data-arrival-skip]').addEventListener('click',finishArrival);
    shell.querySelector('[data-room-enter]').addEventListener('click', startExploration);
    const terminalButton=document.createElement('button');terminalButton.type='button';terminalButton.dataset.roomTerminal='';terminalButton.textContent='Konsole';
    terminalButton.addEventListener('click',()=>{if(!exploring)startExploration();openView?.('overview');});
    shell.querySelector('.root-room-controls').appendChild(terminalButton);
    consolePanel=document.createElement('section');consolePanel.className='root-room-console';consolePanel.hidden=true;consolePanel.setAttribute('aria-label','Raumkonsole');
    consolePanel.innerHTML='<header class="room-console-header"><div><span>ROOT / OPERATIONS TERMINAL</span><strong data-room-console-title>Leitstelle</strong></div><button type="button" data-room-console-close>Zurück in den Raum · Esc</button></header><nav class="room-console-nav" aria-label="Bereiche der Raumkonsole">'+[['overview','Leitstelle'],['network','Hardware'],['agents','Agenten'],['jobs','Aufträge'],['research','Forschung'],['automation','Automatik'],['resilience','Backups & Betrieb'],['inbox','Entscheidungen'],['log','Protokoll'],['facility','Gebäudetechnik']].map(([id,label])=>'<button type="button" data-nav="'+id+'">'+label+'</button>').join('')+'<button type="button" data-modal="settings">Einstellungen</button><button type="button" data-modal="help">Handbuch</button></nav><div class="room-console-content" tabindex="-1"></div>';
    shell.appendChild(consolePanel);consoleContent=consolePanel.querySelector('.room-console-content');
    consolePanel.querySelector('[data-room-console-close]').addEventListener('click',closeConsole);
    shell.querySelector('[data-room-leave]').addEventListener('click', leave);
    shell.querySelector('[data-room-navigation]').addEventListener('click', toggleNavigation);
    shell.querySelector('[data-room-incident]').addEventListener('click', () => { if (openProtection) openProtection(); });
  }

  function mount() {
    const slot = document.querySelector('[data-room-slot]');
    if (!slot) return false;
    if (!shell) buildShell();
    if (shell.parentElement !== slot) slot.appendChild(shell);
    hidden = false; mounted = true;
    if (!scene && !worldLoading) {
      const loading=shell.querySelector('.root-room-empty p');
      loading.textContent='Neue 3D-Modelle werden geladen …';
      shell.querySelector('[data-room-enter]').disabled=true;
      worldLoading=loadRootAssets((done,total)=>{loading.textContent='3D-Modelle laden · '+done+' / '+total;})
        .then(bank=>{assetBank=bank;})
        .catch(error=>{console.warn('ROOT Assetpaket konnte nicht geladen werden:',error);loading.textContent='Standardmodelle · Assetpaket nicht verfügbar';})
        .then(()=>{
          try{
            if(!explicitDestination){
              try{pendingSession=readRoomSession(sessionStorage,facilityLayout(),centralModel());}catch{}
              if(pendingSession){locationId=pendingSession.id;selectedFloor=pendingSession.floor;sessionRestored=true;}
            }
            buildWorld();
            shell.querySelector('.root-room-empty').hidden=true;
            shell.querySelector('.root-room-badge').textContent=assetBank?'LIVE / 3D':'STANDARDMODELLE';
            shell.querySelector('[data-room-enter]').disabled=false;
            update();sizeRenderer();applyRoomSession();startArrival();syncAnimation();
          }catch(error){scene=null;renderer?.dispose();renderer=null;showFallback(error);}
        });
    } else if (canvas && canvas.parentElement !== stage) stage.appendChild(canvas);
    if (resizeObserver) resizeObserver.observe(stage);
    update(); sizeRenderer(); applyRoomSession(); startArrival(); syncAnimation();
    return true;
  }

  function showFallback(error) {
    console.warn('ROOT Serverraum konnte WebGL nicht starten:', error);
    fallback.hidden = false;
    fallback.textContent = '3D-Ansicht nicht verfügbar. Die Simulation und Rackauswahl funktionieren weiterhin über die Liste.';
    stage.classList.add('root-room-no-webgl');
  }

  function sizeRenderer() {
    if (!renderer || !stage || !camera) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix();
  }

  function updateAccessibleNavigation(racks) {
    if (!nav) return;
    const html = racks.map(rack => {
      const color = rack.status === 'online' ? 'ok' : rack.status === 'limited' ? 'warn' : 'fault';
      const serverButtons = rack.servers.map(server => '<button type="button" class="root-room-device-link" data-room-open-server="' + escapeHtml(server.id) + '" data-room-rack="' + escapeHtml(rack.id) + '"><span class="root-room-device-light ' + escapeHtml(server.status) + '" data-room-server-light="' + escapeHtml(server.id) + '"></span><span>' + escapeHtml(server.name) + '</span><small data-room-server-status="' + escapeHtml(server.id) + '">' + escapeHtml(STATUS_TEXT[server.status] || server.status) + '</small></button>').join('');
      return '<article class="root-room-rack-links"><button type="button" class="root-room-rack-link" data-room-open-rack="' + escapeHtml(rack.id) + '"><span class="root-room-device-light ' + color + '" data-room-rack-light="' + escapeHtml(rack.id) + '"></span><strong>' + escapeHtml(rack.name) + '</strong><span data-room-rack-temp="' + escapeHtml(rack.id) + '">' + rack.servers.length + ' Server · ' + decimal(rack.temperature) + ' °C</span><small data-room-rack-status="' + escapeHtml(rack.id) + '">' + escapeHtml(STATUS_TEXT[rack.status] || rack.status) + '</small></button><div class="room-rack-card-actions"><span>'+rack.usedUnits+' / 16 HE</span></div><details><summary>Rackdetails · '+rack.servers.length+' Server</summary><div class="root-room-server-links">' + (serverButtons||'<p>Keine Server eingebaut</p>') + '</div></details></article>';
    }).join('');
    const description=locationId==='control'?'Die Leitstelle bündelt alle Systeme. Der Ausgang führt zurück in den Verbindungsflur.':locationId==='hall'?'Öffne eine Tür mit E oder einem Klick und gehe hindurch. Die Treppen verbinden vorhandene Untergeschosse.':'Kapazität, laufende Kosten und Ausbau steuerst du am Terminal.';
    nav.innerHTML = html || '<div class="room-location-info"><strong>'+escapeHtml(tr(currentLocation().name))+'</strong><p>'+escapeHtml(tr(description))+'</p><button type="button" data-nav="facility">Gebäudetechnik verwalten</button></div>';
    nav.querySelectorAll('[data-room-open-rack]').forEach(button => button.addEventListener('click', () => openRack && openRack(button.dataset.roomOpenRack)));
    nav.querySelectorAll('[data-room-open-server]').forEach(button => button.addEventListener('click', () => openServer && openServer(button.dataset.roomRack, button.dataset.roomOpenServer)));
    window.ROOTI18N?.localize?.(nav);
  }

  function updateNavigationTelemetry(racks) {
    if (!nav) return;
    for (const rack of racks) {
      const light = nav.querySelector('[data-room-rack-light="' + CSS.escape(rack.id) + '"]');
      const temp = nav.querySelector('[data-room-rack-temp="' + CSS.escape(rack.id) + '"]');
      const label = nav.querySelector('[data-room-rack-status="' + CSS.escape(rack.id) + '"]');
      if (light) light.className = 'root-room-device-light ' + (rack.status === 'online' ? 'ok' : rack.status === 'limited' ? 'warn' : 'fault');
      if (temp) temp.textContent = tr(rack.servers.length + ' Server · ' + decimal(rack.temperature) + ' °C');
      if (label) label.textContent = tr(STATUS_TEXT[rack.status] || rack.status);
      for (const server of rack.servers) {
        const status = nav.querySelector('[data-room-server-status="' + CSS.escape(server.id) + '"]');
        const serverLight = nav.querySelector('[data-room-server-light="' + CSS.escape(server.id) + '"]');
        if (status) status.textContent = tr(STATUS_TEXT[server.status] || server.status);
        if (serverLight) serverLight.className = 'root-room-device-light ' + server.status;
      }
    }
  }

  function update(snapshot = null) {
    if (!getState || !E) return;
    const state = getState();
    if (!state || !state.facility) return;
    const shared=snapshot?.state===state?snapshot:null;
    const metrics=shared?.metrics||E.getMetrics(state), model = shared?.model||E.getRackModel(state,metrics), resilience = shared?.resilience||E.getResilience(state,model,metrics), operations = shared?.operations||E.getAgentOperations(state);
    stationSystem?.update(0,{state,metrics,model,resilience,operations});
    if(!facilityLayout().rooms.some(r=>r.id===locationId)&&locationId.startsWith('room-'))locationId='room-1';
    updatePlaceNavigation();
    const racks=visibleRacks(model.racks),signature = getStructureSignature(racks);
    currentRacks = racks;
    if (scene && signature !== structuralSignature) rebuildRacks(racks);
    if(scene)refreshRoomLanguage(racks);
    facilityInterior?.update({model,metrics,resilience,central:centralModel()});
    if(canvas)canvas.setAttribute('aria-label',tr(`Begehbarer Serverraum: ${rackGroups.size} Racks und ${serverGroups.size} eingebaute Server. WASD bewegen, Maus oder Pfeiltasten drehen, E Gerät öffnen, Escape zurück.`));
    const status = resilience.safetyMode ? 'SCHUTZMODUS' : !resilience.online ? 'NETZWERK OFFLINE' : resilience.failed ? 'BETRIEB EINGESCHRÄNKT' : resilience.repairing ? 'WARTUNG AKTIV' : model.racks.some(r => r.status === 'limited' || r.status === 'maintenance') ? 'WARTUNG / LASTBEGRENZUNG' : 'SYSTEM ONLINE';
    if (statusLine) {
      statusLine.textContent = tr(status);
      shell.classList.toggle('has-alert', /SCHUTZ|EINGESCHRÄNKT|OFFEN|OFFLINE|BEGRENZUNG|WARTUNG/.test(status));
    }
    const totalServers = model.racks.reduce((n, rack) => n + rack.servers.length, 0);
    const hottest = model.racks.reduce((n, rack) => Math.max(n, rack.temperature), 0);
    const failures = model.racks.reduce((n, rack) => n + rack.servers.filter(server => server.status === 'failed').length, 0);
    const activeAssignments = operations.agents.filter(agent => agent.assignment).map(agent => {
      const data = state.agents.find(person => person.id === agent.id);
      return (data ? data.name + ': ' : '') + agent.assignment.label+' · '+duration(agent.assignment.remaining);
    });
    const activeEffects = operations.effects.map(effect => effect.label + ' · ' + duration(effect.remaining));
    const activeOp = resilience.operation || model.operation || centralModel().operation;
    const backupText = resilience.backupAge === null ? 'Noch keine Betriebssicherung' : 'Letzte Sicherung vor ' + duration(resilience.backupAge);
    const operationText = activeOp ? escapeHtml(activeOp.label) + ' · noch ' + duration(activeOp.remaining) : 'Keine Maßnahme aktiv';
    if (summary) summary.innerHTML = (resilience.incident ? '<span class="root-room-incident"><b>VORFALL · ' + escapeHtml(resilience.incident.title) + '</b></span>' : '') + '<span><b>' + model.racks.length + '</b> Racks gesamt</span><span><b>' + totalServers + '</b> Server gesamt</span><span><b>' + decimal(hottest) + ' °C</b> höchste Racktemperatur</span><span><b>' + watts(model.totalPowerW) + '</b> Leistungsaufnahme</span><span><b>' + number(Math.round(model.networkFactor * 100)) + ' %</b> Uplink-Leistung</span><span><b>' + (failures ? failures + ' Störung' + (failures > 1 ? 'en' : '') : resilience.repairing ? 'Reparatur läuft' : model.operation ? 'Rack-Wartung' : model.racks.some(r=>r.status==='limited') ? 'Kapazität begrenzt' : 'Betrieb stabil') + '</b></span><span>' + operationText + '</span><span>' + escapeHtml(backupText) + '</span>' + (activeAssignments.length ? '<span>Agenten: ' + escapeHtml(activeAssignments.join(' · ')) + (operations.paused ? ' · pausiert' : '') + '</span>' : '') + (activeEffects.length ? '<span>Netzeffekte: ' + escapeHtml(activeEffects.join(' · ')) + '</span>' : '');
    if(summary)window.ROOTI18N?.localize?.(summary);
    if (shell) {
      const exitButton = shell.querySelector('[data-room-leave]');
      if (exitButton) exitButton.textContent = tr('Weboberfläche');
      const incidentButton = shell.querySelector('[data-room-incident]');
      if (incidentButton) incidentButton.hidden = !resilience.incident;
    }
    updateNavigationTelemetry(racks);
    if (!scene) return;
    for (const rack of model.racks) {
      const ref = rackRefs.get(rack.id); if (!ref) continue;
      if (ref.asset) { updateAssetRack(ref,rack,resilience); continue; }
      const tone = rack.status === 'online' ? materials.green : rack.status === 'limited' ? materials.amber : rack.status === 'maintenance' ? materials.amber : materials.red;
      ref.panel.material = tone;
      ref.tempStrip.material = rack.temperature > 60 ? materials.red : rack.temperature > 35 ? materials.amber : materials.green;
      ref.leds.slice(0, 3).forEach((led, i) => { led.material = i === 0 ? (rack.status === 'online' ? materials.green : materials.amber) : i === 1 ? (rack.networkDemandMbps > 0 ? materials.blue : materials.off) : (rack.warnings.length ? materials.amber : materials.green); });
      ref.fans.forEach((fan, i) => { fan.userData.speed = rack.status === 'maintenance' ? 0 : 1.2 + Math.min(3.6, Math.max(0, rack.temperature - 22) / 14) + i * 0.2; });
      ref.pduDisplay.material = rack.powerW > rack.powerCapacityW ? materials.red : materials.green;
      ref.switchPorts.forEach(light => {
        const port = rack.ports.find(candidate => candidate.number === light.number);
        light.linked = Boolean(port && port.link); light.traffic = Boolean(port && port.trafficMbps > 0);
        ref.switchLinkLights.setColorAt(light.number - 1, new THREE.Color(light.linked ? 0x9ad777 : port && !port.enabled ? 0xe0b36e : 0x172022));
        ref.switchTrafficLights.setColorAt(light.number - 1, new THREE.Color(light.traffic ? 0x86d5e9 : 0x172022));
      });
      ref.switchLinkLights.instanceColor.needsUpdate = true; ref.switchTrafficLights.instanceColor.needsUpdate = true;
      for (let index = 0; index < 16; index++) {
        const server = rack.servers.find(candidate => candidate.unit - 1 === index + 1 && candidate.unit === index + 2);
        ref.pduOutletLights.setColorAt(index, new THREE.Color(server && server.powered ? 0x9ad777 : 0x172022));
      }
      ref.pduOutletLights.instanceColor.needsUpdate = true;
      ref.cables.forEach(cable => {
        const server = rack.servers.find(candidate => candidate.id === cable.serverId);
        cable.mesh.material = server && server.link ? materials.cableLive : materials.cableDown;
      });
      for (const server of rack.servers) updateServer(server,resilience.operation);
    }
    updateTarget(racks);
  }

  function updateServer(server,operation) {
    const ref = serverRefs.get(server.id); if (!ref) return;
    const online = server.status === 'online' && server.link;
    ref.leds.power.material = server.powered&&server.status!=='maintenance' ? (server.status === 'failed' ? materials.red : materials.green) : materials.off;
    ref.leds.activity.material = online && server.activity > 0 ? materials.blue : materials.off;
    ref.leds.fault.material = server.status === 'failed' || server.status === 'repairing' ? materials.red : server.warnings.length ? materials.amber : materials.off;
    ref.leds.boot.material = server.bootRemaining > 0 ? materials.blue : server.status === 'repairing' ? materials.amber : materials.off;
    ref.driveLEDs.forEach((led, i) => { led.material = online && server.activity > 0 && i % 2 === Math.floor(Date.now() / 330) % 2 ? materials.blue : materials.off; });
    const progress = server.bootRemaining > 0 ? 1 - server.bootRemaining / 30 : server.status === 'repairing'&&operation?.serverId===server.id ? 1-operation.remaining/operation.total : server.condition / 100;
    ref.progress.scale.x = Math.max(0.01, progress); ref.progress.position.x = -0.435 + 0.44 * Math.max(0.01, progress);
    ref.progress.material = server.bootRemaining > 0 ? materials.blue : server.status === 'failed' || server.condition < 40 ? materials.red : server.status === 'repairing' || server.condition < 75 ? materials.amber : materials.green;
    for(const bar of ref.gpuLoadBars||[]){const load=Math.max(.025,Math.min(1,server.gpuLoad||0));bar.mesh.scale.y=load;bar.mesh.position.y=bar.baseY-bar.height/2+bar.height*load/2;bar.mesh.material=online?materials.blue:materials.off;}
    for(const led of ref.gpuLeds||[])led.material=online?materials.green:materials.off;
  }

  function updateTarget(racks) {
    if (!camera || !canvas) return;
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = exploring ? raycaster.intersectObjects([...pickTargets,...(stationSystem?.pickTargets||[])], false) : [];
    targetRack = null; targetServer = null;targetStation=null;targetDoor=false;targetPortal=null;
    for (const hit of hits) {
      if(exploring&&hit.distance>4.5)continue;
      let node = hit.object;
      while (node && !node.userData.roomKind) node = node.parent;
      if (!node) continue;
      if(node.userData.roomKind==='station'){targetStation=node.userData;break;}
      if(node.userData.roomKind==='portal'){targetPortal=node.userData;break;}
      targetRack = node.userData.rackId;
      targetDoor = node.userData.roomKind === 'door';
      if (node.userData.roomKind === 'server') targetServer = node.userData.serverId;
      break;
    }
    const rack = racks.find(r => r.id === targetRack), server = rack && rack.servers.find(s => s.id === targetServer);
    const action=rackInteraction(rackRefs.get(targetRack)?.cabinet,targetDoor);
    if(action==='open-door')targetDoor=true;
    const target = shell && shell.querySelector('[data-room-target]');
    if (target) {
      let text;
      if(targetPortal)text=tr(targetPortal.label)+' · '+tr(targetPortal.portal.open?'Tür offen · Hindurchgehen / E: schließen':'E / Klick: Tür öffnen');
      else if(targetStation)text=tr(targetStation.label)+' · '+tr('E / Klick: Terminal öffnen');
      else if (rack && action==='opening') text = rack.name + ' · Tür öffnet …';
      else if (rack && targetDoor) text = rack.name + ' · E: ' + (rackRefs.get(rack.id)?.cabinet?.doorOpen?'Tür schließen':'Tür öffnen');
      else if (rack && server) text = server.name + ' · ' + (STATUS_TEXT[server.status] || server.status) + ' · E / Klick: Server verwalten';
      else if (rack) text = rack.name + ' · ' + decimal(rack.temperature) + ' °C · E / Klick: Rack verwalten';
      else text = exploring ? (locationId==='hall'?'Türen öffnen · Räume erkunden · Treppen benutzen':'Ziele auf einen Server, ein Rack oder ein Terminal.') : 'Klicke ein Gerät, um die vorhandene Verwaltung zu öffnen.';
      text=tr(text);if(target.textContent!==text)target.textContent=text;
      target.classList.toggle('is-target', Boolean(rack||targetStation||targetPortal));
    }
  }

  function bindCanvas() {
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();stopAnimation();leave();showFallback(new Error('Grafikkontext unterbrochen'));});
    canvas.addEventListener('webglcontextrestored',()=>{fallback.hidden=true;stage.classList.remove('root-room-no-webgl');syncAnimation();});
    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', () => { keys.clear(); onPointerUp(); });
    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('mousemove', onLockedMouseMove);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('pagehide', () => { saveRoomSession();onWindowBlur(); });
    window.addEventListener('focus', () => keys.clear());
    document.addEventListener('focusin', event => { if (event.target !== canvas) keys.clear(); });
    document.addEventListener('pointerdown', event => { if (event.target !== canvas) keys.clear(); }, true);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('resize', sizeRenderer);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    motion.addEventListener?.('change', event => { isReducedMotion = event.matches; });
    resizeObserver = new ResizeObserver(sizeRenderer);
    visibilityObserver=new IntersectionObserver(entries=>{inViewport=entries[0]?.isIntersecting!==false;if(inViewport||exploring||arrival)syncAnimation();else stopAnimation();});
    visibilityObserver.observe(stage);
  }

  function onCanvasClick(event) {
    if(consoleOpen)return;
    if (dragMoved) { dragMoved = false; return; }
    if (!canvas) return;
    if (pointerLocked) mouse.set(0, 0);
    else {
      const rect = canvas.getBoundingClientRect();
      mouse.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    }
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.intersectObjects([...pickTargets,...(stationSystem?.pickTargets||[])], false).find(item => {
      if(exploring&&item.distance>4.5)return false;
      let n = item.object; while (n && !n.userData.roomKind) n = n.parent; return Boolean(n);
    });
    if (!hit) return;
    let node = hit.object; while (node && !node.userData.roomKind) node = node.parent;
    if(node.userData.roomKind==='station'){activateStation(node.userData);return;}
    if(node.userData.roomKind==='portal'){facilityInterior?.togglePortal(node.userData.portal);return;}
    if(node.userData.roomKind==='door'){toggleRackDoor(node.userData.rackId);return;}
    activateTarget(node.userData.rackId, node.userData.roomKind === 'server' ? node.userData.serverId : null);
  }

  function activateTarget(rackId, serverId) {
    if (!rackId) return;
    const action=rackInteraction(rackRefs.get(rackId)?.cabinet);
    if(action==='open-door'){toggleRackDoor(rackId);return;}
    if(action==='opening')return;
    if (serverId && openServer) openServer(rackId, serverId);
    else if (openRack) openRack(rackId);
  }

  function toggleRackDoor(rackId) {
    const ref=rackRefs.get(typeof rackId==='string'?rackId:targetRack);if(!ref?.asset)return;
    ref.cabinet.doorOpen=!ref.cabinet.doorOpen;
    updateNavigationTelemetry(currentRacks);
  }

  function onPointerDown(event) {
    if (!exploring || consoleOpen || pointerLocked) return;
    dragPoint = { x: event.clientX, y: event.clientY }; dragMoved = false;
    canvas.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    if (!exploring || pointerLocked || !dragPoint) return;
    const dx = event.clientX - dragPoint.x, dy = event.clientY - dragPoint.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) dragMoved = true;
    dragPoint = { x: event.clientX, y: event.clientY };
    rotateCamera(dx * 0.004, dy * 0.004);
  }

  function onLockedMouseMove(event) {
    if (exploring && !consoleOpen && pointerLocked) rotateCamera((event.movementX || 0) * 0.0024, (event.movementY || 0) * 0.0024);
  }

  function onPointerUp() { dragPoint = null; setTimeout(() => { dragMoved = false; }, 40); }

  function onPointerLockChange() {
    const locked = document.pointerLockElement === canvas;
    if(locked&&(!exploring||consoleOpen||hidden||!mounted)){document.exitPointerLock();pointerLocked=false;return;}
    if (locked === pointerLocked) return;
    pointerLocked = locked;
    if (shell) {shell.classList.toggle('pointer-locked', pointerLocked);shell.querySelector('[data-room-mouse-help]').innerHTML=pointerLocked?'<kbd>Maus</kbd> Umsehen · Esc zurück':'<kbd>Maus</kbd> Ziehen / ← → drehen';}
    // Pointer Lock 2.0 also releases on focus loss. Keep DOM controls reachable.
    if (!locked) {keys.clear();dragPoint=null;}
  }

  function rotateCamera(dx, dy) { yaw -= dx; pitch = THREE.MathUtils.clamp(pitch - dy, -1.15, 1.15); applyCameraRotation(); }
  function applyCameraRotation() { if (camera) camera.rotation.set(pitch, yaw, 0, 'YXZ'); }

  function onKeyDown(event) {
    if(arrival){if(event.code==='Escape'){event.preventDefault();finishArrival();}return;}
    if(document.querySelector('#modal-root .modal'))return;
    if(exploring&&consoleOpen){
      if(event.code==='Escape'){event.preventDefault();closeConsole();}
      if(event.code==='Tab'){
        const controls=[...consolePanel.querySelectorAll('button:not(:disabled),input,select,[tabindex="0"]')].filter(el=>el.getClientRects().length);
        const first=controls[0],last=controls.at(-1);
        if(event.shiftKey&&(document.activeElement===first||document.activeElement===consoleContent)){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&(document.activeElement===last||!consolePanel.contains(document.activeElement))){event.preventDefault();first?.focus();}
      }
      return;
    }
    if (!exploring || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
    if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','KeyE','Escape'].includes(event.code)) event.preventDefault();
    keys.press(event.code,event.repeat);
    if (event.code === 'Escape') leave();
    if (event.code === 'KeyE'&&!event.repeat){if(targetStation)activateStation(targetStation);else if(targetPortal)facilityInterior?.togglePortal(targetPortal.portal);else if(targetDoor)toggleRackDoor();else activateTarget(targetRack, targetServer);}
  }
  function onKeyUp(event) { keys.delete(event.code); }

  function onVisibilityChange() {
    if (document.hidden) { saveRoomSession();stopAnimation();keys.clear();dragPoint=null; }
    else if (mounted && !hidden) syncAnimation();
  }

  function onWindowBlur() { keys.clear();dragPoint=null;if(document.pointerLockElement===canvas)document.exitPointerLock(); }

  function startExploration(pointer=true, restored=null) {
    if (!camera || !renderer) return;
    exploring = true; keys.clear(); dragPoint = null; dragMoved = false;
    if(restored){camera.position.fromArray(restored.position);yaw=restored.yaw;pitch=restored.pitch;}
    else{camera.position.set(0, eyeHeight, assetBank?(locationId==='hall'?3.9:4.6):5.2); yaw = 0; pitch = -0.02;}
    applyCameraRotation();
    shell.classList.add('exploring'); shell.querySelector('[data-room-enter]').hidden = true; shell.querySelector('[data-room-leave]').hidden = false;
    shell.classList.remove('show-nav'); shell.querySelector('[data-room-navigation]').setAttribute('aria-expanded', 'false'); document.body.classList.add('root-room-open');
    try {
      if (pointer&&canvas.requestPointerLock) {
        const request = canvas.requestPointerLock(); if (request && request.catch) request.catch(() => { pointerLocked = false; });
      }
    } catch { pointerLocked = false; }
    saveRoomSession();syncAnimation(); canvas.focus({ preventScroll: true });
  }

  function leave() {
    if (!exploring && !pointerLocked) return;
    exploring = false; pointerLocked = false; keys.clear(); dragPoint = null;
    consoleOpen=false;if(consolePanel)consolePanel.hidden=true;shell?.classList.remove('console-open');
    if (document.pointerLockElement === canvas) { try { document.exitPointerLock(); } catch { /* Browser may already have released it. */ } }
    if (shell) { shell.classList.remove('exploring', 'pointer-locked', 'show-nav'); shell.querySelector('[data-room-enter]').hidden = false; shell.querySelector('[data-room-leave]').hidden = true; shell.querySelector('[data-room-navigation]').setAttribute('aria-expanded', 'false'); }
    document.body.classList.remove('root-room-open');
    saveRoomSession();
    updateTarget(currentRacks);
    if (onExit) onExit();
    syncAnimation();
  }

  function isExploring() { return exploring&&!consoleOpen; }
  function openConsole(title='Leitstelle'){
    consoleOpen=true;keys.clear();dragPoint=null;pointerLocked=false;
    shell.classList.remove('pointer-locked');shell.querySelector('[data-room-mouse-help]').innerHTML='<kbd>Maus</kbd> Ziehen / ← → drehen';
    if(document.pointerLockElement===canvas)document.exitPointerLock();
    shell.classList.add('console-open');consolePanel.hidden=false;
    consolePanel.querySelector('[data-room-console-title]').textContent=title;
    consoleContent.scrollTop=0;consoleContent.focus({preventScroll:true});
  }
  function closeConsole(){consoleOpen=false;consolePanel.hidden=true;shell.classList.remove('console-open');keys.clear();canvas?.focus({preventScroll:true});}
  function setConsoleTitle(title,view){consolePanel.querySelector('[data-room-console-title]').textContent=title;consolePanel.querySelectorAll('[data-nav]').forEach(b=>{b.classList.toggle('active',b.dataset.nav===view);b.setAttribute('aria-current',b.dataset.nav===view?'page':'false');});}

  function hide() {
    saveRoomSession();
    finishArrival(false);
    hidden = true; mounted = false; stopAnimation();
    consoleOpen=false;if(consolePanel)consolePanel.hidden=true;shell?.classList.remove('console-open');
    if (pointerLocked && document.pointerLockElement === canvas) { try { document.exitPointerLock(); } catch { /* no-op */ } }
    pointerLocked = false;
    if (exploring) {
      exploring = false; keys.clear(); dragPoint = null;
      if (shell) { shell.classList.remove('exploring', 'pointer-locked', 'show-nav'); shell.querySelector('[data-room-enter]').hidden = false; shell.querySelector('[data-room-leave]').hidden = true; shell.querySelector('[data-room-navigation]').setAttribute('aria-expanded', 'false'); }
      document.body.classList.remove('root-room-open');
    }
  }

  function toggleNavigation() {
    if (!shell) return;
    const open = !shell.classList.contains('show-nav');
    shell.classList.toggle('show-nav', open);
    shell.querySelector('[data-room-navigation]').setAttribute('aria-expanded', String(open));
  }

  function canStand(x,z) {
    if(!assetBank)return Math.abs(x)<=1.82&&z>=(camera.userData.backLimit||-12)&&z<=5.5;
    if(facilityInterior&&!facilityInterior.canWalk(x,z))return false;
    for(const rack of rackGroups.values())if(Math.abs(x-rack.position.x)<.76&&Math.abs(z-rack.position.z)<.51)return false;
    for(const obstacle of facilityInterior?.colliders||[])
      if(Math.abs(x-obstacle.x)<obstacle.hx&&Math.abs(z-obstacle.z)<obstacle.hz)return false;
    for(const obstacle of stationSystem?.colliders||[])
      if(Math.abs(x-obstacle.x)<obstacle.hx&&Math.abs(z-obstacle.z)<obstacle.hz)return false;
    if(locationId.startsWith('room-'))for(const side of [-1,1])if(Math.abs(x-side*3.25)<.68&&z< -3.8)return false;
    return true;
  }

  function movePlayer(delta) {
    if (!document.hasFocus()) keys.clear();
    keys.expire();
    if (!exploring || consoleOpen || keys.size === 0) return;
    const forward = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    const strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    if(keys.has('ArrowLeft'))yaw+=delta*1.6;
    if(keys.has('ArrowRight'))yaw-=delta*1.6;
    if (!forward && !strafe) return;
    const length = Math.hypot(forward, strafe) || 1, speed = (keys.has('ShiftLeft') ? 2.6 : 1.65) * Math.min(delta, 0.05);
    const dx = (-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) / length * speed;
    const dz = (-Math.cos(yaw) * forward - Math.sin(yaw) * strafe) / length * speed;
    const back = camera.userData.backLimit || -12;
    // The rack faces form the aisle walls; this keeps the camera inside their actual clearance.
    if(assetBank){
      const x=camera.position.x+dx,z=camera.position.z+dz;
      if(canStand(x,camera.position.z))camera.position.x=x;
      if(canStand(camera.position.x,z))camera.position.z=z;
      const stair=facilityInterior?.stairAt(camera.position.x,camera.position.z);
      camera.position.y=eyeHeight+(stair?stairHeight(stair,camera.position.z):0);
      if(performance.now()>roomTransitionUntil){
        const door=facilityInterior?.crossing(camera.position.x,camera.position.z);
        if(door)changeLocation(door.destination,selectedFloor,'threshold');
        else if(stair&&camera.position.z<stair.endZ+.04)changeLocation('hall',stair.floor,'stairs');
      }
    }else{
      camera.position.x = THREE.MathUtils.clamp(camera.position.x + dx, -1.82, 1.82);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z + dz, back, 5.5);
    }
  }

  function animate(now) {
    animationFrame = 0;
    if (!mounted || hidden || document.hidden || (!inViewport&&!exploring&&!arrival) || !renderer || !scene) return;
    const fps = exploring || arrival ? (isReducedMotion ? 30 : 60) : (isReducedMotion ? 4 : 15);
    if (now - lastFrameTime < 1000 / fps - 1) { animationFrame = requestAnimationFrame(animate); return; }
    const delta = Math.min(0.05, (now - (lastFrame || now)) / 1000); lastFrame = now; lastFrameTime = now;
    const elapsed = now / 1000;
    if(arrival){const frame=arrival.render(renderer,now);arrivalOverlay.querySelector('[data-arrival-caption]').textContent=tr(frame.caption);arrivalOverlay.querySelector('.arrival-progress i').style.width=(frame.progress*100)+'%';if(frame.done)finishArrival();animationFrame=requestAnimationFrame(animate);return;}
    movePlayer(delta);
    if(now-lastSessionWrite>=1000)saveRoomSession();
    facilityInterior?.animate(delta,isReducedMotion,{x:camera.position.x,z:camera.position.z});
    if(assetHall&&!isReducedMotion){const heat=Math.max(22,...currentRacks.map(r=>r.temperature));for(const fan of assetHall.coolingFans)fan.rotation.z+=delta*(6+Math.max(0,heat-22)*.2);}
    if(!isReducedMotion)for(const fan of facilityInterior?.fans||[])fan.rotation.z+=delta*9;
    for (const ref of rackRefs.values()) {
      if(ref.asset)animateAssetRack(ref,delta,elapsed,isReducedMotion);
      else if(!isReducedMotion)ref.fans.forEach((fan,i)=>{fan.rotation.z+=delta*(fan.userData.speed||0)*(i?1:-1);});
    }
    if (!exploring) {
      camera.position.x += (0 - camera.position.x) * Math.min(1, delta * 1.6);
      camera.position.y += ((assetBank?2.25:3.25) - camera.position.y) * Math.min(1, delta * 1.6);
      camera.position.z += ((assetBank?(locationId==='hall'?3.9:3.0):5.3) - camera.position.z) * Math.min(1, delta * 1.6);
      camera.lookAt(0, 1.3, assetBank?-.8:-Math.min(8, Math.max(3, (rackGroups.size / 2) * 1.3)));
    } else applyCameraRotation();
    if (targetRack && !isReducedMotion) {
      const ref = rackRefs.get(targetRack); if (ref && ref.tempStrip) ref.tempStrip.material.emissiveIntensity = 0.6 + Math.sin(elapsed * 1.8) * 0.18;
    }
    if(exploring&&now-lastTargetAt>=100){lastTargetAt=now;updateTarget(currentRacks);}
    renderer.render(scene, camera);
    // DOM diagnostics let browser QA verify actual renderer work without exposing state controls.
    if(now-(canvas._lastRenderStats||0)>1000){canvas._lastRenderStats=now;canvas.dataset.drawCalls=renderer.info.render.calls;canvas.dataset.triangles=renderer.info.render.triangles;canvas.dataset.rackModels=rackGroups.size;canvas.dataset.rackBuilds=rackGeneration;canvas.dataset.serverModels=serverGroups.size;canvas.dataset.roomId=locationId;canvas.dataset.floor=selectedFloor;canvas.dataset.position=camera.position.toArray().map(n=>n.toFixed(2)).join(',');canvas.dataset.stairs=locationId==='hall'?(facilityInterior?.plan.stairs||[]).map(s=>s.direction).join(','):'';canvas.dataset.openDoors=[...rackRefs.values()].filter(r=>r.cabinet?.doorOpen).length;}
    animationFrame = requestAnimationFrame(animate);
  }

  function syncAnimation() {
    if (!mounted || hidden || document.hidden || (!inViewport&&!exploring&&!arrival) || !renderer || animationFrame) return;
    lastFrame = 0; lastFrameTime = 0; animationFrame = requestAnimationFrame(animate);
  }
  function stopAnimation() { if (animationFrame) cancelAnimationFrame(animationFrame); animationFrame = 0; lastFrame = 0; }

  return { markup, mount, update, hide, changeLocation, startArrival, isArriving:()=>Boolean(arrival), isExploring, isInRoom:()=>exploring,isConsoleOpen:()=>consoleOpen,consoleBody:()=>consoleContent,openConsole,closeConsole,setConsoleTitle,leave, leaveExploration: leave };
}
