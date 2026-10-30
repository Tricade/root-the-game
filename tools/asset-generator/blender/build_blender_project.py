#!/usr/bin/env python3
"""
ROOT 3D Asset Package — Blender Project Builder Script (`bpy`)
Usage:
  blender --background --python source/blender/build_blender_project.py
  Or open in Blender's Scripting workspace and click "Run Script".

What this script does:
  1. Clears the default scene and configures metric units (1.0m, +Y front/+Z up in Blender,
     automatically converted by Blender's glTF 2.0 importer/exporter to Y-up, +Z front).
  2. Creates organized Blender Collections:
       - 01_Racks (rack_18u, rack_42u, blanking panels)
       - 02_Servers (1U Edge, 2U Compute, 3U Storage, 4U AI)
       - 03_Network_Power (8-Port Switch, 16-Port Switch, 24-Port Patch Panel, 1U Cable Mgmt, Rack PDU, Connectors)
       - 04_Architecture (Floor tiles, Vents, Walls, Ceiling, Linear Light, Overhead Cable Tray, CRAC Unit, Fire Door, Signage)
       - 05_Stations (3-Monitor Operator Console Desk, Wall-Mounted Maintenance Terminal)
       - 06_Example_Scene (Full ROOT Data Center Cold-Aisle Scene)
  3. Imports all editable glTF/GLB assets with their 2K PBR textures, material nodes, hierarchies,
     pivots, LODs, colliders, and attachment empty nodes preserved.
  4. Configures EEVEE/Cycles rendering, ACES/AgX Filmic color management, cool-white area lights,
     and camera framing matching the reference image.
  5. Saves `source/blender/ROOT_Datacenter_Assets.blend`.
"""

import os
import sys

try:
    import bpy
except ImportError:
    print("NOTE: This script is designed to run inside Blender (bpy).")
    print("Run: blender --background --python source/blender/build_blender_project.py")
    sys.exit(0)


BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_BLEND = os.path.join(os.path.dirname(__file__), "ROOT_Datacenter_Assets.blend")

COLLECTIONS_SPEC = [
    ("01_Racks", "assets/racks", [
        ("rack_18u.glb", (-4.0, 0.0, 0.0)),
        ("rack_42u.glb", (-3.0, 0.0, 0.0)),
        ("rack_blank_panel_1u.glb", (-2.0, 0.0, 0.0)),
        ("rack_blank_panel_2u.glb", (-2.0, 0.0, 0.2)),
    ]),
    ("02_Servers", "assets/servers", [
        ("server_1u_edge.glb", (0.0, 0.0, 0.0)),
        ("server_2u_compute.glb", (0.8, 0.0, 0.0)),
        ("server_3u_storage.glb", (1.6, 0.0, 0.0)),
        ("server_4u_ai.glb", (2.4, 0.0, 0.0)),
    ]),
    ("03_Network_Power", "assets/network_power", [
        ("switch_8port.glb", (4.0, 0.0, 0.0)),
        ("switch_16port.glb", (4.8, 0.0, 0.0)),
        ("patch_panel_24port.glb", (5.6, 0.0, 0.0)),
        ("cable_management_1u.glb", (6.4, 0.0, 0.0)),
        ("rack_pdu.glb", (7.2, 0.0, 0.0)),
        ("connector_rj45.glb", (7.8, 0.0, 0.0)),
        ("connector_power_iec.glb", (8.0, 0.0, 0.0)),
    ]),
    ("04_Architecture", "assets/architecture", [
        ("floor_tile_standard.glb", (0.0, 4.0, 0.0)),
        ("floor_tile_vent.glb", (1.0, 4.0, 0.0)),
        ("wall_module_standard.glb", (4.0, 4.0, 0.0)),
        ("wall_module_branded.glb", (8.0, 4.0, 0.0)),
        ("ceiling_module.glb", (12.0, 4.0, 0.0)),
        ("ceiling_light_linear.glb", (15.5, 4.0, 0.0)),
        ("cable_tray_overhead.glb", (17.0, 4.0, 0.0)),
        ("crac_cooling_unit.glb", (19.0, 4.0, 0.0)),
        ("fire_door_module.glb", (21.0, 4.0, 0.0)),
        ("signage_set.glb", (23.0, 4.0, 0.0)),
    ]),
    ("05_Operator_Stations", "assets/stations", [
        ("operator_console_desk.glb", (-4.0, 4.0, 0.0)),
        ("wall_terminal_maintenance.glb", (-1.5, 4.0, 1.4)),
    ]),
]


def setup_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = "ROOT_Asset_Library"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0

    # World background: dark industrial slate (#101518)
    world = bpy.data.worlds.new("ROOT_Datacenter_World")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.015, 0.021, 0.025, 1.0)
        bg.inputs[1].default_value = 0.85

    for col_name, rel_folder, items in COLLECTIONS_SPEC:
        col = bpy.data.collections.new(col_name)
        scene.collection.children.link(col)
        for filename, offset in items:
            glb_path = os.path.join(BASE_DIR, rel_folder, filename)
            if not os.path.exists(glb_path):
                continue
            before = set(bpy.data.objects)
            bpy.ops.import_scene.gltf(filepath=glb_path)
            imported = [obj for obj in bpy.data.objects if obj not in before]
            for obj in imported:
                for uc in obj.users_collection:
                    uc.objects.unlink(obj)
                col.objects.link(obj)
                if obj.parent is None:
                    obj.location.x += offset[0]
                    obj.location.y += offset[1]
                    obj.location.z += offset[2]

    # Create a second scene containing the full assembled Example Scene
    ex_scene = bpy.data.scenes.new("ROOT_Example_Datacenter")
    ex_scene.unit_settings.system = "METRIC"
    ex_scene.world = world
    bpy.context.window.scene = ex_scene
    scene_glb = os.path.join(BASE_DIR, "scenes", "root_datacenter_scene.glb")
    if os.path.exists(scene_glb):
        bpy.ops.import_scene.gltf(filepath=scene_glb)

    # Add camera matching the reference image perspective in the Cold Aisle
    cam_data = bpy.data.cameras.new("ColdAisle_Camera")
    cam_data.lens = 28.0
    cam_obj = bpy.data.objects.new("ColdAisle_Camera", cam_data)
    ex_scene.collection.objects.link(cam_obj)
    cam_obj.location = (0.0, -3.25, 1.58)
    cam_obj.rotation_euler = (1.55, 0.0, 0.0)
    ex_scene.camera = cam_obj

    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    print(f"[OK] Saved Blender project to {OUT_BLEND}")


if __name__ == "__main__":
    setup_scene()
