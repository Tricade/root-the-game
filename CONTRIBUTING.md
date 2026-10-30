# Contributing to ROOT

Bug reports, balancing ideas, translations, accessibility improvements, original assets and code contributions are welcome. Use the Issues and Pull Requests tabs on the repository's current host; the workflow works on Gitea and GitHub.

## Start a development instance

Use Node.js 24 (verified with 24.22.1). No `npm install` or compilation is required.

```sh
git switch main
git pull --ff-only
git switch -c fix/describe-the-change
npm test
```

Keep development saves separate from a real installation. In PowerShell:

```powershell
$env:ROOT_PORT = '18490'
$env:ROOT_DATA_DIR = Join-Path $PWD '.local-data/dev'
node server.cjs
```

On Linux/macOS:

```sh
ROOT_PORT=18490 ROOT_DATA_DIR="$PWD/.local-data/dev" node server.cjs
```

Open `http://127.0.0.1:18490/`. Test servers use temporary data directories. Never point a test at your normal save or share a writable data directory between servers.

## Before a pull request

1. Keep one topic per branch: `feat/...`, `fix/...`, `docs/...` or `assets/...`.
2. Explain the problem and resulting behavior. Record the checks you actually ran and any remaining limits.
3. Run `npm test`. Add focused regression coverage for behavior changes; do not replace runtime checks with string matching alone.
4. Exercise affected controls in both the web UI and 3D terminals. Check German and English, reload recovery and an older synthetic save when persistence changes.
5. Update the relevant documentation. Use synthetic examples and screenshots, with no personal saves, machine paths or credentials.
6. Open a pull request against `main`. Maintainers review before merging; a branch or suggested change is not a release.

Offline progression, crisis decisions, save conflict handling, repair availability and the original mouse-drag movement path must remain usable. Preserve old save compatibility explicitly; do not discard unknown or invalid data silently to make a test pass. Avoid rebuilding the scene or replacing DOM sections on every simulation tick.

## Assets and translations

See the [asset tool](tools/asset-generator/README.md) for source files, isolated builds and asset acceptance checks. Contribute original geometry and retain editable sources. Do not add downloaded furniture or other third-party models. Material textures need a redistribution-compatible license and a recorded source. Preserve all existing notices; do not label a supplied provenance statement as independently verified.

The interface uses `i18n.js`. Preserve user-entered names and values, placeholders, units and keyboard hints. Check long English/German text in both a dialog and a 3D terminal.

## Reporting a problem

Include the release/commit, browser and OS versions, reproduction steps and expected/actual behavior. For rendering issues, give the room, viewing direction and a synthetic screenshot. For economy changes, state fleet size, elapsed simulation time, income, upkeep and relevant upgrades. Share only the smallest synthetic fixture needed to reproduce a bug.

If AI tools helped, say what they did and how you checked the result. Contributors remain responsible for correctness and asset provenance; see [AI-DISCLOSURE.md](AI-DISCLOSURE.md).

## License

Code contributions use the project's [MIT license](LICENSE). Original asset submissions must state their license and source; ROOT's own generated models/maps use CC0-1.0 as described in [NOTICE.md](NOTICE.md). Contribute only material you are authorized to redistribute.
