#!/usr/bin/env python3
"""
ROOT 3D Asset Package — Network & Power Assets Builder (Category 3)
Generates:
  - assets/network_power/switch_8port.glb
  - assets/network_power/switch_16port.glb
  - assets/network_power/patch_panel_24port.glb
  - assets/network_power/cable_management_1u.glb
  - assets/network_power/rack_pdu.glb
  - assets/network_power/connector_rj45.glb
  - assets/network_power/connector_power_iec.glb
"""

import os
from gltf_builder import MeshBuilder, GltfAssetDocument
from build_racks_and_servers import U_HEIGHT, RACK_19IN_W, RACK_CLEAR_W, RACK_RAIL_HOLE_X


def _add_rj45_jack_detail(mb, cx, cy, cz, facing="+z"):
    """Adds a detailed shielded RJ45 jack with recessed cavity, locking tab notch, and gold contact pins."""
    sign = 1.0 if facing == "+z" else -1.0
    # Outer shielded metal housing
    mb.add_box(0.0155, 0.0135, 0.014, center=(cx, cy, cz - sign * 0.005), material="mat_brushed_metal")
    # Dark inner port cavity + top latch notch
    mb.add_box(0.0120, 0.0096, 0.008, center=(cx, cy - 0.0006, cz - sign * 0.001), material="mat_plastic_abs")
    mb.add_box(0.0046, 0.0028, 0.008, center=(cx, cy + 0.0044, cz - sign * 0.001), material="mat_plastic_abs")
    # Gold contact pins row inside cavity
    mb.add_box(0.0088, 0.0014, 0.004, center=(cx, cy - 0.0032, cz), material="mat_gold_contacts")


def _add_iec_c13_outlet_detail(mb, cx, cy, cz, facing="+z"):
    """Adds a detailed IEC C13 power outlet receptacle with 3 contact slots (L, N, PE)."""
    sign = 1.0 if facing == "+z" else -1.0
    mb.add_beveled_box(0.028, 0.021, 0.014, bevel=0.0015, center=(cx, cy, cz - sign * 0.004), material="mat_plastic_abs")
    mb.add_box(0.022, 0.015, 0.006, center=(cx, cy, cz + sign * 0.001), material="mat_rubber_epdm")
    # 3 contact brass terminals inside C13 socket
    for px, py in ((cx - 0.0065, cy - 0.0025), (cx + 0.0065, cy - 0.0025), (cx, cy + 0.0035)):
        mb.add_box(0.0022, 0.0045, 0.004, center=(px, py, cz + sign * 0.002), material="mat_gold_contacts")


def build_rack_switch(port_count=16):
    """Builds an 8-port (`switch_8port`) or 16-port (`switch_16port`) 1U managed rack switch."""
    name = f"switch_{port_count}port"
    uplink_count = 2 if port_count == 8 else 4
    h = U_HEIGHT - 0.0015
    body_w = RACK_CLEAR_W - 0.004
    face_w = RACK_19IN_W
    depth = 0.280 if port_count == 8 else 0.340

    doc = GltfAssetDocument(name, {
        "category": "network_switch",
        "rj45Ports": port_count,
        "uplinkPorts": uplink_count,
        "unitsU": 1,
        "dimensionsM": [face_w, round(h, 4), depth],
    })
    root = doc.add_node(name, extras={
        "assetType": "switch",
        "portCount": port_count,
        "uplinkCount": uplink_count,
        "unitsU": 1,
    })
    lod0 = doc.add_node("LOD0", parent_idx=root, extras={"lodLevel": 0})
    ports_parent = doc.add_node("connection_ports", parent_idx=root)

    sw_mb = MeshBuilder(f"{name}_chassis_LOD0")
    sw_mb.add_beveled_box(body_w, h, depth, bevel=0.002, center=(0, h * 0.5, -depth * 0.5), material="mat_powder_coat_dark")
    sw_mb.add_beveled_box(body_w, h, 0.014, bevel=0.0018, center=(0, h * 0.5, 0.007), material="mat_powder_coat_medium")

    # Rack mounting ears & screws
    for sign in (-1.0, 1.0):
        sw_mb.add_beveled_box(0.018, h, 0.005, bevel=0.001, center=(sign * (face_w * 0.5 - 0.009), h * 0.5, 0.0025), material="mat_brushed_metal")
        sw_mb.add_cylinder(0.0038, 0.008, segments=10, center=(sign * RACK_RAIL_HOLE_X, h * 0.5, 0.005), axis="z", material="mat_brushed_metal")
        # Side intake mesh
        sw_mb.add_box(0.004, h * 0.65, depth * 0.60, center=(sign * (body_w * 0.5 + 0.001), h * 0.5, -depth * 0.45), material="mat_vent_grille")

    # Console RJ45 port on left side (X = -0.162, clear of LEDs at -0.204 and RJ45 port 1 at -0.124)
    _add_rj45_jack_detail(sw_mb, -0.162, h * 0.36, 0.014, facing="+z")
    doc.add_attachment_point("port_console_01", position=(-0.162, h * 0.36, 0.016), normal=(0, 0, 1), connector_type="rj45_console", parent_idx=ports_parent)

    # RJ45 Access Ports (`port_network_01` .. `port_network_XX`) and per-port Link/Activity LEDs
    leds_parent = doc.add_node("port_leds", parent_idx=lod0)
    start_x = -0.118 if port_count == 8 else -0.124
    spacing_x = 0.0195 if port_count == 8 else 0.0150
    for p in range(1, port_count + 1):
        group_gap = ((p - 1) // 4) * 0.005
        px = start_x + (p - 1) * spacing_x + group_gap
        py = h * 0.40
        _add_rj45_jack_detail(sw_mb, px, py, 0.014, facing="+z")

        doc.add_attachment_point(
            f"port_network_{p:02d}",
            position=(px, py, 0.016),
            normal=(0.0, 0.0, 1.0),
            connector_type="rj45",
            parent_idx=ports_parent,
            extra_meta={"portIndex": p, "speedGbps": 1 if port_count == 8 else 2.5},
        )

        # Separate controllable Link & Activity LEDs per port
        l_mb = MeshBuilder(f"{name}_led_link_{p:02d}")
        l_mb.add_box(0.0032, 0.0025, 0.003, center=(0, 0, 0), material="mat_led_port_link")
        doc.add_node(f"led_link_{p:02d}", mesh_builder=l_mb, translation=(px - 0.0038, py + 0.0095, 0.015), parent_idx=leds_parent, extras={"controllableLed": True, "portIndex": p})

        a_mb = MeshBuilder(f"{name}_led_act_{p:02d}")
        a_mb.add_box(0.0032, 0.0025, 0.003, center=(0, 0, 0), material="mat_led_port_act")
        doc.add_node(f"led_act_{p:02d}", mesh_builder=a_mb, translation=(px + 0.0038, py + 0.0095, 0.015), parent_idx=leds_parent, extras={"controllableLed": True, "portIndex": p})

    # SFP+ Uplink Cage Ports (`port_uplink_01` .. `04`) on the right side (X = 0.144..0.195, zero collision with port 16 at 0.116!)
    uplink_base_x = 0.144
    for u_idx in range(1, uplink_count + 1):
        ux = uplink_base_x + (u_idx - 1) * 0.0170
        uy = h * 0.40
        sw_mb.add_box(0.0145, 0.0115, 0.016, center=(ux, uy, 0.008), material="mat_brushed_metal")
        sw_mb.add_box(0.0115, 0.0085, 0.010, center=(ux, uy, 0.012), material="mat_plastic_abs")
        doc.add_attachment_point(
            f"port_uplink_{u_idx:02d}",
            position=(ux, uy, 0.016),
            normal=(0.0, 0.0, 1.0),
            connector_type="sfp_plus_uplink",
            parent_idx=ports_parent,
            extra_meta={"uplinkIndex": u_idx, "speedGbps": 10},
        )
        ul_mb = MeshBuilder(f"{name}_led_uplink_{u_idx:02d}")
        ul_mb.add_box(0.0035, 0.0025, 0.003, center=(0, 0, 0), material="mat_led_activity")
        doc.add_node(f"led_uplink_{u_idx:02d}", mesh_builder=ul_mb, translation=(ux, uy + 0.0088, 0.015), parent_idx=leds_parent, extras={"controllableLed": True})

    # System Power & Fault LEDs at X = -0.204 (clear of label at [-0.194..-0.138])
    for sys_name, sys_mat, sy in (("led_power", "mat_led_power", h * 0.68), ("led_fault", "mat_led_fault", h * 0.32)):
        s_mb = MeshBuilder(f"{name}_{sys_name}")
        s_mb.add_cylinder(0.0026, 0.004, segments=8, center=(0, 0, 0), axis="z", material=sys_mat)
        doc.add_node(sys_name, mesh_builder=s_mb, translation=(-0.204, sy, 0.015), parent_idx=leds_parent, extras={"controllableLed": True})

    # Rear IEC C14 Power Socket(s) (`port_power_01`..`02`) & Rear Fans (`switch_fan_01`..`02`)
    psu_num = 1 if port_count == 8 else 2
    for p_i in range(1, psu_num + 1):
        p_x = 0.145 - (p_i - 1) * 0.065
        _add_iec_c13_outlet_detail(sw_mb, p_x, h * 0.5, -depth, facing="-z")
        doc.add_attachment_point(
            f"port_power_{p_i:02d}",
            position=(p_x, h * 0.5, -depth - 0.002),
            normal=(0.0, 0.0, -1.0),
            connector_type="iec_c14_power",
            parent_idx=ports_parent,
            extra_meta={"psuIndex": p_i},
        )

    doc.add_node("switch_chassis", mesh_builder=sw_mb, parent_idx=lod0)

    # Rear Axial Cooling Fans
    for f_i in range(1, 3):
        fx = -0.12 + (f_i - 1) * 0.075
        f_mb = MeshBuilder(f"{name}_fan_{f_i:02d}")
        f_mb.add_fan_rotor(outer_radius=0.016, depth=0.018, blade_count=7)
        doc.add_node(f"server_fan_{f_i:02d}", mesh_builder=f_mb, translation=(fx, h * 0.5, -depth + 0.015), parent_idx=lod0, extras={"animatable": True, "spinAxis": "z"})

    # Replaceable Label Surface (`label_model`) above console port (X in [-0.194..-0.138], Y in [0.031..0.039])
    lbl_u0 = 0.0 if port_count == 8 else 0.25
    lbl_mb = MeshBuilder(f"{name}_label_model")
    lbl_mb.add_plane(0.056, 0.008, center=(0, 0, 0), facing="+z", material="mat_label_model", uv_rect=(lbl_u0 + 0.005, 0.380, lbl_u0 + 0.245, 0.495))
    doc.add_node("label_model", mesh_builder=lbl_mb, translation=(-0.166, h - 0.007, 0.015), parent_idx=lod0, extras={"dynamicSurface": "label_model"})

    # LOD1 & Collider
    mb1 = MeshBuilder(f"{name}_LOD1_mesh")
    mb1.add_box(body_w, h, depth, center=(0, h * 0.5, -depth * 0.5), material="mat_powder_coat_dark")
    mb1.add_box(face_w, h, 0.014, center=(0, h * 0.5, 0.007), material="mat_powder_coat_medium")
    doc.add_node("LOD1", mesh_builder=mb1, parent_idx=root, extras={"lodLevel": 1})

    col_mb = MeshBuilder(f"collider_{name}_mesh")
    col_mb.add_box(face_w, h, depth + 0.016, center=(0, h * 0.5, -depth * 0.5 + 0.008), material="mat_collider")
    doc.add_node(f"collider_{name}", mesh_builder=col_mb, parent_idx=root, extras={"isCollider": True})
    return doc


def build_patch_panel_24port():
    """Builds a 1U 24-Port Cat6A Keystone Patch Panel (`patch_panel_24port.glb`)."""
    name = "patch_panel_24port"
    h = U_HEIGHT - 0.0015
    face_w = RACK_19IN_W
    body_w = RACK_CLEAR_W - 0.004
    depth = 0.095

    doc = GltfAssetDocument(name, {
        "category": "patch_panel",
        "ports": 24,
        "unitsU": 1,
        "dimensionsM": [face_w, round(h, 4), depth],
    })
    root = doc.add_node(name, extras={"assetType": "patch_panel", "portCount": 24, "unitsU": 1})
    lod0 = doc.add_node("LOD0", parent_idx=root, extras={"lodLevel": 0})
    ports_parent = doc.add_node("connection_ports", parent_idx=root)

    pp_mb = MeshBuilder(f"{name}_LOD0_mesh")
    pp_mb.add_beveled_box(face_w, h, 0.010, bevel=0.0015, center=(0, h * 0.5, 0.005), material="mat_powder_coat_dark")
    # Rear cable management strain-relief support bar
    pp_mb.add_box(0.012, 0.018, depth, center=(-body_w * 0.5 + 0.008, h * 0.35, -depth * 0.5), material="mat_brushed_metal")
    pp_mb.add_box(0.012, 0.018, depth, center=(body_w * 0.5 - 0.008, h * 0.35, -depth * 0.5), material="mat_brushed_metal")
    pp_mb.add_beveled_box(body_w, 0.014, 0.014, bevel=0.002, center=(0, h * 0.35, -depth + 0.008), material="mat_brushed_metal")

    # 24 Keystone RJ45 Ports in 4 groups of 6
    for p in range(1, 25):
        grp = (p - 1) // 6
        idx_in_grp = (p - 1) % 6
        px = -0.198 + grp * 0.104 + idx_in_grp * 0.0155
        py = h * 0.42
        _add_rj45_jack_detail(pp_mb, px, py, 0.011, facing="+z")
        # Rear IDC punch-down block
        pp_mb.add_box(0.013, 0.022, 0.018, center=(px, py, -0.010), material="mat_plastic_abs")

        doc.add_attachment_point(
            f"port_patch_{p:02d}",
            position=(px, py, 0.013),
            normal=(0.0, 0.0, 1.0),
            connector_type="rj45_patch",
            parent_idx=ports_parent,
            extra_meta={"portIndex": p},
        )

    doc.add_node("patch_panel_body", mesh_builder=pp_mb, parent_idx=lod0)

    # Replaceable Port Legend Strip (`label_model`)
    lbl_mb = MeshBuilder(f"{name}_label_strip")
    lbl_mb.add_plane(0.410, 0.008, center=(0, 0, 0), facing="+z", material="mat_label_model", uv_rect=(0.505, 0.380, 0.745, 0.495))
    doc.add_node("label_model", mesh_builder=lbl_mb, translation=(0, h - 0.007, 0.011), parent_idx=lod0, extras={"dynamicSurface": "label_model"})

    mb1 = MeshBuilder(f"{name}_LOD1_mesh")
    mb1.add_box(face_w, h, 0.016, center=(0, h * 0.5, 0.004), material="mat_powder_coat_dark")
    doc.add_node("LOD1", mesh_builder=mb1, parent_idx=root, extras={"lodLevel": 1})

    col_mb = MeshBuilder(f"collider_{name}_mesh")
    col_mb.add_box(face_w, h, depth + 0.012, center=(0, h * 0.5, -depth * 0.5 + 0.006), material="mat_collider")
    doc.add_node(f"collider_{name}", mesh_builder=col_mb, parent_idx=root, extras={"isCollider": True})
    return doc


def build_cable_management_1u():
    """Builds a 1U Horizontal Finger-Duct Cable Organizer (`cable_management_1u.glb`) with removable cover."""
    name = "cable_management_1u"
    h = U_HEIGHT - 0.0015
    face_w = RACK_19IN_W
    duct_w = RACK_CLEAR_W - 0.006
    duct_d = 0.072

    doc = GltfAssetDocument(name, {
        "category": "cable_management",
        "unitsU": 1,
        "dimensionsM": [face_w, round(h, 4), duct_d],
    })
    root = doc.add_node(name, extras={"assetType": "cable_management", "unitsU": 1})
    lod0 = doc.add_node("LOD0", parent_idx=root, extras={"lodLevel": 0})

    cm_mb = MeshBuilder(f"{name}_base_LOD0")
    cm_mb.add_beveled_box(face_w, h, 0.006, bevel=0.001, center=(0, h * 0.5, 0.003), material="mat_powder_coat_dark")
    # Slotted top & bottom cable finger rows (18 fingers along width)
    for fi in range(18):
        fx = -duct_w * 0.5 + 0.014 + fi * (duct_w - 0.028) / 17.0
        for fy in (0.005, h - 0.005):
            cm_mb.add_box(0.011, 0.006, duct_d, center=(fx, fy, 0.006 + duct_d * 0.5), material="mat_plastic_abs")
        # Vertical T-tips at front of fingers
        cm_mb.add_box(0.014, 0.014, 0.005, center=(fx, 0.009, 0.006 + duct_d), material="mat_plastic_abs")
        cm_mb.add_box(0.014, 0.014, 0.005, center=(fx, h - 0.009, 0.006 + duct_d), material="mat_plastic_abs")
    doc.add_node("cable_duct_body", mesh_builder=cm_mb, parent_idx=lod0)

    # Separate Removable Snap-On Front Cover (`cable_cover`)
    cov_mb = MeshBuilder(f"{name}_cover_LOD0")
    cov_mb.add_beveled_box(duct_w, h - 0.004, 0.008, bevel=0.0015, center=(0, 0, 0), material="mat_powder_coat_medium")
    cov_mb.add_box(duct_w - 0.04, 0.010, 0.004, center=(0, 0, 0.005), material="mat_brushed_metal")
    doc.add_node(
        "cable_cover",
        mesh_builder=cov_mb,
        translation=(0, h * 0.5, 0.008 + duct_d),
        parent_idx=lod0,
        extras={"removable": True, "animatable": True, "pivotType": "slide_z"},
    )

    # Cable routing guide attachment points
    guides = doc.add_node("cable_guides", parent_idx=root)
    for gi in range(1, 9):
        gx = -0.18 + (gi - 1) * (0.36 / 7.0)
        doc.add_attachment_point(f"port_guide_{gi:02d}", position=(gx, h * 0.5, 0.006 + duct_d * 0.5), normal=(0, 0, 1), connector_type="cable_waypoint", parent_idx=guides)

    mb1 = MeshBuilder(f"{name}_LOD1_mesh")
    mb1.add_box(face_w, h, duct_d, center=(0, h * 0.5, duct_d * 0.5), material="mat_powder_coat_dark")
    doc.add_node("LOD1", mesh_builder=mb1, parent_idx=root, extras={"lodLevel": 1})

    col_mb = MeshBuilder(f"collider_{name}_mesh")
    col_mb.add_box(face_w, h, duct_d + 0.01, center=(0, h * 0.5, duct_d * 0.5), material="mat_collider")
    doc.add_node(f"collider_{name}", mesh_builder=col_mb, parent_idx=root, extras={"isCollider": True})
    return doc


def build_rack_pdu():
    """Builds a 1U 16-Outlet Metered Rack PDU (`rack_pdu.glb`) with C13 sockets, outlet LEDs, and load display."""
    name = "rack_pdu"
    h = U_HEIGHT - 0.0015
    face_w = RACK_19IN_W
    body_w = RACK_CLEAR_W - 0.004
    depth = 0.115

    doc = GltfAssetDocument(name, {
        "category": "power_pdu",
        "outlets": 16,
        "unitsU": 1,
        "dimensionsM": [face_w, round(h, 4), depth],
    })
    root = doc.add_node(name, extras={"assetType": "pdu", "outletCount": 16, "unitsU": 1})
    lod0 = doc.add_node("LOD0", parent_idx=root, extras={"lodLevel": 0})
    ports_parent = doc.add_node("connection_ports", parent_idx=root)
    leds_parent = doc.add_node("pdu_leds", parent_idx=lod0)

    pdu_mb = MeshBuilder(f"{name}_body_LOD0")
    pdu_mb.add_beveled_box(body_w, h, depth, bevel=0.002, center=(0, h * 0.5, -depth * 0.5), material="mat_powder_coat_dark")
    pdu_mb.add_beveled_box(face_w, h, 0.010, bevel=0.0015, center=(0, h * 0.5, 0.005), material="mat_powder_coat_medium")

    # Left: Digital Load Meter Display (`pdu_display`) & Breaker Switch (`pdu_breaker`)
    disp_mb = MeshBuilder(f"{name}_display")
    disp_mb.add_beveled_box(0.052, 0.024, 0.006, bevel=0.001, center=(0, 0, 0), material="mat_plastic_abs")
    disp_mb.add_plane(0.044, 0.016, center=(0, 0, 0.0035), facing="+z", material="mat_led_power")
    doc.add_node("pdu_display", mesh_builder=disp_mb, translation=(-0.182, h * 0.5, 0.012), parent_idx=lod0, extras={"controllableLed": True})

    # Breaker rocker switch (non-LED mechanical switch!)
    brk_mb = MeshBuilder(f"{name}_breaker")
    brk_mb.add_beveled_box(0.018, 0.022, 0.010, bevel=0.0015, center=(0, 0, 0), material="mat_plastic_latch")
    doc.add_node("pdu_breaker", mesh_builder=brk_mb, translation=(-0.138, h * 0.5, 0.012), parent_idx=lod0, extras={"animatable": True, "pivotType": "rocker_x"})

    # 16 IEC C13 Power Outlets (`port_power_out_01`..`16`) + per-outlet LEDs (`led_pdu_01`..`16`)
    for o_idx in range(1, 17):
        ox = -0.105 + (o_idx - 1) * 0.0195
        oy = h * 0.44
        # Compact vertical C13 outlet
        pdu_mb.add_beveled_box(0.0165, 0.022, 0.012, bevel=0.001, center=(ox, oy, 0.008), material="mat_plastic_abs")
        pdu_mb.add_box(0.0125, 0.016, 0.006, center=(ox, oy, 0.012), material="mat_rubber_epdm")
        for py_off in (-0.004, 0.0, 0.004):
            pdu_mb.add_box(0.004, 0.0018, 0.004, center=(ox, oy + py_off, 0.013), material="mat_gold_contacts")

        doc.add_attachment_point(
            f"port_power_out_{o_idx:02d}",
            position=(ox, oy, 0.016),
            normal=(0.0, 0.0, 1.0),
            connector_type="iec_c13_outlet",
            parent_idx=ports_parent,
            extra_meta={"outletIndex": o_idx, "maxAmps": 10},
        )

        ol_mb = MeshBuilder(f"{name}_led_pdu_{o_idx:02d}")
        ol_mb.add_cylinder(0.0020, 0.003, segments=8, center=(0, 0, 0), axis="z", material="mat_led_pdu")
        doc.add_node(f"led_pdu_{o_idx:02d}", mesh_builder=ol_mb, translation=(ox, h - 0.007, 0.012), parent_idx=leds_parent, extras={"controllableLed": True, "outletIndex": o_idx})

    # Rear Heavy-Duty Input Feed Gland (`port_power_in_01`)
    pdu_mb.add_cylinder(0.014, 0.028, segments=12, center=(-0.16, h * 0.5, -depth - 0.012), axis="z", material="mat_rubber_epdm")
    doc.add_attachment_point("port_power_in_01", position=(-0.16, h * 0.5, -depth - 0.026), normal=(0, 0, -1), connector_type="iec_60309_feed", parent_idx=ports_parent)

    doc.add_node("pdu_chassis", mesh_builder=pdu_mb, parent_idx=lod0)

    mb1 = MeshBuilder(f"{name}_LOD1_mesh")
    mb1.add_box(face_w, h, depth, center=(0, h * 0.5, -depth * 0.5), material="mat_powder_coat_dark")
    doc.add_node("LOD1", mesh_builder=mb1, parent_idx=root, extras={"lodLevel": 1})

    col_mb = MeshBuilder(f"collider_{name}_mesh")
    col_mb.add_box(face_w, h, depth + 0.016, center=(0, h * 0.5, -depth * 0.5 + 0.008), material="mat_collider")
    doc.add_node(f"collider_{name}", mesh_builder=col_mb, parent_idx=root, extras={"isCollider": True})
    return doc


def build_connector_rj45():
    """
    Standalone RJ45 Ethernet Patch Connector (`connector_rj45.glb`).
    Origin (0, 0, 0) at nose insertion tip (+Z into jack); cable exits at `attach_cable_end` (0, 0, -0.038).
    """
    name = "connector_rj45"
    doc = GltfAssetDocument(name, {
        "category": "cable_connector",
        "connectorType": "rj45",
        "dimensionsM": [0.014, 0.014, 0.038],
    })
    root = doc.add_node(name, extras={"assetType": "connector", "connectorType": "rj45"})

    mb0 = MeshBuilder(f"{name}_LOD0_mesh")
    # Shielded RJ45 plug body & 8 gold contact blades
    mb0.add_beveled_box(0.0116, 0.0082, 0.014, bevel=0.0008, center=(0, 0, -0.007), material="mat_brushed_metal")
    mb0.add_box(0.0092, 0.0020, 0.008, center=(0, -0.0032, -0.004), material="mat_gold_contacts")
    # Locking tab clip & snagless boot hood on top (+Y)
    mb0.add_box(0.0042, 0.0032, 0.012, center=(0, 0.0055, -0.008), material="mat_plastic_abs")
    # Molded lime-green snagless strain-relief boot
    mb0.add_beveled_box(0.0132, 0.0108, 0.016, bevel=0.0015, center=(0, 0, -0.020), material="mat_cable_green")
    mb0.add_cylinder(0.0036, 0.012, segments=10, center=(0, 0, -0.033), axis="z", material="mat_cable_green")
    doc.add_node("LOD0", mesh_builder=mb0, parent_idx=root, extras={"lodLevel": 0})

    mb1 = MeshBuilder(f"{name}_LOD1_mesh")
    mb1.add_box(0.013, 0.010, 0.036, center=(0, 0, -0.018), material="mat_cable_green")
    doc.add_node("LOD1", mesh_builder=mb1, parent_idx=root, extras={"lodLevel": 1})

    doc.add_attachment_point("attach_cable_end", position=(0.0, 0.0, -0.038), normal=(0.0, 0.0, -1.0), connector_type="cable_tail", parent_idx=root)

    col_mb = MeshBuilder(f"collider_{name}_mesh")
    col_mb.add_box(0.014, 0.012, 0.038, center=(0, 0, -0.019), material="mat_collider")
    doc.add_node(f"collider_{name}", mesh_builder=col_mb, parent_idx=root, extras={"isCollider": True})
    return doc


def build_connector_power_iec():
    """
    Standalone IEC C13/C14 Power Connector (`connector_power_iec.glb`).
    Origin (0, 0, 0) at plug insertion face (+Z into socket); cable exits at `attach_cable_end` (0, 0, -0.058).
    """
    name = "connector_power_iec"
    doc = GltfAssetDocument(name, {
        "category": "cable_connector",
        "connectorType": "iec_power",
        "dimensionsM": [0.028, 0.020, 0.058],
    })
    root = doc.add_node(name, extras={"assetType": "connector", "connectorType": "iec_power"})

    mb0 = MeshBuilder(f"{name}_LOD0_mesh")
    # Shrouded IEC C13 nose & 3 brass contact slots
    mb0.add_beveled_box(0.022, 0.015, 0.018, bevel=0.0015, center=(0, 0, -0.009), material="mat_plastic_abs")
    for px, py in ((-0.006, -0.0025), (0.006, -0.0025), (0.0, 0.0032)):
        mb0.add_box(0.0022, 0.0042, 0.006, center=(px, py, -0.002), material="mat_gold_contacts")
    # Ergonomic ribbed rubber grip body & strain-relief tail
    mb0.add_beveled_box(0.027, 0.019, 0.024, bevel=0.0025, center=(0, 0, -0.029), material="mat_rubber_epdm")
    mb0.add_cylinder(0.0052, 0.018, segments=12, center=(0, 0, -0.049), axis="z", material="mat_rubber_epdm")
    doc.add_node("LOD0", mesh_builder=mb0, parent_idx=root, extras={"lodLevel": 0})

    mb1 = MeshBuilder(f"{name}_LOD1_mesh")
    mb1.add_box(0.026, 0.018, 0.056, center=(0, 0, -0.028), material="mat_rubber_epdm")
    doc.add_node("LOD1", mesh_builder=mb1, parent_idx=root, extras={"lodLevel": 1})

    doc.add_attachment_point("attach_cable_end", position=(0.0, 0.0, -0.058), normal=(0.0, 0.0, -1.0), connector_type="cable_tail", parent_idx=root)

    col_mb = MeshBuilder(f"collider_{name}_mesh")
    col_mb.add_box(0.028, 0.020, 0.058, center=(0, 0, -0.029), material="mat_collider")
    doc.add_node(f"collider_{name}", mesh_builder=col_mb, parent_idx=root, extras={"isCollider": True})
    return doc


def build_all_network_and_power(base_dir):
    out_dir = os.path.join(base_dir, "assets", "network_power")
    out_gltf = os.path.join(base_dir, "source", "gltf")
    jobs = [
        ("switch_8port", build_rack_switch(8)),
        ("switch_16port", build_rack_switch(16)),
        ("patch_panel_24port", build_patch_panel_24port()),
        ("cable_management_1u", build_cable_management_1u()),
        ("rack_pdu", build_rack_pdu()),
        ("connector_rj45", build_connector_rj45()),
        ("connector_power_iec", build_connector_power_iec()),
    ]
    results = []
    for name, doc in jobs:
        info = doc.export_glb(os.path.join(out_dir, f"{name}.glb"), texture_rel_prefix="../../textures")
        doc.export_gltf(os.path.join(out_gltf, f"{name}.gltf"), texture_rel_prefix="../../textures")
        print(f"  [OK] Exported {name}.glb ({info['size_kb']} KB, {info['nodes']} nodes)")
        results.append((name, doc, info))
    return results


if __name__ == "__main__":
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    build_all_network_and_power(base)
