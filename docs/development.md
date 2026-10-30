# Development map

ROOT runs directly from source with Node.js 24. The server has no third-party npm dependencies; Three.js 0.186.1 and glTF assets are bundled for the browser. See [CONTRIBUTING.md](../CONTRIBUTING.md) for an isolated instance and the test command.

| Area | Files | Responsibility |
| --- | --- | --- |
| Simulation | `engine.js` | Time, income/upkeep, contracts, agents, failures, upgrades, save validation/migration |
| Local service | `server.cjs` | Loopback HTTP API, static allowlist, atomic persistence, backup and optimistic revisions |
| Web interface | `app.js`, `rack-ui.js`, CSS | Navigation, hardware actions, feedback and confirmations |
| Localization | `i18n.js` | German/English interface text while preserving custom names |
| 3D world | `room.js`, `room-facility.js`, `room-arrival.js` | Active-room scene, navigation, input, doors and arrival |
| Scene details | Other `room-*.js` modules | Loading/batching, surfaces, furniture, stations and throttled live instruments |
| Models | `asset-pack/`, `tools/asset-generator/` | Runtime files, editable sources, generators and component provenance |

Simulation state is shared by the web UI and 3D controls. Route operations through the same quotes, confirmation and engine actions; do not create a second economy inside scene callbacks. Browser view state is separate from save exports. The server's optimistic revision check prevents stale tabs overwriting newer writes.

Only the active room is rendered. Preserve static batching and bounded live-display updates; avoid rebuilding the scene or large DOM sections on each tick. Test loss of focus and pointer lock as well as ordinary mouse dragging.

## Verification scope

The publication baseline includes engine/save migration, API persistence and conflict checks, room layout/input tests, localization checks, asset bounds and deterministic original-furniture regeneration. Run `npm test` in your checkout for the current result. `node tools/audit-assets.mjs` separately examines loaded model geometry and texture references; `node tools/inventory-assets.mjs` writes the current hash inventory.

Manual browser checks are still needed for visual artifacts, legibility, interaction from both sides of a door and fullscreen modal layering. Test data is synthetic. Accepting the maximum save size does not prove an acceptable rendering or simulation frame rate at that size.

## Release branches and saves

The published `main` branch contains the checked baseline. Keep unfinished features on separate branches, and tag only reviewed snapshots. Local development history and personal save backups are not part of this clean publication history.

Export progress before changing versions, and use separate folders/ports/data directories when comparing them. Old single-room releases cannot represent every expanded-fleet save. Schema changes must preserve the explicit import/migration route and the stale-client capability guard.
