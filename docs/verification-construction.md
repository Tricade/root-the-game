# Construction integration verification

Checked on Windows with Node 24.22.1 on 2026-10-30. This records local evidence; no hosted CI run is claimed.

- `npm ci --ignore-scripts` completed from the pinned lockfile in a fresh clone. The install reported zero known vulnerabilities at that time.
- `npm run check` passed: ESLint, Prettier and **181 Node tests**, with zero failures, skips or cancellations. The source checkout, fresh clone and deployed checkout were checked. The test suite uses temporary data directories and synthetic fixtures.
- Asset geometry audit examined all **36 GLBs**: zero nonfinite coordinates, degenerate triangles, duplicate triangles or missing referenced textures. Runtime asset and vendored renderer bytes were retained during this integration.

## Browser checks

The isolated construction instance exercised the real interface and local API:

| Scenario                     | Observed result                                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| New installation             | One server room/floor; later rooms and utilities require paid construction and unlocks                                |
| Start a server room          | Full 20-million price and 30-minute duration visible before confirmation; one active project; no second build allowed |
| Reload during construction   | Paid project, target and remaining time retained                                                                      |
| Finish a basement            | Two floors; the new floor has a corridor and stairs but no free server room                                           |
| Empty owned server room      | Hardware view keeps that room selected; the first-rack action targets it                                              |
| Buy one rack in the new room | One physical rack and zero servers in that room; no duplicated cabinet                                                |
| Existing six-rack room       | Six physical racks and all twenty installed servers                                                                   |
| Rack interaction             | E opens the door first; exposed hardware opens its shared management interface                                        |
| 3D power upgrade             | Confirmation and cost visible above the fullscreen console; closing returns to the existing view                      |
| F5 in first person           | Same room and player position restored                                                                                |
| Installed service rooms      | Control-room monitors and installed cooling equipment render; live instruments read shared engine data                |
| English feedback             | Construction quotes/reasons, room selection and achievement notifications translated; custom identifiers preserved    |
| Simultaneous feedback        | Completion and achievement messages can coexist instead of replacing one another                                      |
| Multiple tabs / old client   | Existing-tab lock prevents a second active session; pre-construction clients receive an update-required response      |

The deployed service was also loaded in the existing preview tab, with no new console errors. Before replacement, saves and Git history were backed up outside the publication tree. Migration preserved existing hardware, credits, research, reputation and elapsed time; subsequent simulation proceeds normally.

## Limits

Geometry audits do not establish absence of every visual artifact on every GPU. Browser checks cover the exercised views and interactions, not every possible camera angle. Maximum-fleet save validation does not establish usable real-time performance at that fleet size. The economy study and its incident-free assumptions are documented in [construction.md](construction.md); long-term tuning remains open to contributions. Linux hosted CI and public GitHub publication have not been executed by this local verification.
