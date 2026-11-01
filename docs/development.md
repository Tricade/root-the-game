# Development map

ROOT runs directly from source with Node.js 24. The server has no third-party npm dependencies; Three.js 0.186.1 and glTF assets are bundled for the browser. See [CONTRIBUTING.md](../CONTRIBUTING.md) for an isolated instance and the test command.

| Area                   | Files                                                                | Responsibility                                                                                       |
| ---------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Simulation composition | `engine.js`                                                          | Compose per-instance domains and preserve the browser/CommonJS public API                            |
| Simulation domains     | `engine/`                                                            | Building ownership, economy, hardware, agents, contracts, recovery, simulation and save migration    |
| Local service          | `server.cjs`, `server/static-files.cjs`                              | Loopback HTTP API, closed static allowlist, atomic persistence, backup and optimistic revisions      |
| Web composition        | `app.js`, `rack-ui.js`                                               | State ownership, navigation and composition of interface factories                                   |
| Web features           | `ui/`, `ui/racks/`, CSS                                              | Facility plan, hardware selection, confirmations, live updates, persistence and feedback             |
| Desktop                | `desktop/`, `ui/desktop.js`, `tools/desktop/`, package config        | Isolated Electron shell, profiles, confirmed save handoff, updater and native release verification   |
| Localization           | `i18n.js`, `locales/`                                                | DOM localization lifecycle and separate English catalogs, preserving custom names                    |
| 3D composition         | `room.js`                                                            | Per-view resources, shared context and public controls                                               |
| 3D features            | `room/`, `room-navigation.js`, `room-facility.js`, `room-arrival.js` | Input, rendering, rack/server geometry, owned-space navigation, sessions, room interiors and arrival |
| Scene details          | Other `room-*.js` modules                                            | Loading/batching, surfaces, furniture, stations and throttled live instruments                       |
| Models                 | `asset-pack/`, `tools/asset-generator/`                              | Runtime files, editable sources, generators and component provenance                                 |

Simulation state is shared by the web UI and 3D controls. Route operations through the same quotes, confirmation and engine actions; do not create a second economy inside scene callbacks. Browser view state is separate from save exports. The server's optimistic revision check prevents stale tabs overwriting newer writes.

Domain factories receive a context containing functions and constants. They do not own a global save. The engine's public calls receive the save explicitly; UI controller accessors resolve the current save after import/reset. Browser engine scripts load in the order declared by `index.html`; a parity test executes that order and compares it with the CommonJS engine. UI and scene features use native ES modules. Do not add `type: module` at the project root: `engine.js` deliberately supports CommonJS consumers.

Paid construction lives in `engine/building.js`; its quotes and actions are shared by the site plan and physical terminals. `ui/facility.js` owns the web plan. `room-navigation.js` contains pure location, corridor and stair calculations. `room/telemetry.js` shares one synchronous model snapshot across navigation, instruments and rebuilds, then releases it in `finally` so in-place actions cannot read stale values. See [construction](construction.md) for ownership and migration rules.

Only the active room is rendered. Preserve static batching and bounded live-display updates; avoid rebuilding the scene or large DOM sections on each tick. Test loss of focus and pointer lock as well as ordinary mouse dragging.

## Verification scope

Run `npm ci --ignore-scripts` once for pinned development tools, then `npm run check`. This runs lint, formatting checks and the Node tests. Tests include construction cost/payment/completion, empty-room selection, migration, offline completion notices, API stale-client protection, engine parity, scene input/navigation, localization, bounded DOM updates, asset geometry and deterministic original-furniture regeneration. `node tools/audit-assets.mjs` separately examines loaded model geometry and texture references; `node tools/inventory-assets.mjs` writes the current hash inventory. Supplied/vendored assets and hash-tracked generator inputs are excluded from automatic formatting.

Manual browser checks are still needed for visual artifacts, legibility, interaction from both sides of a door and fullscreen modal layering. Test data is synthetic. Accepting the maximum save size does not prove an acceptable rendering or simulation frame rate at that size.

## Release branches and saves

The published `main` branch contains the checked baseline. Keep unfinished features on separate branches, and tag only reviewed snapshots. Local development history and personal save backups are not part of this clean publication history.

Export progress before changing versions, and use separate folders/ports/data directories when comparing them. Old single-room releases cannot represent every expanded-fleet save. Schema changes must preserve the explicit import/migration route and the stale-client capability guard.

## Service economy and worker boundary

Schema 4 adds resource-backed customers (`service-catalog`, `service-resources`, `service-metrics`, `services`), explicit supply routing (`room-supply`, `dependencies`), bounded plans and deliveries (`operations`, `operation-plans`), and long assignments (`projects`). Each has validation at the save boundary. User controls live in `ui/business.js` and `ui/operations.js`; both also run inside the 3D console. See [rules and reproducible balance checks](service-economy.md).

`engine.js` owns the ordered module manifest for Node, the browser and the classic dedicated worker. `advance-worker.js` uses `importScripts`; it is not a module worker. `ui/offline.js` retains the source state until a complete worker result passes state-identity and save-conflict guards. Worker startup failures fall back once to yielding main-thread chunks. An import waits for pending catch-up rather than mutating it in place.

Runtime facts checked before implementation: Node **24.22.1**, Electron **45.2.1**, Chromium **156.0.8078.75**, vendored Three.js **0.186.1**. No package or protocol permissions changed. Compatibility references are the [HTML dedicated-worker/importScripts specification](https://html.spec.whatwg.org/multipage/workers.html) (reviewed 2026-11-01), [Node 24.22.1 worker_threads source documentation](https://github.com/nodejs/node/blob/v24.22.1/doc/api/worker_threads.md) and [Electron 45.2.1 protocol documentation](https://github.com/electron/electron/blob/v45.2.1/docs/api/protocol.md). The existing standard, secure `root://app` protocol supports the classic worker in the same configured session.

The Node worker test proves script ordering, serialization and deterministic results. Separately, `desktop/catchup-smoke.cjs` runs an actual Chromium worker under `root://app`, compares a full simulated hour to the direct engine result, and verifies renderer timer heartbeats continue during computation. The exercised Windows runtime passed; this does not claim Linux execution or long-run performance at the maximum save size.
