/** 3D renderer. The per-view context owns scene resources and mutable interaction state. */
export function createRoomRenderer(sceneContext) {
  function mount() {
    const slot = document.querySelector('[data-room-slot]');
    if (!slot) return false;
    if (!sceneContext.shell) sceneContext.buildShell();
    if (sceneContext.shell.parentElement !== slot) slot.appendChild(sceneContext.shell);
    sceneContext.hidden = false;
    sceneContext.mounted = true;
    if (!sceneContext.scene && !sceneContext.worldLoading) {
      const loading = sceneContext.shell.querySelector('.root-room-empty p');
      loading.textContent = 'Neue 3D-Modelle werden geladen …';
      sceneContext.shell.querySelector('[data-room-enter]').disabled = true;
      sceneContext.worldLoading = sceneContext
        .loadRootAssets((done, total) => {
          loading.textContent = '3D-Modelle laden · ' + done + ' / ' + total;
        })
        .then((bank) => {
          sceneContext.assetBank = bank;
        })
        .catch((error) => {
          console.warn('ROOT Assetpaket konnte nicht geladen werden:', error);
          loading.textContent = 'Standardmodelle · Assetpaket nicht verfügbar';
        })
        .then(() => {
          try {
            if (!sceneContext.explicitDestination) {
              try {
                sceneContext.pendingSession = sceneContext.readRoomSession(
                  sessionStorage,
                  sceneContext.facilityLayout(),
                  sceneContext.centralModel(),
                );
              } catch {}
              if (sceneContext.pendingSession) {
                sceneContext.locationId = sceneContext.pendingSession.id;
                sceneContext.selectedFloor = sceneContext.pendingSession.floor;
                sceneContext.sessionRestored = true;
              }
            }
            sceneContext.buildWorld();
            sceneContext.shell.querySelector('.root-room-empty').hidden = true;
            sceneContext.shell.querySelector('.root-room-badge').textContent =
              sceneContext.assetBank ? 'LIVE / 3D' : 'STANDARDMODELLE';
            sceneContext.shell.querySelector('[data-room-enter]').disabled = false;
            sceneContext.update();
            sizeRenderer();
            sceneContext.applyRoomSession();
            sceneContext.startArrival();
            syncAnimation();
          } catch (error) {
            sceneContext.scene = null;
            sceneContext.renderer?.dispose();
            sceneContext.renderer = null;
            showFallback(error);
          }
        });
    } else if (sceneContext.canvas && sceneContext.canvas.parentElement !== sceneContext.stage)
      sceneContext.stage.appendChild(sceneContext.canvas);
    if (sceneContext.resizeObserver) sceneContext.resizeObserver.observe(sceneContext.stage);
    sceneContext.update();
    sizeRenderer();
    sceneContext.applyRoomSession();
    sceneContext.startArrival();
    syncAnimation();
    return true;
  }

  function showFallback(error) {
    console.warn('ROOT Serverraum konnte WebGL nicht starten:', error);
    sceneContext.fallback.hidden = false;
    sceneContext.fallback.textContent =
      '3D-Ansicht nicht verfügbar. Die Simulation und Rackauswahl funktionieren weiterhin über die Liste.';
    sceneContext.stage.classList.add('root-room-no-webgl');
  }

  function sizeRenderer() {
    if (!sceneContext.renderer || !sceneContext.stage || !sceneContext.camera) return;
    const rect = sceneContext.stage.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    sceneContext.renderer.setSize(rect.width, rect.height, false);
    sceneContext.camera.aspect = rect.width / rect.height;
    sceneContext.camera.updateProjectionMatrix();
  }

  function animate(now) {
    sceneContext.animationFrame = 0;
    if (
      !sceneContext.mounted ||
      sceneContext.hidden ||
      document.hidden ||
      (!sceneContext.inViewport && !sceneContext.exploring && !sceneContext.arrival) ||
      !sceneContext.renderer ||
      !sceneContext.scene
    )
      return;
    const fps =
      sceneContext.exploring || sceneContext.arrival
        ? sceneContext.isReducedMotion
          ? 30
          : 60
        : sceneContext.isReducedMotion
          ? 4
          : 15;
    if (now - sceneContext.lastFrameTime < 1000 / fps - 1) {
      sceneContext.animationFrame = requestAnimationFrame(animate);
      return;
    }
    const delta = Math.min(0.05, (now - (sceneContext.lastFrame || now)) / 1000);
    sceneContext.lastFrame = now;
    sceneContext.lastFrameTime = now;
    const elapsed = now / 1000;
    if (sceneContext.arrival) {
      const frame = sceneContext.arrival.render(sceneContext.renderer, now);
      sceneContext.arrivalOverlay.querySelector('[data-arrival-caption]').textContent =
        sceneContext.tr(frame.caption);
      sceneContext.arrivalOverlay.querySelector('.arrival-progress i').style.width =
        frame.progress * 100 + '%';
      if (frame.done) sceneContext.finishArrival();
      sceneContext.animationFrame = requestAnimationFrame(animate);
      return;
    }
    sceneContext.movePlayer(delta);
    if (now - sceneContext.lastSessionWrite >= 1000) sceneContext.saveRoomSession();
    sceneContext.facilityInterior?.animate(delta, sceneContext.isReducedMotion, {
      x: sceneContext.camera.position.x,
      z: sceneContext.camera.position.z,
    });
    if (sceneContext.assetHall && !sceneContext.isReducedMotion) {
      const heat = Math.max(22, ...sceneContext.currentRacks.map((r) => r.temperature));
      for (const fan of sceneContext.assetHall.coolingFans)
        fan.rotation.z += delta * (6 + Math.max(0, heat - 22) * 0.2);
    }
    if (!sceneContext.isReducedMotion)
      for (const fan of sceneContext.facilityInterior?.fans || []) fan.rotation.z += delta * 9;
    for (const ref of sceneContext.rackRefs.values()) {
      if (ref.asset)
        sceneContext.animateAssetRack(ref, delta, elapsed, sceneContext.isReducedMotion);
      else if (!sceneContext.isReducedMotion)
        ref.fans.forEach((fan, i) => {
          fan.rotation.z += delta * (fan.userData.speed || 0) * (i ? 1 : -1);
        });
    }
    if (!sceneContext.exploring) {
      sceneContext.camera.position.x +=
        (0 - sceneContext.camera.position.x) * Math.min(1, delta * 1.6);
      sceneContext.camera.position.y +=
        ((sceneContext.assetBank ? 2.25 : 3.25) - sceneContext.camera.position.y) *
        Math.min(1, delta * 1.6);
      sceneContext.camera.position.z +=
        ((sceneContext.assetBank ? (sceneContext.locationId === 'hall' ? 3.9 : 3.0) : 5.3) -
          sceneContext.camera.position.z) *
        Math.min(1, delta * 1.6);
      sceneContext.camera.lookAt(
        0,
        1.3,
        sceneContext.assetBank
          ? -0.8
          : -Math.min(8, Math.max(3, (sceneContext.rackGroups.size / 2) * 1.3)),
      );
    } else sceneContext.applyCameraRotation();
    if (sceneContext.targetRack && !sceneContext.isReducedMotion) {
      const ref = sceneContext.rackRefs.get(sceneContext.targetRack);
      if (ref && ref.tempStrip)
        ref.tempStrip.material.emissiveIntensity = 0.6 + Math.sin(elapsed * 1.8) * 0.18;
    }
    if (sceneContext.exploring && now - sceneContext.lastTargetAt >= 100) {
      sceneContext.lastTargetAt = now;
      sceneContext.updateTarget(sceneContext.currentRacks);
    }
    sceneContext.renderer.render(sceneContext.scene, sceneContext.camera);
    // DOM diagnostics let browser QA verify actual renderer work without exposing state controls.
    if (now - (sceneContext.canvas._lastRenderStats || 0) > 1000) {
      sceneContext.canvas._lastRenderStats = now;
      sceneContext.canvas.dataset.drawCalls = sceneContext.renderer.info.render.calls;
      sceneContext.canvas.dataset.triangles = sceneContext.renderer.info.render.triangles;
      sceneContext.canvas.dataset.rackModels = sceneContext.rackGroups.size;
      sceneContext.canvas.dataset.rackBuilds = sceneContext.rackGeneration;
      sceneContext.canvas.dataset.serverModels = sceneContext.serverGroups.size;
      sceneContext.canvas.dataset.roomId = sceneContext.locationId;
      sceneContext.canvas.dataset.floor = sceneContext.selectedFloor;
      sceneContext.canvas.dataset.position = sceneContext.camera.position
        .toArray()
        .map((n) => n.toFixed(2))
        .join(',');
      sceneContext.canvas.dataset.stairs =
        sceneContext.locationId === 'hall'
          ? (sceneContext.facilityInterior?.plan.stairs || []).map((s) => s.direction).join(',')
          : '';
      sceneContext.canvas.dataset.openDoors = [...sceneContext.rackRefs.values()].filter(
        (r) => r.cabinet?.doorOpen,
      ).length;
    }
    sceneContext.animationFrame = requestAnimationFrame(animate);
  }

  function syncAnimation() {
    if (
      !sceneContext.mounted ||
      sceneContext.hidden ||
      document.hidden ||
      (!sceneContext.inViewport && !sceneContext.exploring && !sceneContext.arrival) ||
      !sceneContext.renderer ||
      sceneContext.animationFrame
    )
      return;
    sceneContext.lastFrame = 0;
    sceneContext.lastFrameTime = 0;
    sceneContext.animationFrame = requestAnimationFrame(animate);
  }

  function stopAnimation() {
    if (sceneContext.animationFrame) cancelAnimationFrame(sceneContext.animationFrame);
    sceneContext.animationFrame = 0;
    sceneContext.lastFrame = 0;
  }
  return { mount, showFallback, sizeRenderer, animate, syncAnimation, stopAnimation };
}
