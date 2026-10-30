import * as THREE from './vendor/three.module.js';
import { metricBox } from './room-surfaces.js';
import { facilityReadout, drawInstrument } from './room-instruments.js';

const tr = text => globalThis.ROOTI18N?.translate(String(text)) || String(text);
const names = { hall: 'Verbindungsflur', control: 'Kontrollraum', cooling: 'Zentrale Kühlung', ups: 'USV', distribution: 'Stromverteilung' };

export function roomLocation(layout, id, floor = 1) {
  const room = layout.rooms.find(item => item.id === id);
  if (room) return { id, floor: room.floor, name: `Raum ${room.number}`, rackIds: room.rackIds };
  const safeId = names[id] ? id : 'hall';
  return { id: safeId, floor: safeId === 'hall' ? Math.max(1, Math.min(layout.floorCount, floor)) : 1, name: names[safeId], rackIds: [] };
}

// Central equipment exists once, on UG 1. Only owned rooms and floors get links.
export function corridorPlan(layout, central, floor) {
  floor = Math.max(1, Math.min(layout.floorCount, floor));
  const destinations = [
    ...(floor === 1 ? [{ id: 'control', name: names.control, subtitle: 'Leitstelle / Betrieb' }] : []),
    ...layout.rooms.filter(room => room.floor === floor).map(room => ({ id: room.id, name: `Raum ${room.number}`, subtitle: `${room.rackCount} Racks · ${room.serverCount} Server` })),
    ...(floor === 1 ? central.systems.filter(s => s.available).map(s => ({ id: s.id, name: s.name, subtitle: `Stufe ${s.level}` })) : [])
  ];
  const doors = destinations.map((d, i) => ({ ...d, x: i % 2 ? 2.1 : -2.1, z: 2.1 - Math.floor(i / 2) * 3.4, turn: i % 2 ? -Math.PI / 2 : Math.PI / 2 }));
  const endZ = Math.min(-2.4, 2.1 - Math.ceil(destinations.length / 2) * 3.4);
  const stairs = [
    ...(floor > 1 ? [{ direction: 'up', floor: floor - 1, x: -1.04, startZ: endZ, endZ: endZ - 3.2, rise: 2.6 }] : []),
    ...(floor < layout.floorCount ? [{ direction: 'down', floor: floor + 1, x: 1.04, startZ: endZ, endZ: endZ - 3.2, rise: -2.6 }] : [])
  ];
  return { floor, doors, stairs, endZ, frontZ: 4.8 };
}

export function stairHeight(stair, z) {
  const fraction = THREE.MathUtils.clamp((stair.startZ - z) / 3.2, 0, 1);
  // Follow the walkable pitch instead of fourteen abrupt head jolts.
  return fraction * stair.rise;
}

export function buildFacilityInterior({ bank, scene, materials, location, layout, central }) {
  const group = new THREE.Group(); group.name = 'facility-interior'; scene.add(group);
  const picks = [], portals = [], colliders = [], fans = [], geometries = [], textures = [], ownedMaterials = [], instruments=[];
  let lastInstrumentUpdate=-Infinity,lastInstrumentLanguage='';
  const concrete = materials.bunkerConcrete || materials.wall;
  const steel = materials.bunkerSteel || materials.brushed;
  const plan = corridorPlan(layout, central, location.floor), isHall = location.id === 'hall';
  function box(parent, size, position, material) {
    const mesh = metricBox(size, material); geometries.push(mesh.geometry);
    mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function sign(parent, title, subtitle, position, width = 1.05, height = .24, turn = 0) {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = Math.round(768*height/width);
    const h=canvas.height,ctx = canvas.getContext('2d'); ctx.fillStyle = '#101c20'; ctx.fillRect(0, 0, 768, h);
    ctx.fillStyle = '#a7d487'; ctx.fillRect(0, 0, 9, h); ctx.fillStyle = '#e5ede8'; ctx.font = `600 ${Math.min(64,Math.round(h*.36))}px Segoe UI`;
    ctx.fillText(tr(title), 30, h*.45, 708); ctx.fillStyle = '#a4b9b8'; ctx.font = `${Math.min(44,Math.round(h*.23))}px Segoe UI`; ctx.fillText(tr(subtitle), 30, h*.82, 708);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
    const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }); ownedMaterials.push(material);
    const geometry = new THREE.PlaneGeometry(width, height); geometries.push(geometry);
    const backing=box(parent,[width+.018,height+.018,.012],[position[0]-Math.sin(turn)*.008,position[1],position[2]-Math.cos(turn)*.008],materials.shellDark);
    backing.name='mounted-sign-backing';backing.rotation.y=turn;
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); mesh.rotation.y = turn; parent.add(mesh); return mesh;
  }
  function portal(title, subtitle, destination, x, z, turn = 0) {
    const holder = new THREE.Group(); holder.position.set(x, 0, z); holder.rotation.y = turn; group.add(holder);
    const door = bank.make('airlock'); holder.add(door);
    sign(holder, title, subtitle, [0, isHall?2.515:2.61, .084], 1.20, .18);
    const p = { id: destination, x, z, turn, destination, label: title, hinge: door.getObjectByName('bunker_door_hinge'), open: false, progress: 0, autoClose: false, closeDelay: 0 };
    const hitMaterial = new THREE.MeshBasicMaterial({ visible: false }); ownedMaterials.push(hitMaterial);
    // Follow the leaf instead of leaving the interaction target in the empty
    // doorway. A closed box is reachable from either side of the open door.
    const hit = p.hinge ? box(p.hinge,[1.06,2.16,.15],[.53,1.08,.015],hitMaterial)
      : box(holder,[1.1,2.24,.15],[0,1.12,.015],hitMaterial);
    hit.name='portal-leaf-hit';
    hit.userData = { roomKind: 'portal', portal: p, destination, label: title, enabled: true }; picks.push(hit); portals.push(p);
    // The aperture reveals a short vestibule; crossing streams the detailed room.
    box(holder, [1.4, .12, 1.1], [0, -.06, -.64], materials.bunkerFloor || materials.floor);
    for (const side of [-1, 1]) box(holder, [.14, 2.4, 1.1], [side * .69, 1.2, -.64], concrete);
    box(holder, [1.5, .16, 1.1], [0, 2.4, -.64], concrete);
    box(holder, [1.4, 2.4, .10], [0, 1.2, -1.18], materials.shellDark);
    box(holder, [.75, .025, .12], [0, 2.28, -.7], materials.lightWhite);
    return p;
  }
  function terminal(title, subtitle, position, turn = 0, view = 'facility', rackId = null) {
    const holder = new THREE.Group(); holder.name='local-operations-terminal';holder.position.set(...position); holder.rotation.y = turn; group.add(holder);
    const model=bank.make('terminal');holder.add(model);
    const originalScreen=model.getObjectByName('monitor_screen');if(originalScreen)originalScreen.visible=false;
    const oldLabel=model.getObjectByName('label_hostname');if(oldLabel)oldLabel.visible=false;
    sign(holder,'ROOT / LOCAL',`Untergeschoss ${location.floor}`,[.14,-.29,.188],.38,.055);
    const panel = instrument(holder,[0,.08,.188],.84,.52);
    panel.userData = { roomKind: 'station', view, label: title, rackId }; picks.push(panel);
    sign(holder, title, 'E / Klick: Terminal öffnen', [0, .64, .012], 1.05, .20);
  }
  function instrument(parent,position,width,height,compact=false) {
    const canvas=document.createElement('canvas');canvas.width=compact?720:840;canvas.height=compact?Math.round(720*height/width):520;
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;textures.push(texture);
    const material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});ownedMaterials.push(material);
    const geometry=new THREE.PlaneGeometry(width,height);geometries.push(geometry);
    const face=new THREE.Mesh(geometry,material);face.name=compact?'live-plant-display':'live-room-terminal';face.position.set(...position);parent.add(face);
    instruments.push({canvas,texture,compact,lastKey:''});return face;
  }
  if (isHall) {
    const length = plan.frontZ - plan.endZ, middle = (plan.frontZ + plan.endZ) / 2;
    box(group, [4.4, .18, length], [0, -.09, middle], materials.bunkerFloor || materials.floor);
    box(group, [4.4, .22, length], [0, 3.12, middle], concrete);
    box(group, [4.4, 3.2, .3], [0, 1.6, plan.frontZ + .15], concrete);
    box(group, [4.4, .36, .28], [0, 2.92, plan.endZ - .05], steel);
    for (const side of [-1, 1]) {
      const doors = plan.doors.filter(d => Math.sign(d.x) === side).sort((a, b) => a.z - b.z);
      let cursor = plan.endZ;
      for (const d of doors) {
        const start = d.z - .72;
        if (start > cursor) box(group, [.3, 3.2, start - cursor], [side * 2.18, 1.6, (cursor + start) / 2], concrete);
        box(group, [.3, .8, 1.44], [side * 2.18, 2.8, d.z], concrete);
        portal(d.name, d.subtitle, d.id, d.x, d.z, d.turn);
        cursor = d.z + .72;
      }
      if (cursor < plan.frontZ) box(group, [.3, 3.2, plan.frontZ - cursor], [side * 2.18, 1.6, (cursor + plan.frontZ) / 2], concrete);
      for (const y of [2.73, 2.86]) box(group, [.055, .055, length - .15], [side * 1.94, y, middle], steel);
      box(group, [.025, .012, length - .2], [side * 1.78, .015, middle], materials.lightWhite);
    }
    for (let z = 3.3; z > plan.endZ+1.55; z -= 3.4) {
      const lamp = bank.make('light'); lamp.position.set(0, 2.74, z); group.add(lamp);
      const light = new THREE.PointLight(0xd6e5e4, 9, 6, 2); light.position.set(0, 2.62, z); group.add(light);
      for (const side of [-1, 1]) box(group, [.11, 3.0, .14], [side * 2.0, 1.5, z + .6], steel);
      box(group, [4.05, .15, .16], [0, 2.99, z + .6], steel);
    }
    if (!plan.stairs.length) box(group, [4.4, 3.2, .3], [0, 1.6, plan.endZ - .15], concrete);
    else {
      const dividerWidth=.14;
      box(group, [dividerWidth, 8.4, 4.7], [0, 1.5, plan.endZ - 2.25], concrete);
      for (const side of [-1, 1]) {
        const stair = plan.stairs.find(s => Math.sign(s.x) === side);
        if (!stair) { box(group, [2.05, 3.2, .3], [side * 1.04, 1.6, plan.endZ - .15], concrete); continue; }
        const flight = bank.make('stairs');
        flight.position.set(stair.x, stair.rise > 0 ? 0 : -2.6, plan.endZ - 1.6);
        flight.rotation.y = stair.rise > 0 ? Math.PI : 0; group.add(flight);
        box(group, [.28, 8.4, 4.8], [side * 2.18, 1.5, plan.endZ - 2.25], concrete);
        box(group, [2.0, .16, 1.25], [stair.x, stair.rise - .08, plan.endZ - 3.825], materials.bunkerFloor || materials.floor);
        box(group, [2.0, 8.4, .2], [stair.x, 1.5, plan.endZ - 4.4], concrete);
        box(group, [2.0, .2, 4.8], [stair.x, stair.rise > 0 ? 5.55 : 3.12, plan.endZ - 2.25], concrete);
        // Keep a 2 mm assembly seam beside the divider. Both front faces
        // share Z, so the old 1.96 m beam overlapped its concrete by 1 cm.
        const headerWidth=2*(Math.abs(stair.x)-dividerWidth/2-.002);
        const header=box(group,[headerWidth,.23,.12],[stair.x,2.705,plan.endZ+.04],steel);header.name='stair-sign-header';
        sign(group, stair.direction === 'up' ? '↑ Treppe nach oben' : '↓ Treppe nach unten', `Untergeschoss ${stair.floor}`, [stair.x, 2.705, plan.endZ + .103], 1.55, .20);
        const lamp = new THREE.PointLight(0xd8e3df, 12, 7, 2); lamp.position.set(stair.x, stair.rise > 0 ? 3.8 : 1.8, plan.endZ - 2.2); group.add(lamp);
      }
    }
    terminal('Gebäudeplan', 'Raum & Etage wählen', [1.10,1.25,4.785], Math.PI, 'map');
    colliders.push({x:1.10,z:4.63,hx:.74,hz:.31});
  } else {
    portal('Verbindungsflur', `Untergeschoss ${location.floor}`, 'hall', 0, 5.35, Math.PI);
    if (location.id === 'control') {
      for (const side of [-1, 1]) colliders.push({ x: side * 1.65, z: -2.4, hx: 1.28, hz: .66 });
    } else if(location.id.startsWith('room-')){
      terminal('Hardware & Wartung', 'Racks · Server · Anschlüsse', [-1.55,1.25,5.275], Math.PI, 'network',location.rackIds[0]);
    } else terminal(location.name, 'Kapazität & Ausbau', [-1.55,1.25,5.275], Math.PI);
    if(location.id!=='control')colliders.push({x:-1.55,z:5.12,hx:.74,hz:.31});
    const system = central.systems.find(item => item.id === location.id);
    if (system) {
      const count = system.level ? Math.min(3, system.level + 1) : 0;
      for (let i = 0; i < count; i++) for (const side of [-1, 1]) {
        const x = side * 2.35, z = .2 - i * 1.45;
        const unit = bank.make(system.id === 'cooling' ? 'cooling' : system.id);
        unit.position.set(x, 0, z); unit.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; group.add(unit);
        const original=unit.getObjectByName(system.id==='cooling'?'crac_cooling_unit_cabinet_LOD0_5':system.id==='ups'?'ups_telemetry_display':'pdu_telemetry_display');
        if(original)original.visible=false;
        // All readings are on the fixed instrument fascia, above the access
        // doors. The original tiny atlas screens/hostnames are replaced locally.
        const cooling=system.id==='cooling',ups=system.id==='ups',front=cooling ? .448 : ups ? .429 : .369;
        const screenAt=cooling?[-.18,1.84,front]:[ups?-.20:-.27,ups?1.78:1.77,front];
        const screenSize=cooling?[.37,.17]:[.34,.11];
        box(unit,[screenSize[0]+.018,screenSize[1]+.018,.014],[screenAt[0],screenAt[1],front-.009],materials.shellDark);
        instrument(unit,screenAt,...screenSize,true);
        const code=system.id==='cooling'?'CRAC':system.id==='ups'?'UPS':'ATS';
        sign(unit,`${code} ${String(i+1).padStart(2,'0')}${side<0?'A':'B'}`,`ROOT / ${tr(`Untergeschoss ${location.floor}`)}`,[cooling ? .20 : ups ? .20 : .27,cooling?1.84:ups?1.78:1.77,front],cooling ? .23 : ups ? .30 : .38,cooling ? .10 : .09);
        if(ups)unit.traverse(node=>{if(/^led_ups_status_/.test(node.name))node.position.y+=.12;});
        if(system.id==='distribution'){
          sign(unit,'STROMVERTEILUNG','ATS / 3~ 400 V',[0,1.965,.363],1.00,.15);
          for(const source of [-1,1])sign(unit,source<0?'QUELLE A':'QUELLE B','L1 · L2 · L3',[source*.29,1.65,.361],.43,.075);
        }
        unit.traverse(node => { if (/^cooling_fan_\d+$/.test(node.name)) fans.push(node); });
        const bounds=new THREE.Box3().setFromObject(unit),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
        colliders.push(bounds.isEmpty()?{x,z,hx:.63,hz:.64}:{x:center.x,z:center.z,hx:size.x/2+.17,hz:size.z/2+.17});
      }
    }
  }
  const local = (p, x, z) => ({ x: Math.cos(p.turn) * (x - p.x) - Math.sin(p.turn) * (z - p.z), z: Math.sin(p.turn) * (x - p.x) + Math.cos(p.turn) * (z - p.z) });
  return {
    group, picks, portals, colliders, fans, plan,
    update(snapshot,now=performance.now()) {
      const language=globalThis.ROOTI18N?.getLanguage()||'de';
      if(now-lastInstrumentUpdate<900&&language===lastInstrumentLanguage)return;
      lastInstrumentUpdate=now;lastInstrumentLanguage=language;
      const data=facilityReadout({...snapshot,location,layout,central:snapshot.central||central},language);
      const key=JSON.stringify([language,data]);
      for(const face of instruments){if(face.lastKey===key)continue;drawInstrument(face.canvas,data,language,face.compact);face.texture.needsUpdate=true;face.lastKey=key;}
    },
    togglePortal(p) { if (portals.includes(p)) {p.open = !p.open;p.autoClose=false;} },
    openPortal(id,autoClose=false) { const p = portals.find(p => p.id === id); if (p) { p.open = true; p.progress = 1;p.autoClose=autoClose;p.closeDelay=1.2; if (p.hinge) p.hinge.rotation.y = -1.72; } },
    animate(delta, reduced, player=null) { for (const p of portals) {
      if(p.autoClose&&p.open){
        p.closeDelay=Math.max(0,p.closeDelay-delta);
        const at=player?local(p,player.x,player.z):null;
        // Keep the leaf open while the player occupies its swing/threshold area.
        const inSweep=at&&at.z>-.30&&Math.hypot(at.x+.53,at.z)<1.30;
        if(p.closeDelay===0&&!inSweep){p.open=false;p.autoClose=false;}
      }
      p.progress += ((p.open ? 1 : 0) - p.progress) * (reduced ? 1 : Math.min(1, delta * 5)); if (p.hinge) p.hinge.rotation.y = -p.progress * 1.72;
    } },
    canWalk(x, z) {
      const inMain = isHall ? Math.abs(x) < 1.8 && z > plan.endZ && z < 4.55 : Math.abs(x) < 3.85 && z > -4.85 && z < 5.05;
      if (inMain) return true;
      if (isHall && plan.stairs.some(s => Math.abs(x - s.x) < .47 && z <= s.startZ && z >= s.endZ - .25)) return true;
      return portals.some(p => { const at = local(p, x, z); return p.progress > .8 && Math.abs(at.x) < .45 && at.z < .65 && at.z > -.5; });
    },
    crossing(x, z) { return portals.find(p => { const at = local(p, x, z); return p.progress > .8 && Math.abs(at.x) < .45 && at.z < -.23 && at.z > -.5; }); },
    stairAt(x, z) { return isHall ? plan.stairs.find(s => Math.abs(x - s.x) < .48 && z < s.startZ && z >= s.endZ - .25) : null; },
    dispose() { scene.remove(group); geometries.forEach(item => item.dispose()); textures.forEach(item => item.dispose()); ownedMaterials.forEach(item => item.dispose()); }
  };
}
