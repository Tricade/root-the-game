#!/usr/bin/env python3
"""
ROOT 3D Asset Package — Complete Example Scene Builder (`scenes/root_datacenter_scene.glb`)
Composes all modular architecture, 6 racks (with Rack 02 highlighted & detailed),
32 servers across the 6 racks, switches, patch panels, PDUs, curved green patch cables,
overhead cable trays, linear ceiling lights, CRAC cooling units, fire door,
branded ROOT feature wall, 3-monitor operator console desk, and wall-mounted maintenance terminal
in the exact visual style and framing of the reference image.
"""

import os
import math
from gltf_builder import MeshBuilder, GltfAssetDocument
from build_racks_and_servers import U_HEIGHT, RACK_OUTER_W, RACK_19IN_W, RACK_CLEAR_W


def build_datacenter_example_scene():
    name = "root_datacenter_scene"
    doc = GltfAssetDocument(name, {
        "category": "example_scene",
        "description": "Complete ROOT Data Center Cold-Aisle Scene matching the reference image (6 racks, 32 servers, modular hall, operator consoles)",
        "units": "meters",
        "upAxis": "+Y",
        "frontAxis": "+Z",
    })
    scene_root = doc.add_node("root_datacenter_scene", extras={"sceneVersion": "1.0", "racksCount": 6, "serversCount": 32})

    # =========================================================================
    # 1. MODULAR ROOM ARCHITECTURE (Floor, Vent Trenches, Green Stripes, Walls, Ceiling, Lights, Cable Trays)
    # =========================================================================
    arch_group = doc.add_node("architecture_hall", parent_idx=scene_root)
    hall_w = 7.20
    hall_l = 12.00
    hall_h = 4.20
    z_front = 4.80
    z_back = z_front - hall_l  # -7.20
    z_center = (z_front + z_back) * 0.5  # -1.20

    # Raised Floor Slabs, Recessed Air-Return Vent Trenches & Lime-Green Safety Stripes (matching reference image!)
    floor_mb = MeshBuilder("hall_raised_floor")
    # Main polished dark concrete aisle & side slabs: 6x10 repeats of 2x2 slab texture = exact 0.60m x 0.60m tiles across 7.2m x 12.0m!
    floor_mb.add_box(hall_w, 0.08, hall_l, center=(0, -0.04, z_center), material="mat_arch_floor", uv_rect=(0.0, 0.0, 6.0, 10.0))

    # Left & Right Lime-Green Aisle Safety Stripes (x = +/- 1.18m)
    for sx_sign in (-1.0, 1.0):
        stripe_x = sx_sign * 1.18
        floor_mb.add_box(0.095, 0.004, hall_l - 1.60, center=(stripe_x, 0.002, z_center + 0.30), material="mat_arch_stripe_green")

        # Continuous Floor Return-Air Grille Trench between green stripe and rack fronts (x = +/- 1.38m)
        vent_x = sx_sign * 1.38
        floor_mb.add_box(0.24, 0.012, hall_l - 1.80, center=(vent_x, -0.004, z_center + 0.30), material="mat_plastic_abs")
        for vz_i in range(48):
            vz = z_back + 1.30 + vz_i * 0.20
            floor_mb.add_box(0.22, 0.008, 0.012, center=(vent_x, 0.001, vz), material="mat_arch_floor_vent")

    doc.add_node("floor_system", mesh_builder=floor_mb, parent_idx=arch_group)

    # Perimeter Walls & Branded Feature Back Wall (`ROOT. STABILE NETZWERKE FÜR EINE VERBUNDENE ZUKUNFT.`)
    walls_mb = MeshBuilder("hall_walls")
    # Left & Right side walls
    walls_mb.add_box(0.18, hall_h, hall_l, center=(-hall_w * 0.5, hall_h * 0.5, z_center), material="mat_arch_wall")
    walls_mb.add_box(0.18, hall_h, hall_l, center=(hall_w * 0.5, hall_h * 0.5, z_center), material="mat_arch_wall")
    # Front wall behind camera
    walls_mb.add_box(hall_w, hall_h, 0.18, center=(0, hall_h * 0.5, z_front + 0.09), material="mat_arch_wall")
    # Back Wall (left recessed alcove with ROOT branding + right column with Fire Door)
    walls_mb.add_box(hall_w, hall_h, 0.18, center=(0, hall_h * 0.5, z_back - 0.09), material="mat_arch_wall")
    # Central vertical pilaster & galvanized conduit pipes (matching reference image!)
    walls_mb.add_beveled_box(0.28, hall_h, 0.22, bevel=0.004, center=(-0.18, hall_h * 0.5, z_back + 0.08), material="mat_powder_coat_dark")
    for c_x in (-0.36, -0.42, -1.95, -2.02):
        walls_mb.add_cylinder(0.018, hall_h - 0.20, segments=10, center=(c_x, hall_h * 0.5, z_back + 0.06), axis="y", material="mat_arch_steel")
    # Lower wainscoting & green kickplate stripe along back wall
    walls_mb.add_beveled_box(2.10, 1.08, 0.03, bevel=0.003, center=(-1.35, 0.54, z_back + 0.02), material="mat_powder_coat_medium")
    walls_mb.add_box(0.28, 0.32, 0.23, center=(-0.18, 0.16, z_back + 0.08), material="mat_arch_stripe_green")

    # Feature Wall Typography Panel on Back-Left Wall (-1.28, 2.35, z_back + 0.015)
    walls_mb.add_plane(1.95, 1.95, center=(-1.22, 2.32, z_back + 0.018), facing="+z", material="mat_wall_branding", uv_rect=(0.02, 0.51, 0.49, 0.99))
    # Overhead Sconce Lamp above ROOT. wall text
    walls_mb.add_beveled_box(0.22, 0.04, 0.14, bevel=0.002, center=(-1.22, 3.38, z_back + 0.08), material="mat_powder_coat_dark")
    walls_mb.add_plane(0.18, 0.10, center=(-1.22, 3.358, z_back + 0.08), facing="-y", material="mat_light_cool_white")

    # Mobile 5-Drawer Diagnostic Tool Cabinet on Casters & Compact Floor Cooling Unit at Back-Left (matching reference image!)
    walls_mb.add_beveled_box(0.58, 0.86, 0.44, bevel=0.004, center=(-1.85, 0.51, z_back + 0.55), material="mat_powder_coat_dark")
    # Brushed steel corner bumpers & top rubberized workmat
    walls_mb.add_box(0.59, 0.02, 0.45, center=(-1.85, 0.94, z_back + 0.55), material="mat_brushed_metal")
    for dy in (0.24, 0.38, 0.52, 0.66, 0.80):
        walls_mb.add_beveled_box(0.50, 0.11, 0.014, bevel=0.002, center=(-1.85, dy, z_back + 0.775), material="mat_powder_coat_medium")
        walls_mb.add_box(0.46, 0.014, 0.018, center=(-1.85, dy + 0.025, z_back + 0.785), material="mat_brushed_metal")
    # 4 Swivel caster wheels under tool cabinet
    for w_x in (-2.08, -1.62):
        for w_z in (z_back + 0.38, z_back + 0.72):
            walls_mb.add_cylinder(0.036, 0.026, segments=12, center=(w_x, 0.038, w_z), axis="x", material="mat_rubber_epdm")
            walls_mb.add_box(0.032, 0.045, 0.045, center=(w_x, 0.062, w_z), material="mat_brushed_metal")
    # Diagnostic field unit / analyzer on top of tool cart with glowing green status LEDs
    walls_mb.add_beveled_box(0.36, 0.24, 0.28, bevel=0.003, center=(-1.90, 1.07, z_back + 0.54), material="mat_powder_coat_dark")
    walls_mb.add_plane(0.22, 0.14, center=(-1.90, 1.08, z_back + 0.682), facing="+z", material="mat_terminal_screen", uv_rect=(0.0, 0.0, 1.0, 1.0))
    walls_mb.add_box(0.018, 0.018, 0.006, center=(-1.76, 1.02, z_back + 0.682), material="mat_led_power")

    # Compact Floor Sub-Cooler Unit under the ROOT. sign on the right of the alcove
    walls_mb.add_beveled_box(0.54, 0.72, 0.42, bevel=0.003, center=(-0.65, 0.36, z_back + 0.32), material="mat_powder_coat_dark")
    walls_mb.add_box(0.46, 0.58, 0.02, center=(-0.65, 0.36, z_back + 0.53), material="mat_vent_grille")

    doc.add_node("walls_and_branding", mesh_builder=walls_mb, parent_idx=arch_group)

    # Fire Door at Back-Right (`fire_door_leaf` with hinge pivot!)
    door_grp = doc.add_node("fire_door", translation=(0.68, 0.0, z_back + 0.04), parent_idx=arch_group)
    fd_frame = MeshBuilder("scene_fire_door_frame")
    fd_frame.add_beveled_box(1.16, 2.32, 0.14, bevel=0.003, center=(0, 1.16, 0), material="mat_powder_coat_dark")
    # Card reader & hazard badge on left pilaster
    fd_frame.add_beveled_box(0.10, 0.20, 0.03, bevel=0.002, center=(-0.74, 1.32, 0.06), material="mat_plastic_abs")
    fd_frame.add_cylinder(0.006, 0.008, segments=8, center=(-0.74, 1.38, 0.078), axis="z", material="mat_led_power")
    doc.add_node("fire_door_jamb", mesh_builder=fd_frame, parent_idx=door_grp)

    fd_leaf = MeshBuilder("scene_fire_door_leaf")
    fd_leaf.add_beveled_box(0.98, 2.18, 0.05, bevel=0.003, center=(-0.49, 1.09, 0), material="mat_powder_coat_medium")
    fd_leaf.add_box(0.96, 0.26, 0.055, center=(-0.49, 0.13, 0), material="mat_brushed_metal")
    fd_leaf.add_box(0.14, 0.84, 0.058, center=(-0.76, 1.42, 0), material="mat_glass_tinted")
    fd_leaf.add_cylinder(0.010, 0.12, segments=8, center=(-0.86, 1.05, 0.045), axis="x", material="mat_brushed_metal")
    doc.add_node("fire_door_leaf", mesh_builder=fd_leaf, translation=(0.49, 0.0, 0.04), parent_idx=door_grp, extras={"animatable": True, "pivotType": "hinge_y"})

    # Industrial Plenum Ceiling, Chilled-Water Piping, Linear Cool-White Lights & Dual Overhead Cable Trays
    ceil_mb = MeshBuilder("hall_ceiling_and_trays")
    ceil_mb.add_box(hall_w, 0.10, hall_l, center=(0, hall_h + 0.05, z_center), material="mat_arch_wall")
    # Alcove header soffit beam at z = -5.05 framing the rear ROOT. wall & fire door (matching reference image!)
    ceil_mb.add_box(hall_w, 0.42, 0.22, center=(0, hall_h - 0.21, -5.05), material="mat_powder_coat_dark")
    for bz in (-3.6, -1.3, 1.0, 3.3):
        ceil_mb.add_box(hall_w, 0.16, 0.08, center=(0, hall_h - 0.10, bz), material="mat_powder_coat_dark")
        # Suspended Central Linear LED Luminaire (`ceiling_light_linear`) along cold aisle center (X = 0)
        ceil_mb.add_beveled_box(0.14, 0.055, 1.80, bevel=0.003, center=(0, 3.82, bz), material="mat_powder_coat_dark")
        ceil_mb.add_box(0.11, 0.014, 1.75, center=(0, 3.79, bz), material="mat_light_cool_white")

    # Overhead Chilled-Water & Fire-Suppression Conduits with Bolted Flanges (matching reference image!)
    for px_pipe in (-0.38, 0.38, -1.55, 1.55):
        ceil_mb.add_cylinder(0.036, hall_l - 0.6, segments=14, center=(px_pipe, 3.92, z_center), axis="z", material="mat_powder_coat_medium")
        for fz_flange in (-4.8, -2.4, 0.0, 2.4):
            ceil_mb.add_cylinder(0.058, 0.022, segments=14, center=(px_pipe, 3.92, fz_flange), axis="z", material="mat_brushed_metal")

    # Left & Right Overhead Double-Tier Open Ladder Cable Trays with Visible Lime-Green Cable Looms (X = +/- 0.92m)
    tray_len = hall_l - 1.2
    for tx_sign in (-1.0, 1.0):
        tx = tx_sign * 0.92
        for ty in (3.28, 3.48):
            # Open side rails + open ladder rungs so green cable bundles are clearly visible from below!
            for rail_off in (-0.185, 0.185):
                ceil_mb.add_box(0.016, 0.042, tray_len, center=(tx + rail_off, ty, z_center), material="mat_arch_steel")
            for rung_i in range(30):
                rz_rung = z_center - tray_len * 0.5 + 0.18 + rung_i * (tray_len / 30.0)
                ceil_mb.add_box(0.36, 0.010, 0.020, center=(tx, ty - 0.016, rz_rung), material="mat_arch_steel")
            for c_off in (-0.13, -0.07, -0.01, 0.05, 0.12):
                ceil_mb.add_cylinder(0.015, tray_len - 0.2, segments=8, center=(tx + c_off, ty + 0.004, z_center), axis="z", material="mat_cable_green")
        for bz in (-5.4, -3.0, -0.6, 1.8, 4.2):
            ceil_mb.add_box(0.44, 0.022, 0.028, center=(tx, 3.245, bz), material="mat_powder_coat_medium")
            ceil_mb.add_box(0.44, 0.022, 0.028, center=(tx, 3.445, bz), material="mat_powder_coat_medium")
            ceil_mb.add_cylinder(0.008, 0.92, segments=8, center=(tx - 0.20, 3.72, bz), axis="y", material="mat_arch_steel")
            ceil_mb.add_cylinder(0.008, 0.92, segments=8, center=(tx + 0.20, 3.72, bz), axis="y", material="mat_arch_steel")

    doc.add_node("ceiling_and_cable_trays", mesh_builder=ceil_mb, parent_idx=arch_group)

    # =========================================================================
    # 2. SIX 42U RACKS & 32 SERVERS ALONG THE COLD AISLE (Rack 01 .. Rack 06)
    #    - Left Row (X = -1.98m, facing +X into aisle): Rack 01, Rack 03, Rack 05
    #    - Right Row (X = +1.98m, facing -X into aisle): Rack 02 (HIGHLIGHTED!), Rack 04, Rack 06
    # =========================================================================
    racks_group = doc.add_node("datacenter_racks", parent_idx=scene_root)
    rack_positions = [
        (1, -1.98, 1.20, math.pi * 0.5, False, 6),   # Rack 01 (front-left, 6 servers)
        (2,  1.98, 1.20, -math.pi * 0.5, True, 6),   # Rack 02 (front-right, HIGHLIGHTED, 6 servers)
        (3, -1.98, -0.95, math.pi * 0.5, False, 5),  # Rack 03 (mid-left, 5 servers)
        (4,  1.98, -0.95, -math.pi * 0.5, False, 5), # Rack 04 (mid-right, 5 servers)
        (5, -1.98, -3.10, math.pi * 0.5, False, 5),  # Rack 05 (rear-left, 5 servers)
        (6,  1.98, -3.10, -math.pi * 0.5, False, 5), # Rack 06 (rear-right, 5 servers) => Total = 32 servers!
    ]

    r_h = 2.067
    r_w = 0.600
    r_d = 1.070
    half_w = r_w * 0.5
    half_d = r_d * 0.5
    rail_z = half_d - 0.065

    global_server_counter = 0

    for r_num, rx, rz, ry_yaw, is_highlighted, srv_count in rack_positions:
        qy = math.sin(ry_yaw * 0.5)
        qw = math.cos(ry_yaw * 0.5)
        r_node = doc.add_node(
            f"rack_{r_num:02d}",
            translation=(rx, 0.0, rz),
            rotation=(0.0, qy, 0.0, qw),
            parent_idx=racks_group,
            extras={"rackNumber": r_num, "highlighted": is_highlighted, "serverCount": srv_count},
        )

        rmb = MeshBuilder(f"scene_rack_{r_num:02d}_body")
        # Rack enclosure, side walls, plinth & vertical mounting rails (rails sit strictly behind Z = rail_z so rack ears sit flush in front!)
        rmb.add_beveled_box(r_w, 0.065, r_d, bevel=0.004, center=(0, 0.0325, 0), material="mat_powder_coat_dark")
        rmb.add_beveled_box(r_w, 0.045, r_d, bevel=0.004, center=(0, r_h - 0.0225, 0), material="mat_powder_coat_dark")
        rmb.add_beveled_box(0.025, r_h - 0.11, r_d - 0.04, bevel=0.003, center=(-half_w + 0.0125, r_h * 0.5, 0), material="mat_powder_coat_dark")
        rmb.add_beveled_box(0.025, r_h - 0.11, r_d - 0.04, bevel=0.003, center=(half_w - 0.0125, r_h * 0.5, 0), material="mat_powder_coat_dark")
        rmb.add_box(0.026, r_h - 0.12, 0.028, center=(-0.2325, r_h * 0.5, rail_z - 0.015), material="mat_brushed_metal")
        rmb.add_box(0.026, r_h - 0.12, 0.028, center=(0.2325, r_h * 0.5, rail_z - 0.015), material="mat_brushed_metal")

        # Vertical Rack Nameplate (`RACK 01`..`06`)
        u0 = ((r_num - 1) % 8) * 0.125
        rmb.add_plane(0.048, 0.090, center=(half_w - 0.024, r_h - 0.18, half_d + 0.012), facing="+z", material="mat_rack_nameplate", uv_rect=(u0 + 0.005, 0.005, u0 + 0.120, 0.120))

        # Highlight LED Perimeter Frame (Active on Rack 02!)
        if is_highlighted:
            fw, fh = r_w - 0.018, r_h - 0.08
            fcy, fz = 0.05 + fh * 0.5, half_d + 0.015
            rmb.add_box(fw, 0.010, 0.010, center=(0, fcy + fh * 0.5, fz), material="mat_led_rack_frame")
            rmb.add_box(fw, 0.010, 0.010, center=(0, fcy - fh * 0.5, fz), material="mat_led_rack_frame")
            rmb.add_box(0.010, fh, 0.010, center=(-fw * 0.5, fcy, fz), material="mat_led_rack_frame")
            rmb.add_box(0.010, fh, 0.010, center=(fw * 0.5, fcy, fz), material="mat_led_rack_frame")

        # Full EIA-310 42U layout: every U from 1..42 is assigned exactly once (validated by assert below)
        layout = [
            (1, "pdu", 1), (2, "cable", 1), (3, "storage_3u", 3), (6, "blank", 1),
            (7, "compute_2u", 2), (9, "filler", 2), (11, "filler", 2), (13, "patch", 1),
            (14, "switch", 1), (15, "ai_4u", 4), (19, "blank", 1), (20, "storage_3u", 3),
            (23, "filler", 2), (25, "cable", 1), (26, "patch", 1), (27, "switch", 1),
            (28, "compute_2u", 2), (30, "blank", 1),
        ]
        if srv_count == 6:
            layout.append((31, "ai_4u", 4))
        else:
            layout += [(31, "filler", 2), (33, "filler", 2)]
        layout += [(35, "filler", 2), (37, "filler", 2), (39, "cable", 1), (40, "patch", 1), (41, "switch", 1), (42, "blank", 1)]
        occupied = []
        for u_start, _kind, u_count in layout:
            occupied.extend(range(u_start, u_start + u_count))
        assert sorted(occupied) == list(range(1, 43)), f"Rack {r_num}: fehlerhafte U-Belegung {sorted(occupied)}"

        SERVER_FACE = {"storage_3u": "mat_powder_coat_dark", "compute_2u": "mat_brushed_metal", "ai_4u": "mat_powder_coat_medium"}

        for u_start, kind, u_count in layout:
            if kind in SERVER_FACE:
                continue
            y0 = 0.100 + (u_start - 1) * U_HEIGHT
            hh = u_count * U_HEIGHT - 0.0015
            cy = y0 + hh * 0.5
            if kind in ("switch", "patch", "pdu"):
                body_mat = "mat_powder_coat_medium" if kind == "switch" else "mat_powder_coat_dark"
                rmb.add_beveled_box(RACK_CLEAR_W, hh, 0.30, bevel=0.0015, center=(0, cy, rail_z - 0.15), material=body_mat)
                rmb.add_beveled_box(RACK_19IN_W, hh, 0.006, bevel=0.001, center=(0, cy, rail_z + 0.003), material=body_mat)
                if kind == "pdu":
                    for p_i in range(12):
                        px = -0.170 + p_i * 0.029
                        # IEC C13 outlet: moulded socket body, dark contact recess, per-outlet LED
                        rmb.add_beveled_box(0.020, 0.024, 0.004, bevel=0.0008, center=(px, cy, rail_z + 0.0075), material="mat_plastic_abs")
                        rmb.add_box(0.012, 0.010, 0.002, center=(px, cy, rail_z + 0.0098), material="mat_rubber_epdm")
                        rmb.add_box(0.003, 0.003, 0.003, center=(px + 0.012, cy + 0.009, rail_z + 0.008), material="mat_led_pdu")
                else:
                    for p_i in range(24):
                        col, row = p_i // 2, p_i % 2
                        px = -0.190 + col * 0.0215 + (col // 6) * 0.010
                        py = cy + (row - 0.5) * 0.0165
                        # RJ45 jack: metal shield + dark recess
                        rmb.add_box(0.0165, 0.0140, 0.003, center=(px, py, rail_z + 0.0065), material="mat_brushed_metal")
                        rmb.add_box(0.0120, 0.0095, 0.003, center=(px, py, rail_z + 0.0075), material="mat_rubber_epdm")
                        if kind == "switch":
                            led = "mat_led_port_link" if (p_i + r_num) % 5 != 0 else "mat_led_port_act"
                            rmb.add_box(0.0028, 0.0022, 0.002, center=(px - 0.0055, py + (0.0085 if row else -0.0085), rail_z + 0.0085), material=led)
                    if kind == "switch":
                        # 4x SFP+ uplink cages + system/boot LEDs
                        for s_i in range(4):
                            sx = 0.125 + s_i * 0.018
                            rmb.add_box(0.0145, 0.0105, 0.004, center=(sx, cy, rail_z + 0.007), material="mat_brushed_metal")
                            rmb.add_box(0.0110, 0.0070, 0.004, center=(sx, cy, rail_z + 0.0085), material="mat_rubber_epdm")
                            rmb.add_box(0.003, 0.002, 0.002, center=(sx, cy + 0.0085, rail_z + 0.0085), material="mat_led_activity")
                        rmb.add_box(0.004, 0.004, 0.003, center=(0.205, cy + 0.006, rail_z + 0.0075), material="mat_led_power")
                        rmb.add_box(0.004, 0.004, 0.003, center=(0.205, cy - 0.006, rail_z + 0.0075), material="mat_led_boot")
            elif kind == "cable":
                # 1U horizontal cable manager with brush strip and D-rings (kept inside Z <= rail_z + 0.034, clear of closed door!)
                rmb.add_beveled_box(RACK_19IN_W, hh, 0.006, bevel=0.001, center=(0, cy, rail_z + 0.003), material="mat_powder_coat_dark")
                rmb.add_box(RACK_CLEAR_W - 0.04, hh * 0.45, 0.004, center=(0, cy, rail_z + 0.0075), material="mat_rubber_epdm")
                for ring_i in range(5):
                    rx_ring = -0.17 + ring_i * 0.085
                    rmb.add_tube([
                        (rx_ring - 0.014, cy - 0.010, rail_z + 0.006),
                        (rx_ring - 0.014, cy - 0.010, rail_z + 0.032),
                        (rx_ring + 0.014, cy - 0.010, rail_z + 0.032),
                        (rx_ring + 0.014, cy - 0.010, rail_z + 0.006),
                    ], radius=0.0022, radial_segments=6, material="mat_plastic_abs")
            elif kind == "filler":
                # 2U JBOD / appliance shelf: 6 slim SFF caddies in X=[-0.194..-0.010], grille in X=[+0.018..+0.178], LEDs on right (ZERO collisions!)
                f_mat = "mat_brushed_metal" if (u_start + r_num) % 3 == 0 else "mat_powder_coat_dark"
                rmb.add_beveled_box(RACK_CLEAR_W, hh, 0.60, bevel=0.0015, center=(0, cy, rail_z - 0.30), material="mat_powder_coat_dark")
                rmb.add_beveled_box(RACK_CLEAR_W, hh, 0.014, bevel=0.0015, center=(0, cy, rail_z + 0.007), material=f_mat)
                for e_s in (-1.0, 1.0):
                    rmb.add_beveled_box(0.018, hh, 0.005, bevel=0.0008, center=(e_s * (RACK_19IN_W * 0.5 - 0.009), cy, rail_z + 0.0025), material="mat_brushed_metal")
                rmb.add_box(0.160, hh - 0.016, 0.004, center=(0.098, cy, rail_z + 0.0155), material="mat_vent_grille")
                # Dedicated status LED cluster on top-right of shelf
                rmb.add_box(0.0035, 0.0035, 0.003, center=(0.192, cy + 0.018, rail_z + 0.016), material="mat_led_power")
                rmb.add_box(0.0035, 0.0035, 0.003, center=(0.192, cy + 0.006, rail_z + 0.016), material="mat_led_activity")
                rmb.add_box(0.0035, 0.0035, 0.003, center=(0.192, cy - 0.006, rail_z + 0.016), material="mat_led_fault")
                for c_i in range(6):
                    bx = -0.178 + c_i * 0.030
                    rmb.add_beveled_box(0.026, hh - 0.014, 0.006, bevel=0.0008, center=(bx, cy, rail_z + 0.017), material="mat_plastic_abs")
                    led = "mat_led_drive" if (c_i + u_start + r_num) % 5 != 0 else "mat_led_activity"
                    rmb.add_box(0.0032, 0.0032, 0.0025, center=(bx + 0.007, cy + hh * 0.5 - 0.012, rail_z + 0.0205), material=led)
            else:  # 1U blanking panel
                rmb.add_beveled_box(RACK_19IN_W, hh, 0.004, bevel=0.0008, center=(0, cy, rail_z + 0.002), material="mat_powder_coat_dark")
                for sx in (-0.2325, 0.2325):
                    rmb.add_knurled_screw(center=(sx, cy, rail_z + 0.004), radius=0.0030, depth=0.004)

        # Clean, tight lime-green Cat6A patch cord jumpers from Patch Panels (U40, U26, U13) into Switch above (+1U) & Cable Manager (-1U / left raceway)
        # Kept strictly within Z <= rail_z + 0.042 (well behind the closed door at rail_z + 0.077!) and clear of all server bays!
        for patch_u, has_cable_below in ((40, True), (26, True), (13, False)):
            py_patch = 0.100 + (patch_u - 0.5) * U_HEIGHT
            py_sw = py_patch + U_HEIGHT
            # Short neat vertical U-jumpers between Patch Panel ports and Switch ports right above it
            for j_i in range(8):
                jx = -0.188 + j_i * 0.0215 + (j_i // 6) * 0.010
                jz_arch = rail_z + 0.028 + (j_i % 2) * 0.007
                rmb.add_tube([
                    (jx, py_patch, rail_z + 0.009),
                    (jx, py_patch + 0.006, jz_arch),
                    (jx, py_sw - 0.006, jz_arch),
                    (jx, py_sw, rail_z + 0.009),
                ], radius=0.0030, radial_segments=6, material="mat_cable_green")
            # Left-side horizontal bundle sweeping cleanly into the left vertical raceway (X = -0.252, completely outside 19" server faceplates!)
            for strand in range(6):
                sx_port = -0.190 + strand * 0.016
                sy_target = py_patch - (0.022 if has_cable_below else -0.018) - strand * 0.004
                z_arch = rail_z + 0.032 + (strand % 3) * 0.005
                rmb.add_tube([
                    (sx_port, py_patch - 0.005, rail_z + 0.009),
                    (sx_port - 0.012, py_patch - 0.008, z_arch),
                    (-0.225, (py_patch + sy_target) * 0.5, z_arch),
                    (-0.254, sy_target, rail_z - 0.006),
                ], radius=0.0033, radial_segments=7, material="mat_cable_green")

        # Vertical green cable trunk tucked inside the left Zero-U side channel (X = -0.258..-0.248, outside 19-inch width!)
        for v_strand in (-0.260, -0.253, -0.246):
            rmb.add_cylinder(0.0055, r_h - 0.28, segments=8, center=(v_strand, r_h * 0.5, rail_z - 0.008), axis="y", material="mat_cable_green")

        # 32 individually managed server nodes, taken from the validated 42U layout above (ZERO front collisions!)
        slot_plan = [
            (u, k, n, "mat_powder_coat_dark" if (k == "ai_4u" and u == 31) else SERVER_FACE[k])
            for (u, k, n) in layout if k in SERVER_FACE
        ]

        for s_i, (u_start, s_type, s_u, s_mat) in enumerate(slot_plan):
            global_server_counter += 1
            sy0 = 0.100 + (u_start - 1) * U_HEIGHT
            sh = s_u * U_HEIGHT - 0.002
            scy = sy0 + sh * 0.5

            s_mb = MeshBuilder(f"scene_server_{global_server_counter:02d}")
            s_mb.add_beveled_box(RACK_CLEAR_W - 0.004, sh, 0.68, bevel=0.002, center=(0, 0, -0.34), material="mat_powder_coat_dark")
            s_mb.add_beveled_box(RACK_CLEAR_W - 0.004, sh, 0.015, bevel=0.0018, center=(0, 0, 0.0075), material=s_mat)

            # Rack ears (X = +/-0.232), knurled captive screws & tubular extraction handles (X = +/-0.214, Z <= 0.036)
            for e_sign in (-1.0, 1.0):
                s_mb.add_beveled_box(0.018, sh, 0.005, bevel=0.0008, center=(e_sign * (RACK_19IN_W * 0.5 - 0.009), 0, 0.0025), material="mat_brushed_metal")
                for u_i in range(s_u):
                    s_mb.add_knurled_screw(center=(e_sign * 0.2325, -sh * 0.5 + (u_i + 0.5) * U_HEIGHT, 0.005), radius=0.0032, depth=0.005)
                hx = e_sign * 0.214
                hy = min(sh * 0.30, 0.028)
                s_mb.add_tube([(hx, -hy, 0.014), (hx, -hy, 0.035), (hx, hy, 0.035), (hx, hy, 0.014)], radius=0.0036, radial_segments=8, material="mat_brushed_metal")

            # Right-side status LED column (X = +0.192: Power, Activity, Dedicated Fault LED, Boot LED) — clean separation from grille!
            s_mb.add_cylinder(0.0044, 0.0035, segments=12, center=(0.192, sh * 0.5 - 0.012, 0.0165), axis="z", material="mat_brushed_metal")
            s_mb.add_cylinder(0.0028, 0.0042, segments=10, center=(0.192, sh * 0.5 - 0.012, 0.0170), axis="z", material="mat_led_power")
            s_mb.add_box(0.0038, 0.0038, 0.0035, center=(0.192, sh * 0.5 - 0.024, 0.0170), material="mat_led_activity")
            s_mb.add_box(0.0042, 0.0042, 0.0038, center=(0.192, sh * 0.5 - 0.035, 0.0170), material="mat_led_fault")
            s_mb.add_box(0.0038, 0.0038, 0.0035, center=(0.192, sh * 0.5 - 0.046, 0.0170), material="mat_led_boot")

            # Ventilation grille strictly in X = [+0.052 .. +0.174] (center = +0.113, width = 0.122)
            s_mb.add_beveled_box(0.122, sh - 0.016, 0.005, bevel=0.001, center=(0.113, 0, 0.017), material="mat_vent_grille")

            if s_type == "ai_4u":
                # 4 GPU sled faces in X = [-0.194 .. +0.038] (gx = -0.168, -0.108, -0.048, +0.012, width = 0.052 -> zero overlap with grille at +0.052!)
                for g in range(4):
                    gx = -0.168 + g * 0.060
                    s_mb.add_beveled_box(0.052, sh - 0.020, 0.008, bevel=0.001, center=(gx, 0, 0.0185), material="mat_powder_coat_dark")
                    s_mb.add_box(0.036, sh - 0.042, 0.004, center=(gx - 0.004, 0, 0.023), material="mat_heatsink_metal")
                    load = 0.50 + 0.45 * (((g + r_num * 3) % 5) / 4.0)
                    bar_h = (sh - 0.044) * load
                    s_mb.add_box(0.0045, bar_h, 0.0035, center=(gx + 0.019, -(sh - 0.044) * 0.5 + bar_h * 0.5, 0.0235), material="mat_led_gpu_load")
            else:
                # 4 columns of drive bays strictly in X = [-0.194 .. +0.038] (bx = -0.168, -0.108, -0.048, +0.012, width = 0.052 -> 14mm clear of grille!)
                rows = min(3, s_u)
                row_pitch = 0.034 if rows == 2 else 0.036
                for r_idx in range(rows):
                    by = (r_idx - (rows - 1) * 0.5) * row_pitch
                    for c_idx in range(4):
                        bx = -0.168 + c_idx * 0.060
                        s_mb.add_beveled_box(0.052, 0.026, 0.008, bevel=0.001, center=(bx, by, 0.0185), material="mat_plastic_abs")
                        s_mb.add_box(0.024, 0.016, 0.003, center=(bx - 0.009, by, 0.023), material="mat_vent_grille")
                        s_mb.add_box(0.009, 0.018, 0.0035, center=(bx + 0.012, by, 0.023), material="mat_brushed_metal")
                        # Healthy online drives use mat_led_drive or mat_led_activity (NEVER mat_led_fault on healthy caddies!)
                        led_m = "mat_led_drive" if (c_idx + r_idx + r_num) % 4 != 0 else "mat_led_activity"
                        s_mb.add_box(0.0035, 0.0035, 0.003, center=(bx + 0.020, by + 0.006, 0.0235), material=led_m)

            doc.add_node(
                f"server_{global_server_counter:02d}_{s_type}",
                mesh_builder=s_mb,
                translation=(0.0, scy, rail_z),
                parent_idx=r_node,
                extras={"serverId": f"server-{global_server_counter:02d}", "variant": s_type, "unitsU": s_u},
            )

        doc.add_node(f"rack_{r_num:02d}_structure", mesh_builder=rmb, parent_idx=r_node)

        # Animatable Perforated Front Door (`rack_door_front`) with complete 4-sided frame & hinge pivot at left edge
        door_mb = MeshBuilder(f"scene_rack_{r_num:02d}_door_front")
        dw, dh = r_w - 0.036, r_h - 0.115
        dx_c = dw * 0.5
        door_mb.add_beveled_box(0.042, dh, 0.020, bevel=0.002, center=(dx_c - dw * 0.5 + 0.021, 0, 0), material="mat_powder_coat_dark")
        door_mb.add_beveled_box(0.042, dh, 0.020, bevel=0.002, center=(dx_c + dw * 0.5 - 0.021, 0, 0), material="mat_powder_coat_dark")
        door_mb.add_beveled_box(dw - 0.084, 0.042, 0.020, bevel=0.002, center=(dx_c, dh * 0.5 - 0.021, 0), material="mat_powder_coat_dark")
        door_mb.add_beveled_box(dw - 0.084, 0.042, 0.020, bevel=0.002, center=(dx_c, -dh * 0.5 + 0.021, 0), material="mat_powder_coat_dark")
        door_mb.add_plane(dw - 0.084, dh - 0.084, center=(dx_c, 0, 0.002), facing="+z", material="mat_perforated_door", uv_rect=(0.0, 0.0, 1.2, 4.2))
        door_mb.add_beveled_box(0.022, 0.18, 0.018, bevel=0.002, center=(dw - 0.022, 0.0, 0.018), material="mat_brushed_metal")
        doc.add_node(
            f"rack_{r_num:02d}_door_front",
            mesh_builder=door_mb,
            translation=(-dw * 0.5, 0.068 + dh * 0.5, half_d + 0.012),
            parent_idx=r_node,
            extras={"animatable": True, "pivotType": "hinge_y"},
        )

    assert global_server_counter == 32, f"Erwartet 32 Server, erzeugt: {global_server_counter}"

    # =========================================================================
    # 3. COOLING UNITS (CRAC) & OPERATOR STATIONS (3-Monitor Console Desk & Wall Terminal)
    # =========================================================================
    equip_group = doc.add_node("cooling_and_stations", parent_idx=scene_root)

    # Two Precision CRAC Cooling Units at the rear sides of the hall
    for crac_i, (cx, ry) in enumerate(((-2.95, math.pi * 0.5), (2.95, -math.pi * 0.5)), start=1):
        qy, qw = math.sin(ry * 0.5), math.cos(ry * 0.5)
        c_node = doc.add_node(f"crac_cooling_unit_{crac_i:02d}", translation=(cx, 0.0, -5.20), rotation=(0, qy, 0, qw), parent_idx=equip_group)
        cmb = MeshBuilder(f"scene_crac_{crac_i:02d}")
        cmb.add_beveled_box(0.90, 2.10, 0.85, bevel=0.004, center=(0, 1.05, 0), material="mat_powder_coat_dark")
        cmb.add_box(0.80, 1.38, 0.02, center=(0, 0.95, 0.43), material="mat_vent_grille")
        doc.add_node(f"crac_{crac_i:02d}_body", mesh_builder=cmb, parent_idx=c_node)
        for f_i, fy in enumerate((0.52, 0.95, 1.38), start=1):
            fmb = MeshBuilder(f"scene_crac_{crac_i:02d}_fan_{f_i:02d}")
            fmb.add_fan_rotor(0.145, 0.032, blade_count=7)
            doc.add_node(f"crac_{crac_i:02d}_fan_{f_i:02d}", mesh_builder=fmb, translation=(0, fy, 0.44), parent_idx=c_node, extras={"animatable": True, "spinAxis": "z"})

    # Industrial 3-Monitor Operator Console Desk at the front of the hall (Z = 3.55m, facing -Z down the aisle)
    desk_node = doc.add_node("operator_console_desk", translation=(0.0, 0.0, 3.85), rotation=(0, 1, 0, 0), parent_idx=equip_group)
    dmb = MeshBuilder("scene_console_desk")
    dmb.add_beveled_box(2.20, 0.045, 0.84, bevel=0.004, center=(0, 0.75, 0), material="mat_powder_coat_dark")
    dmb.add_beveled_box(1.90, 0.72, 0.12, bevel=0.003, center=(0, 0.36, -0.18), material="mat_powder_coat_medium")
    dmb.add_beveled_box(0.44, 0.022, 0.15, bevel=0.002, center=(-0.06, 0.78, 0.18), material="mat_plastic_abs")
    dmb.add_beveled_box(0.064, 0.032, 0.11, bevel=0.005, center=(0.34, 0.78, 0.18), material="mat_plastic_abs")
    for m_i, mx in enumerate((-0.66, 0.0, 0.66), start=1):
        dmb.add_beveled_box(0.60, 0.36, 0.028, bevel=0.003, center=(mx, 1.12, -0.06), material="mat_plastic_abs")
        dmb.add_plane(0.57, 0.33, center=(mx, 1.12, -0.044), facing="+z", material=f"mat_monitor_screen_0{m_i}", uv_rect=(0.0, 0.0, 1.0, 1.0))
    doc.add_node("console_desk_mesh", mesh_builder=dmb, parent_idx=desk_node)

    # Wall-Mounted Maintenance & Backup Terminal on the side/rear wall
    term_node = doc.add_node("wall_terminal_maintenance", translation=(3.42, 1.55, -5.20), rotation=(0, -math.sqrt(0.5), 0, math.sqrt(0.5)), parent_idx=equip_group)
    tmb = MeshBuilder("scene_wall_terminal")
    tmb.add_beveled_box(1.15, 0.88, 0.16, bevel=0.004, center=(0, 0, 0.08), material="mat_powder_coat_dark")
    tmb.add_plane(0.84, 0.52, center=(0, 0.08, 0.165), facing="+z", material="mat_terminal_screen", uv_rect=(0.0, 0.0, 1.0, 1.0))
    doc.add_node("wall_terminal_mesh", mesh_builder=tmb, parent_idx=term_node)

    return doc


def export_example_scene(base_dir):
    doc = build_datacenter_example_scene()
    out_glb = os.path.join(base_dir, "scenes", "root_datacenter_scene.glb")
    out_gltf = os.path.join(base_dir, "source", "gltf", "root_datacenter_scene.gltf")
    info = doc.export_glb(out_glb, texture_rel_prefix="../textures")
    doc.export_gltf(out_gltf, texture_rel_prefix="../../textures")
    print(f"  [OK] Exported scenes/root_datacenter_scene.glb ({info['size_kb']} KB, {info['nodes']} nodes)")
    return ("root_datacenter_scene", doc, info)


if __name__ == "__main__":
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    export_example_scene(base)
