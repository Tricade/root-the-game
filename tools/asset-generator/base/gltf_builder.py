#!/usr/bin/env python3
"""
ROOT 3D Asset Package — glTF 2.0 / GLB Geometry & Scene Builder Engine
Builds standards-compliant binary .glb and editable .gltf 2.0 assets with:
  - Metric units (1m = 1.0, +Y up, +Z front)
  - Hierarchical scene nodes with exact local pivots for doors, drive caddies, fans, GPUs, and arms
  - Multi-primitive meshes grouped by shared PBR materials
  - LOD0 (high detail), LOD1 (medium/distance detail), and collider_* (simple collision hull)
  - Attachment point empty nodes (port_network_*, port_uplink_*, port_power_*, slot_u*)
"""

import os
import json
import math
import struct
import numpy as np


class MeshPrimitiveData:
    def __init__(self, material_name):
        self.material_name = material_name
        self.positions = []
        self.normals = []
        self.uvs = []
        self.indices = []

    def add_geometry(self, pos_list, norm_list, uv_list, idx_list):
        base_idx = len(self.positions)
        self.positions.extend(pos_list)
        self.normals.extend(norm_list)
        self.uvs.extend(uv_list)
        for i in idx_list:
            self.indices.append(base_idx + i)


class MeshBuilder:
    """Collects geometry primitives grouped by material name for a single glTF Mesh."""
    def __init__(self, name):
        self.name = name
        self.primitives = {}  # material_name -> MeshPrimitiveData

    def _prim(self, material_name):
        if material_name not in self.primitives:
            self.primitives[material_name] = MeshPrimitiveData(material_name)
        return self.primitives[material_name]

    def is_empty(self):
        return len(self.primitives) == 0

    def triangle_count(self):
        return sum(len(p.indices) // 3 for p in self.primitives.values())

    def vertex_count(self):
        return sum(len(p.positions) for p in self.primitives.values())

    def add_quad(self, p0, p1, p2, p3, normal, material, uv_rect=(0.0, 0.0, 1.0, 1.0), double_sided=False):
        """Add a quad (p0 bottom-left, p1 bottom-right, p2 top-right, p3 top-left) looking against normal."""
        u0, v0, u1, v1 = uv_rect
        prim = self._prim(material)
        pos = [p0, p1, p2, p3]
        norms = [normal, normal, normal, normal]
        # glTF UV origin is top-left (v0=top, v1=bottom)
        uvs = [(u0, v1), (u1, v1), (u1, v0), (u0, v0)]
        prim.add_geometry(pos, norms, uvs, [0, 1, 2, 0, 2, 3])
        if double_sided:
            neg_n = (-normal[0], -normal[1], -normal[2])
            prim.add_geometry([p1, p0, p3, p2], [neg_n] * 4, uvs, [0, 1, 2, 0, 2, 3])

    def add_plane(self, w, h, center=(0.0, 0.0, 0.0), facing="+z", material="mat_label_model", uv_rect=(0.0, 0.0, 1.0, 1.0)):
        cx, cy, cz = center
        hw, hh = w * 0.5, h * 0.5
        if facing == "+z":
            self.add_quad((cx - hw, cy - hh, cz), (cx + hw, cy - hh, cz), (cx + hw, cy + hh, cz), (cx - hw, cy + hh, cz), (0, 0, 1), material, uv_rect)
        elif facing == "-z":
            self.add_quad((cx + hw, cy - hh, cz), (cx - hw, cy - hh, cz), (cx - hw, cy + hh, cz), (cx + hw, cy + hh, cz), (0, 0, -1), material, uv_rect)
        elif facing == "+y":
            self.add_quad((cx - hw, cy, cz + hh), (cx + hw, cy, cz + hh), (cx + hw, cy, cz - hh), (cx - hw, cy, cz - hh), (0, 1, 0), material, uv_rect)
        elif facing == "-y":
            self.add_quad((cx - hw, cy, cz - hh), (cx + hw, cy, cz - hh), (cx + hw, cy, cz + hh), (cx - hw, cy, cz + hh), (0, -1, 0), material, uv_rect)
        elif facing == "+x":
            self.add_quad((cx, cy - hh, cz + hw), (cx, cy - hh, cz - hw), (cx, cy + hh, cz - hw), (cx, cy + hh, cz + hw), (1, 0, 0), material, uv_rect)
        elif facing == "-x":
            self.add_quad((cx, cy - hh, cz - hw), (cx, cy - hh, cz + hw), (cx, cy + hh, cz + hw), (cx, cy + hh, cz - hw), (-1, 0, 0), material, uv_rect)

    def add_box(self, w, h, d, center=(0.0, 0.0, 0.0), material="mat_powder_coat_dark", uv_rect=None, omit_faces=()):
        """Add an axis-aligned 3D box with clean per-face normals and UV mapping."""
        if uv_rect is None:
            uv_rect = DEFAULT_MAT_UVS.get(material, (0.04, 0.04, 0.46, 0.46))
        cx, cy, cz = center
        hw, hh, hd = w * 0.5, h * 0.5, d * 0.5
        x0, x1 = cx - hw, cx + hw
        y0, y1 = cy - hh, cy + hh
        z0, z1 = cz - hd, cz + hd

        if "+z" not in omit_faces:
            self.add_quad((x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1), (0, 0, 1), material, uv_rect)
        if "-z" not in omit_faces:
            self.add_quad((x1, y0, z0), (x0, y0, z0), (x0, y1, z0), (x1, y1, z0), (0, 0, -1), material, uv_rect)
        if "+x" not in omit_faces:
            self.add_quad((x1, y0, z1), (x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (1, 0, 0), material, uv_rect)
        if "-x" not in omit_faces:
            self.add_quad((x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0), (-1, 0, 0), material, uv_rect)
        if "+y" not in omit_faces:
            self.add_quad((x0, y1, z1), (x1, y1, z1), (x1, y1, z0), (x0, y1, z0), (0, 1, 0), material, uv_rect)
        if "-y" not in omit_faces:
            self.add_quad((x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1), (0, -1, 0), material, uv_rect)

    def add_beveled_box(self, w, h, d, bevel=0.0025, center=(0.0, 0.0, 0.0), material="mat_powder_coat_dark", uv_rect=None):
        """
        Adds a 3D box with beveled front/rear/side edges (chamfered prism) so specular highlights
        catch cleanly in close-up ego view without exploding triangle count.
        """
        if bevel <= 0.0002:
            return self.add_box(w, h, d, center, material, uv_rect)
        if uv_rect is None:
            uv_rect = DEFAULT_MAT_UVS.get(material, (0.04, 0.04, 0.46, 0.46))
        b = min(bevel, w * 0.25, h * 0.25, d * 0.25)
        cx, cy, cz = center
        hw, hh, hd = w * 0.5, h * 0.5, d * 0.5
        ihw, ihh, ihd = hw - b, hh - b, hd - b
        inv_s2 = 0.70710678

        # Main 6 inset faces
        self.add_quad((cx - ihw, cy - ihh, cz + hd), (cx + ihw, cy - ihh, cz + hd), (cx + ihw, cy + ihh, cz + hd), (cx - ihw, cy + ihh, cz + hd), (0, 0, 1), material, uv_rect)
        self.add_quad((cx + ihw, cy - ihh, cz - hd), (cx - ihw, cy - ihh, cz - hd), (cx - ihw, cy + ihh, cz - hd), (cx + ihw, cy + ihh, cz - hd), (0, 0, -1), material, uv_rect)
        self.add_quad((cx + hw, cy - ihh, cz + ihd), (cx + hw, cy - ihh, cz - ihd), (cx + hw, cy + ihh, cz - ihd), (cx + hw, cy + ihh, cz + ihd), (1, 0, 0), material, uv_rect)
        self.add_quad((cx - hw, cy - ihh, cz - ihd), (cx - hw, cy - ihh, cz + ihd), (cx - hw, cy + ihh, cz + ihd), (cx - hw, cy + ihh, cz - ihd), (-1, 0, 0), material, uv_rect)
        self.add_quad((cx - ihw, cy + hh, cz + ihd), (cx + ihw, cy + hh, cz + ihd), (cx + ihw, cy + hh, cz - ihd), (cx - ihw, cy + hh, cz - ihd), (0, 1, 0), material, uv_rect)
        self.add_quad((cx - ihw, cy - hh, cz - ihd), (cx + ihw, cy - hh, cz - ihd), (cx + ihw, cy - hh, cz + ihd), (cx - ihw, cy - hh, cz + ihd), (0, -1, 0), material, uv_rect)

        # 4 Front bevels (+Z to +/-X, +/-Y)
        self.add_quad((cx - ihw, cy + ihh, cz + hd), (cx + ihw, cy + ihh, cz + hd), (cx + ihw, cy + hh, cz + ihd), (cx - ihw, cy + hh, cz + ihd), (0, inv_s2, inv_s2), material, uv_rect)
        self.add_quad((cx - ihw, cy - hh, cz + ihd), (cx + ihw, cy - hh, cz + ihd), (cx + ihw, cy - ihh, cz + hd), (cx - ihw, cy - ihh, cz + hd), (0, -inv_s2, inv_s2), material, uv_rect)
        self.add_quad((cx + ihw, cy - ihh, cz + hd), (cx + hw, cy - ihh, cz + ihd), (cx + hw, cy + ihh, cz + ihd), (cx + ihw, cy + ihh, cz + hd), (inv_s2, 0, inv_s2), material, uv_rect)
        self.add_quad((cx - hw, cy - ihh, cz + ihd), (cx - ihw, cy - ihh, cz + hd), (cx - ihw, cy + ihh, cz + hd), (cx - hw, cy + ihh, cz + ihd), (-inv_s2, 0, inv_s2), material, uv_rect)

        # 4 Rear bevels (-Z to +/-X, +/-Y)
        self.add_quad((cx + ihw, cy + ihh, cz - hd), (cx - ihw, cy + ihh, cz - hd), (cx - ihw, cy + hh, cz - ihd), (cx + ihw, cy + hh, cz - ihd), (0, inv_s2, -inv_s2), material, uv_rect)
        self.add_quad((cx + ihw, cy - hh, cz - ihd), (cx - ihw, cy - hh, cz - ihd), (cx - ihw, cy - ihh, cz - hd), (cx + ihw, cy - ihh, cz - hd), (0, -inv_s2, -inv_s2), material, uv_rect)
        self.add_quad((cx + hw, cy - ihh, cz - ihd), (cx + ihw, cy - ihh, cz - hd), (cx + ihw, cy + ihh, cz - hd), (cx + hw, cy + ihh, cz - ihd), (inv_s2, 0, -inv_s2), material, uv_rect)
        self.add_quad((cx - ihw, cy - ihh, cz - hd), (cx - hw, cy - ihh, cz - ihd), (cx - hw, cy + ihh, cz - ihd), (cx - ihw, cy + ihh, cz - hd), (-inv_s2, 0, -inv_s2), material, uv_rect)

        # 4 Vertical/Longitudinal edge bevels (+/-X to +/-Y)
        self.add_quad((cx + hw, cy + ihh, cz + ihd), (cx + hw, cy + ihh, cz - ihd), (cx + ihw, cy + hh, cz - ihd), (cx + ihw, cy + hh, cz + ihd), (inv_s2, inv_s2, 0), material, uv_rect)
        self.add_quad((cx - ihw, cy + hh, cz + ihd), (cx - ihw, cy + hh, cz - ihd), (cx - hw, cy + ihh, cz - ihd), (cx - hw, cy + ihh, cz + ihd), (-inv_s2, inv_s2, 0), material, uv_rect)
        self.add_quad((cx + ihw, cy - hh, cz + ihd), (cx + ihw, cy - hh, cz - ihd), (cx + hw, cy - ihh, cz - ihd), (cx + hw, cy - ihh, cz + ihd), (inv_s2, -inv_s2, 0), material, uv_rect)
        self.add_quad((cx - hw, cy - ihh, cz + ihd), (cx - hw, cy - ihh, cz - ihd), (cx - ihw, cy - hh, cz - ihd), (cx - ihw, cy - hh, cz + ihd), (-inv_s2, -inv_s2, 0), material, uv_rect)

    def add_cylinder(self, radius, length, segments=16, center=(0.0, 0.0, 0.0), axis="z", material="mat_brushed_metal", capped=True, uv_rect=None):
        if uv_rect is None:
            uv_rect = DEFAULT_MAT_UVS.get(material, (0.54, 0.04, 0.96, 0.46))
        u0, v0, u1, v1 = uv_rect
        prim = self._prim(material)
        cx, cy, cz = center
        hl = length * 0.5

        def to_world(ca, sa, h_pos):
            if axis == "z":
                return (cx + ca * radius, cy + sa * radius, cz + h_pos), (ca, sa, 0.0)
            elif axis == "y":
                return (cx + ca * radius, cy + h_pos, cz + sa * radius), (ca, 0.0, sa)
            else:
                return (cx + h_pos, cy + ca * radius, cz + sa * radius), (0.0, ca, sa)

        pos, norms, uvs, idxs = [], [], [], []
        for i in range(segments + 1):
            t = i / segments
            ang = t * 2.0 * math.pi
            ca, sa = math.cos(ang), math.sin(ang)
            p_bot, n_vec = to_world(ca, sa, -hl)
            p_top, _ = to_world(ca, sa, hl)
            u = u0 + t * (u1 - u0)
            pos.extend([p_bot, p_top])
            norms.extend([n_vec, n_vec])
            uvs.extend([(u, v1), (u, v0)])

        for i in range(segments):
            b0 = i * 2
            t0 = b0 + 1
            b1 = b0 + 2
            t1 = b0 + 3
            if axis == "y":
                idxs.extend([b0, t0, t1, b0, t1, b1])
            else:
                idxs.extend([b0, b1, t1, b0, t1, t0])
        prim.add_geometry(pos, norms, uvs, idxs)

        if capped:
            um, vm = (u0 + u1) * 0.5, (v0 + v1) * 0.5
            ur, vr = (u1 - u0) * 0.45, (v1 - v0) * 0.45
            for sign in (-1.0, 1.0):
                c_pos, c_norms, c_uvs, c_idxs = [], [], [], []
                if axis == "z":
                    cap_center = (cx, cy, cz + sign * hl)
                    cap_n = (0.0, 0.0, sign)
                elif axis == "y":
                    cap_center = (cx, cy + sign * hl, cz)
                    cap_n = (0.0, sign, 0.0)
                else:
                    cap_center = (cx + sign * hl, cy, cz)
                    cap_n = (sign, 0.0, 0.0)
                c_pos.append(cap_center)
                c_norms.append(cap_n)
                c_uvs.append((um, vm))
                for i in range(segments + 1):
                    ang = (i / segments) * 2.0 * math.pi
                    ca, sa = math.cos(ang), math.sin(ang)
                    pt, _ = to_world(ca, sa, sign * hl)
                    c_pos.append(pt)
                    c_norms.append(cap_n)
                    c_uvs.append((um + ca * ur, vm + sa * vr))
                for i in range(1, segments + 1):
                    if (sign > 0 and axis != "y") or (sign < 0 and axis == "y"):
                        c_idxs.extend([0, i, i + 1])
                    else:
                        c_idxs.extend([0, i + 1, i])
                prim.add_geometry(c_pos, c_norms, c_uvs, c_idxs)

    def add_tube(self, curve_points, radius=0.004, radial_segments=8, material="mat_cable_green", uv_rect=None):
        """Extrude a smooth 3D tube along a polyline of 3D points (for cables, handles, conduits)."""
        if uv_rect is None:
            uv_rect = DEFAULT_MAT_UVS.get(material, (0.54, 0.54, 0.96, 0.72))
        u0, v0, u1, v1 = uv_rect
        pts = [np.array(p, dtype=np.float64) for p in curve_points]
        n_pts = len(pts)
        if n_pts < 2:
            return
        prim = self._prim(material)
        pos, norms, uvs, idxs = [], [], [], []

        for i in range(n_pts):
            if i == 0:
                tangent = pts[1] - pts[0]
            elif i == n_pts - 1:
                tangent = pts[-1] - pts[-2]
            else:
                tangent = pts[i + 1] - pts[i - 1]
            t_len = np.linalg.norm(tangent)
            tangent = tangent / (t_len if t_len > 1e-8 else 1.0)
            up = np.array([0.0, 1.0, 0.0]) if abs(tangent[1]) < 0.9 else np.array([1.0, 0.0, 0.0])
            binorm = np.cross(tangent, up)
            binorm /= np.linalg.norm(binorm) + 1e-8
            norm_v = np.cross(binorm, tangent)

            v_coord = v0 + (i / (n_pts - 1)) * (v1 - v0)
            for j in range(radial_segments + 1):
                u_frac = j / radial_segments
                ang = u_frac * 2.0 * math.pi
                ca, sa = math.cos(ang), math.sin(ang)
                radial_n = ca * binorm + sa * norm_v
                vertex = pts[i] + radius * radial_n
                pos.append((float(vertex[0]), float(vertex[1]), float(vertex[2])))
                norms.append((float(radial_n[0]), float(radial_n[1]), float(radial_n[2])))
                uvs.append((u0 + u_frac * (u1 - u0), v_coord))

        ring = radial_segments + 1
        for i in range(n_pts - 1):
            for j in range(radial_segments):
                a = i * ring + j
                b = a + 1
                c = (i + 1) * ring + j + 1
                d = (i + 1) * ring + j
                idxs.extend([a, b, c, a, c, d])

        prim.add_geometry(pos, norms, uvs, idxs)

    def add_knurled_screw(self, center, radius=0.0032, depth=0.0028, material="mat_brushed_metal"):
        """Adds a realistic rack screw / captive thumbscrew with washer collar and hex/Torx recess."""
        cx, cy, cz = center
        # Washer collar
        self.add_cylinder(radius * 1.25, depth * 0.35, segments=12, center=(cx, cy, cz + depth * 0.17), axis="z", material="mat_powder_coat_dark")
        # Knurled head cylinder
        self.add_cylinder(radius, depth * 0.85, segments=14, center=(cx, cy, cz + depth * 0.55), axis="z", material=material)
        # Inner Torx/Hex dark recess
        self.add_cylinder(radius * 0.46, depth * 0.25, segments=6, center=(cx, cy, cz + depth * 0.90), axis="z", material="mat_powder_coat_dark")

    def add_fan_rotor(self, outer_radius, depth, blade_count=9, material_hub="mat_brushed_metal", material_blades="mat_plastic_abs"):
        """
        Builds a high-detail axial fan rotor centered at local (0, 0, 0) so rotating around Z (`rotation.z`)
        spins the motor hub, metallic rotor cap, and curved multi-segment swept blades cleanly.
        """
        hub_r = outer_radius * 0.36
        # Outer cylindrical fan housing / shroud ring
        self.add_cylinder(outer_radius * 0.98, depth * 0.18, segments=20, center=(0, 0, -depth * 0.36), axis="z", material="mat_powder_coat_dark", capped=False)
        # Central motor hub + precision machined cap + copper winding peek
        self.add_cylinder(hub_r, depth * 0.86, segments=18, center=(0, 0, 0), axis="z", material="mat_plastic_abs")
        self.add_cylinder(hub_r * 0.72, depth * 0.90, segments=16, center=(0, 0, depth * 0.03), axis="z", material=material_hub)
        self.add_cylinder(hub_r * 0.28, depth * 0.95, segments=12, center=(0, 0, depth * 0.05), axis="z", material="mat_powder_coat_dark")

        u0, v0, u1, v1 = DEFAULT_MAT_UVS.get(material_blades, (0.53, 0.53, 0.97, 0.72))
        r_in = hub_r * 0.88
        r_mid = outer_radius * 0.64
        r_out = outer_radius * 0.93
        chord_in = outer_radius * 0.28
        chord_mid = outer_radius * 0.36
        chord_out = outer_radius * 0.31

        for b in range(blade_count):
            theta = (b / blade_count) * 2.0 * math.pi
            # Root station (higher pitch ~38 deg), Mid station (~28 deg + forward sweep), Tip station (~20 deg + sweep)
            def blade_station(r, chord, pitch, sweep_ang):
                ang = theta + sweep_ang
                ct, st = math.cos(ang), math.sin(ang)
                dz = math.sin(pitch) * (chord * 0.5)
                dt = math.cos(pitch) * (chord * 0.5)
                p_lead = (ct * r - st * (-dt), st * r + ct * (-dt), -dz)
                p_trail = (ct * r - st * dt, st * r + ct * dt, dz)
                n_vec = (-st * math.sin(pitch), ct * math.sin(pitch), math.cos(pitch))
                return p_lead, p_trail, n_vec

            p0_l, p0_t, n0 = blade_station(r_in, chord_in, 0.66, -0.05)
            p1_l, p1_t, n1 = blade_station(r_mid, chord_mid, 0.49, 0.08)
            p2_l, p2_t, n2 = blade_station(r_out, chord_out, 0.36, 0.20)

            self.add_quad(p0_l, p1_l, p1_t, p0_t, n0, material_blades, (u0, v0, u1, v1), double_sided=True)
            self.add_quad(p1_l, p2_l, p2_t, p1_t, n1, material_blades, (u0, v0, u1, v1), double_sided=True)


# Default UV rectangles mapping into our 2K Texture Atlases
DEFAULT_MAT_UVS = {
    "mat_powder_coat_dark": (0.03, 0.03, 0.47, 0.47),
    "mat_powder_coat_medium": (0.05, 0.05, 0.45, 0.45),
    "mat_brushed_metal": (0.53, 0.03, 0.97, 0.47),
    "mat_vent_grille": (0.03, 0.53, 0.47, 0.97),
    "mat_plastic_abs": (0.53, 0.53, 0.97, 0.72),
    "mat_rubber_epdm": (0.55, 0.55, 0.95, 0.70),
    "mat_heatsink_metal": (0.53, 0.77, 0.97, 0.97),
    "mat_perforated_door": (0.0, 0.0, 1.0, 1.0),
    "mat_cable_green": (0.55, 0.55, 0.95, 0.70),
    "mat_cable_power": (0.55, 0.55, 0.95, 0.70),
    "mat_plastic_latch": (0.55, 0.55, 0.95, 0.70),
    "mat_plastic_usb_blue": (0.55, 0.55, 0.95, 0.70),
    "mat_arch_floor": (0.0, 0.0, 0.5, 0.5),
    "mat_arch_stripe_green": (0.52, 0.02, 0.73, 0.48),
    "mat_arch_floor_vent": (0.77, 0.02, 0.98, 0.48),
    "mat_arch_wall": (0.02, 0.52, 0.48, 0.98),
    "mat_arch_steel": (0.52, 0.52, 0.98, 0.98),
    "mat_collider": (0.0, 0.0, 1.0, 1.0),
}


def get_material_definitions():
    """
    Returns canonical glTF 2.0 PBR material definitions for the ROOT asset package.
    Includes Base Color, Roughness, Metallic, Normal, Ambient Occlusion (packed ORM),
    and separate controllable Emissive materials for LEDs, plus replaceable label/screen materials.
    """
    return {
        # Shared Hardware Atlas Materials
        "mat_powder_coat_dark": {
            "name": "mat_powder_coat_dark",
            "atlas": "hardware",
            "baseColorFactor": [0.88, 0.90, 0.92, 1.0],
            "metallicFactor": 0.72,
            "roughnessFactor": 0.88,
            "normalScale": 1.0,
        },
        "mat_powder_coat_medium": {
            "name": "mat_powder_coat_medium",
            "atlas": "hardware",
            "baseColorFactor": [1.0, 1.0, 1.0, 1.0],
            "metallicFactor": 0.68,
            "roughnessFactor": 0.82,
            "normalScale": 0.9,
        },
        "mat_brushed_metal": {
            "name": "mat_brushed_metal",
            "atlas": "hardware",
            "baseColorFactor": [1.0, 1.0, 1.0, 1.0],
            "metallicFactor": 0.92,
            "roughnessFactor": 0.85,
            "normalScale": 0.8,
        },
        "mat_vent_grille": {
            "name": "mat_vent_grille",
            "atlas": "hardware",
            "baseColorFactor": [0.95, 0.97, 0.98, 1.0],
            "metallicFactor": 0.80,
            "roughnessFactor": 0.90,
            "normalScale": 1.2,
        },
        "mat_plastic_abs": {
            "name": "mat_plastic_abs",
            "atlas": "hardware",
            "baseColorFactor": [0.92, 0.94, 0.96, 1.0],
            "metallicFactor": 0.12,
            "roughnessFactor": 0.95,
            "normalScale": 0.7,
        },
        "mat_rubber_epdm": {
            "name": "mat_rubber_epdm",
            "atlas": "hardware",
            "baseColorFactor": [0.75, 0.77, 0.79, 1.0],
            "metallicFactor": 0.05,
            "roughnessFactor": 1.0,
            "normalScale": 0.6,
        },
        "mat_heatsink_metal": {
            "name": "mat_heatsink_metal",
            "atlas": "hardware",
            "baseColorFactor": [1.0, 1.0, 1.0, 1.0],
            "metallicFactor": 0.95,
            "roughnessFactor": 0.85,
            "normalScale": 1.2,
        },
        "mat_perforated_door": {
            "name": "mat_perforated_door",
            "atlas": "perforated",
            "baseColorFactor": [1.0, 1.0, 1.0, 1.0],
            "metallicFactor": 0.85,
            "roughnessFactor": 0.86,
            "normalScale": 1.15,
            "alphaMode": "MASK",
            "alphaCutoff": 0.38,
            "doubleSided": True,
        },
        "mat_copper_heatpipe": {
            "name": "mat_copper_heatpipe",
            "atlas": None,
            "baseColorFactor": [0.86, 0.49, 0.28, 1.0],
            "metallicFactor": 0.96,
            "roughnessFactor": 0.24,
        },
        "mat_pcb_dark": {
            "name": "mat_pcb_dark",
            "atlas": None,
            "baseColorFactor": [0.06, 0.14, 0.10, 1.0],
            "metallicFactor": 0.25,
            "roughnessFactor": 0.48,
        },
        "mat_cable_green": {
            "name": "mat_cable_green",
            "atlas": None,
            "baseColorFactor": [0.46, 0.80, 0.14, 1.0],
            "metallicFactor": 0.05,
            "roughnessFactor": 0.42,
            "emissiveFactor": [0.015, 0.04, 0.005],
        },
        "mat_plastic_latch": {
            "name": "mat_plastic_latch",
            "atlas": None,
            "baseColorFactor": [0.58, 0.19, 0.14, 1.0],
            "metallicFactor": 0.18,
            "roughnessFactor": 0.46,
        },
        "mat_plastic_usb_blue": {
            "name": "mat_plastic_usb_blue",
            "atlas": None,
            "baseColorFactor": [0.10, 0.38, 0.75, 1.0],
            "metallicFactor": 0.08,
            "roughnessFactor": 0.44,
        },
        "mat_cable_power": {
            "name": "mat_cable_power",
            "atlas": None,
            "baseColorFactor": [0.10, 0.12, 0.13, 1.0],
            "metallicFactor": 0.08,
            "roughnessFactor": 0.62,
        },
        "mat_gold_contacts": {
            "name": "mat_gold_contacts",
            "atlas": None,
            "baseColorFactor": [0.92, 0.74, 0.26, 1.0],
            "metallicFactor": 0.96,
            "roughnessFactor": 0.22,
        },
        "mat_glass_tinted": {
            "name": "mat_glass_tinted",
            "atlas": None,
            "baseColorFactor": [0.12, 0.17, 0.20, 0.55],
            "metallicFactor": 0.10,
            "roughnessFactor": 0.12,
            "alphaMode": "BLEND",
            "doubleSided": True,
        },

        # Architecture Materials (Floor uses dedicated seamless 2K concrete tile set; others use architecture atlas)
        "mat_arch_floor": {
            "name": "mat_arch_floor",
            "atlas": "floor_concrete",
            "baseColorFactor": [1.0, 1.0, 1.0, 1.0],
            "metallicFactor": 0.12,
            "roughnessFactor": 0.90,
            "normalScale": 1.0,
        },
        "mat_arch_stripe_green": {
            "name": "mat_arch_stripe_green",
            "atlas": "architecture",
            "baseColorFactor": [0.88, 0.92, 0.84, 1.0],
            "metallicFactor": 0.08,
            "roughnessFactor": 0.88,
            "normalScale": 0.7,
        },
        "mat_arch_floor_vent": {
            "name": "mat_arch_floor_vent",
            "atlas": "architecture",
            "baseColorFactor": [1.0, 1.0, 1.0, 1.0],
            "metallicFactor": 0.88,
            "roughnessFactor": 0.88,
            "normalScale": 1.2,
        },
        "mat_arch_wall": {
            "name": "mat_arch_wall",
            "atlas": "architecture",
            "baseColorFactor": [1.0, 1.0, 1.0, 1.0],
            "metallicFactor": 0.30,
            "roughnessFactor": 0.95,
            "normalScale": 0.9,
        },
        "mat_arch_steel": {
            "name": "mat_arch_steel",
            "atlas": "architecture",
            "baseColorFactor": [1.0, 1.0, 1.0, 1.0],
            "metallicFactor": 0.92,
            "roughnessFactor": 0.86,
            "normalScale": 0.8,
        },

        # Separately Controllable Emissive LED Materials
        "mat_led_power": {
            "name": "mat_led_power",
            "atlas": None,
            "baseColorFactor": [0.46, 0.88, 0.14, 1.0],
            "metallicFactor": 0.05,
            "roughnessFactor": 0.22,
            "emissiveFactor": [0.38, 0.86, 0.10],
            "extras": {"controllable": True, "ledRole": "power", "defaultState": "online"},
        },
        "mat_led_activity": {
            "name": "mat_led_activity",
            "atlas": None,
            "baseColorFactor": [0.20, 0.76, 0.98, 1.0],
            "metallicFactor": 0.05,
            "roughnessFactor": 0.22,
            "emissiveFactor": [0.16, 0.68, 0.95],
            "extras": {"controllable": True, "ledRole": "activity", "defaultState": "blinking"},
        },
        "mat_led_fault": {
            "name": "mat_led_fault",
            "atlas": None,
            "baseColorFactor": [0.22, 0.08, 0.06, 1.0],
            "metallicFactor": 0.05,
            "roughnessFactor": 0.28,
            "emissiveFactor": [0.0, 0.0, 0.0],
            "extras": {"controllable": True, "ledRole": "fault", "defaultState": "off_healthy"},
        },
        "mat_led_boot": {
            "name": "mat_led_boot",
            "atlas": None,
            "baseColorFactor": [0.08, 0.15, 0.24, 1.0],
            "metallicFactor": 0.05,
            "roughnessFactor": 0.28,
            "emissiveFactor": [0.0, 0.0, 0.0],
            "extras": {"controllable": True, "ledRole": "boot", "defaultState": "off_ready"},
        },
        "mat_led_drive": {
            "name": "mat_led_drive",
            "atlas": None,
            "baseColorFactor": [0.45, 0.86, 0.15, 1.0],
            "metallicFactor": 0.05,
            "roughnessFactor": 0.22,
            "emissiveFactor": [0.36, 0.82, 0.10],
            "extras": {"controllable": True, "ledRole": "drive_status"},
        },
        "mat_led_gpu_load": {
            "name": "mat_led_gpu_load",
            "atlas": None,
            "baseColorFactor": [0.36, 0.88, 0.22, 1.0],
            "metallicFactor": 0.05,
            "roughnessFactor": 0.20,
            "emissiveFactor": [0.28, 0.82, 0.14],
            "extras": {"controllable": True, "ledRole": "gpu_utilization"},
        },
        "mat_led_port_link": {
            "name": "mat_led_port_link",
            "atlas": None,
            "baseColorFactor": [0.46, 0.88, 0.14, 1.0],
            "metallicFactor": 0.05,
            "roughnessFactor": 0.22,
            "emissiveFactor": [0.38, 0.84, 0.10],
            "extras": {"controllable": True, "ledRole": "network_link"},
        },
        "mat_led_port_act": {
            "name": "mat_led_port_act",
            "atlas": None,
            "baseColorFactor": [0.95, 0.65, 0.12, 1.0],
            "metallicFactor": 0.05,
            "roughnessFactor": 0.22,
            "emissiveFactor": [0.72, 0.46, 0.06],
            "extras": {"controllable": True, "ledRole": "network_activity"},
        },
        "mat_led_pdu": {
            "name": "mat_led_pdu",
            "atlas": None,
            "baseColorFactor": [0.46, 0.88, 0.14, 1.0],
            "metallicFactor": 0.05,
            "roughnessFactor": 0.22,
            "emissiveFactor": [0.36, 0.80, 0.10],
            "extras": {"controllable": True, "ledRole": "pdu_outlet"},
        },
        "mat_led_rack_frame": {
            "name": "mat_led_rack_frame",
            "atlas": None,
            "baseColorFactor": [0.45, 0.88, 0.12, 1.0],
            "metallicFactor": 0.05,
            "roughnessFactor": 0.22,
            "emissiveFactor": [0.26, 0.72, 0.05],
            "extras": {"controllable": True, "ledRole": "rack_highlight_frame"},
        },
        "mat_light_cool_white": {
            "name": "mat_light_cool_white",
            "atlas": None,
            "baseColorFactor": [0.92, 0.97, 1.0, 1.0],
            "metallicFactor": 0.0,
            "roughnessFactor": 0.15,
            "emissiveFactor": [0.88, 0.95, 0.99],
            "extras": {"controllable": True, "ledRole": "room_ceiling_light"},
        },

        # Replaceable Label & Dynamic Screen Materials
        "mat_label_model": {
            "name": "mat_label_model",
            "atlas": "labels",
            "baseColorFactor": [1.0, 1.0, 1.0, 1.0],
            "metallicFactor": 0.15,
            "roughnessFactor": 0.42,
            "emissiveFactor": [0.12, 0.14, 0.14],
            "extras": {"dynamicSurface": "label_model", "replaceable": True},
        },
        "mat_label_hostname": {
            "name": "mat_label_hostname",
            "atlas": "labels",
            "baseColorFactor": [1.0, 1.0, 1.0, 1.0],
            "metallicFactor": 0.10,
            "roughnessFactor": 0.40,
            "emissiveFactor": [0.14, 0.16, 0.16],
            "extras": {"dynamicSurface": "label_hostname", "replaceable": True},
        },
        "mat_label_inventory": {
            "name": "mat_label_inventory",
            "atlas": "labels",
            "baseColorFactor": [1.0, 1.0, 1.0, 1.0],
            "metallicFactor": 0.10,
            "roughnessFactor": 0.45,
            "extras": {"dynamicSurface": "label_inventory", "replaceable": True},
        },
        "mat_rack_nameplate": {
            "name": "mat_rack_nameplate",
            "atlas": "labels",
            "baseColorFactor": [1.0, 1.0, 1.0, 1.0],
            "metallicFactor": 0.20,
            "roughnessFactor": 0.38,
            "emissiveFactor": [0.16, 0.18, 0.18],
            "extras": {"dynamicSurface": "rack_nameplate", "replaceable": True},
        },
        "mat_wall_branding": {
            "name": "mat_wall_branding",
            "atlas": "labels",
            "baseColorFactor": [1.0, 1.0, 1.0, 1.0],
            "metallicFactor": 0.24,
            "roughnessFactor": 0.92,
            "extras": {"dynamicSurface": "wall_branding", "replaceable": True},
        },
        "mat_signage": {
            "name": "mat_signage",
            "atlas": "labels",
            "baseColorFactor": [1.0, 1.0, 1.0, 1.0],
            "metallicFactor": 0.22,
            "roughnessFactor": 0.40,
            "extras": {"dynamicSurface": "signage", "replaceable": True},
        },
        "mat_monitor_screen_01": {
            "name": "mat_monitor_screen_01",
            "atlas": "screen_01",
            "baseColorFactor": [1.0, 1.0, 1.0, 1.0],
            "metallicFactor": 0.05,
            "roughnessFactor": 0.18,
            "emissiveFactor": [0.75, 0.82, 0.85],
            "extras": {"dynamicSurface": "monitor_screen_01", "replaceable": True, "uvSpace": "0..1"},
        },
        "mat_monitor_screen_02": {
            "name": "mat_monitor_screen_02",
            "atlas": "screen_02",
            "baseColorFactor": [1.0, 1.0, 1.0, 1.0],
            "metallicFactor": 0.05,
            "roughnessFactor": 0.18,
            "emissiveFactor": [0.75, 0.82, 0.85],
            "extras": {"dynamicSurface": "monitor_screen_02", "replaceable": True, "uvSpace": "0..1"},
        },
        "mat_monitor_screen_03": {
            "name": "mat_monitor_screen_03",
            "atlas": "screen_03",
            "baseColorFactor": [1.0, 1.0, 1.0, 1.0],
            "metallicFactor": 0.05,
            "roughnessFactor": 0.18,
            "emissiveFactor": [0.75, 0.82, 0.85],
            "extras": {"dynamicSurface": "monitor_screen_03", "replaceable": True, "uvSpace": "0..1"},
        },
        "mat_terminal_screen": {
            "name": "mat_terminal_screen",
            "atlas": "screen_04",
            "baseColorFactor": [1.0, 1.0, 1.0, 1.0],
            "metallicFactor": 0.05,
            "roughnessFactor": 0.18,
            "emissiveFactor": [0.75, 0.82, 0.85],
            "extras": {"dynamicSurface": "monitor_screen", "replaceable": True, "uvSpace": "0..1"},
        },
        "mat_collider": {
            "name": "mat_collider",
            "atlas": None,
            "baseColorFactor": [0.2, 0.9, 0.4, 0.0],
            "metallicFactor": 0.0,
            "roughnessFactor": 1.0,
            "alphaMode": "BLEND",
            "extras": {"isColliderMaterial": True},
        },
    }


ATLAS_TEXTURE_FILES = {
    "hardware": {
        "baseColor": "root_hardware_atlas_basecolor_2k.png",
        "normal": "root_hardware_atlas_normal_2k.png",
        "orm": "root_hardware_atlas_orm_2k.png",
    },
    "perforated": {
        "baseColor": "root_perforated_mesh_basecolor_2k.png",
        "normal": "root_perforated_mesh_normal_2k.png",
        "orm": "root_perforated_mesh_orm_2k.png",
    },
    "architecture": {
        "baseColor": "root_architecture_atlas_basecolor_2k.png",
        "normal": "root_architecture_atlas_normal_2k.png",
        "orm": "root_architecture_atlas_orm_2k.png",
    },
    "floor_concrete": {
        "baseColor": "root_floor_concrete_basecolor_2k.png",
        "normal": "root_floor_concrete_normal_2k.png",
        "orm": "root_floor_concrete_orm_2k.png",
    },
    "labels": {
        "baseColor": "root_labels_atlas_2k.png",
    },
    "screen_01": {
        "baseColor": "root_screen_01_telemetry.png",
    },
    "screen_02": {
        "baseColor": "root_screen_02_workloads.png",
    },
    "screen_03": {
        "baseColor": "root_screen_03_network.png",
    },
    "screen_04": {
        "baseColor": "root_screen_04_maintenance.png",
    },
}


class GltfAssetDocument:
    """
    Constructs a complete glTF 2.0 Scene Hierarchy and compiles it to:
      - Binary .glb (with relative texture URIs to `textures/` so 2K atlases are shared across assets)
      - Editable .gltf (JSON + binary .bin buffer in `source/gltf/`)
    """
    def __init__(self, asset_name, metadata=None):
        self.asset_name = asset_name
        self.metadata = metadata or {}
        self.nodes = []
        self.root_node_indices = []
        self.meshes = []  # list of MeshBuilder

    def add_node(self, name, mesh_builder=None, translation=None, rotation=None, scale=None, parent_idx=None, extras=None):
        node = {"name": name}
        if translation is not None and any(abs(x) > 1e-7 for x in translation):
            node["translation"] = [round(float(x), 6) for x in translation]
        if rotation is not None and rotation != (0, 0, 0, 1):
            node["rotation"] = [round(float(x), 6) for x in rotation]
        if scale is not None and scale != (1, 1, 1):
            node["scale"] = [round(float(x), 6) for x in scale]
        if extras is not None:
            node["extras"] = extras

        if mesh_builder is not None and not mesh_builder.is_empty():
            mesh_idx = len(self.meshes)
            self.meshes.append(mesh_builder)
            node["mesh"] = mesh_idx

        idx = len(self.nodes)
        self.nodes.append(node)
        if parent_idx is None:
            self.root_node_indices.append(idx)
        else:
            parent = self.nodes[parent_idx]
            if "children" not in parent:
                parent["children"] = []
            parent["children"].append(idx)
        return idx

    def add_attachment_point(self, name, position, normal=(0.0, 0.0, 1.0), connector_type="rj45", parent_idx=None, extra_meta=None):
        extras = {
            "isAttachmentPoint": True,
            "connectorType": connector_type,
            "normal": [round(float(x), 4) for x in normal],
        }
        if extra_meta:
            extras.update(extra_meta)
        return self.add_node(name, mesh_builder=None, translation=position, parent_idx=parent_idx, extras=extras)

    def _compile_gltf_dict_and_bin(self, texture_rel_prefix):
        mat_defs = get_material_definitions()
        used_mat_names = []
        for mb in self.meshes:
            for m_name in mb.primitives.keys():
                if m_name not in used_mat_names:
                    used_mat_names.append(m_name)

        images = []
        textures = []
        image_lookup = {}

        def get_texture_idx(filename):
            if filename not in image_lookup:
                img_idx = len(images)
                uri = f"{texture_rel_prefix}/{filename}".replace("\\", "/")
                images.append({"name": filename, "uri": uri})
                tex_idx = len(textures)
                textures.append({"sampler": 0, "source": img_idx, "name": filename})
                image_lookup[filename] = tex_idx
            return image_lookup[filename]

        materials = []
        mat_index_map = {}
        for m_name in used_mat_names:
            m_spec = mat_defs.get(m_name, mat_defs["mat_powder_coat_dark"])
            pbr = {
                "baseColorFactor": m_spec.get("baseColorFactor", [1.0, 1.0, 1.0, 1.0]),
                "metallicFactor": m_spec.get("metallicFactor", 0.5),
                "roughnessFactor": m_spec.get("roughnessFactor", 0.5),
            }
            mat_obj = {
                "name": m_name,
                "pbrMetallicRoughness": pbr,
            }
            atlas_key = m_spec.get("atlas")
            if atlas_key and atlas_key in ATLAS_TEXTURE_FILES:
                t_files = ATLAS_TEXTURE_FILES[atlas_key]
                if "baseColor" in t_files:
                    bc_idx = get_texture_idx(t_files["baseColor"])
                    pbr["baseColorTexture"] = {"index": bc_idx}
                    if "emissiveFactor" in m_spec:
                        mat_obj["emissiveTexture"] = {"index": bc_idx}
                if "orm" in t_files:
                    orm_idx = get_texture_idx(t_files["orm"])
                    pbr["metallicRoughnessTexture"] = {"index": orm_idx}
                    mat_obj["occlusionTexture"] = {"index": orm_idx, "strength": 1.0}
                if "normal" in t_files:
                    norm_idx = get_texture_idx(t_files["normal"])
                    mat_obj["normalTexture"] = {"index": norm_idx, "scale": m_spec.get("normalScale", 1.0)}

            if "emissiveFactor" in m_spec:
                mat_obj["emissiveFactor"] = m_spec["emissiveFactor"]
            if "alphaMode" in m_spec:
                mat_obj["alphaMode"] = m_spec["alphaMode"]
            if "alphaCutoff" in m_spec:
                mat_obj["alphaCutoff"] = m_spec["alphaCutoff"]
            if m_spec.get("doubleSided"):
                mat_obj["doubleSided"] = True
            if "extras" in m_spec:
                mat_obj["extras"] = m_spec["extras"]

            mat_index_map[m_name] = len(materials)
            materials.append(mat_obj)

        # Build binary buffer, bufferViews, accessors, and meshes
        bin_chunks = bytearray()
        buffer_views = []
        accessors = []
        gltf_meshes = []

        def align4(buf):
            rem = len(buf) % 4
            if rem:
                buf.extend(b"\x00" * (4 - rem))

        for mb in self.meshes:
            gltf_prims = []
            for m_name, prim in mb.primitives.items():
                pos_arr = np.array(prim.positions, dtype=np.float32)
                norm_arr = np.array(prim.normals, dtype=np.float32)
                uv_arr = np.array(prim.uvs, dtype=np.float32)
                n_verts = len(prim.positions)
                if n_verts < 65535:
                    idx_arr = np.array(prim.indices, dtype=np.uint16)
                    idx_comp_type = 5123  # UNSIGNED_SHORT
                else:
                    idx_arr = np.array(prim.indices, dtype=np.uint32)
                    idx_comp_type = 5125  # UNSIGNED_INT

                # Positions
                align4(bin_chunks)
                pos_offset = len(bin_chunks)
                pos_bytes = pos_arr.tobytes()
                bin_chunks.extend(pos_bytes)
                pos_bv = len(buffer_views)
                buffer_views.append({
                    "buffer": 0,
                    "byteOffset": pos_offset,
                    "byteLength": len(pos_bytes),
                    "target": 34962,  # ARRAY_BUFFER
                })
                pos_min = pos_arr.min(axis=0).tolist()
                pos_max = pos_arr.max(axis=0).tolist()
                pos_acc = len(accessors)
                accessors.append({
                    "bufferView": pos_bv,
                    "byteOffset": 0,
                    "componentType": 5126,  # FLOAT
                    "count": n_verts,
                    "type": "VEC3",
                    "min": [round(float(x), 6) for x in pos_min],
                    "max": [round(float(x), 6) for x in pos_max],
                })

                # Normals
                align4(bin_chunks)
                norm_offset = len(bin_chunks)
                norm_bytes = norm_arr.tobytes()
                bin_chunks.extend(norm_bytes)
                norm_bv = len(buffer_views)
                buffer_views.append({
                    "buffer": 0,
                    "byteOffset": norm_offset,
                    "byteLength": len(norm_bytes),
                    "target": 34962,
                })
                norm_acc = len(accessors)
                accessors.append({
                    "bufferView": norm_bv,
                    "byteOffset": 0,
                    "componentType": 5126,
                    "count": n_verts,
                    "type": "VEC3",
                })

                # UVs
                align4(bin_chunks)
                uv_offset = len(bin_chunks)
                uv_bytes = uv_arr.tobytes()
                bin_chunks.extend(uv_bytes)
                uv_bv = len(buffer_views)
                buffer_views.append({
                    "buffer": 0,
                    "byteOffset": uv_offset,
                    "byteLength": len(uv_bytes),
                    "target": 34962,
                })
                uv_acc = len(accessors)
                accessors.append({
                    "bufferView": uv_bv,
                    "byteOffset": 0,
                    "componentType": 5126,
                    "count": n_verts,
                    "type": "VEC2",
                })

                # Indices
                align4(bin_chunks)
                idx_offset = len(bin_chunks)
                idx_bytes = idx_arr.tobytes()
                bin_chunks.extend(idx_bytes)
                idx_bv = len(buffer_views)
                buffer_views.append({
                    "buffer": 0,
                    "byteOffset": idx_offset,
                    "byteLength": len(idx_bytes),
                    "target": 34963,  # ELEMENT_ARRAY_BUFFER
                })
                idx_acc = len(accessors)
                accessors.append({
                    "bufferView": idx_bv,
                    "byteOffset": 0,
                    "componentType": idx_comp_type,
                    "count": len(prim.indices),
                    "type": "SCALAR",
                })

                gltf_prims.append({
                    "attributes": {
                        "POSITION": pos_acc,
                        "NORMAL": norm_acc,
                        "TEXCOORD_0": uv_acc,
                    },
                    "indices": idx_acc,
                    "material": mat_index_map[m_name],
                    "mode": 4,  # TRIANGLES
                })

            gltf_meshes.append({
                "name": mb.name,
                "primitives": gltf_prims,
            })

        align4(bin_chunks)
        gltf_dict = {
            "asset": {
                "version": "2.0",
                "generator": "ROOT 3D Asset Package Builder v1.0",
                "copyright": "CC0 1.0 / MIT — ROOT Network & Datacenter Simulation",
                "extras": self.metadata,
            },
            "scene": 0,
            "scenes": [
                {
                    "name": self.asset_name,
                    "nodes": self.root_node_indices,
                }
            ],
            "nodes": self.nodes,
            "meshes": gltf_meshes,
            "materials": materials,
            "accessors": accessors,
            "bufferViews": buffer_views,
            "buffers": [
                {
                    "byteLength": len(bin_chunks),
                }
            ],
        }
        if textures:
            gltf_dict["samplers"] = [
                {
                    "magFilter": 9729,  # LINEAR
                    "minFilter": 9987,  # LINEAR_MIPMAP_LINEAR
                    "wrapS": 10497,     # REPEAT
                    "wrapT": 10497,     # REPEAT
                }
            ]
            gltf_dict["images"] = images
            gltf_dict["textures"] = textures

        return gltf_dict, bytes(bin_chunks)

    def export_glb(self, out_path, texture_rel_prefix="../../textures"):
        os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
        gltf_dict, bin_bytes = self._compile_gltf_dict_and_bin(texture_rel_prefix)
        json_bytes = json.dumps(gltf_dict, separators=(",", ":")).encode("utf-8")
        json_pad = (4 - (len(json_bytes) % 4)) % 4
        json_bytes += b" " * json_pad

        bin_pad = (4 - (len(bin_bytes) % 4)) % 4
        bin_bytes_padded = bin_bytes + (b"\x00" * bin_pad)

        total_len = 12 + 8 + len(json_bytes) + 8 + len(bin_bytes_padded)
        with open(out_path, "wb") as f:
            # GLB Header: magic 'glTF' (0x46546C67), version 2, total length
            f.write(struct.pack("<III", 0x46546C67, 2, total_len))
            # Chunk 0: JSON (0x4E4F534A)
            f.write(struct.pack("<II", len(json_bytes), 0x4E4F534A))
            f.write(json_bytes)
            # Chunk 1: BIN (0x004E4942)
            f.write(struct.pack("<II", len(bin_bytes_padded), 0x004E4942))
            f.write(bin_bytes_padded)

        return {
            "path": out_path,
            "size_kb": round(total_len / 1024.0, 1),
            "nodes": len(self.nodes),
            "meshes": len(self.meshes),
        }

    def export_gltf(self, out_gltf_path, texture_rel_prefix="../../textures"):
        os.makedirs(os.path.dirname(os.path.abspath(out_gltf_path)), exist_ok=True)
        bin_filename = os.path.splitext(os.path.basename(out_gltf_path))[0] + ".bin"
        out_bin_path = os.path.join(os.path.dirname(out_gltf_path), bin_filename)
        gltf_dict, bin_bytes = self._compile_gltf_dict_and_bin(texture_rel_prefix)
        gltf_dict["buffers"][0]["uri"] = bin_filename
        with open(out_bin_path, "wb") as bf:
            bf.write(bin_bytes)
        with open(out_gltf_path, "w", encoding="utf-8") as gf:
            json.dump(gltf_dict, gf, indent=2)
        return out_gltf_path
