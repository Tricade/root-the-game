#!/usr/bin/env python3
"""Build five standalone facility GLBs in ROOT's shared procedural style."""

from __future__ import annotations

import json
import math
import struct
from pathlib import Path

from gltf_builder import GltfAssetDocument, MeshBuilder


PROJECT = Path(__file__).resolve().parents[2]
ASSET_DIR = PROJECT / "asset-pack" / "assets" / "facility"
SOURCE_DIR = PROJECT / "asset-pack" / "source" / "facility"
MANIFEST = PROJECT / "asset-pack" / "docs" / "facility_manifest.json"


def _box(mesh, dims, center, material, bevel=0.0):
    w, h, d = dims
    if bevel:
        mesh.add_beveled_box(w, h, d, bevel=bevel, center=center, material=material)
    else:
        mesh.add_box(w, h, d, center=center, material=material)


def _cylinder(mesh, radius, depth, center, material, segments=12):
    mesh.add_cylinder(radius, depth, segments=segments, center=center, axis="z", material=material)


def _node(doc, name, parent, dims, center, material, bevel=0.0, extras=None):
    mb = MeshBuilder(name + "_mesh")
    _box(mb, dims, center, material, bevel)
    return doc.add_node(name, mesh_builder=mb, parent_idx=parent, extras=extras)


def _led(doc, parent, name, position, material="mat_led_power"):
    mb = MeshBuilder(name + "_mesh")
    _cylinder(mb, 0.006, 0.004, (0, 0, 0), material, segments=10)
    doc.add_node(name, mesh_builder=mb, translation=position, parent_idx=parent,
                 extras={"controllableLed": True, "ledRole": name.split("_")[1]})


def _shell(doc, name, dims, frame, detail_fn, collider_dims=None, extras=None):
    root = doc.add_node(name, extras={"assetType": "facility", "units": "m", "dimensionsM": list(dims), **(extras or {})})
    lod0 = doc.add_node("LOD0", parent_idx=root, extras={"lodLevel": 0})
    detail_fn(doc, lod0, dims, frame)
    lod1 = doc.add_node("LOD1", parent_idx=root, extras={"lodLevel": 1})
    low = MeshBuilder(name + "_LOD1_mesh")
    _box(low, dims, (0, dims[1] / 2, 0), "mat_powder_coat_dark", bevel=0.012)
    doc.add_node(name + "_distance_shell", mesh_builder=low, parent_idx=lod1)
    coll = MeshBuilder("collider_" + name)
    _box(coll, collider_dims or dims, (0, dims[1] / 2, 0), "mat_collider")
    doc.add_node("collider_" + name, mesh_builder=coll, parent_idx=root,
                 extras={"collisionProxy": True, "triangleBudget": 12})
    return root


def _matrix_product(a, b):
    return [[sum(a[r][k] * b[k][c] for k in range(4)) for c in range(4)] for r in range(4)]


def _node_matrix(node):
    if "matrix" in node:
        values = node["matrix"]
        return [[values[c * 4 + r] for c in range(4)] for r in range(4)]
    tx, ty, tz = node.get("translation", (0, 0, 0))
    sx, sy, sz = node.get("scale", (1, 1, 1))
    x, y, z, w = node.get("rotation", (0, 0, 0, 1))
    r = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 0],
         [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 0],
         [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y), 0],
         [0, 0, 0, 1]]
    s = [[sx, 0, 0, 0], [0, sy, 0, 0], [0, 0, sz, 0], [0, 0, 0, 1]]
    t = [[1, 0, 0, tx], [0, 1, 0, ty], [0, 0, 1, tz], [0, 0, 0, 1]]
    return _matrix_product(t, _matrix_product(r, s))


def _measure_glb_bounds(glb_path):
    """Measure exported GLB POSITION accessor bounds after every scene node transform."""
    blob = glb_path.read_bytes()
    magic, version, total_length = struct.unpack_from("<III", blob, 0)
    json_length, json_type = struct.unpack_from("<II", blob, 12)
    if magic != 0x46546C67 or version != 2 or total_length != len(blob) or json_type != 0x4E4F534A:
        raise ValueError(f"Invalid GLB v2 header: {glb_path}")
    data = json.loads(blob[20:20 + json_length].decode("utf-8"))
    bin_header = 20 + json_length
    bin_length, bin_type = struct.unpack_from("<II", blob, bin_header)
    if bin_type != 0x004E4942 or bin_header + 8 + bin_length != len(blob):
        raise ValueError(f"Invalid GLB v2 BIN chunk: {glb_path}")
    binary = blob[bin_header + 8:bin_header + 8 + bin_length]
    nodes, meshes, accessors, views = data["nodes"], data["meshes"], data["accessors"], data["bufferViews"]
    lows, highs = [float("inf")] * 3, [float("-inf")] * 3

    def walk(index, parent):
        node = nodes[index]
        world = _matrix_product(parent, _node_matrix(node))
        if "mesh" in node:
            for primitive in meshes[node["mesh"]]["primitives"]:
                pos = accessors[primitive["attributes"]["POSITION"]]
                if pos.get("componentType") != 5126 or pos.get("type") != "VEC3":
                    raise ValueError(f"Unsupported POSITION accessor in {glb_path}")
                view = views[pos["bufferView"]]
                stride = view.get("byteStride", 12)
                start = view.get("byteOffset", 0) + pos.get("byteOffset", 0)
                for vertex in range(pos["count"]):
                    xyz = struct.unpack_from("<fff", binary, start + vertex * stride)
                    p = [xyz[0], xyz[1], xyz[2], 1]
                    v = [sum(world[r][c] * p[c] for c in range(4)) for r in range(3)]
                    for axis in range(3):
                        lows[axis] = min(lows[axis], v[axis])
                        highs[axis] = max(highs[axis], v[axis])
        for child in node.get("children", []):
            walk(child, world)

    for root in data["scenes"][0]["nodes"]:
        walk(root, [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]])
    return ([round(x, 6) for x in lows], [round(x, 6) for x in highs])


def _add_cabinet_body(doc, parent, dims, label, role):
    w, h, d = dims
    mb = MeshBuilder(role + "_enclosure_mesh")
    # Solid wall thickness gives the enclosure visible inside faces as well as
    # outside faces. The old one-sided open shell disappeared through its gaps.
    side_bottom, side_top = 0.102, h - 0.04
    for side in (-1, 1):
        # The side skins meet the plinth at a 2 mm assembly reveal; they must
        # not duplicate the plinth's exposed brushed-metal side faces.
        _box(mb, (0.028, side_top - side_bottom, d - 0.035), (side * (w / 2 - 0.014), (side_top + side_bottom) / 2, -0.012), "mat_powder_coat_dark")
    _box(mb, (w - 0.056, h - 0.11, 0.025), (0, h / 2 + 0.015, -d / 2 + 0.018), "mat_powder_coat_dark")
    # Fixed instrument fascia and the rebated centre door seal close the front.
    _box(mb, (w - 0.04, h - 1.74, 0.025), (0, (1.69 + h - 0.05) / 2, d / 2 - 0.014), "mat_powder_coat_medium", 0.006)
    _box(mb, (0.028, 1.62, 0.045), (0, 0.91, d / 2 - 0.029), "mat_rubber_epdm", 0.005)
    base_depth = d + (0.025 if role == "ups" else 0.010)
    _box(mb, (w, 0.10, base_depth), (0, 0.05, 0), "mat_brushed_metal", 0.012)
    _box(mb, (w - 0.02, 0.035, d - 0.025), (0, h - 0.035, 0), "mat_powder_coat_medium", 0.006)
    doc.add_node(role + "_cabinet_frame", mesh_builder=mb, parent_idx=parent)

    # Rear air outlet and two recessed side service panels.
    back = MeshBuilder(role + "_rear_vents_mesh")
    for i in range(11):
        y = 0.24 + i * ((h - 0.48) / 10)
        _box(back, (w * 0.58, 0.009, 0.008), (0, y, -d / 2 + 0.006), "mat_vent_grille")
    doc.add_node(role + "_rear_vent_slots", mesh_builder=back, parent_idx=parent)

    screen = MeshBuilder(role + "_display_mesh")
    _box(screen, (0.19, 0.115, 0.012), (-w * 0.25, h - 0.31, d / 2 - 0.006), "mat_plastic_abs", 0.009)
    screen.add_plane(0.162, 0.078, center=(-w * 0.25, h - 0.31, d / 2 + 0.001), facing="+z", material="mat_led_activity")
    _box(screen, (0.28, 0.064, 0.012), (w * 0.22, h - 0.31, d / 2 - 0.006), "mat_rack_nameplate", 0.004)
    doc.add_node(role + "_telemetry_display", mesh_builder=screen, parent_idx=parent,
                 extras={"dynamicSurface": "facility_status_display", "replaceable": True, "label": label})

    # Frame fasteners around the visible face.
    bolts = MeshBuilder(role + "_fasteners_mesh")
    for x in (-w * 0.44, w * 0.44):
        for y in (0.20, h * 0.38, h * 0.65, h - 0.16):
            _cylinder(bolts, 0.008, 0.005, (x, y, d / 2 - 0.006), "mat_brushed_metal", segments=8)
    doc.add_node(role + "_frame_bolts", mesh_builder=bolts, parent_idx=parent)


def build_ups():
    name, dims = "ups_battery_cabinet", (0.86, 2.04, 0.82)
    doc = GltfAssetDocument(name, {"category": "facility_power", "dimensionsM": list(dims), "batteryStringCount": 8})

    def details(doc, lod, dims, _frame):
        _add_cabinet_body(doc, lod, dims, "ROOT UPS 960", "ups")
        w, h, d = dims
        # Visible battery cartridge faces behind the access doors.
        cells = MeshBuilder("ups_battery_cartridge_faces_mesh")
        for row in range(4):
            for col in range(2):
                x = (col - 0.5) * 0.31
                y = 0.42 + row * 0.29
                _box(cells, (0.27, 0.255, 0.035), (x, y, d / 2 - 0.045), "mat_brushed_metal", 0.009)
                _box(cells, (0.19, 0.013, 0.008), (x, y + 0.085, d / 2 - 0.022), "mat_powder_coat_medium", 0.004)
        doc.add_node("ups_battery_cartridge_bank", mesh_builder=cells, parent_idx=lod,
                     extras={"batteryModules": 8, "serviceable": True})
        for side, x in (("left", -w / 2), ("right", w / 2)):
            hinge = doc.add_node(f"ups_door_{side}", parent_idx=lod,
                                 translation=(x, 0.10, d / 2 - 0.015), extras={"animated": True, "motion": "hinge_y"})
            door = MeshBuilder(f"ups_door_{side}_mesh")
            panel_w = w / 2 - 0.008
            cx = panel_w / 2 if side == "left" else -panel_w / 2
            _box(door, (panel_w, 1.60, 0.038), (cx, 0.80, 0), "mat_powder_coat_medium", 0.014)
            _box(door, (panel_w * 0.68, 0.21, 0.008), (cx, 0.80, 0.024), "mat_vent_grille", 0.006)
            hx = panel_w * 0.39 if side == "left" else -panel_w * 0.39
            _box(door, (0.022, 0.28, 0.03), (hx, 0.85, 0.010), "mat_brushed_metal", 0.008)
            doc.add_node(f"ups_door_{side}_panel", mesh_builder=door, parent_idx=hinge,
                         extras={"material": "powder_coat", "serviceDoor": True})
        for i in range(5):
            _led(doc, lod, f"led_ups_status_{i + 1:02d}", (-0.17 + i * 0.075, 1.82, d / 2 + 0.003),
                 "mat_led_power" if i == 0 else ("mat_led_fault" if i == 4 else "mat_led_activity"))
        # Side cooling fans and perforated intake grilles.
        for side in (-1, 1):
            fan = MeshBuilder(f"ups_fan_{side}_mesh")
            _cylinder(fan, 0.095, 0.012, (side * 0.20, 0.46, -d / 2 - 0.006), "mat_brushed_metal", 24)
            doc.add_node(f"ups_cooling_fan_{'left' if side < 0 else 'right'}", mesh_builder=fan, parent_idx=lod,
                         extras={"animated": True, "rotationAxis": "x"})

    _shell(doc, name, dims, None, details, extras={"deviceClass": "online_ups", "batteryChemistry": "modular_lfp"})
    return doc


def build_distribution():
    name, dims = "power_distribution_ats", (1.16, 2.08, 0.70)
    doc = GltfAssetDocument(name, {"category": "facility_power", "dimensionsM": list(dims), "phases": 3, "transferSwitch": "dual_source"})

    def details(doc, lod, dims, _frame):
        _add_cabinet_body(doc, lod, dims, "ROOT PWR-A/B", "pdu")
        w, h, d = dims
        # A broad, shallow switchboard with externally accessible isolators and
        # outgoing breakers must read differently from the deep battery cabinet.
        for side in ("left", "right"):
            # A small inset keeps the door edge off the enclosure's exposed
            # side plane while the centre seal still overlaps both leaves.
            x = -w / 2 + 0.002 if side == "left" else w / 2 - 0.002
            hinge = doc.add_node(f"distribution_door_{side}", parent_idx=lod, translation=(x, 0.11, d / 2 - 0.025),
                                 extras={"animated": True, "motion": "hinge_y", "interlock": True})
            door = MeshBuilder(f"distribution_door_{side}_mesh")
            panel_w = w / 2 - 0.012
            cx = panel_w / 2 if side == "left" else -panel_w / 2
            _box(door, (panel_w, 1.60, 0.042), (cx, 0.80, 0), "mat_arch_steel", 0.015)
            # Upper source isolator: black mounting plate and a connected red
            # rotary handle, including its shaft and four fixing screws.
            _box(door, (0.32, 0.35, 0.025), (cx, 1.30, 0.035), "mat_powder_coat_dark", 0.012)
            _cylinder(door, 0.072, 0.035, (cx, 1.30, 0.065), "mat_plastic_latch", 24)
            _box(door, (0.038, 0.18, 0.035), (cx, 1.30, 0.091), "mat_led_fault", 0.008)
            for dx in (-0.13, 0.13):
                for dy in (-0.14, 0.14):
                    _cylinder(door, 0.007, 0.008, (cx + dx, 1.30 + dy, 0.052), "mat_brushed_metal", 8)
            # Six visible outgoing breaker modules per source, rather than
            # concealing every electrical component behind blank double doors.
            for row in range(3):
                for col in range(2):
                    bx, by = cx + (col - 0.5) * 0.155, 0.43 + row * 0.20
                    _box(door, (0.135, 0.16, 0.038), (bx, by, 0.042), "mat_powder_coat_dark", 0.008)
                    _box(door, (0.028, 0.065, 0.028), (bx, by + 0.005, 0.072), "mat_plastic_latch", 0.005)
                    _box(door, (0.074, 0.009, 0.003), (bx, by - 0.052, 0.063), "mat_brushed_metal")
            _box(door, (0.028, 0.20, 0.028), (panel_w * (0.84 if side == 'left' else -0.84), 0.98, 0.025), "mat_brushed_metal", 0.008)
            doc.add_node(f"distribution_door_{side}_panel", mesh_builder=door, parent_idx=hinge,
                         extras={"visibleOutgoingBreakers": 6, "externalSourceIsolator": True})

        bus = MeshBuilder("distribution_busbar_and_breakers_mesh")
        for i, x in enumerate((-0.27, -0.09, 0.09, 0.27)):
            _box(bus, (0.065, 0.82, 0.035), (x, 1.32, 0.02), "mat_brushed_metal", 0.008)
            _box(bus, (0.11, 0.13, 0.055), (x, 0.68, 0.03), "mat_powder_coat_medium", 0.01)
            _box(bus, (0.022, 0.046, 0.014), (x, 0.69, 0.067), "mat_plastic_latch", 0.004)
            _cylinder(bus, 0.008, 0.006, (x, 0.52, 0.05), "mat_led_power" if i < 3 else "mat_led_fault", 8)
        doc.add_node("distribution_copper_busbars", mesh_builder=bus, parent_idx=lod,
                     extras={"phaseCount": 3, "visibleWhenDoorsOpen": True})
        for i, material in enumerate(("mat_led_power", "mat_led_activity", "mat_led_fault", "mat_led_boot")):
            _led(doc, lod, f"led_distribution_{('source_a','source_b','transfer','alarm')[i]}",
                 (-0.12 + i * 0.08, 1.84, d / 2 + 0.003), material)

    _shell(doc, name, dims, None, details, extras={"deviceClass": "automatic_transfer_switchboard"})
    return doc


def build_elevator():
    name, dims = "elevator_module", (1.46, 2.46, 0.20)
    doc = GltfAssetDocument(name, {"category": "facility_access", "dimensionsM": list(dims), "openingWidthM": 1.18})

    def details(doc, lod, dims, _frame):
        w, h, d = dims
        frame = MeshBuilder("elevator_portal_frame_mesh")
        _box(frame, (w, h, d), (0, h / 2, 0), "mat_arch_wall", 0.018)
        _box(frame, (1.24, 2.22, d), (0, 1.17, 0), "mat_powder_coat_dark", 0.01)
        _box(frame, (1.18, 2.15, d * 0.50), (0, 1.14, d * 0.18), "mat_rubber_epdm", 0.005)
        _box(frame, (0.018, 2.12, 0.028), (0, 1.13, d / 2 - 0.032), "mat_brushed_metal", 0.006)
        doc.add_node("elevator_module_frame", mesh_builder=frame, parent_idx=lod)

        for side in ("left", "right"):
            x = -0.295 if side == "left" else 0.295
            door = MeshBuilder(f"lift_door_{side}_mesh")
            _box(door, (0.59, 2.12, 0.038), (0, 1.06, 0), "mat_brushed_metal", 0.014)
            _box(door, (0.49, 1.94, 0.012), (0, 1.06, 0.025), "mat_powder_coat_medium", 0.008)
            _box(door, (0.018, 1.84, 0.008), (0, 1.06, 0.034), "mat_powder_coat_dark", 0.004)
            node = doc.add_node(f"lift_door_{side}", mesh_builder=door, translation=(x, 0.09, d / 2 - 0.05), parent_idx=lod,
                                extras={"animated": True, "motion": "slide_x", "slideDirection": "left" if side == "left" else "right"})
        # Call station, status display and mechanical landing locks.
        call = MeshBuilder("elevator_call_station_mesh")
        _box(call, (0.11, 0.34, 0.055), (0.66, 1.12, d / 2 - 0.03), "mat_brushed_metal", 0.012)
        _box(call, (0.074, 0.12, 0.012), (0.66, 1.24, d / 2 - 0.008), "mat_plastic_abs", 0.006)
        doc.add_node("elevator_call_station", mesh_builder=call, parent_idx=lod,
                     extras={"interactable": True, "control": "call_elevator"})
        _led(doc, lod, "led_lift_arrival", (0.66, 1.25, d / 2 - 0.006), "mat_led_activity")
        for x in (-0.58, 0.58):
            lock = MeshBuilder("lift_landing_lock_mesh")
            _cylinder(lock, 0.014, 0.01, (0, 0, 0), "mat_brushed_metal", 8)
            doc.add_node(f"lift_landing_lock_{'left' if x < 0 else 'right'}", mesh_builder=lock,
                         translation=(x, 2.30, d / 2 - 0.02), parent_idx=lod, extras={"safetyInterlock": True})

    root = _shell(doc, name, dims, None, details, extras={"deviceClass": "freight_elevator_landing", "requiresInterlock": True})
    # Replace a full-block LOD1 with a simplified portal silhouette while retaining a compact collision proxy.
    low = MeshBuilder("elevator_distance_frame_mesh")
    _box(low, (1.46, 2.46, 0.20), (0, 1.23, 0), "mat_arch_wall")
    _box(low, (1.18, 2.15, 0.07), (0, 1.14, 0.03), "mat_brushed_metal")
    lod1 = next(i for i, n in enumerate(doc.nodes) if n["name"] == "LOD1")
    doc.nodes[lod1]["children"] = []
    doc.add_node("elevator_distance_portal", mesh_builder=low, parent_idx=lod1)
    return doc


def build_airlock():
    name, dims = "cyber_bunker_airlock", (1.40, 2.40, 0.30)
    sill_h = 0.045
    door_w, door_h, door_t = 1.06, 2.16, 0.12
    opening_z = 0.025
    doc = GltfAssetDocument(name, {"category": "facility_security", "dimensionsM": list(dims),
        "securityRating": "blast_seal", "doorMassVisualClass": "heavy", "pivotM": [0, 0, 0],
        "boundsMethod": "GLB accessor positions transformed through node hierarchy; closed door pose",
        "supportFrame": True, "clearOpeningM": [door_w, door_h], "sillHeightM": sill_h})
    root = doc.add_node(name, extras={"assetType": "industrial_security_door", "units": "m",
        "dimensionsM": list(dims), "deviceClass": "underground_bunker_airlock", "pressureSeal": True,
        "interlock": True, "pivotAtFloor": True})
    lod = doc.add_node("LOD0", parent_idx=root, extras={"lodLevel": 0})

    # Open, load-bearing portal: two grounded jambs, structural lintel and a sill flush to the room floor.
    frame = MeshBuilder("bunker_portal_frame_mesh")
    jamb_w = 0.15
    for x in (-dims[0] / 2 + jamb_w / 2, dims[0] / 2 - jamb_w / 2):
        _box(frame, (jamb_w, dims[1], dims[2]), (x, dims[1] / 2, 0), "mat_arch_steel", 0.012)
    # Lintel/sill fit between the jambs; their front faces must not overlap.
    _box(frame, (dims[0] - 2 * jamb_w, 0.20, dims[2]), (0, dims[1] - 0.10, 0), "mat_brushed_metal", 0.012)
    _box(frame, (dims[0] - 2 * jamb_w, sill_h, dims[2]), (0, sill_h / 2, 0), "mat_brushed_metal", 0.006)
    # Nested metal reveals show the frame depth without filling the doorway with a wall panel.
    _box(frame, (0.035, dims[1] - 0.20, dims[2] * 0.74), (-0.585, dims[1] / 2, dims[2] * 0.13 + 0.008), "mat_powder_coat_dark", 0.004)
    _box(frame, (0.035, dims[1] - 0.20, dims[2] * 0.74), (0.585, dims[1] / 2, dims[2] * 0.13 + 0.008), "mat_powder_coat_dark", 0.004)
    doc.add_node("bunker_door_load_bearing_frame", mesh_builder=frame, parent_idx=lod,
                 extras={"structuralJambs": 2, "structuralLintel": True, "doorwayOpen": True})

    # Dense compression gasket and raised steel stop sit behind the leaf; both end exactly at the threshold.
    gasket = MeshBuilder("bunker_door_perimeter_seal_mesh")
    for x in (-door_w / 2, door_w / 2):
        _box(gasket, (0.018, door_h, 0.035), (x, sill_h + door_h / 2, opening_z - 0.055), "mat_rubber_epdm", 0.006)
    _box(gasket, (door_w, 0.018, 0.035), (0, sill_h + door_h, opening_z - 0.055), "mat_rubber_epdm", 0.006)
    doc.add_node("bunker_door_compression_seal", mesh_builder=gasket, parent_idx=lod)

    # The opening contains a separate, genuinely movable leaf. Its front is a metal plate field with a glazed cutout,
    # not a perforated cabinet door; its lower edge rests directly on the sill.
    hinge_x = -door_w / 2
    hinge_z = 0.0
    hinge = doc.add_node("bunker_door_hinge", parent_idx=lod, translation=(hinge_x, sill_h, hinge_z),
        extras={"animated": True, "motion": "hinge_y", "axis": "y", "sealed": True, "pivotOnLeafEdge": True})
    leaf = MeshBuilder("bunker_door_leaf_metalwork_mesh")
    # Forged outer rails leave a small true aperture for the laminated view glass.
    _box(leaf, (0.13, door_h, door_t), (0.065, door_h / 2, 0), "mat_brushed_metal", 0.014)
    _box(leaf, (0.13, door_h, door_t), (door_w - 0.065, door_h / 2, 0), "mat_brushed_metal", 0.014)
    _box(leaf, (door_w - 0.26, 0.16, door_t), (door_w / 2, 0.08, 0), "mat_powder_coat_dark", 0.010)
    _box(leaf, (door_w - 0.26, 0.17, door_t), (door_w / 2, door_h - 0.085, 0), "mat_powder_coat_dark", 0.010)
    # Solid steel fields above and below a 0.24 × 0.30 m laminated sight pane.
    sight_y, sight_h, sight_w = 1.64, 0.30, 0.24
    span_w = door_w - 0.26
    pane_left, pane_right = (door_w - sight_w) / 2, (door_w + sight_w) / 2
    lower, upper = sight_y - sight_h / 2, sight_y + sight_h / 2
    _box(leaf, (span_w, lower - 0.16, 0.055), (door_w / 2, (lower + 0.16) / 2, 0.012), "mat_brushed_metal", 0.008)
    _box(leaf, (span_w, door_h - 0.17 - upper, 0.055), (door_w / 2, (door_h - 0.17 + upper) / 2, 0.012), "mat_brushed_metal", 0.008)
    _box(leaf, (pane_left - 0.13, sight_h, 0.055), ((0.13 + pane_left) / 2, sight_y, 0.012), "mat_brushed_metal", 0.008)
    _box(leaf, (door_w - 0.13 - pane_right, sight_h, 0.055), ((pane_right + door_w - 0.13) / 2, sight_y, 0.012), "mat_brushed_metal", 0.008)
    for y in (0.65, 1.10):
        _box(leaf, (span_w - 0.04, 0.025, 0.016), (door_w / 2, y, 0.044), "mat_powder_coat_dark", 0.005)
    # Dark gasket, safety glass and external retaining bezel occupy the opening only.
    for x in (pane_left - 0.00875, pane_right + 0.00875):
        _box(leaf, (0.0175, sight_h + 0.035, 0.018), (x, sight_y, 0.039), "mat_rubber_epdm", 0.004)
    for y in (sight_y - sight_h / 2 - 0.00875, sight_y + sight_h / 2 + 0.00875):
        _box(leaf, (sight_w, 0.0175, 0.018), (door_w / 2, y, 0.039), "mat_rubber_epdm", 0.004)
    _box(leaf, (sight_w, sight_h, 0.012), (door_w / 2, sight_y, 0.051), "mat_glass_tinted", 0.002)
    for x in (pane_left - 0.024, pane_right + 0.024):
        _box(leaf, (0.018, sight_h + 0.045, 0.018), (x, sight_y, 0.062), "mat_brushed_metal", 0.004)
    for y in (sight_y - sight_h / 2 - 0.02, sight_y + sight_h / 2 + 0.02):
        _box(leaf, (sight_w + 0.06, 0.018, 0.018), (door_w / 2, y, 0.062), "mat_brushed_metal", 0.004)
    doc.add_node("bunker_door_leaf", mesh_builder=leaf, parent_idx=hinge,
                 extras={"animated": True, "sealed": True, "locks": 10, "construction": "solid steel leaf with glazed sight aperture"})

    # Large flush-set lockdogs and a handwheel have distinct hardware silhouettes at human scale.
    lockdogs = MeshBuilder("bunker_lockdog_mesh")
    for y in (0.31, 0.79, 1.27, 1.75, 2.10):
        for x in (0.055, door_w - 0.055):
            _cylinder(lockdogs, 0.022, 0.028, (x, y, door_t / 2 + 0.045), "mat_brushed_metal", 12)
            _cylinder(lockdogs, 0.010, 0.032, (x, y, door_t / 2 + 0.055), "mat_powder_coat_medium", 10)
    doc.add_node("bunker_door_lockdogs", mesh_builder=lockdogs, parent_idx=hinge,
                 extras={"animatedWithLeaf": True, "boltCount": 10})
    wheel = MeshBuilder("bunker_door_handwheel_mesh")
    wx, wy, wz = door_w - 0.24, 1.12, door_t / 2 + 0.045
    circle = [(wx + math.cos(2 * math.pi * i / 20) * 0.105, wy + math.sin(2 * math.pi * i / 20) * 0.105, wz) for i in range(21)]
    wheel.add_tube(circle, radius=0.009, radial_segments=8, material="mat_brushed_metal")
    _cylinder(wheel, 0.032, 0.038, (wx, wy, wz), "mat_brushed_metal", 16)
    for i in range(4):
        angle = i * math.pi / 2
        ex, ey = wx + math.cos(angle) * 0.09, wy + math.sin(angle) * 0.09
        wheel.add_tube([(wx, wy, wz), (ex, ey, wz)], radius=0.007, radial_segments=8, material="mat_brushed_metal")
    # A vertical pull handle and a robust latch lever sit beside the wheel.
    _box(wheel, (0.025, 0.26, 0.035), (0.28, 1.08, wz), "mat_brushed_metal", 0.012)
    _box(wheel, (0.08, 0.035, 0.035), (0.31, 1.11, wz + 0.006), "mat_powder_coat_medium", 0.012)
    doc.add_node("bunker_door_handwheel_and_latch", mesh_builder=wheel, parent_idx=hinge,
                 extras={"animatedWithLeaf": True, "manualLock": True})

    # Real piano-style external hinge barrels, edge screws and status beacon on the frame.
    hardware = MeshBuilder("bunker_frame_hinges_fasteners_mesh")
    for y in (0.34, 1.20, 2.06):
        _cylinder(hardware, 0.024, 0.23, (-0.665, y, 0.0), "mat_brushed_metal", 12)
    for y in (0.16, 0.46, 0.76, 1.06, 1.36, 1.66, 1.96, 2.24):
        for x in (-0.61, 0.61):
            _cylinder(hardware, 0.009, 0.008, (x, y, dims[2] / 2 - 0.012), "mat_brushed_metal", 8)
    doc.add_node("bunker_door_hinges_and_frame_screws", mesh_builder=hardware, parent_idx=lod)
    _led(doc, lod, "led_bunker_seal_status", (0.54, 2.28, dims[2] / 2 - 0.02), "mat_led_power")
    _led(doc, lod, "led_bunker_interlock", (0.54, 2.16, dims[2] / 2 - 0.02), "mat_led_activity")

    low = MeshBuilder("bunker_portal_LOD1_mesh")
    for x in (-0.625, 0.625):
        _box(low, (0.15, dims[1], dims[2]), (x, dims[1] / 2, 0), "mat_arch_steel")
    _box(low, (dims[0], 0.20, dims[2]), (0, dims[1] - 0.10, 0), "mat_brushed_metal")
    _box(low, (dims[0], sill_h, dims[2]), (0, sill_h / 2, 0), "mat_brushed_metal")
    _box(low, (door_w, door_h, door_t), (0, sill_h + door_h / 2, opening_z), "mat_brushed_metal")
    l1 = doc.add_node("LOD1", parent_idx=root, extras={"lodLevel": 1})
    doc.add_node("bunker_portal_LOD1", mesh_builder=low, parent_idx=l1)

    collider = MeshBuilder("collider_cyber_bunker_airlock")
    for x in (-0.625, 0.625):
        _box(collider, (0.15, dims[1], dims[2]), (x, dims[1] / 2, 0), "mat_collider")
    _box(collider, (dims[0], 0.20, dims[2]), (0, dims[1] - 0.10, 0), "mat_collider")
    _box(collider, (dims[0], sill_h, dims[2]), (0, sill_h / 2, 0), "mat_collider")
    _box(collider, (door_w, door_h, door_t), (0, sill_h + door_h / 2, opening_z), "mat_collider")
    doc.add_node("collider_cyber_bunker_airlock", mesh_builder=collider, parent_idx=root,
                 extras={"collisionProxy": "portal frame and closed leaf", "triangleBudget": 60})
    return doc


def build_stairs():
    name = "stairs_flight"
    width, run, rise, count = 1.40, 3.20, 2.60, 14
    step_run, step_rise, tread_thick = run / count, rise / count, 0.045
    rail_radius, rail_offset = 0.024, 0.90
    bounds_y = rise + rail_offset + rail_radius
    dims = (width, bounds_y, run)
    doc = GltfAssetDocument(name, {"category": "facility_access", "dimensionsM": list(dims),
        "floorToFloorRiseM": rise, "horizontalRunM": run, "flightWidthM": width,
        "treadCount": count, "treadRiseM": round(step_rise, 6), "treadGoingM": round(step_run, 6),
        "handrailHeightAboveTreadsM": rail_offset, "pivotM": [0, 0, 0],
        "boundsMethod": "GLB accessor positions transformed through node hierarchy"})
    root = doc.add_node(name, extras={"assetType": "industrial_stair_flight", "units": "m",
        "floorToFloorRiseM": rise, "horizontalRunM": run, "treadCount": count, "pivotAtLowerFloor": True})
    lod = doc.add_node("LOD0", parent_idx=root, extras={"lodLevel": 0})

    treads = MeshBuilder("stairs_treads_risers_mesh")
    z0 = -run / 2
    tread_w = 1.18
    for i in range(count):
        z_start = z0 + i * step_run
        y_top = (i + 1) * step_rise
        zc = z_start + step_run / 2
        _box(treads, (tread_w, tread_thick, step_run), (0, y_top - tread_thick / 2, zc), "mat_brushed_metal", 0.006)
        # The riser stops at the tread underside. Extending it to y_top placed
        # its dark front face over the brushed nosing on all thirteen steps.
        if i < count - 1:
            riser_height = step_rise - tread_thick
            _box(treads, (tread_w, riser_height, 0.026), (0, y_top - tread_thick - riser_height / 2, z_start + step_run - 0.013), "mat_powder_coat_dark", 0.003)
    doc.add_node("stairs_treads_and_risers", mesh_builder=treads, parent_idx=lod,
                 extras={"treadCount": count, "antiSlipNosing": True})

    # Two supported stringers; tubes follow the stair pitch with their lower ends resting on the floor.
    stringers = MeshBuilder("stairs_side_stringers_mesh")
    for x in (-0.60, 0.60):
        pts = [(x, 0.078 + (z - z0) * rise / run, z) for z in (z0 + 0.06, -run / 4, 0, run / 4, run / 2 - 0.06)]
        stringers.add_tube(pts, radius=0.078, radial_segments=10, material="mat_arch_steel")
    mounts = MeshBuilder("stairs_stringer_foot_mounts_mesh")
    for x in (-0.60, 0.60):
        _box(mounts, (0.14, 0.13, 0.14), (x, 0.065, z0 + 0.10), "mat_brushed_metal", 0.008)
    doc.add_node("stairs_stringer_foot_mounts", mesh_builder=mounts, parent_idx=lod,
                 extras={"groundContact": True, "supportCount": 2})
    doc.add_node("stairs_structural_stringers", mesh_builder=stringers, parent_idx=lod,
                 extras={"supportedAtLowerFloor": True, "sideCount": 2})

    rails = MeshBuilder("stairs_handrails_posts_mesh")
    for side in (-1, 1):
        x = side * 0.675
        rail_points = []
        for i in range(count + 1):
            z = z0 + 0.03 + i * (run - 0.06) / count
            y = i * step_rise + rail_offset
            rail_points.append((x, y, z))
        rails.add_tube(rail_points, radius=rail_radius, radial_segments=10, material="mat_brushed_metal")
        for i in range(count):
            zc = z0 + (i + 0.5) * step_run
            y_floor = (i + 1) * step_rise
            y_rail = (i + 0.5) * step_rise + rail_offset
            post = MeshBuilder("stairs_handrail_post_mesh")
            post.add_cylinder(0.014, y_rail - y_floor, segments=10,
                              center=(0, (y_rail + y_floor) / 2, 0), axis="y", material="mat_brushed_metal")
            doc.add_node(f"stairs_handrail_post_{'left' if side < 0 else 'right'}_{i + 1:02d}",
                         mesh_builder=post, translation=(x, 0, zc), parent_idx=lod,
                         extras={"supportingRail": True, "treadIndex": i + 1})
    doc.add_node("stairs_dual_handrails", mesh_builder=rails, parent_idx=lod,
                 extras={"handrailCount": 2, "handrailHeightAboveTreadsM": rail_offset})
    # Rail-end returns curve downward at both landings and remain inside the declared width/run.
    returns = MeshBuilder("stairs_handrail_returns_mesh")
    for side in (-1, 1):
        x = side * 0.675
        returns.add_tube([(x, rail_offset + 0.035, z0 + 0.03), (x, rail_offset, z0 + 0.09)], radius=rail_radius, radial_segments=10, material="mat_brushed_metal")
        returns.add_tube([(x, rise + rail_offset - 0.035, run / 2 - 0.09), (x, rise + rail_offset, run / 2 - 0.03)], radius=rail_radius, radial_segments=10, material="mat_brushed_metal")
    doc.add_node("stairs_handrail_ends", mesh_builder=returns, parent_idx=lod)

    l1 = doc.add_node("LOD1", parent_idx=root, extras={"lodLevel": 1})
    simplified = MeshBuilder("stairs_distance_mesh")
    for i in range(0, count, 2):
        z_start = z0 + i * step_run
        y_top = (i + 1) * step_rise
        _box(simplified, (tread_w, tread_thick, step_run * 2), (0, y_top - tread_thick / 2, z_start + step_run), "mat_brushed_metal")
    for x in (-0.60, 0.60):
        simplified.add_tube([(x, rail_offset + (z - z0) * rise / run, z) for z in (z0 + 0.03, 0, run / 2 - 0.03)],
                            radius=rail_radius, radial_segments=6, material="mat_brushed_metal")
        simplified.add_tube([(x, 0.078 + (z - z0) * rise / run, z) for z in (z0 + 0.06, 0, run / 2 - 0.06)],
                            radius=0.078, radial_segments=6, material="mat_arch_steel")
    doc.add_node("stairs_distance_treads_rails", mesh_builder=simplified, parent_idx=l1)

    collider = MeshBuilder("collider_stairs_flight")
    for i in range(count):
        z_start = z0 + i * step_run
        y_top = (i + 1) * step_rise
        _box(collider, (tread_w, tread_thick, step_run), (0, y_top - tread_thick / 2, z_start + step_run / 2), "mat_collider")
    doc.add_node("collider_stairs_flight", mesh_builder=collider, parent_idx=root,
                 extras={"collisionProxy": "individual stair treads", "triangleBudget": count * 12})
    return doc


BUILDERS = (build_ups, build_distribution, build_elevator, build_airlock, build_stairs)


def main():
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    entries = []
    for build in BUILDERS:
        doc = build()
        glb = ASSET_DIR / f"{doc.asset_name}.glb"
        source = SOURCE_DIR / f"{doc.asset_name}.gltf"
        # Deliberately scoped outputs: no legacy paths, textures, app files, or old manifest touched.
        glb_meta = doc.export_glb(str(glb), texture_rel_prefix="../../textures")
        glb_meta["path"] = glb.relative_to(PROJECT).as_posix()
        doc.export_gltf(str(source), texture_rel_prefix="../../textures")
        bounds_min, bounds_max = _measure_glb_bounds(glb)
        lod0 = next(i for i, node in enumerate(doc.nodes) if node["name"] == "LOD0")
        children = {i: node.get("children", []) for i, node in enumerate(doc.nodes)}
        reachable, stack = set(), [lod0]
        while stack:
            idx = stack.pop()
            if idx in reachable:
                continue
            reachable.add(idx)
            stack.extend(children[idx])
        triangles_lod0 = sum(doc.meshes[node["mesh"]].triangle_count()
                             for i, node in enumerate(doc.nodes)
                             if i in reachable and "mesh" in node)
        entry = {"key": doc.asset_name, **doc.metadata, **glb_meta,
                 "glb": glb.relative_to(PROJECT / "asset-pack").as_posix(),
                 "source": source.relative_to(PROJECT / "asset-pack").as_posix(),
                 "boundsMinM": bounds_min, "boundsMaxM": bounds_max,
                 "measuredDimensionsM": [round(bounds_max[i] - bounds_min[i], 6) for i in range(3)],
                 "trianglesLOD0": triangles_lod0,
                 "materials": sorted({p.material_name for m in doc.meshes for p in m.primitives.values()})}
        entries.append(entry)
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps({"package": "ROOT facility assets", "format": "glTF 2.0", "units": "m", "axis": {"up": "+Y", "front": "+Z"}, "assets": entries}, indent=2), encoding="utf-8")
    for e in entries:
        print(f"{e['key']}: bounds {e['boundsMinM']}..{e['boundsMaxM']} m; LOD0 {e['trianglesLOD0']:,} tris; {e['nodes']} nodes; {e['size_kb']} KiB")


if __name__ == "__main__":
    main()
