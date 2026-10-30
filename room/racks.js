/** 3D racks. The per-view context owns scene resources and mutable interaction state. */
export function createRoomRacks(sceneContext) {
  function makeFan(parent, x, y, z, material) {
    const fan = new sceneContext.THREE.Group();
    fan.position.set(x, y, z);
    parent.add(fan);
    const base = new sceneContext.THREE.Mesh(
      sceneContext.cylinderGeometry(0.23, 0.23, 0.075, 24),
      sceneContext.materials.black,
    );
    base.rotation.x = Math.PI / 2;
    fan.add(base);
    const guard = new sceneContext.THREE.Mesh(
      new sceneContext.THREE.TorusGeometry(0.22, 0.012, 5, 24),
      sceneContext.materials.rail,
    );
    guard.position.z = 0.047;
    fan.add(guard);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        point = sceneContext.addBox(
          fan,
          0.012,
          0.043,
          0.012,
          sceneContext.materials.rail,
          Math.sin(a) * 0.19,
          Math.cos(a) * 0.19,
          0.045,
          { castShadow: false, radius: 0.004 },
        );
      point.rotation.z = -a;
    }
    const rotor = new sceneContext.THREE.Group();
    fan.add(rotor);
    let bladeGeometry = sceneContext.sharedGeometries.get('fanBlade');
    if (!bladeGeometry) {
      const shape = new sceneContext.THREE.Shape();
      shape.moveTo(0.008, 0.025);
      shape.quadraticCurveTo(0.025, 0.09, 0.16, 0.17);
      shape.quadraticCurveTo(0.205, 0.2, 0.18, 0.145);
      shape.quadraticCurveTo(0.135, 0.055, 0.04, 0.012);
      shape.quadraticCurveTo(0.018, 0.006, 0.008, 0.025);
      bladeGeometry = new sceneContext.THREE.ExtrudeGeometry(shape, {
        depth: 0.012,
        bevelEnabled: true,
        bevelSegments: 1,
        steps: 1,
        bevelSize: 0.003,
        bevelThickness: 0.002,
        curveSegments: 3,
      });
      bladeGeometry.translate(-0.08, -0.075, -0.006);
      sceneContext.sharedGeometries.set('fanBlade', bladeGeometry);
    }
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5;
      const blade = new sceneContext.THREE.Mesh(bladeGeometry, material);
      blade.rotation.z = angle;
      blade.position.z = 0.012;
      blade.castShadow = false;
      rotor.add(blade);
    }
    const hub = new sceneContext.THREE.Mesh(
      sceneContext.sphereGeometry(0.055, 12),
      sceneContext.materials.rail,
    );
    hub.position.z = 0.02;
    rotor.add(hub);
    return rotor;
  }

  function buildRack(rack, index, total) {
    if (sceneContext.assetBank) {
      sceneContext.assetHitMaterial ||= new sceneContext.THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false,
      });
      const ref = sceneContext.buildAssetRack({
        bank: sceneContext.assetBank,
        rack,
        index,
        scene: sceneContext.scene,
        hitMaterial: sceneContext.assetHitMaterial,
      });
      sceneContext.rackGroups.set(rack.id, ref.group);
      sceneContext.rackRefs.set(rack.id, ref);
      sceneContext.pickTargets.push(...ref.picks);
      for (const [id, item] of ref.servers) {
        sceneContext.serverGroups.set(id, item.root);
        sceneContext.serverRefs.set(id, item);
      }
      return ref.group;
    }
    const group = new sceneContext.THREE.Group();
    group.userData.roomKind = 'rack';
    group.userData.rackId = rack.id;
    const side = index % 2 === 0 ? -1 : 1;
    const row = Math.floor(index / 2);
    const frontX = side * 3.3;
    group.position.set(frontX, 0, -row * 4.2 - 1.0);
    group.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    sceneContext.scene.add(group);
    sceneContext.rackGroups.set(rack.id, group);
    sceneContext.rackRefs.set(rack.id, {
      group,
      leds: [],
      tempStrip: null,
      fans: [],
      panel: null,
      cables: [],
    });
    const h = 2.72,
      w = 1.6,
      d = 1.0,
      halfW = w / 2,
      halfD = d / 2;
    sceneContext.addBox(group, 0.1, h, 0.12, sceneContext.materials.rail, -halfW + 0.06, h / 2, 0, {
      radius: 0.02,
    });
    sceneContext.addBox(group, 0.1, h, 0.12, sceneContext.materials.rail, halfW - 0.06, h / 2, 0, {
      radius: 0.02,
    });
    sceneContext.addBox(group, w, 0.13, d, sceneContext.materials.shell, 0, 0.08, 0, {
      radius: 0.035,
    });
    sceneContext.addBox(group, w, 0.13, d, sceneContext.materials.shell, 0, h - 0.07, 0, {
      radius: 0.035,
    });
    sceneContext.addBox(
      group,
      w - 0.14,
      0.055,
      0.04,
      sceneContext.materials.trim,
      0,
      h - 0.15,
      halfD + 0.035,
      {
        radius: 0.012,
      },
    );
    sceneContext.addBox(
      group,
      w - 0.14,
      0.055,
      0.04,
      sceneContext.materials.trim,
      0,
      0.18,
      halfD + 0.035,
      {
        radius: 0.012,
      },
    );
    sceneContext.addBox(
      group,
      0.09,
      h - 0.33,
      0.04,
      sceneContext.materials.trim,
      -halfW + 0.14,
      h / 2,
      halfD + 0.035,
      {
        radius: 0.014,
      },
    );
    sceneContext.addBox(
      group,
      0.09,
      h - 0.33,
      0.04,
      sceneContext.materials.trim,
      halfW - 0.14,
      h / 2,
      halfD + 0.035,
      {
        radius: 0.014,
      },
    );
    // Recessed chassis back, side panels, and 16 usable height-unit rails.
    sceneContext.addBox(
      group,
      w - 0.21,
      h - 0.23,
      0.1,
      sceneContext.materials.shellDark,
      0,
      h / 2,
      -halfD + 0.06,
    );
    sceneContext.addBox(
      group,
      0.055,
      h - 0.3,
      d - 0.15,
      sceneContext.materials.shell,
      -halfW + 0.03,
      h / 2,
      0,
    );
    sceneContext.addBox(
      group,
      0.055,
      h - 0.3,
      d - 0.15,
      sceneContext.materials.shell,
      halfW - 0.03,
      h / 2,
      0,
    );
    for (const x of [-halfW - 0.01, halfW + 0.01]) {
      sceneContext.addBox(
        group,
        0.018,
        0.56,
        0.48,
        sceneContext.materials.panel,
        x,
        h * 0.55,
        -0.11,
        {
          castShadow: false,
          radius: 0.012,
        },
      );
      sceneContext.addBox(
        group,
        0.02,
        0.2,
        0.045,
        sceneContext.materials.rubber,
        x * 1.006,
        h * 0.55,
        0.17,
        {
          castShadow: false,
          radius: 0.008,
        },
      );
    }
    const sideLouvers = [];
    for (const x of [-halfW - 0.02, halfW + 0.02])
      for (let i = 0; i < 9; i++) sideLouvers.push([x, 0.62 + i * 0.057, -0.11]);
    sceneContext.addBoxInstances(
      group,
      0.012,
      0.012,
      0.39,
      sceneContext.materials.brushed,
      sideLouvers,
      false,
      0.003,
    );
    const unitH = 0.1125,
      unitBase = 0.32;
    const occupied = new Set(
      rack.servers.flatMap((s) => Array.from({ length: s.units }, (_, i) => s.unit + i)),
    );
    for (let u = 2; u <= 17; u++)
      if (!occupied.has(u)) {
        const y = unitBase + (u - 1.5) * unitH;
        sceneContext.addBox(
          group,
          1.29,
          unitH - 0.015,
          0.035,
          sceneContext.materials.grille,
          0,
          y,
          halfD + 0.025,
          {
            castShadow: false,
            radius: 0.007,
          },
        );
        sceneContext.addBox(
          group,
          0.022,
          0.026,
          0.012,
          sceneContext.materials.rail,
          -0.6,
          y,
          halfD + 0.049,
          {
            castShadow: false,
          },
        );
        sceneContext.addBox(
          group,
          0.022,
          0.026,
          0.012,
          sceneContext.materials.rail,
          0.6,
          y,
          halfD + 0.049,
          {
            castShadow: false,
          },
        );
      }
    const unitRails = [],
      unitClips = [];
    for (let u = 0; u <= 16; u++) {
      const y = unitBase + u * unitH;
      unitRails.push([0, y, halfD + 0.018]);
      if (u < 16) unitClips.push([-halfW + 0.18, y + 0.063, halfD + 0.022]);
    }
    sceneContext.addBoxInstances(
      group,
      w - 0.18,
      0.018,
      0.035,
      sceneContext.materials.rail,
      unitRails,
    );
    sceneContext.addBoxInstances(
      group,
      0.12,
      0.024,
      0.035,
      sceneContext.materials.amber,
      unitClips,
    );
    const rackScrews = [];
    for (let u = 1; u <= 16; u += 2)
      for (const x of [-0.69, 0.69])
        rackScrews.push([x, unitBase + (u - 0.5) * unitH, halfD + 0.045]);
    sceneContext.addBoxInstances(
      group,
      0.026,
      0.026,
      0.012,
      sceneContext.materials.brushed,
      rackScrews,
      false,
      0.006,
    );
    // Top fascia and a physically legible rack nameplate.
    sceneContext.addBox(
      group,
      w - 0.16,
      0.25,
      0.055,
      sceneContext.materials.panel,
      0,
      h - 0.27,
      halfD + 0.05,
      {
        radius: 0.028,
      },
    );
    const rackTag = new sceneContext.THREE.Mesh(
      sceneContext.planeGeometry(1.1, 0.18),
      sceneContext.labelMaterial([rack.name.toUpperCase(), 'ROOT / CABINET 19 IN'], {
        accent: '#9ce265',
      }),
    );
    rackTag.position.set(0, h - 0.27, halfD + 0.082);
    group.add(rackTag);
    const rackLights = [
      sceneContext.materials.off,
      sceneContext.materials.off,
      sceneContext.materials.off,
    ].map((m, i) => sceneContext.addDot(group, -0.58 + i * 0.1, h - 0.36, halfD + 0.086, m, 0.025));
    const innerFill = sceneContext.addBox(
      group,
      0.035,
      0.11,
      0.012,
      sceneContext.materials.green,
      halfW - 0.19,
      h / 2,
      halfD + 0.09,
      { castShadow: false },
    );
    sceneContext.addBox(
      group,
      w - 0.16,
      0.19,
      0.055,
      sceneContext.materials.panel,
      0,
      0.23,
      halfD + 0.05,
      { radius: 0.02 },
    );
    const pdu = sceneContext.addBox(
      group,
      w - 0.25,
      0.13,
      0.055,
      sceneContext.materials.face,
      0,
      0.21,
      halfD + 0.088,
      {
        castShadow: false,
        radius: 0.018,
      },
    );
    const pduDisplay = sceneContext.addBox(
      group,
      0.2,
      0.07,
      0.014,
      sceneContext.materials.green,
      0,
      0.21,
      halfD + 0.12,
      {
        castShadow: false,
        radius: 0.01,
      },
    );
    const pduPositions = [],
      pduLedPositions = [];
    for (let port = 0; port < 16; port++) {
      const px = -0.56 + port * 0.074;
      pduPositions.push([px, 0.21, halfD + 0.12]);
      pduLedPositions.push([px, 0.21 + 0.033, halfD + 0.14]);
    }
    sceneContext.addBoxInstances(
      group,
      0.045,
      0.072,
      0.028,
      sceneContext.materials.black,
      pduPositions,
      false,
      0.006,
    );
    const pduOutletLights = sceneContext.addDotInstances(
      group,
      0.012,
      sceneContext.materials.indicator,
      pduLedPositions,
    );
    // Switch sits above the 16U server bay; the PDU occupies its own base.
    const switchMesh = sceneContext.addBox(
      group,
      w - 0.25,
      0.12,
      0.28,
      sceneContext.materials.face,
      0,
      h - 0.48,
      halfD + 0.12,
      { castShadow: false, radius: 0.018 },
    );
    const switchSocketPositions = [],
      switchLinkPositions = [],
      switchTrafficPositions = [],
      switchPorts = [];
    for (let p = 0; p < Math.min(16, rack.ports.length); p++) {
      const px = -0.58 + p * 0.075;
      switchSocketPositions.push([px, h - 0.48, halfD + 0.27]);
      switchLinkPositions.push([px - 0.009, h - 0.435, halfD + 0.29]);
      switchTrafficPositions.push([px + 0.011, h - 0.435, halfD + 0.29]);
      switchPorts.push({ number: p + 1, traffic: false, linked: false });
    }
    sceneContext.addBoxInstances(
      group,
      0.05,
      0.055,
      0.03,
      sceneContext.materials.black,
      switchSocketPositions,
      false,
      0.006,
    );
    const switchLinkLights = sceneContext.addDotInstances(
      group,
      0.01,
      sceneContext.materials.indicator,
      switchLinkPositions,
    );
    const switchTrafficLights = sceneContext.addDotInstances(
      group,
      0.01,
      sceneContext.materials.indicator,
      switchTrafficPositions,
    );
    sceneContext.addBox(
      group,
      0.18,
      0.07,
      0.04,
      sceneContext.materials.green,
      0.56,
      h - 0.48,
      halfD + 0.28,
      {
        castShadow: false,
      },
    );
    const fans = [
      makeFan(group, -0.45, h + 0.03, 0, sceneContext.materials.green),
      makeFan(group, 0.45, h + 0.03, 0, sceneContext.materials.green),
    ];
    const topStrip = sceneContext.addBox(
      group,
      0.035,
      0.05,
      0.9,
      sceneContext.materials.green,
      side < 0 ? halfW - 0.035 : -halfW + 0.035,
      h - 0.38,
      0,
      { castShadow: false },
    );
    sceneContext.rackRefs.get(rack.id).leds = rackLights;
    sceneContext.rackRefs.get(rack.id).tempStrip = topStrip;
    sceneContext.rackRefs.get(rack.id).fans = fans;
    sceneContext.rackRefs.get(rack.id).switchPorts = switchPorts;
    sceneContext.rackRefs.get(rack.id).switchLinkLights = switchLinkLights;
    sceneContext.rackRefs.get(rack.id).switchTrafficLights = switchTrafficLights;
    sceneContext.rackRefs.get(rack.id).pduOutletLights = pduOutletLights;
    sceneContext.rackRefs.get(rack.id).panel = innerFill;
    sceneContext.rackRefs.get(rack.id).switch = switchMesh;
    sceneContext.rackRefs.get(rack.id).pdu = pdu;
    sceneContext.rackRefs.get(rack.id).pduDisplay = pduDisplay;
    // Servers use the real 1/2/3U placements and have drive bays, ventilation, ports, and state LEDs.
    for (const server of rack.servers)
      sceneContext.buildServer(group, rack, server, unitBase, unitH, h, halfD);
    // Fine wire-mesh door sits ahead of the live hardware; transparent cells preserve legibility.
    const door = new sceneContext.THREE.Mesh(
      sceneContext.planeGeometry(w - 0.16, h - 0.36),
      sceneContext.materials.door,
    );
    door.position.set(0, h / 2, halfD + 0.585);
    door.renderOrder = 2;
    door.castShadow = false;
    group.add(door);
    sceneContext.addBox(
      group,
      0.045,
      h - 0.36,
      0.065,
      sceneContext.materials.shell,
      -halfW + 0.11,
      h / 2,
      halfD + 0.6,
      {
        castShadow: false,
        radius: 0.015,
      },
    );
    sceneContext.addBox(
      group,
      0.045,
      h - 0.36,
      0.065,
      sceneContext.materials.shell,
      halfW - 0.11,
      h / 2,
      halfD + 0.6,
      {
        castShadow: false,
        radius: 0.015,
      },
    );
    sceneContext.addBox(
      group,
      0.035,
      0.31,
      0.055,
      sceneContext.materials.brushed,
      -halfW + 0.13,
      h / 2,
      halfD + 0.63,
      {
        castShadow: false,
        radius: 0.014,
      },
    );
    // Side-mounted rack access tag is also a valid pick target for rack-level management.
    const hitMaterial = new sceneContext.THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.001,
      depthWrite: false,
      color: 0xffffff,
    });
    sceneContext.dynamicMaterials.push(hitMaterial);
    const hit = sceneContext.addBox(
      group,
      w - 0.15,
      h - 0.38,
      0.025,
      hitMaterial,
      0,
      h / 2,
      halfD - 0.08,
      {
        castShadow: false,
      },
    );
    hit.userData.roomKind = 'rack';
    hit.userData.rackId = rack.id;
    sceneContext.pickTargets.push(hit);
    return group;
  }
  return { makeFan, buildRack };
}
