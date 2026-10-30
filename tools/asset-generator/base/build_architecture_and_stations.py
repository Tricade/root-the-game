#!/usr/bin/env python3
"""
ROOT 3D Asset Package — Modular Room Architecture (Category 4) & Operator Stations (Category 5)
Generates:
  - assets/architecture/floor_tile_standard.glb
  - assets/architecture/floor_tile_vent.glb
  - assets/architecture/wall_module_standard.glb
  - assets/architecture/wall_module_branded.glb
  - assets/architecture/ceiling_module.glb
  - assets/architecture/ceiling_light_linear.glb
  - assets/architecture/cable_tray_overhead.glb
  - assets/architecture/crac_cooling_unit.glb
  - assets/architecture/fire_door_module.glb
  - assets/architecture/signage_set.glb
  - assets/stations/operator_console_desk.glb
  - assets/stations/wall_terminal_maintenance.glb
"""

import os
import math
from gltf_builder import MeshBuilder, GltfAssetDocument


def build_floor_tile_standard():
    """0.60m x 0.60m Raised Floor Tile (Doppelbodenplatte) with top surface at Y=0 and under-floor pedestals."""
    name = "floor_tile_standard"
    w = 0.600
    d = 0.600
    slab_h = 0.038
    plenum_h = 0.220

    doc = GltfAssetDocument(name, {
        "category": "architecture_floor",
        "gridSizeM": [w, d],
        "dimensionsM": [w, plenum_h, d],
    })
    root = doc.add_node(name, extras={"assetType": "floor_tile", "tileSizeM": 0.6})
    lod0 = doc.add_node("LOD0", parent_idx=root, extras={"lodLevel": 0})

    mb0 = MeshBuilder(f"{name}_LOD0_mesh")
    # Dark anti-static concrete slab (top face at Y = 0.000)
    mb0.add_beveled_box(w - 0.003, slab_h, d - 0.003, bevel=0.0015, center=(0, -slab_h * 0.5, 0), material="mat_arch_floor", uv_rect=(0.0, 0.0, 0.5, 0.5))
    # Conductive dark perimeter trim gasket
    mb0.add_box(w, slab_h - 0.004, d, center=(0, -slab_h * 0.5 - 0.001, 0), material="mat_rubber_epdm")
    # Sub-floor galvanized steel stringers & 4 adjustable corner pedestals
    for px in (-w * 0.5 + 0.035, w * 0.5 - 0.035):
        for pz in (-d * 0.5 + 0.035, d * 0.5 - 0.035):
            mb0.add_cylinder(0.014, plenum_h - slab_h, segments=10, center=(px, -slab_h - (plenum_h - slab_h) * 0.5, pz), axis="y", material="mat_arch_steel")
            mb0.add_box(0.065, 0.006, 0.065, center=(px, -plenum_h + 0.003, pz), material="mat_arch_steel")
    doc.add_node("floor_slab", mesh_builder=mb0, parent_idx=lod0)

    mb1 = MeshBuilder(f"{name}_LOD1_mesh")
    mb1.add_box(w, slab_h, d, center=(0, -slab_h * 0.5, 0), material="mat_arch_floor", uv_rect=(0.0, 0.0, 0.5, 0.5))
    doc.add_node("LOD1", mesh_builder=mb1, parent_idx=root, extras={"lodLevel": 1})

    col_mb = MeshBuilder(f"collider_{name}_mesh")
    col_mb.add_box(w, slab_h, d, center=(0, -slab_h * 0.5, 0), material="mat_collider")
    doc.add_node(f"collider_{name}", mesh_builder=col_mb, parent_idx=root, extras={"isCollider": True})
    return doc


def build_floor_tile_vent():
    """
    0.60m x 0.60m Perforated Return-Air Grille Floor Tile (Lüftungsgitter)
    with recessed metallic louvers, sub-floor damper box, and optional lime-green aisle safety stripe.
    """
    name = "floor_tile_vent"
    w = 0.600
    d = 0.600
    slab_h = 0.038

    doc = GltfAssetDocument(name, {
        "category": "architecture_floor",
        "gridSizeM": [w, d],
        "dimensionsM": [w, 0.220, d],
    })
    root = doc.add_node(name, extras={"assetType": "floor_vent", "tileSizeM": 0.6})
    lod0 = doc.add_node("LOD0", parent_idx=root, extras={"lodLevel": 0})

    mb0 = MeshBuilder(f"{name}_LOD0_mesh")
    # Outer heavy-duty cast aluminum frame
    frame_t = 0.032
    mb0.add_beveled_box(w, slab_h, frame_t, bevel=0.0015, center=(0, -slab_h * 0.5, d * 0.5 - frame_t * 0.5), material="mat_powder_coat_dark")
    mb0.add_beveled_box(w, slab_h, frame_t, bevel=0.0015, center=(0, -slab_h * 0.5, -d * 0.5 + frame_t * 0.5), material="mat_powder_coat_dark")
    mb0.add_beveled_box(frame_t, slab_h, d - frame_t * 2, bevel=0.0015, center=(-w * 0.5 + frame_t * 0.5, -slab_h * 0.5, 0), material="mat_powder_coat_dark")
    mb0.add_beveled_box(frame_t, slab_h, d - frame_t * 2, bevel=0.0015, center=(w * 0.5 - frame_t * 0.5, -slab_h * 0.5, 0), material="mat_powder_coat_dark")

    # Dark sub-plenum airflow chamber & 14 metallic cross-slats (matching the floor grilles in the reference image!)
    mb0.add_box(w - 0.04, 0.012, d - 0.04, center=(0, -slab_h + 0.006, 0), material="mat_plastic_abs")
    for s_i in range(14):
        sz = -d * 0.5 + 0.052 + s_i * ((d - 0.104) / 13.0)
        mb0.add_beveled_box(w - frame_t * 2, 0.014, 0.014, bevel=0.001, center=(0, -0.008, sz), material="mat_arch_floor_vent")
    # Longitudinal support bars
    for lx in (-0.14, 0.0, 0.14):
        mb0.add_box(0.010, 0.018, d - frame_t * 2, center=(lx, -0.012, 0), material="mat_brushed_metal")

    doc.add_node("vent_grille_body", mesh_builder=mb0, parent_idx=lod0)

    # Separate toggleable Lime-Green Aisle Safety Stripe (`aisle_safety_stripe`)
    stripe_mb = MeshBuilder(f"{name}_safety_stripe")
    stripe_mb.add_box(0.085, 0.003, d, center=(w * 0.5 + 0.045, 0.001, 0), material="mat_arch_stripe_green")
    doc.add_node("aisle_safety_stripe", mesh_builder=stripe_mb, parent_idx=lod0, extras={"optionalTrim": True})

    mb1 = MeshBuilder(f"{name}_LOD1_mesh")
    mb1.add_box(w, slab_h, d, center=(0, -slab_h * 0.5, 0), material="mat_arch_floor_vent")
    doc.add_node("LOD1", mesh_builder=mb1, parent_idx=root, extras={"lodLevel": 1})

    col_mb = MeshBuilder(f"collider_{name}_mesh")
    col_mb.add_box(w, slab_h, d, center=(0, -slab_h * 0.5, 0), material="mat_collider")
    doc.add_node(f"collider_{name}", mesh_builder=col_mb, parent_idx=root, extras={"isCollider": True})
    return doc


def build_wall_module(branded=False):
    """
    3.60m wide x 4.20m high Repeatable Industrial Wall Module (`wall_module_standard` / `wall_module_branded`).
    Front faces +Z. Origin at bottom-center (0, 0, 0).
    """
    name = "wall_module_branded" if branded else "wall_module_standard"
    w = 3.600
    h = 4.200
    d = 0.160

    doc = GltfAssetDocument(name, {
        "category": "architecture_wall",
        "branded": branded,
        "dimensionsM": [w, h, d],
    })
    root = doc.add_node(name, extras={"assetType": "wall_module", "branded": branded, "moduleWidthM": w})
    lod0 = doc.add_node("LOD0", parent_idx=root, extras={"lodLevel": 0})

    mb0 = MeshBuilder(f"{name}_LOD0_mesh")
    # Main dark acoustic/steel architectural wall panel
    mb0.add_beveled_box(w, h, d, bevel=0.004, center=(0, h * 0.5, -d * 0.5), material="mat_arch_wall")
    # Lower dado wainscoting panel (1.15m high) + brushed horizontal trim rail + lime-green baseboard accent
    mb0.add_beveled_box(w - 0.02, 1.12, 0.024, bevel=0.003, center=(0, 0.58, 0.012), material="mat_powder_coat_medium")
    mb0.add_box(w, 0.035, 0.032, center=(0, 1.15, 0.016), material="mat_brushed_metal")
    mb0.add_box(w, 0.095, 0.028, center=(0, 0.0475, 0.014), material="mat_powder_coat_dark")
    mb0.add_box(w, 0.018, 0.030, center=(0, 0.105, 0.015), material="mat_arch_stripe_green")

    # Vertical structural pilaster columns at left/right module edges & galvanized conduit pipes (matching reference image!)
    for sx in (-w * 0.5 + 0.09, w * 0.5 - 0.09):
        mb0.add_beveled_box(0.16, h, 0.06, bevel=0.003, center=(sx, h * 0.5, 0.03), material="mat_powder_coat_dark")
    for px in (-w * 0.5 + 0.24, -w * 0.5 + 0.31):
        mb0.add_cylinder(0.018, h - 0.20, segments=12, center=(px, h * 0.5, 0.035), axis="y", material="mat_arch_steel")
        for cy in (0.8, 1.8, 2.8, 3.8):
            mb0.add_box(0.048, 0.024, 0.045, center=(px, cy, 0.022), material="mat_powder_coat_dark")

    doc.add_node("wall_structure", mesh_builder=mb0, parent_idx=lod0)

    if branded:
        # Feature Wall Typography Panel ("ROOT. STABILE NETZWERKE FÜR EINE VERBUNDENE ZUKUNFT.") + Sconce Light
        brand_mb = MeshBuilder(f"{name}_branding")
        brand_mb.add_plane(2.10, 2.10, center=(0.08, 2.38, 0.008), facing="+z", material="mat_wall_branding", uv_rect=(0.02, 0.51, 0.49, 0.99))
        # Overhead architectural wall sconce luminaire (seen above ROOT. text in reference image!)
        brand_mb.add_beveled_box(0.24, 0.045, 0.14, bevel=0.003, center=(-0.18, 3.56, 0.07), material="mat_powder_coat_dark")
        brand_mb.add_plane(0.20, 0.10, center=(-0.18, 3.535, 0.07), facing="-y", material="mat_light_cool_white")
        doc.add_node("wall_branding_panel", mesh_builder=brand_mb, parent_idx=lod0, extras={"dynamicSurface": "wall_branding"})

    mb1 = MeshBuilder(f"{name}_LOD1_mesh")
    mb1.add_box(w, h, d, center=(0, h * 0.5, -d * 0.5), material="mat_arch_wall")
    doc.add_node("LOD1", mesh_builder=mb1, parent_idx=root, extras={"lodLevel": 1})

    col_mb = MeshBuilder(f"collider_{name}_mesh")
    col_mb.add_box(w, h, d + 0.04, center=(0, h * 0.5, -d * 0.5 + 0.02), material="mat_collider")
    doc.add_node(f"collider_{name}", mesh_builder=col_mb, parent_idx=root, extras={"isCollider": True})
    return doc


def build_ceiling_module():
    """3.60m x 3.60m Modular Industrial Plenum Ceiling Grid with Steel I-Beams and HVAC Ducts."""
    name = "ceiling_module"
    w = 3.600
    d = 3.600
    h = 0.360

    doc = GltfAssetDocument(name, {
        "category": "architecture_ceiling",
        "dimensionsM": [w, h, d],
    })
    root = doc.add_node(name, extras={"assetType": "ceiling_module", "gridSizeM": [w, d]})
    lod0 = doc.add_node("LOD0", parent_idx=root, extras={"lodLevel": 0})

    mb0 = MeshBuilder(f"{name}_LOD0_mesh")
    # Dark plenum acoustic ceiling slab at top
    mb0.add_box(w, 0.06, d, center=(0, h - 0.03, 0), material="mat_arch_wall")
    # Structural Transverse Steel I-Beams (web + top/bottom flanges)
    for bz in (-d * 0.5 + 0.15, 0.0, d * 0.5 - 0.15):
        mb0.add_box(w, 0.16, 0.024, center=(0, h - 0.14, bz), material="mat_powder_coat_dark")
        mb0.add_box(w, 0.018, 0.120, center=(0, h - 0.22, bz), material="mat_powder_coat_medium")
    # Longitudinal purlins & galvanized cylindrical HVAC supply duct
    for px in (-1.20, 1.20):
        mb0.add_box(0.06, 0.08, d, center=(px, h - 0.12, 0), material="mat_arch_steel")
    mb0.add_cylinder(0.14, d, segments=16, center=(0.0, h - 0.16, 0.0), axis="z", material="mat_arch_steel")
    doc.add_node("ceiling_grid", mesh_builder=mb0, parent_idx=lod0)

    mb1 = MeshBuilder(f"{name}_LOD1_mesh")
    mb1.add_box(w, 0.12, d, center=(0, h - 0.06, 0), material="mat_arch_wall")
    doc.add_node("LOD1", mesh_builder=mb1, parent_idx=root, extras={"lodLevel": 1})

    col_mb = MeshBuilder(f"collider_{name}_mesh")
    col_mb.add_box(w, 0.12, d, center=(0, h - 0.06, 0), material="mat_collider")
    doc.add_node(f"collider_{name}", mesh_builder=col_mb, parent_idx=root, extras={"isCollider": True})
    return doc


def build_ceiling_light_linear():
    """2.40m Suspended Linear Cool-White LED Luminaire (Deckenleuchte) matching the reference image."""
    name = "ceiling_light_linear"
    w = 0.150
    h = 0.065
    length = 2.400

    doc = GltfAssetDocument(name, {
        "category": "architecture_lighting",
        "dimensionsM": [w, 0.320, length],
    })
    root = doc.add_node(name, extras={"assetType": "ceiling_light"})
    lod0 = doc.add_node("LOD0", parent_idx=root, extras={"lodLevel": 0})

    mb0 = MeshBuilder(f"{name}_housing_LOD0")
    # Extruded anodized aluminum luminaire body + twin suspension rods
    mb0.add_beveled_box(w, h, length, bevel=0.003, center=(0, h * 0.5, 0), material="mat_powder_coat_dark")
    for sz in (-length * 0.36, length * 0.36):
        mb0.add_cylinder(0.006, 0.250, segments=8, center=(0, h + 0.125, sz), axis="y", material="mat_brushed_metal")
        mb0.add_box(0.045, 0.016, 0.045, center=(0, h + 0.245, sz), material="mat_powder_coat_medium")
    doc.add_node("light_housing", mesh_builder=mb0, parent_idx=lod0)

    # Separate Emissive Diffuser Lens (`light_diffuser`)
    diff_mb = MeshBuilder(f"{name}_diffuser")
    diff_mb.add_box(w - 0.024, 0.012, length - 0.024, center=(0, -0.002, 0), material="mat_light_cool_white")
    doc.add_node("light_diffuser", mesh_builder=diff_mb, parent_idx=lod0, extras={"controllableLed": True})

    mb1 = MeshBuilder(f"{name}_LOD1_mesh")
    mb1.add_box(w, h, length, center=(0, h * 0.5, 0), material="mat_light_cool_white")
    doc.add_node("LOD1", mesh_builder=mb1, parent_idx=root, extras={"lodLevel": 1})

    col_mb = MeshBuilder(f"collider_{name}_mesh")
    col_mb.add_box(w, h, length, center=(0, h * 0.5, 0), material="mat_collider")
    doc.add_node(f"collider_{name}", mesh_builder=col_mb, parent_idx=root, extras={"isCollider": True})
    return doc


def build_cable_tray_overhead():
    """
    3.60m Overhead Galvanized Cable Ladder & Basket Tray (`cable_tray_overhead.glb`)
    with ceiling hanger brackets (`cable_tray_support`), lime-green data cable looms, and dark power cables
    matching the dual overhead cable trays in the reference image!
    """
    name = "cable_tray_overhead"
    w = 0.460
    h = 0.340
    length = 3.600

    doc = GltfAssetDocument(name, {
        "category": "architecture_cabling",
        "dimensionsM": [w, h, length],
    })
    root = doc.add_node(name, extras={"assetType": "cable_tray", "lengthM": length})
    lod0 = doc.add_node("LOD0", parent_idx=root, extras={"lodLevel": 0})

    tray_mb = MeshBuilder(f"{name}_tray_LOD0")
    # Upper & Lower tiered galvanized side rails (matching the double-deck cable trays in the reference image!)
    for tier_y in (0.04, 0.18):
        for sx in (-w * 0.5 + 0.012, w * 0.5 - 0.012):
            tray_mb.add_beveled_box(0.018, 0.055, length, bevel=0.002, center=(sx, tier_y, 0), material="mat_arch_steel")
        # Cross rungs every 0.30m
        for ri in range(12):
            rz = -length * 0.5 + 0.15 + ri * 0.30
            tray_mb.add_box(w - 0.02, 0.012, 0.022, center=(0, tier_y - 0.020, rz), material="mat_arch_steel")

    # Ceiling Trapeze Suspension Brackets (`cable_tray_support`) at 3 stations
    for bz in (-1.35, 0.0, 1.35):
        tray_mb.add_box(w + 0.06, 0.024, 0.032, center=(0, 0.005, bz), material="mat_powder_coat_medium")
        tray_mb.add_box(w + 0.06, 0.024, 0.032, center=(0, 0.145, bz), material="mat_powder_coat_medium")
        for rx in (-w * 0.5 - 0.015, w * 0.5 + 0.015):
            tray_mb.add_cylinder(0.008, h, segments=8, center=(rx, h * 0.5, bz), axis="y", material="mat_arch_steel")

    doc.add_node("cable_tray_structure", mesh_builder=tray_mb, parent_idx=lod0)

    # Neat Lime-Green Data Cable Bundles (`cable_bundle_green`) & Dark Power Conduits
    cables_mb = MeshBuilder(f"{name}_cables_LOD0")
    for cx in (-0.15, -0.09, -0.03, 0.05, 0.11):
        cables_mb.add_cylinder(0.014, length, segments=10, center=(cx, 0.032, 0), axis="z", material="mat_cable_green")
    for px in (-0.12, 0.0, 0.12):
        cables_mb.add_cylinder(0.018, length, segments=10, center=(px, 0.175, 0), axis="z", material="mat_cable_power")
    # Cable drop waterfall waterfalls at ends
    doc.add_node("cable_tray_looms", mesh_builder=cables_mb, parent_idx=lod0)

    mb1 = MeshBuilder(f"{name}_LOD1_mesh")
    mb1.add_box(w, 0.06, length, center=(0, 0.04, 0), material="mat_arch_steel")
    mb1.add_box(w * 0.7, 0.03, length, center=(0, 0.05, 0), material="mat_cable_green")
    doc.add_node("LOD1", mesh_builder=mb1, parent_idx=root, extras={"lodLevel": 1})

    col_mb = MeshBuilder(f"collider_{name}_mesh")
    col_mb.add_box(w, h, length, center=(0, h * 0.5, 0), material="mat_collider")
    doc.add_node(f"collider_{name}", mesh_builder=col_mb, parent_idx=root, extras={"isCollider": True})
    return doc


def build_crac_cooling_unit():
    """
    Precision Data Center Air Conditioning Unit (`crac_cooling_unit.glb`, 0.90m x 2.10m x 0.85m)
    with intake louver grilles, status display, and 3 visible animated axial cooling fans (`cooling_fan_01`..`03`).
    """
    name = "crac_cooling_unit"
    w = 0.900
    h = 2.100
    d = 0.850

    doc = GltfAssetDocument(name, {
        "category": "architecture_cooling",
        "dimensionsM": [w, h, d],
    })
    root = doc.add_node(name, extras={"assetType": "crac_cooling_unit", "fanCount": 3})
    lod0 = doc.add_node("LOD0", parent_idx=root, extras={"lodLevel": 0})

    mb0 = MeshBuilder(f"{name}_cabinet_LOD0")
    mb0.add_beveled_box(w, h, d, bevel=0.005, center=(0, h * 0.5, 0), material="mat_powder_coat_dark")
    # Front upper & lower intake/supply grille panels
    mb0.add_beveled_box(w - 0.10, 1.38, 0.024, bevel=0.003, center=(0, 0.95, d * 0.5 + 0.008), material="mat_vent_grille")
    mb0.add_beveled_box(w - 0.10, 0.28, 0.020, bevel=0.002, center=(0, 1.84, d * 0.5 + 0.008), material="mat_powder_coat_medium")
    # Fan shroud rings on front face
    for fy in (0.52, 0.95, 1.38):
        mb0.add_cylinder(0.175, 0.032, segments=20, center=(0, fy, d * 0.5 + 0.012), axis="z", material="mat_brushed_metal")
        mb0.add_cylinder(0.158, 0.036, segments=20, center=(0, fy, d * 0.5 + 0.010), axis="z", material="mat_plastic_abs")

    # Digital telemetry status panel & replaceable label
    mb0.add_plane(0.28, 0.14, center=(-0.18, 1.84, d * 0.5 + 0.020), facing="+z", material="mat_terminal_screen")
    mb0.add_cylinder(0.008, 0.010, segments=10, center=(0.22, 1.86, d * 0.5 + 0.020), axis="z", material="mat_led_power")
    mb0.add_cylinder(0.008, 0.010, segments=10, center=(0.26, 1.86, d * 0.5 + 0.020), axis="z", material="mat_led_activity")
    doc.add_node("crac_cabinet", mesh_builder=mb0, parent_idx=lod0)

    # 3 Visible Animated Axial Cooling Fans (`cooling_fan_01`..`03`) with exact hub pivots
    for f_idx, fy in enumerate((0.52, 0.95, 1.38), start=1):
        f_mb = MeshBuilder(f"{name}_cooling_fan_{f_idx:02d}")
        f_mb.add_fan_rotor(outer_radius=0.148, depth=0.034, blade_count=7)
        doc.add_node(
            f"cooling_fan_{f_idx:02d}",
            mesh_builder=f_mb,
            translation=(0.0, fy, d * 0.5 + 0.022),
            parent_idx=lod0,
            extras={"animatable": True, "spinAxis": "z", "fanIndex": f_idx},
        )

    mb1 = MeshBuilder(f"{name}_LOD1_mesh")
    mb1.add_box(w, h, d, center=(0, h * 0.5, 0), material="mat_powder_coat_dark")
    mb1.add_box(w - 0.10, 1.38, 0.02, center=(0, 0.95, d * 0.5 + 0.008), material="mat_vent_grille")
    doc.add_node("LOD1", mesh_builder=mb1, parent_idx=root, extras={"lodLevel": 1})

    col_mb = MeshBuilder(f"collider_{name}_mesh")
    col_mb.add_box(w, h, d, center=(0, h * 0.5, 0), material="mat_collider")
    doc.add_node(f"collider_{name}", mesh_builder=col_mb, parent_idx=root, extras={"isCollider": True})
    return doc


def build_fire_door_module():
    """
    Industrial T90 Fire Door Module (`fire_door_module.glb`, 1.40m x 2.40m x 0.18m)
    matching the back-right door in the reference image:
      - Dark steel frame
      - Animatable door leaf (`fire_door_leaf`) with pivot at right/left hinge, stainless kickplate,
        vertical narrow vision window, and stainless lever handle (`fire_door_handle`)
      - Adjacent wall-mounted access control reader & technical safety plaque
    """
    name = "fire_door_module"
    w = 1.400
    h = 2.400
    d = 0.180

    doc = GltfAssetDocument(name, {
        "category": "architecture_door",
        "dimensionsM": [w, h, d],
    })
    root = doc.add_node(name, extras={"assetType": "fire_door"})
    lod0 = doc.add_node("LOD0", parent_idx=root, extras={"lodLevel": 0})

    frame_mb = MeshBuilder(f"{name}_frame_LOD0")
    leaf_w = 1.020
    leaf_h = 2.180
    # Left, Right & Top Steel Door Jambs
    frame_mb.add_beveled_box(0.09, h, d, bevel=0.003, center=(-leaf_w * 0.5 - 0.045, h * 0.5, 0), material="mat_powder_coat_dark")
    frame_mb.add_beveled_box(0.09, h, d, bevel=0.003, center=(leaf_w * 0.5 + 0.045, h * 0.5, 0), material="mat_powder_coat_dark")
    frame_mb.add_beveled_box(leaf_w + 0.18, 0.22, d, bevel=0.003, center=(0, h - 0.11, 0), material="mat_powder_coat_dark")
    # Illuminated exit/room sign above door + RFID access control terminal on left wall pilaster (matching reference image!)
    frame_mb.add_beveled_box(0.46, 0.11, 0.03, bevel=0.002, center=(0, h - 0.11, d * 0.5 + 0.015), material="mat_powder_coat_medium")
    frame_mb.add_plane(0.42, 0.08, center=(0, h - 0.11, d * 0.5 + 0.032), facing="+z", material="mat_signage", uv_rect=(0.51, 0.51, 0.97, 0.61))

    # Wall-mounted security card reader & hazard badge on left side (-0.64m)
    frame_mb.add_beveled_box(0.11, 0.22, 0.035, bevel=0.002, center=(-0.64, 1.32, d * 0.5 + 0.015), material="mat_plastic_abs")
    frame_mb.add_cylinder(0.006, 0.008, segments=10, center=(-0.64, 1.39, d * 0.5 + 0.034), axis="z", material="mat_led_power")
    frame_mb.add_plane(0.09, 0.12, center=(-0.64, 1.08, d * 0.5 + 0.012), facing="+z", material="mat_signage", uv_rect=(0.51, 0.74, 0.97, 0.85))
    doc.add_node("fire_door_frame", mesh_builder=frame_mb, parent_idx=lod0)

    # Animatable Fire Door Leaf (`fire_door_leaf`) with pivot at right hinge `(leaf_w * 0.5, 0, d * 0.35)`
    hinge_x = leaf_w * 0.5
    hinge_z = d * 0.25
    dx = -leaf_w * 0.5  # Center of door leaf relative to hinge
    leaf_mb = MeshBuilder(f"{name}_leaf_LOD0")
    leaf_mb.add_beveled_box(leaf_w, leaf_h, 0.056, bevel=0.003, center=(dx, leaf_h * 0.5, 0), material="mat_powder_coat_dark")
    # Brushed stainless steel bottom kickplate (matching reference image!)
    leaf_mb.add_beveled_box(leaf_w - 0.02, 0.28, 0.060, bevel=0.002, center=(dx, 0.14, 0), material="mat_brushed_metal")
    # Vertical narrow wire-glass vision slit with brushed steel bezel (matching reference image!)
    vw, vh = 0.15, 0.88
    vx = dx - 0.26
    vy = 1.44
    leaf_mb.add_beveled_box(vw + 0.03, vh + 0.03, 0.064, bevel=0.002, center=(vx, vy, 0), material="mat_brushed_metal")
    leaf_mb.add_box(vw, vh, 0.020, center=(vx, vy, 0), material="mat_glass_tinted")
    # Overhead hydraulic door closer arm
    leaf_mb.add_box(0.24, 0.055, 0.065, center=(dx + 0.26, leaf_h - 0.08, 0.045), material="mat_brushed_metal")

    leaf_node = doc.add_node(
        "fire_door_leaf",
        mesh_builder=leaf_mb,
        translation=(hinge_x, 0.0, hinge_z),
        parent_idx=lod0,
        extras={"animatable": True, "pivotType": "hinge_y", "maxAngleRad": 1.65},
    )

    # Separate Lever Handle Child Node (`fire_door_handle`)
    h_mb = MeshBuilder(f"{name}_handle_LOD0")
    h_mb.add_beveled_box(0.042, 0.18, 0.012, bevel=0.002, center=(0, -0.02, 0.032), material="mat_brushed_metal")
    h_mb.add_cylinder(0.011, 0.045, segments=10, center=(0, 0, 0.050), axis="z", material="mat_brushed_metal")
    h_mb.add_cylinder(0.010, 0.135, segments=10, center=(0.058, 0, 0.068), axis="x", material="mat_brushed_metal")
    doc.add_node(
        "fire_door_handle",
        mesh_builder=h_mb,
        translation=(-leaf_w + 0.085, 1.05, 0.0),
        parent_idx=leaf_node,
        extras={"animatable": True, "pivotType": "latch_z"},
    )

    mb1 = MeshBuilder(f"{name}_LOD1_mesh")
    mb1.add_box(w, h, d, center=(0, h * 0.5, 0), material="mat_powder_coat_dark")
    doc.add_node("LOD1", mesh_builder=mb1, parent_idx=root, extras={"lodLevel": 1})

    col_mb = MeshBuilder(f"collider_{name}_mesh")
    col_mb.add_box(w, h, d, center=(0, h * 0.5, 0), material="mat_collider")
    doc.add_node(f"collider_{name}", mesh_builder=col_mb, parent_idx=root, extras={"isCollider": True})
    return doc


def build_signage_set():
    """Modular Technical Data Center Signage Set (`signage_set.glb`) with 4 individual replaceable plaques."""
    name = "signage_set"
    doc = GltfAssetDocument(name, {
        "category": "architecture_signage",
        "dimensionsM": [1.20, 0.60, 0.04],
    })
    root = doc.add_node(name, extras={"assetType": "signage_set"})
    lod0 = doc.add_node("LOD0", parent_idx=root, extras={"lodLevel": 0})

    specs = [
        ("sign_cold_aisle", (-0.32, 0.38, 0.0), (0.48, 0.12), (0.51, 0.51, 0.97, 0.61)),
        ("sign_esd_zone", (0.32, 0.38, 0.0), (0.48, 0.12), (0.51, 0.63, 0.97, 0.73)),
        ("sign_fire_door", (-0.32, 0.16, 0.0), (0.48, 0.12), (0.51, 0.74, 0.97, 0.85)),
        ("sign_high_voltage", (0.32, 0.16, 0.0), (0.48, 0.12), (0.51, 0.86, 0.97, 0.97)),
    ]
    mb1 = MeshBuilder(f"{name}_LOD1_mesh")
    for s_name, pos, (sw, sh), uv_r in specs:
        smb = MeshBuilder(f"{name}_{s_name}")
        smb.add_beveled_box(sw + 0.016, sh + 0.016, 0.014, bevel=0.002, center=(0, 0, -0.007), material="mat_powder_coat_dark")
        smb.add_plane(sw, sh, center=(0, 0, 0.001), facing="+z", material="mat_signage", uv_rect=uv_r)
        doc.add_node(s_name, mesh_builder=smb, translation=pos, parent_idx=lod0, extras={"dynamicSurface": s_name})
        mb1.add_box(sw, sh, 0.012, center=pos, material="mat_signage", uv_rect=uv_r)

    doc.add_node("LOD1", mesh_builder=mb1, parent_idx=root, extras={"lodLevel": 1})

    col_mb = MeshBuilder(f"collider_{name}_mesh")
    col_mb.add_box(1.16, 0.50, 0.03, center=(0, 0.27, 0), material="mat_collider")
    doc.add_node(f"collider_{name}", mesh_builder=col_mb, parent_idx=root, extras={"isCollider": True})
    return doc


def build_operator_console_desk():
    """
    Industrial Operator Control Desk (`operator_console_desk.glb`) with:
      - Powder-coated steel desk frame, brushed trim, antistatic work surface, cable trough
      - Three articulated widescreen monitors (`monitor_01`, `monitor_02`, `monitor_03`)
      - Each monitor has a dedicated screen mesh (`monitor_screen_01`, `monitor_screen_02`, `monitor_screen_03`)
        with separate material (`mat_monitor_screen_01..03`) and full [0,0]..[1,1] UV mapping!
      - Mechanical keyboard (`console_keyboard`) and precision mouse (`console_mouse`)
    """
    name = "operator_console_desk"
    desk_w = 2.200
    desk_d = 0.840
    desk_h = 0.760
    total_h = 1.420

    doc = GltfAssetDocument(name, {
        "category": "operator_station",
        "monitors": 3,
        "dimensionsM": [desk_w, total_h, desk_d],
    })
    root = doc.add_node(name, extras={"assetType": "operator_console_desk", "monitorCount": 3})
    lod0 = doc.add_node("LOD0", parent_idx=root, extras={"lodLevel": 0})

    desk_mb = MeshBuilder(f"{name}_desk_LOD0")
    # Layered desktop slab, brushed edge trim, and anti-static dark rubber desk mat
    desk_mb.add_beveled_box(desk_w, 0.045, desk_d, bevel=0.004, center=(0, desk_h - 0.022, 0), material="mat_powder_coat_dark")
    desk_mb.add_beveled_box(desk_w + 0.012, 0.016, desk_d + 0.012, bevel=0.002, center=(0, desk_h + 0.004, 0), material="mat_brushed_metal")
    desk_mb.add_beveled_box(desk_w - 0.08, 0.006, desk_d - 0.10, bevel=0.001, center=(0, desk_h + 0.014, 0.01), material="mat_rubber_epdm")

    # Left & Right C-Leg Steel Pillars, Skid Feet, Cross-Brace & Rear Modesty/Cable Trough
    for lx in (-desk_w * 0.5 + 0.14, desk_w * 0.5 - 0.14):
        desk_mb.add_beveled_box(0.075, desk_h - 0.06, 0.110, bevel=0.003, center=(lx, (desk_h - 0.02) * 0.5, -0.14), material="mat_powder_coat_medium")
        desk_mb.add_beveled_box(0.110, 0.048, desk_d - 0.12, bevel=0.003, center=(lx, 0.024, -0.02), material="mat_powder_coat_dark")
    desk_mb.add_beveled_box(desk_w - 0.28, 0.08, 0.045, bevel=0.002, center=(0, 0.32, -0.14), material="mat_brushed_metal")
    desk_mb.add_beveled_box(desk_w - 0.20, 0.24, 0.14, bevel=0.003, center=(0, desk_h - 0.16, -desk_d * 0.5 + 0.10), material="mat_powder_coat_dark")
    # Front illuminated lime-green status strip on modesty apron
    desk_mb.add_box(0.95, 0.014, 0.008, center=(0, desk_h - 0.12, -desk_d * 0.5 + 0.028), material="mat_led_power")
    doc.add_node("console_desk_frame", mesh_builder=desk_mb, parent_idx=lod0)

    # Replaceable Desk Nameplate (`label_hostname`)
    lbl_mb = MeshBuilder(f"{name}_label_hostname")
    lbl_mb.add_plane(0.42, 0.065, center=(0, 0, 0), facing="-z", material="mat_label_hostname", uv_rect=(0.01, 0.26, 0.24, 0.37))
    doc.add_node("label_hostname", mesh_builder=lbl_mb, translation=(0, desk_h - 0.18, -desk_d * 0.5 + 0.026), parent_idx=lod0, extras={"dynamicSurface": "label_hostname"})

    # 3 Articulated Widescreen Monitors (`monitor_01`, `monitor_02`, `monitor_03`)
    # Facing +Z toward the operator standing in front of +Z side of desk
    mon_specs = [
        (1, -0.66, 0.18, -0.22),   # Left monitor angled inward (-12.6 deg around Y)
        (2, 0.00, 0.14, 0.0),      # Center monitor straight (+Z)
        (3, 0.66, 0.18, 0.22),     # Right monitor angled inward (+12.6 deg around Y)
    ]
    mon_w = 0.600
    mon_h = 0.360
    for m_idx, mx, mz_off, yaw_rad in mon_specs:
        # Articulated monitor stand & arm
        arm_mb = MeshBuilder(f"{name}_monitor_stand_{m_idx:02d}")
        arm_mb.add_beveled_box(0.14, 0.018, 0.14, bevel=0.002, center=(mx, desk_h + 0.024, -0.22), material="mat_brushed_metal")
        arm_mb.add_cylinder(0.020, 0.34, segments=12, center=(mx, desk_h + 0.19, -0.22), axis="y", material="mat_brushed_metal")
        arm_mb.add_beveled_box(0.055, 0.045, 0.16, bevel=0.002, center=(mx, desk_h + 0.34, -0.15), material="mat_powder_coat_medium")
        doc.add_node(f"monitor_arm_{m_idx:02d}", mesh_builder=arm_mb, parent_idx=lod0)

        # Monitor Bezel Group with pivot at VESA mount so monitor can tilt/swivel!
        q_y = math.sin(yaw_rad * 0.5)
        q_w = math.cos(yaw_rad * 0.5)
        bezel_mb = MeshBuilder(f"{name}_monitor_bezel_{m_idx:02d}")
        bezel_mb.add_beveled_box(mon_w, mon_h, 0.028, bevel=0.003, center=(0, 0, 0), material="mat_plastic_abs")
        bezel_mb.add_box(mon_w - 0.012, 0.010, 0.032, center=(0, -mon_h * 0.5 + 0.006, 0.002), material="mat_brushed_metal")
        bezel_mb.add_cylinder(0.0025, 0.004, segments=8, center=(mon_w * 0.44, -mon_h * 0.5 + 0.006, 0.017), axis="z", material="mat_led_power")

        mon_node = doc.add_node(
            f"monitor_{m_idx:02d}",
            mesh_builder=bezel_mb,
            translation=(mx, desk_h + 0.36, -0.22 + mz_off),
            rotation=(0.0, -q_y, 0.0, q_w),
            parent_idx=lod0,
            extras={"animatable": True, "pivotType": "vesa_swivel_tilt", "monitorIndex": m_idx},
        )

        # Separate Screen Surface Mesh (`monitor_screen_01`..`03` and alias `monitor_screen`) with full [0,0]..[1,1] UV!
        scr_mat = f"mat_monitor_screen_0{m_idx}"
        scr_mb = MeshBuilder(f"{name}_monitor_screen_{m_idx:02d}")
        scr_mb.add_plane(mon_w - 0.024, mon_h - 0.026, center=(0, 0.002, 0.015), facing="+z", material=scr_mat, uv_rect=(0.0, 0.0, 1.0, 1.0))
        scr_node_name = "monitor_screen" if m_idx == 2 else f"monitor_screen_{m_idx:02d}"
        doc.add_node(
            scr_node_name,
            mesh_builder=scr_mb,
            parent_idx=mon_node,
            extras={"dynamicSurface": f"monitor_screen_{m_idx:02d}", "uvSpace": "0..1", "monitorIndex": m_idx},
        )

    # Separate Mechanical Keyboard (`console_keyboard`)
    kb_mb = MeshBuilder(f"{name}_keyboard_LOD0")
    kb_w, kb_h, kb_d = 0.440, 0.022, 0.155
    kb_mb.add_beveled_box(kb_w, kb_h, kb_d, bevel=0.002, center=(0, kb_h * 0.5, 0), material="mat_powder_coat_dark")
    # Sculpted keycap rows
    for r in range(5):
        cols = 15 if r < 4 else 8
        for c in range(cols):
            kw = (kb_w - 0.04) / cols - 0.003
            kx = -kb_w * 0.5 + 0.02 + (c + 0.5) * ((kb_w - 0.04) / cols)
            kz = -kb_d * 0.5 + 0.024 + r * 0.026
            kmat = "mat_plastic_latch" if (r == 0 and c == 0) else "mat_plastic_abs"
            kb_mb.add_beveled_box(kw, 0.008, 0.018, bevel=0.001, center=(kx, kb_h + 0.004, kz), material=kmat)
    doc.add_node("console_keyboard", mesh_builder=kb_mb, translation=(-0.06, desk_h + 0.016, 0.18), parent_idx=lod0, extras={"movable": True})

    # Separate Precision Mouse (`console_mouse`)
    ms_mb = MeshBuilder(f"{name}_mouse_LOD0")
    ms_mb.add_beveled_box(0.064, 0.034, 0.112, bevel=0.008, center=(0, 0.017, 0), material="mat_plastic_abs")
    ms_mb.add_cylinder(0.008, 0.006, segments=10, center=(0, 0.033, -0.028), axis="x", material="mat_brushed_metal")
    ms_mb.add_box(0.014, 0.003, 0.024, center=(0, 0.035, 0.015), material="mat_led_power")
    doc.add_node("console_mouse", mesh_builder=ms_mb, translation=(0.34, desk_h + 0.016, 0.19), parent_idx=lod0, extras={"movable": True})

    # Network & Power Feed Attachment Points under desk
    ports = doc.add_node("connection_ports", parent_idx=root)
    doc.add_attachment_point("port_network_01", position=(-0.35, 0.58, -0.32), normal=(0, -1, 0), connector_type="rj45", parent_idx=ports)
    doc.add_attachment_point("port_power_01", position=(0.35, 0.58, -0.32), normal=(0, -1, 0), connector_type="iec_c14_power", parent_idx=ports)

    # LOD1 & Collider
    mb1 = MeshBuilder(f"{name}_LOD1_mesh")
    mb1.add_box(desk_w, 0.05, desk_d, center=(0, desk_h, 0), material="mat_powder_coat_dark")
    mb1.add_box(desk_w - 0.24, desk_h, 0.12, center=(0, desk_h * 0.5, -0.18), material="mat_powder_coat_medium")
    for _, mx, mz_off, _ in mon_specs:
        mb1.add_box(mon_w, mon_h, 0.03, center=(mx, desk_h + 0.36, -0.22 + mz_off), material="mat_plastic_abs")
    doc.add_node("LOD1", mesh_builder=mb1, parent_idx=root, extras={"lodLevel": 1})

    col_mb = MeshBuilder(f"collider_{name}_mesh")
    col_mb.add_box(desk_w, total_h, desk_d, center=(0, total_h * 0.5, 0), material="mat_collider")
    doc.add_node(f"collider_{name}", mesh_builder=col_mb, parent_idx=root, extras={"isCollider": True})
    return doc


def build_wall_terminal_maintenance():
    """
    Wall-Mounted Maintenance & Backup Terminal (`wall_terminal_maintenance.glb`).
    Includes armored wall housing, status LEDs (`led_power`, `led_activity`, `led_fault`),
    tactile service keypads, replaceable nameplate (`label_hostname`), and dedicated `monitor_screen`
    mesh with separate material (`mat_terminal_screen`) and clean [0,0]..[1,1] UV mapping.
    """
    name = "wall_terminal_maintenance"
    w = 1.150
    h = 0.880
    d = 0.160

    doc = GltfAssetDocument(name, {
        "category": "operator_station",
        "monitors": 1,
        "dimensionsM": [w, h, d],
    })
    root = doc.add_node(name, extras={"assetType": "wall_terminal_maintenance"})
    lod0 = doc.add_node("LOD0", parent_idx=root, extras={"lodLevel": 0})

    mb0 = MeshBuilder(f"{name}_chassis_LOD0")
    mb0.add_beveled_box(w, h, d, bevel=0.004, center=(0, 0, d * 0.5), material="mat_powder_coat_dark")
    mb0.add_beveled_box(w - 0.06, h - 0.06, 0.025, bevel=0.003, center=(0, 0.02, d + 0.010), material="mat_powder_coat_medium")
    # Fold-out lower keyboard/control shelf & side grab handles
    mb0.add_beveled_box(w - 0.12, 0.036, 0.18, bevel=0.002, center=(0, -h * 0.5 + 0.08, d + 0.08), material="mat_brushed_metal")
    for hx in (-w * 0.5 + 0.045, w * 0.5 - 0.045):
        mb0.add_cylinder(0.008, h * 0.65, segments=10, center=(hx, 0.02, d + 0.035), axis="y", material="mat_brushed_metal")
    doc.add_node("terminal_chassis", mesh_builder=mb0, parent_idx=lod0)

    # Dedicated `monitor_screen` mesh with [0,0]..[1,1] UV mapping
    scr_mb = MeshBuilder(f"{name}_monitor_screen")
    scr_mb.add_plane(0.84, 0.52, center=(0, 0.08, d + 0.024), facing="+z", material="mat_terminal_screen", uv_rect=(0.0, 0.0, 1.0, 1.0))
    doc.add_node(
        "monitor_screen",
        mesh_builder=scr_mb,
        parent_idx=lod0,
        extras={"dynamicSurface": "monitor_screen", "uvSpace": "0..1"},
    )

    # Status LEDs (`led_power`, `led_activity`, `led_fault`)
    leds_parent = doc.add_node("status_leds", parent_idx=lod0)
    for l_name, l_mat, lx in (("led_power", "mat_led_power", -0.36), ("led_activity", "mat_led_activity", -0.32), ("led_fault", "mat_led_fault", -0.28)):
        l_mb = MeshBuilder(f"{name}_{l_name}")
        l_mb.add_cylinder(0.006, 0.008, segments=10, center=(0, 0, 0), axis="z", material=l_mat)
        doc.add_node(l_name, mesh_builder=l_mb, translation=(lx, -h * 0.5 + 0.15, d + 0.025), parent_idx=leds_parent, extras={"controllableLed": True})

    # Replaceable Nameplate (`label_hostname`)
    lbl_mb = MeshBuilder(f"{name}_label_hostname")
    lbl_mb.add_plane(0.38, 0.055, center=(0, 0, 0), facing="+z", material="mat_label_hostname", uv_rect=(0.51, 0.26, 0.74, 0.37))
    doc.add_node("label_hostname", mesh_builder=lbl_mb, translation=(0.14, -h * 0.5 + 0.15, d + 0.025), parent_idx=lod0, extras={"dynamicSurface": "label_hostname"})

    # Connection ports
    ports = doc.add_node("connection_ports", parent_idx=root)
    doc.add_attachment_point("port_network_01", position=(-0.25, -h * 0.5, 0.08), normal=(0, -1, 0), connector_type="rj45", parent_idx=ports)
    doc.add_attachment_point("port_power_01", position=(0.25, -h * 0.5, 0.08), normal=(0, -1, 0), connector_type="iec_c14_power", parent_idx=ports)

    mb1 = MeshBuilder(f"{name}_LOD1_mesh")
    mb1.add_box(w, h, d, center=(0, 0, d * 0.5), material="mat_powder_coat_dark")
    mb1.add_plane(0.84, 0.52, center=(0, 0.08, d + 0.005), facing="+z", material="mat_terminal_screen")
    doc.add_node("LOD1", mesh_builder=mb1, parent_idx=root, extras={"lodLevel": 1})

    col_mb = MeshBuilder(f"collider_{name}_mesh")
    col_mb.add_box(w, h, d + 0.18, center=(0, 0, (d + 0.18) * 0.5), material="mat_collider")
    doc.add_node(f"collider_{name}", mesh_builder=col_mb, parent_idx=root, extras={"isCollider": True})
    return doc


def build_all_architecture_and_stations(base_dir):
    out_arch = os.path.join(base_dir, "assets", "architecture")
    out_stat = os.path.join(base_dir, "assets", "stations")
    out_gltf = os.path.join(base_dir, "source", "gltf")
    jobs = [
        ("floor_tile_standard", build_floor_tile_standard(), out_arch),
        ("floor_tile_vent", build_floor_tile_vent(), out_arch),
        ("wall_module_standard", build_wall_module(branded=False), out_arch),
        ("wall_module_branded", build_wall_module(branded=True), out_arch),
        ("ceiling_module", build_ceiling_module(), out_arch),
        ("ceiling_light_linear", build_ceiling_light_linear(), out_arch),
        ("cable_tray_overhead", build_cable_tray_overhead(), out_arch),
        ("crac_cooling_unit", build_crac_cooling_unit(), out_arch),
        ("fire_door_module", build_fire_door_module(), out_arch),
        ("signage_set", build_signage_set(), out_arch),
        ("operator_console_desk", build_operator_console_desk(), out_stat),
        ("wall_terminal_maintenance", build_wall_terminal_maintenance(), out_stat),
    ]
    results = []
    for name, doc, folder in jobs:
        info = doc.export_glb(os.path.join(folder, f"{name}.glb"), texture_rel_prefix="../../textures")
        doc.export_gltf(os.path.join(out_gltf, f"{name}.gltf"), texture_rel_prefix="../../textures")
        print(f"  [OK] Exported {name}.glb ({info['size_kb']} KB, {info['nodes']} nodes)")
        results.append((name, doc, info))
    return results


if __name__ == "__main__":
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    build_all_architecture_and_stations(base)
