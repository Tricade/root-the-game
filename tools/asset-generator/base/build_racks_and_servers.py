#!/usr/bin/env python3
"""
ROOT 3D Asset Package — Racks (18U & 42U, Blank Panels) and 4 Server Variants Builder
Generates:
  - assets/racks/rack_18u.glb
  - assets/racks/rack_42u.glb
  - assets/racks/rack_blank_panel_1u.glb
  - assets/racks/rack_blank_panel_2u.glb
  - assets/servers/server_1u_edge.glb
  - assets/servers/server_2u_compute.glb
  - assets/servers/server_3u_storage.glb
  - assets/servers/server_4u_ai.glb
"""

import os
import math
from gltf_builder import MeshBuilder, GltfAssetDocument

U_HEIGHT = 0.04445          # Standard EIA-310 1U = 44.45 mm
RACK_OUTER_W = 0.600        # Standard 600 mm cabinet width
RACK_19IN_W = 0.4826        # 19.00 inches = 482.6 mm
RACK_RAIL_HOLE_X = 0.2325   # Center-to-center rail mounting hole half-span (465 mm / 2)
RACK_CLEAR_W = 0.450        # 450 mm between front mounting rail flanges


def build_blank_panel(units=1):
    """Builds a 1U or 2U removable 19-inch blanking panel asset."""
    name = f"rack_blank_panel_{units}u"
    h = units * U_HEIGHT - 0.0012
    w = RACK_19IN_W
    doc = GltfAssetDocument(name, {
        "category": "rack_accessory",
        "unitsU": units,
        "dimensionsM": [round(w, 4), round(h, 4), 0.018],
    })
    root = doc.add_node(name, extras={"assetType": "blank_panel", "unitsU": units})

    # LOD0
    mb0 = MeshBuilder(f"{name}_LOD0_mesh")
    # Main flanged blanking plate centered at Y = h/2, Z = 0
    mb0.add_beveled_box(w - 0.028, h, 0.012, bevel=0.0018, center=(0, h * 0.5, 0.004), material="mat_powder_coat_dark")
    # Left & right mounting ears
    mb0.add_box(0.016, h, 0.004, center=(-w * 0.5 + 0.008, h * 0.5, 0.002), material="mat_powder_coat_medium")
    mb0.add_box(0.016, h, 0.004, center=(w * 0.5 - 0.008, h * 0.5, 0.002), material="mat_powder_coat_medium")
    # Subtle recessed center groove & captive quarter-turn fasteners
    mb0.add_box(w - 0.064, h * 0.42, 0.003, center=(0, h * 0.5, 0.0105), material="mat_brushed_metal")
    for sx in (-RACK_RAIL_HOLE_X, RACK_RAIL_HOLE_X):
        for sy in ([h * 0.5] if units == 1 else [h * 0.25, h * 0.75]):
            mb0.add_cylinder(0.0038, 0.006, segments=10, center=(sx, sy, 0.005), axis="z", material="mat_brushed_metal")
    doc.add_node("LOD0", mesh_builder=mb0, parent_idx=root, extras={"lodLevel": 0})

    # LOD1
    mb1 = MeshBuilder(f"{name}_LOD1_mesh")
    mb1.add_box(w, h, 0.012, center=(0, h * 0.5, 0.004), material="mat_powder_coat_dark")
    doc.add_node("LOD1", mesh_builder=mb1, parent_idx=root, extras={"lodLevel": 1})

    # Collider
    col = MeshBuilder(f"collider_{name}_mesh")
    col.add_box(w, h, 0.016, center=(0, h * 0.5, 0.004), material="mat_collider")
    doc.add_node(f"collider_{name}", mesh_builder=col, parent_idx=root, extras={"isCollider": True})
    return doc


def build_rack(units=18, highlight_active=False, rack_number=1):
    """
    Builds a modular 19-inch EIA-310 cabinet (18U or 42U) based on the exact same construction.
      - Origin: (0, 0, 0) at floor center.
      - +Y up, +Z front.
      - Separate animatable doors (`rack_door_front`, `rack_door_rear`) with pivots at hinge axes.
      - Separate handles (`rack_door_handle_front`, `rack_door_handle_rear`).
      - Removable blank panels & side panels.
      - 1U slot locators `slot_u01` .. `slot_uXX`.
    """
    name = f"rack_{units}u"
    rail_base_y = 0.100
    usable_h = units * U_HEIGHT
    total_h = round(usable_h + 0.200, 4)  # 1.000m for 18U, 2.067m for 42U
    outer_w = RACK_OUTER_W                # 0.600m
    outer_d = 1.000 if units <= 18 else 1.070
    half_w = outer_w * 0.5
    half_d = outer_d * 0.5
    rail_front_z = half_d - 0.065
    rail_rear_z = -half_d + 0.085

    doc = GltfAssetDocument(name, {
        "category": "rack",
        "unitsU": units,
        "dimensionsM": [outer_w, total_h, outer_d],
        "usableHeightM": round(usable_h, 4),
        "railFrontZ": round(rail_front_z, 4),
    })

    root = doc.add_node(name, extras={
        "assetType": "rack",
        "unitsU": units,
        "rackNumber": rack_number,
    })

    # ==========================================
    # LOD0 Hierarchy
    # ==========================================
    lod0 = doc.add_node("LOD0", parent_idx=root, extras={"lodLevel": 0})

    # 1. Main Structural Frame, Plinth, Casters & Cable Pass-Throughs
    frame_mb = MeshBuilder(f"{name}_frame_LOD0")
    # Heavy-duty plinth base, leveling jacks & swivel caster wheels
    frame_mb.add_beveled_box(outer_w, 0.065, outer_d, bevel=0.004, center=(0, 0.0325, 0), material="mat_powder_coat_dark")
    for fx in (-half_w + 0.045, half_w - 0.045):
        for fz in (-half_d + 0.055, half_d - 0.055):
            frame_mb.add_cylinder(0.018, 0.014, segments=14, center=(fx, 0.007, fz), axis="y", material="mat_rubber_epdm")
            frame_mb.add_cylinder(0.010, 0.022, segments=12, center=(fx, 0.020, fz), axis="y", material="mat_brushed_metal")
            # Swivel caster wheel inset next to leveling foot
            cx_w = fx * 0.78
            cz_w = fz * 0.84
            frame_mb.add_cylinder(0.016, 0.014, segments=14, center=(cx_w, 0.016, cz_w), axis="x", material="mat_rubber_epdm")
            frame_mb.add_box(0.022, 0.022, 0.026, center=(cx_w, 0.026, cz_w), material="mat_brushed_metal")

    # 4 Corner Vertical Structural Posts with welded seam channels
    post_w = 0.042
    post_d = 0.048
    post_h = total_h - 0.120
    post_cy = 0.065 + post_h * 0.5
    for px in (-half_w + post_w * 0.5, half_w - post_w * 0.5):
        for pz in (-half_d + post_d * 0.5, half_d - post_d * 0.5):
            frame_mb.add_beveled_box(post_w, post_h, post_d, bevel=0.0025, center=(px, post_cy, pz), material="mat_powder_coat_dark")

    # Top & Bottom Depth Stringers + Front/Rear Header & Sill Bars
    for sy in (0.082, total_h - 0.038):
        for sx in (-half_w + 0.022, half_w - 0.022):
            frame_mb.add_beveled_box(0.038, 0.036, outer_d - 0.08, bevel=0.002, center=(sx, sy, 0), material="mat_powder_coat_medium")
        for sz in (-half_d + 0.024, half_d - 0.024):
            frame_mb.add_beveled_box(outer_w - 0.04, 0.042, 0.042, bevel=0.002, center=(0, sy, sz), material="mat_powder_coat_dark")

    # Roof Panel with Front/Rear Brush Cable Pass-Throughs (Kabeldurchführungen)
    frame_mb.add_beveled_box(outer_w - 0.02, 0.024, outer_d - 0.02, bevel=0.003, center=(0, total_h - 0.012, 0), material="mat_powder_coat_dark")
    for cz in (-half_d + 0.14, half_d - 0.14):
        # Cable gland frame + split twin rubber brush strips
        frame_mb.add_beveled_box(0.35, 0.030, 0.080, bevel=0.002, center=(0, total_h - 0.012, cz), material="mat_powder_coat_medium")
        frame_mb.add_box(0.31, 0.032, 0.024, center=(0, total_h - 0.012, cz - 0.014), material="mat_rubber_epdm")
        frame_mb.add_box(0.31, 0.032, 0.024, center=(0, total_h - 0.012, cz + 0.014), material="mat_rubber_epdm")
        # Bottom floor cable entry port
        frame_mb.add_beveled_box(0.35, 0.030, 0.088, bevel=0.002, center=(0, 0.066, cz), material="mat_powder_coat_medium")
        frame_mb.add_box(0.31, 0.032, 0.058, center=(0, 0.066, cz), material="mat_rubber_epdm")

    # Internal Vertical Zero-U Cable Management Channels with Molded Comb Fingers + Copper Grounding Bar
    for cx in (-half_w + 0.042, half_w - 0.042):
        frame_mb.add_box(0.026, usable_h, 0.052, center=(cx, rail_base_y + usable_h * 0.5, rail_front_z - 0.052), material="mat_plastic_abs")
        frame_mb.add_box(0.026, usable_h, 0.052, center=(cx, rail_base_y + usable_h * 0.5, rail_rear_z + 0.052), material="mat_plastic_abs")
        # Cable organizer comb fingers every 2U
        for u_idx in range(0, units, 2):
            fy = rail_base_y + (u_idx + 0.5) * U_HEIGHT
            frame_mb.add_box(0.028, 0.008, 0.034, center=(cx, fy, rail_front_z - 0.018), material="mat_plastic_abs")
            frame_mb.add_box(0.028, 0.008, 0.034, center=(cx, fy, rail_rear_z + 0.018), material="mat_plastic_abs")

    # Rear Copper Earthing / Grounding Busbar (`mat_copper_heatpipe`) with insulator standoffs
    frame_mb.add_box(0.012, usable_h * 0.85, 0.005, center=(half_w - 0.055, rail_base_y + usable_h * 0.5, rail_rear_z + 0.095), material="mat_copper_heatpipe")

    doc.add_node("rack_frame", mesh_builder=frame_mb, parent_idx=lod0)

    # 2. EIA-310 19-Inch Mounting Rails with Square Cage-Nut Holes & U Markings
    rails_mb = MeshBuilder(f"{name}_rails_LOD0")
    for rz in (rail_front_z, rail_rear_z):
        for rx_sign in (-1.0, 1.0):
            rx_outer = rx_sign * (RACK_19IN_W * 0.5 + 0.008)
            rx_hole = rx_sign * RACK_RAIL_HOLE_X
            # Vertical L-rail flange & web
            rails_mb.add_box(0.028, usable_h + 0.02, 0.005, center=(rx_hole, rail_base_y + usable_h * 0.5, rz), material="mat_brushed_metal")
            rails_mb.add_box(0.005, usable_h + 0.02, 0.042, center=(rx_outer, rail_base_y + usable_h * 0.5, rz - 0.021 * (1 if rz > 0 else -1)), material="mat_brushed_metal")
            # Horizontal cross-support brackets to outer cabinet frame
            for by in (rail_base_y + 0.04, rail_base_y + usable_h * 0.5, rail_base_y + usable_h - 0.04):
                rails_mb.add_box(0.052, 0.032, 0.085, center=(rx_sign * (half_w - 0.048), by, rz - 0.03 * (1 if rz > 0 else -1)), material="mat_powder_coat_medium")

            # EIA-310 Square Cage-Nut Holes (3 per U: bottom +6.35mm, middle +22.225mm, top +38.10mm) & U divider ticks
            for u in range(units):
                u_y0 = rail_base_y + u * U_HEIGHT
                # U-boundary tick mark
                rails_mb.add_box(0.024, 0.0015, 0.006, center=(rx_hole, u_y0, rz), material="mat_powder_coat_dark")
                for h_off in (0.00635, 0.022225, 0.03810):
                    hy = u_y0 + h_off
                    # 9.5mm x 9.5mm square cage nut hole pocket
                    rails_mb.add_box(0.0095, 0.0095, 0.0065, center=(rx_hole, hy, rz), material="mat_plastic_abs")

    doc.add_node("rack_mounting_rails", mesh_builder=rails_mb, parent_idx=lod0)

    # 3. Removable Side Walls (`rack_side_panel_l`, `rack_side_panel_r`)
    for side_label, sx_sign in (("rack_side_panel_l", -1.0), ("rack_side_panel_r", 1.0)):
        sp_mb = MeshBuilder(f"{name}_{side_label}_LOD0")
        sx = sx_sign * (half_w - 0.006)
        panel_h = total_h - 0.145
        panel_d = outer_d - 0.110
        sp_mb.add_beveled_box(0.014, panel_h, panel_d, bevel=0.002, center=(0, 0, 0), material="mat_powder_coat_dark")
        # Slam latches & recessed handles
        for lz in (-panel_d * 0.32, panel_d * 0.32):
            sp_mb.add_box(0.018, 0.095, 0.042, center=(sx_sign * 0.003, panel_h * 0.35, lz), material="mat_plastic_abs")
            sp_mb.add_box(0.020, 0.045, 0.018, center=(sx_sign * 0.004, panel_h * 0.35, lz), material="mat_brushed_metal")
        # Top & bottom ventilation louver patches
        for vy in (-panel_h * 0.34, panel_h * 0.34):
            sp_mb.add_box(0.017, 0.18, 0.38, center=(0, vy, 0), material="mat_vent_grille")
        doc.add_node(
            side_label,
            mesh_builder=sp_mb,
            translation=(sx, 0.065 + panel_h * 0.5, 0.0),
            parent_idx=lod0,
            extras={"removable": True, "partType": "side_panel"},
        )

    # 4. Roof Exhaust Fans (`rack_fan_01`, `rack_fan_02`) with exact hub pivots
    for f_idx, fx in enumerate((-0.14, 0.14), start=1):
        fan_mb = MeshBuilder(f"{name}_roof_fan_{f_idx:02d}")
        fan_mb.add_fan_rotor(outer_radius=0.085, depth=0.024, blade_count=7)
        # Rotate -90 deg around X so fan blows upward along +Y
        s2 = math.sqrt(0.5)
        doc.add_node(
            f"rack_fan_{f_idx:02d}",
            mesh_builder=fan_mb,
            translation=(fx, total_h - 0.022, 0.0),
            rotation=(-s2, 0.0, 0.0, s2),
            parent_idx=lod0,
            extras={"animatable": True, "spinAxis": "z", "partType": "cooling_fan"},
        )

    # 5. Rack Nameplate (`rack_nameplate`) & Status Highlight Frame (`led_rack_status_frame`)
    np_mb = MeshBuilder(f"{name}_nameplate")
    u0 = ((rack_number - 1) % 8) * 0.125
    u1 = u0 + 0.125
    # Backing bezel + replaceable label quad on top-right stile (matching reference image!)
    np_mb.add_beveled_box(0.044, 0.082, 0.008, bevel=0.001, center=(0, 0, 0), material="mat_powder_coat_dark")
    np_mb.add_plane(0.040, 0.076, center=(0, 0, 0.0045), facing="+z", material="mat_rack_nameplate", uv_rect=(u0 + 0.005, 0.005, u1 - 0.005, 0.120))
    doc.add_node(
        "rack_nameplate",
        mesh_builder=np_mb,
        translation=(half_w - 0.022, total_h - 0.14, half_d + 0.004),
        parent_idx=lod0,
        extras={"dynamicSurface": "rack_nameplate", "rackNumber": rack_number},
    )

    # Continuous Perimeter Status LED Frame (`led_rack_status_frame` — seen on RACK 02 in reference image!)
    led_frame_mb = MeshBuilder(f"{name}_led_status_frame")
    fw = outer_w - 0.028
    fh = total_h - 0.095
    f_cy = 0.065 + fh * 0.5
    f_z = half_d + 0.003
    bar_t = 0.0075
    led_frame_mb.add_box(fw, bar_t, bar_t, center=(0, f_cy + fh * 0.5, f_z), material="mat_led_rack_frame")
    led_frame_mb.add_box(fw, bar_t, bar_t, center=(0, f_cy - fh * 0.5, f_z), material="mat_led_rack_frame")
    led_frame_mb.add_box(bar_t, fh, bar_t, center=(-fw * 0.5, f_cy, f_z), material="mat_led_rack_frame")
    led_frame_mb.add_box(bar_t, fh, bar_t, center=(fw * 0.5, f_cy, f_z), material="mat_led_rack_frame")
    doc.add_node(
        "led_rack_status_frame",
        mesh_builder=led_frame_mb,
        parent_idx=lod0,
        extras={"controllableLed": True, "defaultActive": highlight_active},
    )

    # 6. Animatable Perforated Front & Rear Doors (`rack_door_front`, `rack_door_rear`)
    # Pivot is placed at the LEFT HINGE AXIS so rotating `rotation.y` swings the door cleanly!
    door_w = outer_w - 0.036
    door_h = total_h - 0.115
    door_cy = 0.068 + door_h * 0.5
    stile_w = 0.046

    for door_name, dz_sign in (("rack_door_front", 1.0), ("rack_door_rear", -1.0)):
        hinge_x = -door_w * 0.5 * dz_sign
        hinge_z = dz_sign * (half_d + 0.012)
        # Local coordinates inside door are relative to hinge at (0, 0, 0)
        dx_center = (door_w * 0.5) * dz_sign

        d_mb = MeshBuilder(f"{name}_{door_name}_LOD0")
        # Left & right vertical door stiles
        d_mb.add_beveled_box(stile_w, door_h, 0.022, bevel=0.0025, center=(dx_center - (door_w * 0.5 - stile_w * 0.5), 0, 0), material="mat_powder_coat_dark")
        d_mb.add_beveled_box(stile_w, door_h, 0.022, bevel=0.0025, center=(dx_center + (door_w * 0.5 - stile_w * 0.5), 0, 0), material="mat_powder_coat_dark")
        # Top & bottom horizontal door rails
        d_mb.add_beveled_box(door_w - stile_w * 2, stile_w, 0.022, bevel=0.0025, center=(dx_center, door_h * 0.5 - stile_w * 0.5, 0), material="mat_powder_coat_dark")
        d_mb.add_beveled_box(door_w - stile_w * 2, stile_w, 0.022, bevel=0.0025, center=(dx_center, -door_h * 0.5 + stile_w * 0.5, 0), material="mat_powder_coat_dark")
        # Inner brushed trim bezel around mesh
        mesh_w = door_w - stile_w * 2
        mesh_h = door_h - stile_w * 2
        d_mb.add_box(mesh_w + 0.008, 0.006, 0.014, center=(dx_center, mesh_h * 0.5, 0), material="mat_brushed_metal")
        d_mb.add_box(mesh_w + 0.008, 0.006, 0.014, center=(dx_center, -mesh_h * 0.5, 0), material="mat_brushed_metal")

        # Perforated hexagonal steel mesh sheet (with tiled UV coordinates so holes are crisp & scale-accurate)
        v_tile = round(mesh_h / 0.45, 1)
        d_mb.add_plane(mesh_w, mesh_h, center=(dx_center, 0, 0.002 * dz_sign), facing="+z" if dz_sign > 0 else "-z", material="mat_perforated_door", uv_rect=(0.0, 0.0, 1.2, v_tile))

        # 3 Hinge barrels at x = 0 (exact pivot axis!)
        for hy in (-door_h * 0.38, 0.0, door_h * 0.38):
            d_mb.add_cylinder(0.007, 0.036, segments=10, center=(0.0, hy, 0.0), axis="y", material="mat_brushed_metal")

        door_node = doc.add_node(
            door_name,
            mesh_builder=d_mb,
            translation=(hinge_x, door_cy, hinge_z),
            parent_idx=lod0,
            extras={
                "animatable": True,
                "pivotType": "hinge_y",
                "minAngleRad": 0.0,
                "maxAngleRad": round(math.radians(135.0) * (-1.0 if dz_sign > 0 else 1.0), 4),
            },
        )

        # Separate Swing Handle Child Node (`rack_door_handle_front` / `rack_door_handle_rear`)
        handle_name = f"{door_name}_handle"
        handle_x = (door_w - stile_w * 0.5) * dz_sign
        h_mb = MeshBuilder(f"{name}_{handle_name}_LOD0")
        # Escutcheon plate & swing lever with pivot at top shaft (0, 0, 0)
        h_mb.add_beveled_box(0.028, 0.190, 0.012, bevel=0.002, center=(0, -0.065, dz_sign * 0.012), material="mat_plastic_abs")
        h_mb.add_beveled_box(0.018, 0.145, 0.016, bevel=0.002, center=(0, -0.065, dz_sign * 0.024), material="mat_brushed_metal")
        h_mb.add_cylinder(0.005, 0.010, segments=10, center=(0, 0.0, dz_sign * 0.018), axis="z", material="mat_brushed_metal")
        doc.add_node(
            handle_name,
            mesh_builder=h_mb,
            translation=(handle_x, 0.04, 0.0),
            parent_idx=door_node,
            extras={"animatable": True, "pivotType": "latch_z"},
        )

    # 7. Removable Blank Panels for default unoccupied slots (`rack_blank_panel_uXX`)
    default_blanks = [1, 7, 11, 16] if units == 18 else [1, 7, 11, 16, 22, 28, 34, 40]
    for bu in default_blanks:
        if bu <= units:
            by = rail_base_y + (bu - 1) * U_HEIGHT
            bp_mb = MeshBuilder(f"{name}_blank_u{bu:02d}")
            bp_mb.add_beveled_box(RACK_19IN_W - 0.024, U_HEIGHT - 0.0015, 0.010, bevel=0.0015, center=(0, U_HEIGHT * 0.5, 0.004), material="mat_powder_coat_dark")
            bp_mb.add_box(RACK_19IN_W, U_HEIGHT - 0.0015, 0.003, center=(0, U_HEIGHT * 0.5, 0.001), material="mat_powder_coat_medium")
            for sx in (-RACK_RAIL_HOLE_X, RACK_RAIL_HOLE_X):
                bp_mb.add_cylinder(0.0035, 0.005, segments=8, center=(sx, U_HEIGHT * 0.5, 0.004), axis="z", material="mat_brushed_metal")
            doc.add_node(
                f"rack_blank_panel_u{bu:02d}",
                mesh_builder=bp_mb,
                translation=(0.0, by, rail_front_z + 0.003),
                parent_idx=lod0,
                extras={"removable": True, "slotU": bu, "unitsU": 1},
            )

    # 8. Standardized 1U Mounting Slot Attachment Points (`slot_u01` .. `slot_uXX`)
    slots_parent = doc.add_node("rack_slots", parent_idx=root, extras={"description": "1U EIA-310 mounting slot origins"})
    for u in range(1, units + 1):
        uy = rail_base_y + (u - 1) * U_HEIGHT
        doc.add_attachment_point(
            f"slot_u{u:02d}",
            position=(0.0, uy, rail_front_z),
            normal=(0.0, 0.0, 1.0),
            connector_type="eia_19in_slot",
            parent_idx=slots_parent,
            extra_meta={"unitNumber": u, "heightM": round(uy, 5)},
        )

    # ==========================================
    # LOD1 (Optimized Distance Representation)
    # ==========================================
    mb1 = MeshBuilder(f"{name}_LOD1_mesh")
    mb1.add_box(outer_w, 0.08, outer_d, center=(0, 0.04, 0), material="mat_powder_coat_dark")
    mb1.add_box(outer_w, 0.06, outer_d, center=(0, total_h - 0.03, 0), material="mat_powder_coat_dark")
    mb1.add_box(0.02, total_h - 0.14, outer_d - 0.08, center=(-half_w + 0.01, total_h * 0.5, 0), material="mat_powder_coat_dark")
    mb1.add_box(0.02, total_h - 0.14, outer_d - 0.08, center=(half_w - 0.01, total_h * 0.5, 0), material="mat_powder_coat_dark")
    mb1.add_plane(outer_w - 0.06, total_h - 0.14, center=(0, total_h * 0.5, half_d), facing="+z", material="mat_perforated_door")
    mb1.add_plane(outer_w - 0.06, total_h - 0.14, center=(0, total_h * 0.5, -half_d), facing="-z", material="mat_perforated_door")
    doc.add_node("LOD1", mesh_builder=mb1, parent_idx=root, extras={"lodLevel": 1})

    # ==========================================
    # Collision Geometry (`collider_rack_*`)
    # ==========================================
    col_mb = MeshBuilder(f"collider_{name}_mesh")
    col_mb.add_box(outer_w, total_h, outer_d, center=(0, total_h * 0.5, 0), material="mat_collider")
    doc.add_node(f"collider_{name}", mesh_builder=col_mb, parent_idx=root, extras={"isCollider": True})

    return doc


def _build_server_common_chassis(doc, root, lod0, name, units, depth, model_idx, drive_layout, fan_count, psu_count, net_port_count, is_ai=False):
    """
    Shared precision builder for the 4 server variants:
      - Origin (0, 0, 0) at bottom-center of front rack-rail mounting plane!
        +Z is forward (bezel, handles, drive caddies, status LEDs, labels).
        -Z is into the rack (chassis body, rear fans, hot-swap PSUs, network/power ports).
      - Every drive caddy (`drive_bay_01`..`XX`), fan (`server_fan_01`..`XX`),
        PSU (`psu_01`..`XX`), GPU (`gpu_module_01`..`04`), and status LED (`led_power`,
        `led_activity`, `led_fault`, `led_boot`) is a separate named component!
    """
    h = units * U_HEIGHT - 0.0015
    body_w = RACK_CLEAR_W - 0.004  # 0.446 m chassis body width
    face_w = RACK_19IN_W           # 0.4826 m across rack ears

    chassis_mb = MeshBuilder(f"{name}_chassis_LOD0")
    # Main galvanized/powder-coated sheet metal enclosure extending from Z = 0 to Z = -depth
    chassis_mb.add_beveled_box(body_w, h, depth, bevel=0.002, center=(0, h * 0.5, -depth * 0.5), material="mat_powder_coat_dark")
    # Top cover service seams & brushed steel latch release
    chassis_mb.add_box(body_w - 0.02, 0.002, depth * 0.45, center=(0, h + 0.0005, -depth * 0.35), material="mat_brushed_metal")
    # Left & Right Slide Rails along chassis sides
    for sx in (-body_w * 0.5 - 0.004, body_w * 0.5 + 0.004):
        chassis_mb.add_box(0.008, 0.022, depth * 0.88, center=(sx, h * 0.5, -depth * 0.48), material="mat_brushed_metal")

    # Front Stamped Bezel & Die-Cast Rack Ears with Captive Screws & Pull Handles
    # Bezel ends at Z = +0.016m; all mounted caddies, GPU sleds, grille, labels, and controls sit cleanly in front of Z = +0.016m
    chassis_mb.add_beveled_box(body_w, h, 0.016, bevel=0.0018, center=(0, h * 0.5, 0.008), material="mat_powder_coat_medium")
    header_y = drive_layout["header_y"]
    header_h = drive_layout["header_h"]
    bezel_front_z = 0.016
    if units == 2:
        # Signature brushed aluminum top header bar on 2U Compute Server (Z = 0.016..0.0195; labels & LEDs sit proud at Z = 0.0205)
        chassis_mb.add_beveled_box(0.400, header_h, 0.0035, bevel=0.0008, center=(0, header_y, 0.01775), material="mat_brushed_metal")
        bezel_front_z = 0.0195

    # Track 2D front-panel footprints (x0, y0, x1, y1, tag) to mathematically assert ZERO overlaps!
    front_zones = []

    def register_zone(cx_z, cy_z, w_z, h_z, tag):
        pad = 0.0008  # require at least ~1.6mm physical gap or clean separation
        x0, x1 = cx_z - w_z * 0.5 + pad, cx_z + w_z * 0.5 - pad
        y0, y1 = cy_z - h_z * 0.5 + pad, cy_z + h_z * 0.5 - pad
        for ox0, oy0, ox1, oy1, otag in front_zones:
            if x0 < ox1 and x1 > ox0 and y0 < oy1 and y1 > oy0:
                raise AssertionError(f"[{name}] Front-panel collision between '{tag}' ({x0:.4f}..{x1:.4f}, {y0:.4f}..{y1:.4f}) and '{otag}' ({ox0:.4f}..{ox1:.4f}, {oy0:.4f}..{oy1:.4f})")
        front_zones.append((x0, y0, x1, y1, tag))

    for ear_sign in (-1.0, 1.0):
        ex = ear_sign * (face_w * 0.5 - 0.009)
        # Rack ear flange
        chassis_mb.add_beveled_box(0.018, h, 0.006, bevel=0.001, center=(ex, h * 0.5, 0.003), material="mat_brushed_metal")
        # Knurled captive thumbscrews
        for u in range(units):
            sy = (u + 0.5) * U_HEIGHT
            chassis_mb.add_knurled_screw(center=(ear_sign * RACK_RAIL_HOLE_X, sy, 0.006), radius=0.0038, depth=0.007, material="mat_brushed_metal")
        # Front Extraction Handle (strictly at X = +/-0.214, clear of inner content [-0.202..+0.202])
        hx = ear_sign * 0.214
        hy_bot = max(0.008, h * 0.20)
        hy_top = min(h - 0.008, h * 0.80)
        chassis_mb.add_tube([
            (hx, hy_bot, 0.014),
            (hx, hy_bot, 0.040),
            (hx, hy_top, 0.040),
            (hx, hy_top, 0.014),
        ], radius=0.0042, radial_segments=10, material="mat_brushed_metal")
        chassis_mb.add_cylinder(0.0052, (hy_top - hy_bot) * 0.60, segments=10, center=(hx, (hy_bot + hy_top) * 0.5, 0.040), axis="y", material="mat_rubber_epdm")
        register_zone(hx, (hy_bot + hy_top) * 0.5, 0.011, (hy_top - hy_bot) + 0.008, f"handle_{int(ear_sign)}")

    # Internal SAS/NVMe Backplane PCB visible when drive caddies are pulled out!
    chassis_mb.add_box(body_w - 0.024, h - 0.010, 0.004, center=(0, h * 0.5, -0.105), material="mat_pcb_dark")
    for (bx, by, bw, bh) in drive_layout["bays"]:
        # Recessed drive slot dark pocket on bezel + SFF-8639 gold backplane connector
        chassis_mb.add_box(bw - 0.002, bh - 0.002, 0.003, center=(bx, by, 0.0155), material="mat_rubber_epdm")
        chassis_mb.add_box(bw * 0.55, 0.004, 0.006, center=(bx, by - bh * 0.28, -0.101), material="mat_gold_contacts")

    # Front Ventilation Grille Section
    grille_w, grille_h, grille_x, grille_y = drive_layout["grille_rect"]
    chassis_mb.add_beveled_box(grille_w, grille_h, 0.006, bevel=0.0012, center=(grille_x, grille_y, 0.0185), material="mat_vent_grille")
    register_zone(grille_x, grille_y, grille_w, grille_h, "vent_grille")

    # Front USB 3.2 Service Port (non-LED blue insert!) & Illuminated Power Button
    usb_x, usb_y = drive_layout["usb_pos"]
    pwr_x, pwr_y = drive_layout["pwr_pos"]
    chassis_mb.add_box(0.014, 0.007, 0.005, center=(usb_x, usb_y, 0.018), material="mat_plastic_abs")
    chassis_mb.add_box(0.010, 0.0026, 0.0055, center=(usb_x, usb_y, 0.0185), material="mat_plastic_usb_blue")
    register_zone(usb_x, usb_y, 0.014, 0.007, "usb_port")

    chassis_mb.add_cylinder(0.0046, 0.004, segments=12, center=(pwr_x, pwr_y, 0.018), axis="z", material="mat_brushed_metal")
    chassis_mb.add_cylinder(0.0030, 0.0048, segments=10, center=(pwr_x, pwr_y, 0.0185), axis="z", material="mat_led_power")
    register_zone(pwr_x, pwr_y, 0.010, 0.010, "power_button")

    # Rear Exhaust Perforated Mesh Wall + Rear PCIe Expansion Slot Brackets
    chassis_mb.add_box(body_w - 0.02, h - 0.01, 0.006, center=(0, h * 0.5, -depth + 0.003), material="mat_vent_grille")
    pcie_slots = 1 if units == 1 else (3 if units == 2 else (4 if units == 3 else 6))
    for p_slot in range(pcie_slots):
        py_slot = h - 0.016 - p_slot * 0.018
        if py_slot > 0.028:
            chassis_mb.add_beveled_box(0.095, 0.013, 0.008, bevel=0.001, center=(-0.035, py_slot, -depth - 0.001), material="mat_brushed_metal")
            chassis_mb.add_box(0.072, 0.007, 0.009, center=(-0.035, py_slot, -depth - 0.0015), material="mat_vent_grille")

    doc.add_node("server_chassis", mesh_builder=chassis_mb, parent_idx=lod0)

    # ==========================================
    # Separate Status LEDs (`led_power`, `led_activity`, `led_fault`, `led_boot`)
    # ==========================================
    leds_parent = doc.add_node("status_leds", parent_idx=lod0)
    led_y = drive_layout["led_y"]
    led_x0 = drive_layout["led_x0"]
    led_specs = [
        ("led_power", "mat_led_power", led_x0),
        ("led_activity", "mat_led_activity", led_x0 + 0.012),
        ("led_fault", "mat_led_fault", led_x0 + 0.024),
        ("led_boot", "mat_led_boot", led_x0 + 0.036),
    ]
    for led_name, led_mat, lx in led_specs:
        l_mb = MeshBuilder(f"{name}_{led_name}")
        l_mb.add_cylinder(0.0028, 0.004, segments=10, center=(0, 0, 0), axis="z", material=led_mat)
        doc.add_node(
            led_name,
            mesh_builder=l_mb,
            translation=(lx, led_y, bezel_front_z + 0.002),
            parent_idx=leds_parent,
            extras={"controllableLed": True, "materialName": led_mat},
        )
        register_zone(lx, led_y, 0.006, 0.006, led_name)

    # ==========================================
    # Separate Replaceable Label Surfaces (`label_model`, `label_hostname`, `label_inventory`)
    # ==========================================
    labels_parent = doc.add_node("labels", parent_idx=lod0)
    u0 = model_idx * 0.25
    u1 = u0 + 0.25
    lbl_z = bezel_front_z + 0.0008
    lbl_h = drive_layout["label_h"]
    lm_x, lm_w = drive_layout["label_model_xw"]
    lh_x, lh_w = drive_layout["label_host_xw"]
    li_x, li_w = drive_layout["label_inv_xw"]

    # 1. Model Nameplate (`label_model`)
    lm_mb = MeshBuilder(f"{name}_label_model")
    lm_mb.add_plane(lm_w, lbl_h, center=(0, 0, 0), facing="+z", material="mat_label_model", uv_rect=(u0 + 0.005, 0.128, u1 - 0.005, 0.248))
    doc.add_node("label_model", mesh_builder=lm_mb, translation=(lm_x, header_y, lbl_z), parent_idx=labels_parent, extras={"dynamicSurface": "label_model"})
    register_zone(lm_x, header_y, lm_w, lbl_h, "label_model")

    # 2. Device Hostname Plate (`label_hostname`)
    lh_mb = MeshBuilder(f"{name}_label_hostname")
    lh_mb.add_plane(lh_w, lbl_h, center=(0, 0, 0), facing="+z", material="mat_label_hostname", uv_rect=(u0 + 0.005, 0.255, u1 - 0.005, 0.315))
    doc.add_node("label_hostname", mesh_builder=lh_mb, translation=(lh_x, header_y, lbl_z), parent_idx=labels_parent, extras={"dynamicSurface": "label_hostname"})
    register_zone(lh_x, header_y, lh_w, lbl_h, "label_hostname")

    # 3. Inventory / Asset Barcode Tag (`label_inventory`)
    li_mb = MeshBuilder(f"{name}_label_inventory")
    li_mb.add_plane(li_w, lbl_h, center=(0, 0, 0), facing="+z", material="mat_label_inventory", uv_rect=(u0 + 0.005, 0.315, u1 - 0.005, 0.372))
    doc.add_node("label_inventory", mesh_builder=li_mb, translation=(li_x, header_y, lbl_z), parent_idx=labels_parent, extras={"dynamicSurface": "label_inventory"})
    register_zone(li_x, header_y, li_w, lbl_h, "label_inventory")

    # ==========================================
    # Separate Pull-Out Hot-Swap Drive Bays (`drive_bay_01` .. `drive_bay_XX`)
    # ==========================================
    bays_parent = doc.add_node("drive_bays", parent_idx=lod0)
    for b_idx, (bx, by, bw, bh) in enumerate(drive_layout["bays"], start=1):
        bay_name = f"drive_bay_{b_idx:02d}"
        register_zone(bx, by, bw, bh, bay_name)
        b_mb = MeshBuilder(f"{name}_{bay_name}")
        # Caddy front bezel sits strictly from local Z = 0.001 to 0.011 (world Z = 0.017..0.027, proud of bezel!)
        b_mb.add_beveled_box(bw - 0.0022, bh - 0.0022, 0.010, bevel=0.0012, center=(0, 0, 0.006), material="mat_plastic_abs")
        b_mb.add_box(bw - 0.005, bh - 0.005, 0.110, center=(0, 0, -0.055), material="mat_brushed_metal")
        b_mb.add_box(bw - 0.008, 0.0025, 0.104, center=(0, -bh * 0.42, -0.054), material="mat_pcb_dark")
        # Rear SFF-8639 gold edge connector on caddy
        b_mb.add_box(bw * 0.48, 0.003, 0.006, center=(0, -bh * 0.36, -0.111), material="mat_gold_contacts")
        # Perforated caddy airflow honeycomb window (left half of caddy: -0.40*bw .. +0.06*bw)
        b_mb.add_beveled_box(bw * 0.46, bh * 0.60, 0.003, bevel=0.0006, center=(-bw * 0.17, 0, 0.0118), material="mat_vent_grille")
        # Mechanical latch release tab (NON-LED mat_plastic_latch! Never lights up on fault!)
        b_mb.add_beveled_box(bw * 0.08, bh * 0.34, 0.0035, bevel=0.0006, center=(bw * 0.12, 0, 0.0120), material="mat_plastic_latch")
        # Brushed aluminum cam lever bar (+0.18*bw .. +0.32*bw)
        b_mb.add_beveled_box(bw * 0.14, bh * 0.68, 0.0035, bevel=0.0008, center=(bw * 0.25, 0, 0.0120), material="mat_brushed_metal")
        # Optical light-pipe bezel ring around drive LED (+0.39*bw, clear of cam bar!)
        b_mb.add_cylinder(0.0028, 0.0025, segments=10, center=(bw * 0.39, bh * 0.22, 0.0118), axis="z", material="mat_brushed_metal")

        bay_node = doc.add_node(
            bay_name,
            mesh_builder=b_mb,
            translation=(bx, by, 0.016),
            parent_idx=bays_parent,
            extras={"animatable": True, "pivotType": "slide_z", "maxPullOutM": 0.11},
        )
        # Individual Drive Status LED child node (`led_drive_XX`)
        dl_mb = MeshBuilder(f"{name}_led_drive_{b_idx:02d}")
        dl_mb.add_cylinder(0.0020, 0.0035, segments=10, center=(0, 0, 0), axis="z", material="mat_led_drive")
        doc.add_node(
            f"led_drive_{b_idx:02d}",
            mesh_builder=dl_mb,
            translation=(bw * 0.39, bh * 0.22, 0.0125),
            parent_idx=bay_node,
            extras={"controllableLed": True, "driveIndex": b_idx},
        )

    # ==========================================
    # Optional 4U AI Server GPU Accelerator Modules (`gpu_module_01` .. `04`)
    # ==========================================
    if is_ai:
        gpus_parent = doc.add_node("gpu_modules", parent_idx=lod0)
        for g_idx in range(1, 5):
            gx = -0.167 + (g_idx - 1) * 0.070
            gy = 0.078
            gw = 0.062
            gh = 0.120
            g_name = f"gpu_module_{g_idx:02d}"
            register_zone(gx, gy, gw, gh, g_name)
            g_mb = MeshBuilder(f"{name}_{g_name}")
            # SXM/OAM GPU sled front carrier frame (local Z = 0.001..0.015 -> world Z = 0.017..0.031, zero bezel overlap!)
            g_mb.add_beveled_box(gw - 0.002, gh - 0.002, 0.014, bevel=0.0015, center=(0, 0, 0.008), material="mat_powder_coat_dark")
            g_mb.add_box(gw - 0.006, 0.004, 0.245, center=(0, -gh * 0.42, -0.122), material="mat_pcb_dark")
            g_mb.add_box(gw - 0.010, 0.006, 0.220, center=(0, -gh * 0.35, -0.118), material="mat_copper_heatpipe")
            # 16 Individual Skived Aluminum Heatsink Fins inside sled body
            fin_count = 16
            fin_span = gw - 0.022
            for f_i in range(fin_count):
                fx_fin = -0.003 - fin_span * 0.5 + (f_i / (fin_count - 1)) * fin_span
                g_mb.add_box(0.0012, gh - 0.026, 0.228, center=(fx_fin, 0.002, -0.104), material="mat_heatsink_metal")
            # 4 Curved Copper Heatpipes looping cleanly on the front fin window (local X in [-0.018..+0.012], clear of left handle & right LED bar!)
            for hp_i in range(4):
                hpx = -0.016 + hp_i * 0.009
                g_mb.add_tube([
                    (hpx, -gh * 0.30, -0.015),
                    (hpx, -gh * 0.28, 0.017),
                    (hpx, gh * 0.20, 0.018),
                    (hpx, gh * 0.24, -0.035),
                ], radius=0.0022, radial_segments=8, material="mat_copper_heatpipe")
            # Anodized retention handle on left of sled (-0.37*gw) & captive thumbscrew at top-left
            g_mb.add_beveled_box(0.007, gh * 0.62, 0.009, bevel=0.001, center=(-gw * 0.37, -0.006, 0.019), material="mat_brushed_metal")
            g_mb.add_knurled_screw(center=(-gw * 0.37, gh * 0.38, 0.015), radius=0.0030, depth=0.005, material="mat_brushed_metal")

            gpu_node = doc.add_node(
                g_name,
                mesh_builder=g_mb,
                translation=(gx, gy, 0.016),
                parent_idx=gpus_parent,
                extras={"animatable": True, "pivotType": "slide_z", "maxPullOutM": 0.18, "gpuIndex": g_idx},
            )
            # GPU Utilization LED Bargraph (`led_gpu_load_01`..`04`) on right side (+0.36*gw), pivot at bottom for `scale.y`!
            bar_h = gh * 0.68
            gb_mb = MeshBuilder(f"{name}_led_gpu_load_{g_idx:02d}")
            gb_mb.add_box(0.0055, bar_h, 0.004, center=(0, bar_h * 0.5, 0), material="mat_led_gpu_load")
            doc.add_node(
                f"led_gpu_load_{g_idx:02d}",
                mesh_builder=gb_mb,
                translation=(gw * 0.36, -bar_h * 0.5, 0.017),
                parent_idx=gpu_node,
                extras={"controllableLed": True, "animatableScaleY": True, "gpuIndex": g_idx},
            )

    # ==========================================
    # Separate Cooling Fans (`server_fan_01` .. `server_fan_XX`)
    # ==========================================
    fans_parent = doc.add_node("cooling_fans", parent_idx=lod0)
    fan_r = min(0.017 if units == 1 else (0.026 if units == 2 else 0.036), h * 0.38)
    fan_span_x = body_w * 0.58
    for f_idx in range(1, fan_count + 1):
        t = (f_idx - 0.5) / fan_count
        fx = -fan_span_x * 0.5 + t * fan_span_x
        fy = h * 0.5
        fz = -depth + 0.028
        f_mb = MeshBuilder(f"{name}_server_fan_{f_idx:02d}")
        f_mb.add_fan_rotor(outer_radius=fan_r, depth=0.022, blade_count=7)
        doc.add_node(
            f"server_fan_{f_idx:02d}",
            mesh_builder=f_mb,
            translation=(fx, fy, fz),
            parent_idx=fans_parent,
            extras={"animatable": True, "spinAxis": "z", "fanIndex": f_idx},
        )

    # ==========================================
    # Separate Hot-Swap Power Supplies (`psu_01`..`XX`) & Power Sockets (`port_power_01`..`XX`)
    # ==========================================
    psus_parent = doc.add_node("power_supplies", parent_idx=lod0)
    ports_parent = doc.add_node("connection_ports", parent_idx=root, extras={"description": "Dynamic cable attachment points"})
    psu_w = 0.074
    psu_h = min(0.038, h - 0.008)
    for p_idx in range(1, psu_count + 1):
        px = body_w * 0.5 - 0.048 - ((p_idx - 1) % 2) * (psu_w + 0.006)
        py = 0.024 + ((p_idx - 1) // 2) * (psu_h + 0.006) if units >= 3 else h * 0.5
        pz = -depth
        p_mb = MeshBuilder(f"{name}_psu_{p_idx:02d}")
        # PSU rear face, pull handle, green release tab, IEC C14 recessed socket + 3 brass pins
        p_mb.add_beveled_box(psu_w, psu_h, 0.020, bevel=0.0015, center=(0, 0, 0.010), material="mat_brushed_metal")
        p_mb.add_box(0.024, 0.018, 0.012, center=(-0.012, 0, 0.004), material="mat_plastic_abs")
        for pin_x, pin_y in ((-0.018, -0.003), (-0.006, -0.003), (-0.012, 0.004)):
            p_mb.add_box(0.002, 0.004, 0.008, center=(pin_x, pin_y, 0.003), material="mat_gold_contacts")
        # PSU extraction handle & green status LED
        p_mb.add_beveled_box(0.016, psu_h * 0.65, 0.018, bevel=0.001, center=(0.022, 0, -0.008), material="mat_plastic_abs")
        p_mb.add_cylinder(0.0025, 0.004, segments=8, center=(0.008, psu_h * 0.25, -0.001), axis="z", material="mat_led_power")

        doc.add_node(
            f"psu_{p_idx:02d}",
            mesh_builder=p_mb,
            translation=(px, py, pz),
            parent_idx=psus_parent,
            extras={"animatable": True, "pivotType": "slide_z_rear", "psuIndex": p_idx},
        )
        # Power socket attachment point (`port_power_01`..`XX`) at exact IEC C14 receptacle center
        doc.add_attachment_point(
            f"port_power_{p_idx:02d}",
            position=(px - 0.012, py, -depth - 0.002),
            normal=(0.0, 0.0, -1.0),
            connector_type="iec_c14_power",
            parent_idx=ports_parent,
            extra_meta={"portIndex": p_idx, "voltageV": 230},
        )

    # ==========================================
    # Rear Network & Uplink Ports (`port_network_01`..`XX`)
    # ==========================================
    io_mb = MeshBuilder(f"{name}_rear_io_LOD0")
    for n_idx in range(1, net_port_count + 1):
        nx = -body_w * 0.5 + 0.045 + (n_idx - 1) * 0.022
        ny = 0.018
        nz = -depth
        # Shielded RJ45 / SFP+ cage + Link/Activity LEDs
        io_mb.add_box(0.016, 0.014, 0.016, center=(nx, ny, nz + 0.008), material="mat_brushed_metal")
        io_mb.add_box(0.012, 0.010, 0.010, center=(nx, ny, nz + 0.004), material="mat_plastic_abs")
        io_mb.add_box(0.003, 0.0025, 0.003, center=(nx - 0.004, ny + 0.006, nz - 0.001), material="mat_led_port_link")
        io_mb.add_box(0.003, 0.0025, 0.003, center=(nx + 0.004, ny + 0.006, nz - 0.001), material="mat_led_port_act")

        doc.add_attachment_point(
            f"port_network_{n_idx:02d}",
            position=(nx, ny, -depth - 0.002),
            normal=(0.0, 0.0, -1.0),
            connector_type="rj45_or_sfp",
            parent_idx=ports_parent,
            extra_meta={"portIndex": n_idx, "role": "uplink" if n_idx > net_port_count - 2 else "access"},
        )
    doc.add_node("server_rear_io", mesh_builder=io_mb, parent_idx=lod0)

    # ==========================================
    # LOD1 & Collision Geometry
    # ==========================================
    mb1 = MeshBuilder(f"{name}_LOD1_mesh")
    mb1.add_box(body_w, h, depth, center=(0, h * 0.5, -depth * 0.5), material="mat_powder_coat_dark")
    mb1.add_box(face_w, h, 0.016, center=(0, h * 0.5, 0.008), material="mat_powder_coat_medium")
    mb1.add_box(grille_w, grille_h, 0.006, center=(grille_x, grille_y, 0.018), material="mat_vent_grille")
    doc.add_node("LOD1", mesh_builder=mb1, parent_idx=root, extras={"lodLevel": 1})

    col_mb = MeshBuilder(f"collider_{name}_mesh")
    col_mb.add_box(face_w, h, depth + 0.02, center=(0, h * 0.5, -depth * 0.5 + 0.01), material="mat_collider")
    doc.add_node(f"collider_{name}", mesh_builder=col_mb, parent_idx=root, extras={"isCollider": True})


def build_server_1u_edge():
    """1U Edge Server (ROOT R120): 4x 2.5" NVMe drive bays, 4x 40mm fans, dual PSU, 4x network ports."""
    name = "server_1u_edge"
    h = 1 * U_HEIGHT - 0.0015  # 0.04295m
    doc = GltfAssetDocument(name, {
        "category": "server",
        "model": "ROOT R120",
        "unitsU": 1,
        "dimensionsM": [RACK_19IN_W, round(h, 4), 0.650],
    })
    root = doc.add_node(name, extras={"assetType": "server", "serverVariant": "edge_1u", "model": "ROOT R120", "unitsU": 1})
    lod0 = doc.add_node("LOD0", parent_idx=root, extras={"lodLevel": 0})

    # 4 bays in X = [-0.198 .. +0.022], Y = [0.006 .. 0.024]
    bays = [(-0.172 + i * 0.056, 0.015, 0.052, 0.018) for i in range(4)]
    drive_layout = {
        "bays": bays,
        "header_y": 0.0345,
        "header_h": 0.012,
        "label_h": 0.0095,
        "label_model_xw": (-0.162, 0.068),
        "label_host_xw": (-0.084, 0.074),
        "label_inv_xw": (-0.008, 0.062),
        "grille_rect": (0.098, 0.028, 0.084, 0.021),  # X = [+0.035 .. +0.133]
        "led_x0": 0.146,
        "led_y": 0.031,
        "usb_pos": (0.156, 0.013),
        "pwr_pos": (0.188, 0.014),
    }
    _build_server_common_chassis(doc, root, lod0, name, units=1, depth=0.650, model_idx=0, drive_layout=drive_layout, fan_count=4, psu_count=2, net_port_count=4, is_ai=False)
    return doc


def build_server_2u_compute():
    """2U Compute Server (ROOT C240): 8x 2.5" hot-swap bays, brushed bezel trim, 6x 60mm fans, dual PSU, 6x network ports."""
    name = "server_2u_compute"
    h = 2 * U_HEIGHT - 0.0015  # 0.0874m
    doc = GltfAssetDocument(name, {
        "category": "server",
        "model": "ROOT C240",
        "unitsU": 2,
        "dimensionsM": [RACK_19IN_W, round(h, 4), 0.720],
    })
    root = doc.add_node(name, extras={"assetType": "server", "serverVariant": "compute_2u", "model": "ROOT C240", "unitsU": 2})
    lod0 = doc.add_node("LOD0", parent_idx=root, extras={"lodLevel": 0})

    # 2x4 = 8 bays in X = [-0.197 .. +0.034], Y = [0.008 .. 0.056]
    bays = []
    for row in range(2):
        for col in range(4):
            bx = -0.170 + col * 0.059
            by = 0.019 + row * 0.026
            bays.append((bx, by, 0.055, 0.022))
    drive_layout = {
        "bays": bays,
        "header_y": 0.0745,
        "header_h": 0.017,
        "label_h": 0.0125,
        "label_model_xw": (-0.158, 0.076),
        "label_host_xw": (-0.072, 0.082),
        "label_inv_xw": (0.014, 0.072),
        "grille_rect": (0.092, 0.048, 0.092, 0.032),  # X = [+0.046 .. +0.138]
        "led_x0": 0.146,
        "led_y": 0.0745,
        "usb_pos": (0.160, 0.024),
        "pwr_pos": (0.188, 0.036),
    }
    _build_server_common_chassis(doc, root, lod0, name, units=2, depth=0.720, model_idx=1, drive_layout=drive_layout, fan_count=6, psu_count=2, net_port_count=6, is_ai=False)
    return doc


def build_server_3u_storage():
    """3U Storage Server (ROOT S360): 12x 3.5" LFF hot-swap bays in 3x4 array, 4x 80mm fans, dual PSU, 4x network ports."""
    name = "server_3u_storage"
    h = 3 * U_HEIGHT - 0.0015  # 0.13185m
    doc = GltfAssetDocument(name, {
        "category": "server",
        "model": "ROOT S360",
        "unitsU": 3,
        "dimensionsM": [RACK_19IN_W, round(h, 4), 0.760],
    })
    root = doc.add_node(name, extras={"assetType": "server", "serverVariant": "storage_3u", "model": "ROOT S360", "unitsU": 3})
    lod0 = doc.add_node("LOD0", parent_idx=root, extras={"lodLevel": 0})

    # 3x4 = 12 LFF bays in X = [-0.198 .. +0.108], Y = [0.0085 .. 0.0995]
    bays = []
    for row in range(3):
        for col in range(4):
            bx = -0.162 + col * 0.078
            by = 0.022 + row * 0.032
            bays.append((bx, by, 0.072, 0.027))
    drive_layout = {
        "bays": bays,
        "header_y": 0.1185,
        "header_h": 0.018,
        "label_h": 0.0135,
        "label_model_xw": (-0.158, 0.076),
        "label_host_xw": (-0.072, 0.082),
        "label_inv_xw": (0.014, 0.072),
        "grille_rect": (0.048, 0.090, 0.142, 0.054),  # X = [+0.118 .. +0.166]
        "led_x0": 0.146,
        "led_y": 0.1185,
        "usb_pos": (0.186, 0.032),
        "pwr_pos": (0.186, 0.076),
    }
    _build_server_common_chassis(doc, root, lod0, name, units=3, depth=0.760, model_idx=2, drive_layout=drive_layout, fan_count=4, psu_count=2, net_port_count=4, is_ai=False)
    return doc


def build_server_4u_ai():
    """4U AI Server (ROOT A480): 4x GPU accelerator modules with heatsink stacks & utilization bars, 4x NVMe bays, 8x fans, 4x PSUs."""
    name = "server_4u_ai"
    h = 4 * U_HEIGHT - 0.0015  # 0.1763m
    doc = GltfAssetDocument(name, {
        "category": "server",
        "model": "ROOT A480",
        "unitsU": 4,
        "gpuCount": 4,
        "dimensionsM": [RACK_19IN_W, round(h, 4), 0.800],
    })
    root = doc.add_node(name, extras={"assetType": "server", "serverVariant": "ai_4u", "model": "ROOT A480", "unitsU": 4, "gpuCount": 4})
    lod0 = doc.add_node("LOD0", parent_idx=root, extras={"lodLevel": 0})

    # 2x2 = 4 NVMe bays on bottom-right X = [+0.089 .. +0.195], Y = [0.018 .. 0.076] (clear of GPUs in [-0.198..+0.074])
    bays = []
    for row in range(2):
        for col in range(2):
            bx = 0.114 + col * 0.056
            by = 0.031 + row * 0.032
            bays.append((bx, by, 0.050, 0.026))
    drive_layout = {
        "bays": bays,
        "header_y": 0.161,
        "header_h": 0.020,
        "label_h": 0.014,
        "label_model_xw": (-0.158, 0.076),
        "label_host_xw": (-0.072, 0.082),
        "label_inv_xw": (0.014, 0.072),
        "grille_rect": (0.084, 0.046, 0.131, 0.115),  # X = [+0.089 .. +0.173], Y = [0.092 .. 0.138]
        "led_x0": 0.146,
        "led_y": 0.161,
        "usb_pos": (0.188, 0.100),
        "pwr_pos": (0.188, 0.126),
    }
    _build_server_common_chassis(doc, root, lod0, name, units=4, depth=0.800, model_idx=3, drive_layout=drive_layout, fan_count=8, psu_count=4, net_port_count=6, is_ai=True)
    return doc


def build_all_racks_and_servers(base_dir):
    out_racks = os.path.join(base_dir, "assets", "racks")
    out_servers = os.path.join(base_dir, "assets", "servers")
    out_gltf = os.path.join(base_dir, "source", "gltf")
    results = []

    rack_jobs = [
        ("rack_18u", build_rack(18, highlight_active=False, rack_number=1), out_racks),
        ("rack_42u", build_rack(42, highlight_active=True, rack_number=2), out_racks),
        ("rack_blank_panel_1u", build_blank_panel(1), out_racks),
        ("rack_blank_panel_2u", build_blank_panel(2), out_racks),
    ]
    for name, doc, folder in rack_jobs:
        info = doc.export_glb(os.path.join(folder, f"{name}.glb"), texture_rel_prefix="../../textures")
        doc.export_gltf(os.path.join(out_gltf, f"{name}.gltf"), texture_rel_prefix="../../textures")
        print(f"  [OK] Exported {name}.glb ({info['size_kb']} KB, {info['nodes']} nodes)")
        results.append((name, doc, info))

    server_jobs = [
        ("server_1u_edge", build_server_1u_edge(), out_servers),
        ("server_2u_compute", build_server_2u_compute(), out_servers),
        ("server_3u_storage", build_server_3u_storage(), out_servers),
        ("server_4u_ai", build_server_4u_ai(), out_servers),
    ]
    for name, doc, folder in server_jobs:
        info = doc.export_glb(os.path.join(folder, f"{name}.glb"), texture_rel_prefix="../../textures")
        doc.export_gltf(os.path.join(out_gltf, f"{name}.gltf"), texture_rel_prefix="../../textures")
        print(f"  [OK] Exported {name}.glb ({info['size_kb']} KB, {info['nodes']} nodes)")
        results.append((name, doc, info))

    return results


if __name__ == "__main__":
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    build_all_racks_and_servers(base)
