# ROOT / Cyberbunker

**Build and operate an underground data center, through a modern web console or from inside its walkable 3D rooms.**

ROOT is a local, persistent infrastructure simulation designed for occasional check-ins. Racks, agents, GPU workloads, cooling, power, backups and failures all share the same operating state. The interface is available in **English and German**.

![ROOT control room with live wall displays and original workstations](screenshots/control-room.jpg)

*Actual application capture with synthetic demonstration data.*

> **AI transparency:** Development, documentation and procedural assets received substantial generative-AI assistance. No AI provider is contacted while running ROOT. Read the [AI disclosure](AI-DISCLOSURE.md) for scope and verification limits.

## Start locally

Install **Node.js 24** (verified with **24.22.1**), clone or download this repository, then run from its directory:

```sh
node server.cjs
```

Open **[127.0.0.1:18473](http://127.0.0.1:18473/)**. On Windows, you can also double-click **ROOT starten.cmd** after making Node available on `PATH`. No `npm install`, compilation or internet connection is needed to run ROOT. Three.js and the runtime assets are bundled.

The server binds to loopback and stores progress locally. `ROOT_PORT` and `ROOT_DATA_DIR` select an independent instance. Use a different data directory for each server.

## Inside the bunker

- **One network, two interfaces.** Use the web UI or operate terminals, racks and wall displays in the 3D facility. Installed hardware and faults are reflected in the room.
- **Hardware with tradeoffs.** CPU, storage, edge and AI/GPU servers consume rack space, power and cooling. Connections, switches and upgrades affect usable capacity.
- **Consequences and recovery.** Defects, maintenance, outages and incidents can interrupt work. Repairs, backups, agent assignments and automation help protect the network. Major incidents wait for your decision.
- **An expanding underground facility.** Six racks fit in a server room; four server rooms form a floor. Corridors connect rooms, and stairs connect existing adjacent floors. Central cooling, UPS and power distribution unlock in sectors 4, 6 and 8.
- **A control room with live instruments.** Monitor operations, building systems and protection on interactive wall displays, with furnished workstations and a lounge.
- **Persistent progress.** Up to 12 hours of offline progress is simulated. Automatic saves, a previous-write backup and JSON export/import provide recovery paths.

This is an evolving **1.4 preview**. In this published baseline, new server rooms and floors are allocated automatically as racks are added. Separately purchased construction and a revised economy are under development; they are not included in this baseline. Economy tuning and 3D presentation remain active areas for contributions.

Progression extends beyond six racks. Validation currently accepts up to **10,000 racks**, **10,000 servers** and **1,000,000 sectors**, with five central-utility levels. These are implementation limits. Only the selected room is rendered; maximum-size save validation does not establish real-time performance at that size.

## Controls

| Control | Action |
| --- | --- |
| WASD | Move |
| Mouse drag / left and right arrows | Look around |
| E on a closed rack | Open its door |
| E on exposed hardware | Open hardware controls |
| E on a door or terminal | Operate the target |
| Escape | Close the active dialog/console, then leave walking mode |
| Room / floor selectors | Navigate without walking |

Room doors work from either side and close after passage once the swing area is clear. If pointer lock is unavailable, mouse drag remains usable. Reloading restores the selected room/floor and the saved walking position within that browser tab, with a safe entrance as fallback.

The skippable arrival sequence runs on the first eligible entry per tab. Settings lets you disable or replay it. Reduced-motion preference disables automatic arrival, and restoring an existing view takes priority.

## Saves and privacy

`data/save.json` holds the current state; `data/save.backup.json` retains the previous valid write. Export a JSON copy through Settings before trying another version. Imports accept supported v1–v3 saves, up to 16 MiB. An older release may not understand newer fleet sizes or facility fields.

Conflicting browser sessions cannot silently overwrite each other: a stale session pauses saving and simulation until the newer state is reloaded. Its local copy remains exportable. Do not run multiple servers against the same data directory.

ROOT has no telemetry, analytics, accounts, online AI calls or runtime downloads. Simulation data stays on the local machine. Following the optional Ko-fi link opens an external website. Saves, logs, `.env` files and build scratch directories are excluded from Git; keep personal exports out of issues and pull requests. The server has no internet-facing authentication layer; see [SECURITY.md](SECURITY.md).

## Build with us

```sh
npm test
```

Runtime source is plain JavaScript, HTML and CSS, with vendored **Three.js 0.186.1**. There is no application build step. Start with the [contributor guide](CONTRIBUTING.md), [architecture](docs/development.md) and [runtime notes](docs/runtime-1.4.md).

Useful contributions include balancing, incident and agent behavior, readable 3D instruments, accessibility, translations and original procedural assets. Create a focused `feat/...`, `fix/...`, `docs/...` or `assets/...` branch and open a pull request against `main`. Record actual checks and use synthetic data.

### Asset tool included

The repository includes editable glTF sources and local generators for the supplied base assets, facility equipment and original control-room furniture. Optional Python dependencies are needed only for the base/facility generators; normal use and the furniture generator need Node alone.

```sh
node tools/asset-generator/generate.mjs --help
node tools/asset-generator/generate.mjs interiors
```

Builds go into a fresh `.asset-build/` directory. The [asset-tool guide](tools/asset-generator/README.md) covers Python setup, outputs, provenance and how to add models without replacing the checked runtime pack. No downloaded furniture or model meshes are required.

## Support

If you enjoy ROOT and want to support its development: **[Support Tricade on Ko-fi](https://ko-fi.com/tricade)**. Contributions and useful bug reports are welcome too.

## Licensing and attribution

Project code is [MIT licensed](LICENSE). Original generated models/maps are provided under CC0-1.0; supplied assets, allowed material textures and vendored Three.js have component-specific notices in [NOTICE.md](NOTICE.md). The [current inventory](asset-pack/docs/runtime_inventory.json) records bundled files and hashes. Supplied ownership statements are preserved with their scope clearly identified.

## Deutsch

**ROOT starten.cmd** oder `node server.cjs` startet die lokale Leitstelle. Unter **Einstellungen → Sprache / Language** kannst du Deutsch oder Englisch wählen. Betrieb, Wartung und Ausbau sind über die Weboberfläche und die Terminals im Cyberbunker erreichbar. Fortschritt und Sicherungen bleiben lokal in `data/`.

Diese Vorschau legt weitere Räume und Etagen noch mit den Rackkäufen an. Kostenpflichtiger unterirdischer Bau und neues Balancing werden separat entwickelt. Zum Mitbauen: einen eigenen Themenbranch erstellen, `npm test` ausführen und einen Pull Request gegen `main` öffnen. Die Asset-Generatoren und bearbeitbaren Quelldateien sind enthalten.
