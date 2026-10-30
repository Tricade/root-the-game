#!/usr/bin/env python3
"""
ROOT 3D Asset Package — Master Build Pipeline
Generates:
  1. All 2K PBR Texture Maps & Atlases in `textures/`
  2. All 23 Standalone Modular GLB Assets in `assets/{racks,servers,network_power,architecture,stations}/`
  3. Complete Example Scene in `scenes/root_datacenter_scene.glb`
  4. Editable glTF 2.0 Source Files (`.gltf` + `.bin`) in `source/gltf/`
  5. Detailed Asset Manifest (`docs/asset_manifest.json`) with dimensions, triangle/polygon counts,
     materials, animatable parts/pivots, and dynamic cable attachment points.
"""

import os
import json
from generate_textures import (
    generate_hardware_atlas,
    generate_perforated_door_mesh,
    generate_architecture_atlas,
    generate_floor_concrete_2k,
    generate_dynamic_label_atlas,
    generate_screen_ui_atlas,
)
from build_racks_and_servers import build_all_racks_and_servers
from build_network_and_power import build_all_network_and_power
from build_architecture_and_stations import build_all_architecture_and_stations
from build_example_scene import export_example_scene


def inspect_doc_stats(name, doc, info):
    """Extracts exact polygon/triangle counts per LOD, materials, movable nodes, and attachment points."""
    lod0_tris = 0
    lod1_tris = 0
    col_tris = 0
    total_tris = 0
    total_verts = 0
    materials_used = set()

    # Map mesh index to LOD / collider role by walking nodes
    mesh_role = {}

    def walk_role(node_idx, inherited_role="LOD0"):
        node = doc.nodes[node_idx]
        n_name = node["name"]
        role = inherited_role
        if n_name == "LOD0":
            role = "LOD0"
        elif n_name == "LOD1":
            role = "LOD1"
        elif n_name.startswith("collider_"):
            role = "collider"
        if "mesh" in node:
            mesh_role[node["mesh"]] = role
        for ch in node.get("children", []):
            walk_role(ch, role)

    for r_idx in doc.root_node_indices:
        walk_role(r_idx)

    for m_idx, mb in enumerate(doc.meshes):
        tris = mb.triangle_count()
        verts = mb.vertex_count()
        total_tris += tris
        total_verts += verts
        role = mesh_role.get(m_idx, "LOD0")
        if role == "LOD0":
            lod0_tris += tris
        elif role == "LOD1":
            lod1_tris += tris
        elif role == "collider":
            col_tris += tris
        for mat_name in mb.primitives.keys():
            materials_used.add(mat_name)

    movable_parts = []
    attachment_points = []
    dynamic_surfaces = []
    controllable_leds = []

    for node in doc.nodes:
        ex = node.get("extras", {})
        n_name = node["name"]
        pos = node.get("translation", [0.0, 0.0, 0.0])
        if ex.get("animatable") or ex.get("removable") or ex.get("movable"):
            movable_parts.append({
                "name": n_name,
                "pivotPosition": pos,
                "pivotType": ex.get("pivotType", "removable" if ex.get("removable") else "translate"),
                "spinAxis": ex.get("spinAxis"),
            })
        if ex.get("isAttachmentPoint"):
            attachment_points.append({
                "name": n_name,
                "position": pos,
                "normal": ex.get("normal", [0.0, 0.0, 1.0]),
                "connectorType": ex.get("connectorType", "generic"),
            })
        if ex.get("dynamicSurface"):
            dynamic_surfaces.append({
                "name": n_name,
                "surfaceId": ex.get("dynamicSurface"),
                "uvSpace": ex.get("uvSpace", "atlas"),
            })
        if ex.get("controllableLed"):
            controllable_leds.append(n_name)

    return {
        "name": name,
        "glbPath": os.path.relpath(info["path"], os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))).replace("\\", "/"),
        "sizeKB": info["size_kb"],
        "dimensionsM": doc.metadata.get("dimensionsM", []),
        "unitsU": doc.metadata.get("unitsU"),
        "triangles": {
            "LOD0": lod0_tris,
            "LOD1": lod1_tris,
            "collider": col_tris,
            "total": total_tris,
        },
        "verticesTotal": total_verts,
        "materials": sorted(list(materials_used)),
        "movableParts": movable_parts,
        "attachmentPoints": attachment_points,
        "dynamicSurfaces": dynamic_surfaces,
        "controllableLeds": controllable_leds,
    }


def main():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    print("=== STEP 1: Building 2K PBR Textures & Atlases ===")
    # Only regenerate if missing so re-runs are fast
    tex_dir = os.path.join(base_dir, "textures")
    if not os.path.exists(os.path.join(tex_dir, "root_floor_concrete_basecolor_2k.png")):
        generate_hardware_atlas(2048)
        generate_perforated_door_mesh(2048)
        generate_architecture_atlas(2048)
        generate_floor_concrete_2k(2048)
        generate_dynamic_label_atlas(2048)
        generate_screen_ui_atlas(2048)
    else:
        print("  [OK] 2K PBR textures already present in textures/")

    print("\n=== STEP 2: Building Modular Racks & Server Variants ===")
    all_built = []
    all_built.extend(build_all_racks_and_servers(base_dir))

    print("\n=== STEP 3: Building Network & Power Hardware ===")
    all_built.extend(build_all_network_and_power(base_dir))

    print("\n=== STEP 4: Building Modular Room Architecture & Operator Stations ===")
    all_built.extend(build_all_architecture_and_stations(base_dir))

    print("\n=== STEP 5: Building Complete Example Scene ===")
    all_built.append(export_example_scene(base_dir))

    manifest = {
        "package": "ROOT 3D Asset Package",
        "version": "1.0.0",
        "units": "meters",
        "coordinateSystem": {"up": "+Y", "front": "+Z", "right": "+X"},
        "assetCount": len(all_built),
        "assets": [inspect_doc_stats(n, d, i) for (n, d, i) in all_built],
    }
    manifest_path = os.path.join(base_dir, "docs", "asset_manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"\n[DONE] Built {len(all_built)} GLB/glTF assets and saved manifest to {manifest_path}")


if __name__ == "__main__":
    main()
