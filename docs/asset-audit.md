# Asset verification scope

The runtime pack contains 36 GLBs: 27 supplied base models, five procedural facility models and four original ROOT furniture/plant models. The current inventory also records 30 local material textures and SHA-256 file hashes. See [NOTICE.md](../NOTICE.md) for component-specific provenance.

`node tools/audit-assets.mjs` parses GLBs with the vendored Three.js loader, checks active LOD0 geometry for nonfinite, zero-area and duplicate triangles, measures bounds and checks referenced texture files. Its Node loader substitutes texture objects; this is a geometry/file check, not a rendered-image test. Coplanar candidates can include buried material joins and need visual inspection.

The furniture generator reproduces all four committed original models and its procedural maps byte for byte in the checked Node environment. The facility generator also reproduces the maintained five models in the checked Python environment. The supplied base generator completes independently into a fresh directory; it is a historical source and is not a byte-for-byte replacement for the maintained runtime pack.

Corrections in the maintained baseline separate overlapping door/frame, stair/header, vent and cabinet surfaces. Rack E interaction opens the door before exposing hardware controls; room doors can be operated from either side and close after passage. Entrance terminals and live instruments share web UI operations. App confirmations render above fullscreen 3D consoles.

Manual scene checks remain necessary after model, material, placement or renderer changes. Inspect both sides and multiple distances, open doors, terminal access, signs and moving-camera flicker. Passing geometry checks does not establish that every GPU, camera angle or maximum-size fleet renders correctly.
