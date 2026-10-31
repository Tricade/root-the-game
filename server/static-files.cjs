'use strict';
const fs = require('node:fs');
const path = require('node:path');

// A closed allowlist keeps local saves and build sources outside the HTTP surface.
function createStaticFiles(root) {
  const FILES = new Map([
    ['/', ['index.html', 'text/html; charset=utf-8']],
    ['/index.html', ['index.html', 'text/html; charset=utf-8']],
    ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
    ['/racks.css', ['racks.css', 'text/css; charset=utf-8']],
    ['/ui/chrome.js', ['ui/chrome.js', 'text/javascript; charset=utf-8']],
    ['/ui/overview.js', ['ui/overview.js', 'text/javascript; charset=utf-8']],
    ['/ui/workforce.js', ['ui/workforce.js', 'text/javascript; charset=utf-8']],
    ['/ui/workloads.js', ['ui/workloads.js', 'text/javascript; charset=utf-8']],
    ['/ui/protection.js', ['ui/protection.js', 'text/javascript; charset=utf-8']],
    ['/ui/dialogs.js', ['ui/dialogs.js', 'text/javascript; charset=utf-8']],
    ['/ui/telemetry.js', ['ui/telemetry.js', 'text/javascript; charset=utf-8']],
    ['/ui/persistence.js', ['ui/persistence.js', 'text/javascript; charset=utf-8']],
    ['/ui/notifications.js', ['ui/notifications.js', 'text/javascript; charset=utf-8']],
    ['/ui/facility.js', ['ui/facility.js', 'text/javascript; charset=utf-8']],
    ['/ui/events.js', ['ui/events.js', 'text/javascript; charset=utf-8']],
    ['/ui/foundation.js', ['ui/foundation.js', 'text/javascript; charset=utf-8']],
    ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
    ['/locales/building-en.js', ['locales/building-en.js', 'text/javascript; charset=utf-8']],
    ['/locales/en.js', ['locales/en.js', 'text/javascript; charset=utf-8']],
    ['/i18n.js', ['i18n.js', 'text/javascript; charset=utf-8']],
    ['/ui/racks/faces.js', ['ui/racks/faces.js', 'text/javascript; charset=utf-8']],
    ['/ui/racks/wiring.js', ['ui/racks/wiring.js', 'text/javascript; charset=utf-8']],
    ['/ui/racks/inspector.js', ['ui/racks/inspector.js', 'text/javascript; charset=utf-8']],
    ['/ui/racks/view.js', ['ui/racks/view.js', 'text/javascript; charset=utf-8']],
    ['/ui/racks/telemetry.js', ['ui/racks/telemetry.js', 'text/javascript; charset=utf-8']],
    ['/rack-ui.js', ['rack-ui.js', 'text/javascript; charset=utf-8']],
    ['/room/materials.js', ['room/materials.js', 'text/javascript; charset=utf-8']],
    ['/room/primitives.js', ['room/primitives.js', 'text/javascript; charset=utf-8']],
    ['/room/world.js', ['room/world.js', 'text/javascript; charset=utf-8']],
    ['/room/racks.js', ['room/racks.js', 'text/javascript; charset=utf-8']],
    ['/room/servers.js', ['room/servers.js', 'text/javascript; charset=utf-8']],
    ['/room/location.js', ['room/location.js', 'text/javascript; charset=utf-8']],
    ['/room/telemetry.js', ['room/telemetry.js', 'text/javascript; charset=utf-8']],
    ['/room/input.js', ['room/input.js', 'text/javascript; charset=utf-8']],
    ['/room/exploration.js', ['room/exploration.js', 'text/javascript; charset=utf-8']],
    ['/room/renderer.js', ['room/renderer.js', 'text/javascript; charset=utf-8']],
    ['/room-navigation.js', ['room-navigation.js', 'text/javascript; charset=utf-8']],
    ['/room/status.js', ['room/status.js', 'text/javascript; charset=utf-8']],
    ['/room.js', ['room.js', 'text/javascript; charset=utf-8']],
    ['/room-stations.js', ['room-stations.js', 'text/javascript; charset=utf-8']],
    ['/room-lounge.js', ['room-lounge.js', 'text/javascript; charset=utf-8']],
    ['/room-assets.js', ['room-assets.js', 'text/javascript; charset=utf-8']],
    ['/room-facility.js', ['room-facility.js', 'text/javascript; charset=utf-8']],
    ['/room-instruments.js', ['room-instruments.js', 'text/javascript; charset=utf-8']],
    ['/room-arrival.js', ['room-arrival.js', 'text/javascript; charset=utf-8']],
    ['/room-surfaces.js', ['room-surfaces.js', 'text/javascript; charset=utf-8']],
    ['/room.css', ['room.css', 'text/css; charset=utf-8']],
    ['/facility.css', ['facility.css', 'text/css; charset=utf-8']],
    ['/building.css', ['building.css', 'text/css; charset=utf-8']],
    ['/desktop.css', ['desktop.css', 'text/css; charset=utf-8']],
    ['/ui/desktop.js', ['ui/desktop.js', 'text/javascript; charset=utf-8']],
    ['/vendor/three.module.js', ['vendor/three.module.js', 'text/javascript; charset=utf-8']],
    ['/vendor/three.core.js', ['vendor/three.core.js', 'text/javascript; charset=utf-8']],
    ['/vendor/RoomEnvironment.js', ['vendor/RoomEnvironment.js', 'text/javascript; charset=utf-8']],
    [
      '/vendor/RoundedBoxGeometry.js',
      ['vendor/RoundedBoxGeometry.js', 'text/javascript; charset=utf-8'],
    ],
    ['/vendor/GLTFLoader.js', ['vendor/GLTFLoader.js', 'text/javascript; charset=utf-8']],
    [
      '/vendor/BufferGeometryUtils.js',
      ['vendor/BufferGeometryUtils.js', 'text/javascript; charset=utf-8'],
    ],
    ['/vendor/SkeletonUtils.js', ['vendor/SkeletonUtils.js', 'text/javascript; charset=utf-8']],
    ['/engine/definitions.js', ['engine/definitions.js', 'text/javascript; charset=utf-8']],
    ['/engine/state.js', ['engine/state.js', 'text/javascript; charset=utf-8']],
    ['/engine/economy.js', ['engine/economy.js', 'text/javascript; charset=utf-8']],
    ['/engine/building.js', ['engine/building.js', 'text/javascript; charset=utf-8']],
    ['/engine/central.js', ['engine/central.js', 'text/javascript; charset=utf-8']],
    ['/engine/hardware.js', ['engine/hardware.js', 'text/javascript; charset=utf-8']],
    ['/engine/gpu.js', ['engine/gpu.js', 'text/javascript; charset=utf-8']],
    ['/engine/metrics.js', ['engine/metrics.js', 'text/javascript; charset=utf-8']],
    ['/engine/hardware-quotes.js', ['engine/hardware-quotes.js', 'text/javascript; charset=utf-8']],
    ['/engine/racks.js', ['engine/racks.js', 'text/javascript; charset=utf-8']],
    ['/engine/recovery-quotes.js', ['engine/recovery-quotes.js', 'text/javascript; charset=utf-8']],
    ['/engine/resilience.js', ['engine/resilience.js', 'text/javascript; charset=utf-8']],
    ['/engine/agents.js', ['engine/agents.js', 'text/javascript; charset=utf-8']],
    ['/engine/contracts.js', ['engine/contracts.js', 'text/javascript; charset=utf-8']],
    ['/engine/incidents.js', ['engine/incidents.js', 'text/javascript; charset=utf-8']],
    ['/engine/maintenance.js', ['engine/maintenance.js', 'text/javascript; charset=utf-8']],
    ['/engine/simulation.js', ['engine/simulation.js', 'text/javascript; charset=utf-8']],
    [
      '/engine/actions-infrastructure.js',
      ['engine/actions-infrastructure.js', 'text/javascript; charset=utf-8'],
    ],
    [
      '/engine/actions-workforce.js',
      ['engine/actions-workforce.js', 'text/javascript; charset=utf-8'],
    ],
    [
      '/engine/actions-progression.js',
      ['engine/actions-progression.js', 'text/javascript; charset=utf-8'],
    ],
    [
      '/engine/actions-recovery.js',
      ['engine/actions-recovery.js', 'text/javascript; charset=utf-8'],
    ],
    ['/engine/actions.js', ['engine/actions.js', 'text/javascript; charset=utf-8']],
    ['/engine/save-legacy.js', ['engine/save-legacy.js', 'text/javascript; charset=utf-8']],
    ['/engine/save-v2.js', ['engine/save-v2.js', 'text/javascript; charset=utf-8']],
    ['/engine/save-v3.js', ['engine/save-v3.js', 'text/javascript; charset=utf-8']],
    ['/engine/saves.js', ['engine/saves.js', 'text/javascript; charset=utf-8']],
    ['/engine.js', ['engine.js', 'text/javascript; charset=utf-8']],
    ['/favicon.svg', ['favicon.svg', 'image/svg+xml']],
  ]);

  // Only bundled model/image files are public. Saves, source, scripts and licences stay private.
  function registerAssetFiles(relative) {
    const folder = path.join(root, relative);
    if (!fs.existsSync(folder)) return;
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const name = relative + '/' + entry.name;
      if (entry.isDirectory()) registerAssetFiles(name);
      else if (entry.isFile() && /\.(glb|png|jpg)$/.test(entry.name)) {
        const type = entry.name.endsWith('.glb')
          ? 'model/gltf-binary'
          : entry.name.endsWith('.png')
            ? 'image/png'
            : 'image/jpeg';
        FILES.set('/' + name, [name, type]);
      }
    }
  }
  registerAssetFiles('asset-pack/assets');
  registerAssetFiles('asset-pack/textures');

  return FILES;
}
module.exports = { createStaticFiles };
