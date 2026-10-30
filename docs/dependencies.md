# Runtime and tooling versions

The application uses Node.js built-ins and vendored browser modules. No `npm install` is needed to run it or execute the Node tests.

| Component | Checked version | Scope |
| --- | --- | --- |
| Node.js | 24.22.1 | Server, Node tests and furniture generator |
| Three.js | 0.186.1 | Local browser rendering and geometry tools |
| CPython | 3.12.14 | Optional base/facility generation |
| NumPy | 2.5.4 | Optional procedural geometry/textures |
| Pillow | 13.0.0 | Optional base texture generation |

## Three.js source

The vendored files are from the official npm package [three-0.186.1.tgz](https://registry.npmjs.org/three/-/three-0.186.1.tgz), source revision [`9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8`](https://github.com/mrdoob/three.js/tree/9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8).

Package integrity:

```text
sha512-blFeqb49wRCSGUGj7gtpfnSGHy2lwDk94RhUmS1c/hTby70kvChbWpkJ4Pm1390LqzzvTmzgXKHPEafJwCb8jA==
```

Core builds are unchanged. Example-module imports are redirected to the same local core. `vendor/LICENSE` retains the Three.js MIT notice. The renderer requires WebGL 2; a device that cannot create the renderer can still use the web hardware interface.

## Generator compatibility

The asset wrapper uses the argument-array subprocess API documented in the [exact Node 24.22.1 source](https://github.com/nodejs/node/blob/v24.22.1/doc/api/child_process.md), with `shell: false`. The [Pillow 13.0.0 release notes](https://github.com/python-pillow/Pillow/blob/13.0.0/docs/releasenotes/13.0.0.rst) remove `Image.fromarray` mode use when it changes data type; the base generator supplies uint8 RGB/L arrays without such a type change. All three generator targets were exercised in the checked environment. See the [asset guide](../tools/asset-generator/README.md) for isolated commands and scope.

## GitHub checks

The optional GitHub workflow pins `actions/checkout`, `actions/setup-node` and `actions/setup-python` to complete v6 commit IDs. Their `action.yml` files declare Node 24 action runtimes. The workflow requests read-only repository access and checks application tests on Windows/Linux plus Python generation on Linux. A compatible hosted runner is required; adding the workflow does not assert that a remote CI run has completed. No Gitea runner is configured by this repository.
