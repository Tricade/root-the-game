#!/usr/bin/env python3
"""
ROOT 3D Asset Package — High-Realism 2K PBR Texture & Atlas Generator (v2.0)
Generates photorealistic 2048x2048 PBR texture maps (BaseColor, Normal, ORM,
Roughness, Metallic, Ambient Occlusion, Emissive, and High-DPI Dynamic UI/Label Atlases)
with multi-scale micro-surface detail, electrostatic powder-coat orange peel,
anisotropic brushed metal, concrete aggregate & specular floor wear, and PCB/heatsink details.
"""

import os
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "textures"))
os.makedirs(OUT_DIR, exist_ok=True)


def save_image(arr, filename, mode="RGB"):
    path = os.path.join(OUT_DIR, filename)
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), mode=mode)
    img.save(path, format="PNG", optimize=False)
    print(f"  [OK] Saved {filename} ({img.size[0]}x{img.size[1]} {mode})")
    return path


def height_to_normal(height_map, strength=4.0):
    """Convert a [0..1] float height map into a high-precision OpenGL tangent-space normal map."""
    h = height_map.astype(np.float32)
    dy, dx = np.gradient(h)
    nx = -dx * strength
    ny = dy * strength
    nz = np.ones_like(h)
    length = np.sqrt(nx * nx + ny * ny + nz * nz) + 1e-8
    nx /= length
    ny /= length
    nz /= length
    return np.stack([(nx * 0.5 + 0.5) * 255.0, (ny * 0.5 + 0.5) * 255.0, (nz * 0.5 + 0.5) * 255.0], axis=-1)


def tileable_noise(size, scale=16, seed=42):
    rng = np.random.default_rng(seed)
    small = rng.random((scale, scale), dtype=np.float32)
    img = Image.fromarray((small * 255).astype(np.uint8), mode="L")
    img = img.resize((size, size), resample=Image.Resampling.BICUBIC)
    return np.asarray(img, dtype=np.float32) / 255.0


def fbm_noise(size, octaves=(4, 8, 16, 32, 64, 128, 256), weights=(0.24, 0.22, 0.18, 0.14, 0.10, 0.07, 0.05), seed=101):
    total = np.zeros((size, size), dtype=np.float32)
    for i, (oct_scale, w) in enumerate(zip(octaves, weights)):
        total += tileable_noise(size, scale=oct_scale, seed=seed + i * 19) * w
    return total


def generate_hardware_atlas(size=2048):
    """
    2048x2048 Photorealistic Hardware PBR Atlas:
      - Top-Left (0..1024, 0..1024): Electrostatic Dark Charcoal Powder-Coated Steel (#1c2125)
        with orange-peel micro-bump, subtle finger smudges, and metallic flake response.
      - Top-Right (1024..2048, 0..1024): Fine Anisotropic Brushed Anodized Aluminum / Stainless (#747e83)
        with multi-frequency linear brush strokes and subtle edge bevel wear.
      - Bottom-Left (0..1024, 1024..2048): Stamped Honeycomb Hexagonal Ventilation Mesh
        with deep cavity AO, bevel normal lips, and dark internal shadow.
      - Bottom-Right (1024..2048, 1024..2048):
        - Upper half: Textured ABS Plastic (#14181c) & Ribbed EPDM Rubber (#0d1013)
        - Lower half: Dense Skived Copper/Aluminum Heatsink Fin Array & Gold/PCB Backplane Detail
    """
    print("Generating high-realism root_hardware_atlas_2k (2048x2048)...")
    half = size // 2
    rng = np.random.default_rng(2026)

    base = np.zeros((size, size, 3), dtype=np.float32)
    rough = np.zeros((size, size), dtype=np.float32)
    metal = np.zeros((size, size), dtype=np.float32)
    ao = np.ones((size, size), dtype=np.float32)
    height = np.full((size, size), 0.5, dtype=np.float32)

    # 1. Top-Left: Powder-Coated Dark Steel with realistic orange-peel & subtle wear
    fine_peel = tileable_noise(half, scale=256, seed=11) * 0.6 + tileable_noise(half, scale=512, seed=12) * 0.4
    micro_stipple = rng.normal(0.0, 1.0, (half, half)).astype(np.float32)
    smudge = fbm_noise(half, octaves=(4, 8, 16, 32), weights=(0.4, 0.3, 0.2, 0.1), seed=33)
    pc_col = np.array([29.0, 34.0, 38.0], dtype=np.float32)
    for c in range(3):
        base[0:half, 0:half, c] = pc_col[c] + (fine_peel - 0.5) * 6.5 + micro_stipple * 1.6 + (smudge - 0.5) * 9.0
    # Subtle roughness variation from handling/cleaning in a well-maintained data center
    rough[0:half, 0:half] = np.clip(0.36 + (smudge - 0.5) * 0.14 + (fine_peel - 0.5) * 0.06, 0.22, 0.56)
    metal[0:half, 0:half] = np.clip(0.72 + (fine_peel - 0.5) * 0.06, 0.62, 0.82)
    height[0:half, 0:half] = 0.5 + (fine_peel - 0.5) * 0.12 + micro_stipple * 0.025
    ao[0:half, 0:half] = np.clip(0.94 + (fine_peel - 0.5) * 0.10, 0.84, 1.0)

    # 2. Top-Right: Anisotropic Brushed Anodized Metal (#768085)
    streak_1 = np.asarray(
        Image.fromarray((rng.random((half, 24), dtype=np.float32) * 255).astype(np.uint8), mode="L").resize((half, half), Image.Resampling.BILINEAR),
        dtype=np.float32,
    ) / 255.0
    streak_2 = np.asarray(
        Image.fromarray((rng.random((half, 96), dtype=np.float32) * 255).astype(np.uint8), mode="L").resize((half, half), Image.Resampling.BILINEAR),
        dtype=np.float32,
    ) / 255.0
    micro_line = rng.normal(0.0, 0.04, (half, 1)).astype(np.float32)
    brush = np.clip(streak_1 * 0.55 + streak_2 * 0.45 + micro_line, 0.0, 1.0)
    bm_col = np.array([118.0, 126.0, 131.0], dtype=np.float32)
    for c in range(3):
        base[0:half, half:size, c] = bm_col[c] + (brush - 0.5) * 34.0 + (smudge - 0.5) * 12.0
    rough[0:half, half:size] = np.clip(0.22 + (brush - 0.5) * 0.12 + (smudge - 0.5) * 0.05, 0.12, 0.38)
    metal[0:half, half:size] = 0.91
    height[0:half, half:size] = 0.5 + (brush - 0.5) * 0.11
    ao[0:half, half:size] = np.clip(0.95 + (brush - 0.5) * 0.08, 0.86, 1.0)

    # 3. Bottom-Left: Stamped Honeycomb Hexagonal Ventilation Grille
    yy, xx = np.mgrid[0:half, 0:half].astype(np.float32)
    pitch_x = 14.0
    pitch_y = 12.124
    row_idx = np.floor(yy / pitch_y)
    gx = (xx + (row_idx % 2) * (pitch_x * 0.5)) % pitch_x - pitch_x * 0.5
    gy = (yy % pitch_y) - pitch_y * 0.5
    ax, ay = np.abs(gx), np.abs(gy)
    hex_d = np.maximum(ax * 0.866025 + ay * 0.5, ay)
    hole_r = 4.3
    bevel = np.clip((hex_d - hole_r) / 1.8, 0.0, 1.0)
    is_hole = hex_d < hole_r
    rim_highlight = np.exp(-((hex_d - (hole_r + 0.9)) ** 2) / 1.5)

    for c, val in enumerate([40.0, 46.0, 50.0]):
        base[half:size, 0:half, c] = np.where(is_hole, 6.0 + c, val + rim_highlight * 24.0 + (smudge - 0.5) * 6.0)
    rough[half:size, 0:half] = np.where(is_hole, 0.88, np.clip(0.30 - rim_highlight * 0.08, 0.18, 0.45))
    metal[half:size, 0:half] = np.where(is_hole, 0.10, 0.78)
    ao[half:size, 0:half] = np.where(is_hole, 0.08, np.clip(0.58 + bevel * 0.42, 0.45, 1.0))
    height[half:size, 0:half] = np.where(is_hole, 0.04, 0.55 + bevel * 0.30 + rim_highlight * 0.14)

    # 4. Bottom-Right: ABS Plastic / EPDM Rubber + Skived Copper/Aluminum Heatsink Array
    q = half // 2
    abs_stipple = tileable_noise(half, scale=512, seed=77)[:q, :]
    for c, val in enumerate([20.0, 24.0, 27.0]):
        base[half:half + q, half:size, c] = val + (abs_stipple - 0.5) * 7.0 + micro_stipple[:q, :] * 1.5
    rough[half:half + q, half:size] = np.clip(0.58 + (abs_stipple - 0.5) * 0.10, 0.45, 0.75)
    metal[half:half + q, half:size] = 0.06
    ao[half:half + q, half:size] = 0.95
    height[half:half + q, half:size] = 0.5 + (abs_stipple - 0.5) * 0.07

    fy, fx = np.mgrid[0:q, 0:half].astype(np.float32)
    fin_wave = 0.5 + 0.5 * np.cos(fx * (2.0 * math.pi / 8.0))
    is_copper = (fy > q * 0.38) & (fy < q * 0.68)
    fin_r = np.where(is_copper, 184.0, 118.0) * (0.55 + 0.45 * fin_wave)
    fin_g = np.where(is_copper, 115.0, 126.0) * (0.55 + 0.45 * fin_wave)
    fin_b = np.where(is_copper, 72.0, 132.0) * (0.55 + 0.45 * fin_wave)
    base[half + q:size, half:size, 0] = fin_r
    base[half + q:size, half:size, 1] = fin_g
    base[half + q:size, half:size, 2] = fin_b
    rough[half + q:size, half:size] = np.where(fin_wave > 0.45, 0.20, 0.55)
    metal[half + q:size, half:size] = 0.92
    ao[half + q:size, half:size] = np.clip(0.25 + 0.75 * fin_wave, 0.18, 1.0)
    height[half + q:size, half:size] = 0.15 + 0.80 * fin_wave

    normal = height_to_normal(height, strength=5.5)
    orm = np.stack([ao * 255.0, rough * 255.0, metal * 255.0], axis=-1)

    save_image(base, "root_hardware_atlas_basecolor_2k.png", "RGB")
    save_image(normal, "root_hardware_atlas_normal_2k.png", "RGB")
    save_image(orm, "root_hardware_atlas_orm_2k.png", "RGB")
    save_image(rough * 255.0, "root_hardware_atlas_roughness_2k.png", "L")
    save_image(metal * 255.0, "root_hardware_atlas_metallic_2k.png", "L")
    save_image(ao * 255.0, "root_hardware_atlas_ao_2k.png", "L")


def generate_perforated_door_mesh(size=2048):
    """
    Generates a crisp 2048x2048 RGBA hexagonal perforated mesh texture with realistic
    see-through ratio (~68% open area so internal servers and glowing LEDs shine through
    the rack doors just like in the reference image!).
    """
    print("Generating high-transparency root_perforated_mesh_2k (2048x2048 RGBA)...")
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    pitch_x = 28.0
    pitch_y = 24.248
    row_idx = np.floor(yy / pitch_y)
    gx = (xx + (row_idx % 2) * (pitch_x * 0.5)) % pitch_x - pitch_x * 0.5
    gy = (yy % pitch_y) - pitch_y * 0.5
    ax, ay = np.abs(gx), np.abs(gy)
    hex_dist = np.maximum(ax * 0.866025 + ay * 0.5, ay)
    hole_r = 10.6  # Wide hexagonal aperture so internal LEDs & green patch cables remain vividly visible!
    edge_width = 1.4
    alpha = np.clip((hex_dist - hole_r) / edge_width, 0.0, 1.0)
    lip = np.exp(-((hex_dist - (hole_r + 1.1)) ** 2) / 2.2)

    rgba = np.zeros((size, size, 4), dtype=np.float32)
    rgba[:, :, 0] = 30.0 + lip * 26.0
    rgba[:, :, 1] = 35.0 + lip * 28.0
    rgba[:, :, 2] = 39.0 + lip * 30.0
    rgba[:, :, 3] = alpha * 255.0

    height = alpha * (0.72 + lip * 0.28)
    normal = height_to_normal(height, strength=6.0)
    ao = np.clip(0.30 + alpha * 0.70, 0.20, 1.0)
    rough = np.where(alpha > 0.5, 0.28 - lip * 0.06, 0.70)
    metal = np.where(alpha > 0.5, 0.82, 0.0)
    orm = np.stack([ao * 255.0, rough * 255.0, metal * 255.0], axis=-1)

    save_image(rgba, "root_perforated_mesh_basecolor_2k.png", "RGBA")
    save_image(normal, "root_perforated_mesh_normal_2k.png", "RGB")
    save_image(orm, "root_perforated_mesh_orm_2k.png", "RGB")


def generate_architecture_atlas(size=2048):
    """
    Generates the 2048x2048 Modular Architecture PBR Atlas with realistic satin concrete floor tiles,
    painted green safety line, recessed air-return floor grilles, dark acoustic wall panels, and galvanized steel.
    """
    print("Generating high-realism root_architecture_atlas_2k (2048x2048)...")
    half = size // 2
    rng = np.random.default_rng(808)

    base = np.zeros((size, size, 3), dtype=np.float32)
    rough = np.zeros((size, size), dtype=np.float32)
    metal = np.zeros((size, size), dtype=np.float32)
    ao = np.ones((size, size), dtype=np.float32)
    height = np.full((size, size), 0.5, dtype=np.float32)

    macro = fbm_noise(half, octaves=(4, 8, 16, 32, 64, 128), weights=(0.28, 0.24, 0.20, 0.14, 0.09, 0.05), seed=505)
    micro = tileable_noise(half, scale=256, seed=606)
    fine = rng.normal(0.0, 1.0, (half, half)).astype(np.float32)

    # 1. Top-Left: Satin Polished Dark Concrete Raised-Floor Tile (2x2 tiles in 1024x1024)
    yy, xx = np.mgrid[0:half, 0:half].astype(np.float32)
    tx_mod = np.minimum(xx % 512.0, 512.0 - (xx % 512.0))
    ty_mod = np.minimum(yy % 512.0, 512.0 - (yy % 512.0))
    seam_d = np.minimum(tx_mod, ty_mod)
    is_seam = seam_d < 3.5
    is_chamfer = (seam_d >= 3.5) & (seam_d < 8.5)

    floor_col = np.array([64.0, 69.0, 72.0], dtype=np.float32)
    for c in range(3):
        col = floor_col[c] + (macro - 0.5) * 26.0 + (micro - 0.5) * 9.0 + fine * 1.8
        col = np.where(is_seam, 18.0, np.where(is_chamfer, col * 0.82, col))
        base[0:half, 0:half, c] = col
    # Low-to-medium satin roughness (0.16..0.38) so overhead lights & green rack glow reflect realistically!
    rough[0:half, 0:half] = np.where(is_seam, 0.85, np.clip(0.22 + (macro - 0.5) * 0.16 + (micro - 0.5) * 0.06, 0.14, 0.40))
    metal[0:half, 0:half] = np.where(is_seam, 0.05, 0.08)
    ao[0:half, 0:half] = np.where(is_seam, 0.18, np.where(is_chamfer, 0.72, 0.98))
    height[0:half, 0:half] = np.where(is_seam, 0.08, np.where(is_chamfer, 0.35, 0.54 + (macro - 0.5) * 0.05 + (micro - 0.5) * 0.03))

    # 2. Top-Right: Left half = Lime-green painted floor stripe (#76bd38); Right half = Floor return-air grille
    q = half // 2
    stripe_col = np.array([116.0, 188.0, 54.0], dtype=np.float32)
    for c in range(3):
        base[0:half, half:half + q, c] = stripe_col[c] + (macro[:, 0:q] - 0.5) * 18.0 + (micro[:, 0:q] - 0.5) * 8.0
    rough[0:half, half:half + q] = np.clip(0.30 + (macro[:, 0:q] - 0.5) * 0.12, 0.20, 0.44)
    metal[0:half, half:half + q] = 0.05
    ao[0:half, half:half + q] = 0.98
    height[0:half, half:half + q] = 0.56 + (macro[:, 0:q] - 0.5) * 0.05

    vy, vx = np.mgrid[0:half, 0:q].astype(np.float32)
    slat_y = vy % 20.0
    cross_x = vx % 128.0
    is_frame = (vx < 14.0) | (vx > q - 14.0) | ((vy % 256.0) < 12.0) | ((vy % 256.0) > 244.0)
    is_slat = (slat_y < 8.0) | (cross_x < 7.0) | is_frame
    for c, v in enumerate([38.0, 43.0, 46.0]):
        base[0:half, half + q:size, c] = np.where(is_slat, v + (macro[:, q:half] - 0.5) * 10.0, 5.0)
    rough[0:half, half + q:size] = np.where(is_slat, 0.32, 0.92)
    metal[0:half, half + q:size] = np.where(is_slat, 0.82, 0.05)
    ao[0:half, half + q:size] = np.where(is_slat, 0.86, 0.08)
    height[0:half, half + q:size] = np.where(is_frame, 0.78, np.where(is_slat, 0.62, 0.04))

    # 3. Bottom-Left: Industrial Dark Acoustic Wall Cladding (#22272b)
    wy, wx = np.mgrid[0:half, 0:half].astype(np.float32)
    w_seam = ((wx % 512.0) < 3.5) | ((wy % 512.0) < 3.5)
    wall_col = np.array([34.0, 39.0, 43.0], dtype=np.float32)
    for c in range(3):
        base[half:size, 0:half, c] = np.where(w_seam, 14.0, wall_col[c] + (macro - 0.5) * 9.0 + fine * 1.4)
    rough[half:size, 0:half] = np.clip(0.50 + (macro - 0.5) * 0.08, 0.38, 0.64)
    metal[half:size, 0:half] = 0.28
    ao[half:size, 0:half] = np.where(w_seam, 0.28, 0.96)
    height[half:size, 0:half] = np.where(w_seam, 0.16, 0.52 + fine * 0.02)

    # 4. Bottom-Right: Galvanized Brushed Steel for Cable Trays & Conduits (#828b90)
    galv_col = np.array([124.0, 132.0, 137.0], dtype=np.float32)
    for c in range(3):
        base[half:size, half:size, c] = galv_col[c] + (macro - 0.5) * 28.0 + (micro - 0.5) * 12.0
    rough[half:size, half:size] = np.clip(0.28 + (macro - 0.5) * 0.12, 0.18, 0.44)
    metal[half:size, half:size] = 0.90
    ao[half:size, half:size] = 0.96
    height[half:size, half:size] = 0.5 + (macro - 0.5) * 0.08

    normal = height_to_normal(height, strength=4.8)
    orm = np.stack([ao * 255.0, rough * 255.0, metal * 255.0], axis=-1)

    save_image(base, "root_architecture_atlas_basecolor_2k.png", "RGB")
    save_image(normal, "root_architecture_atlas_normal_2k.png", "RGB")
    save_image(orm, "root_architecture_atlas_orm_2k.png", "RGB")
    save_image(rough * 255.0, "root_architecture_atlas_roughness_2k.png", "L")
    save_image(metal * 255.0, "root_architecture_atlas_metallic_2k.png", "L")
    save_image(ao * 255.0, "root_architecture_atlas_ao_2k.png", "L")


def load_font(size, bold=False, mono=False):
    candidates = []
    if mono:
        candidates = ["consolab.ttf" if bold else "consola.ttf", "courbd.ttf" if bold else "cour.ttf"]
    else:
        candidates = ["segoeuib.ttf" if bold else "segoeui.ttf", "arialbd.ttf" if bold else "arial.ttf"]
    for name in candidates:
        try:
            return ImageFont.truetype(name, size)
        except Exception:
            pass
    return ImageFont.load_default()


def generate_dynamic_label_atlas(size=2048):
    print("Generating root_labels_atlas_2k (2048x2048)...")
    img = Image.new("RGB", (size, size), (20, 24, 27))
    draw = ImageDraw.Draw(img)

    f_rack_sm = load_font(32, bold=True)
    f_rack_lg = load_font(88, bold=True)
    f_title = load_font(40, bold=True)
    f_sub = load_font(25, bold=False, mono=True)
    f_mono_sm = load_font(21, bold=False, mono=True)
    f_hero_brand = load_font(112, bold=True)
    f_hero_sub = load_font(38, bold=False)

    # Row 0: RACK 01 .. RACK 08 vertical plaques matching reference image
    for i in range(8):
        x0 = i * 256
        y0 = 0
        draw.rectangle([x0 + 4, y0 + 4, x0 + 252, y0 + 252], fill=(17, 20, 23), outline=(48, 56, 60), width=3)
        draw.text((x0 + 52, y0 + 42), "RACK", fill=(182, 192, 195), font=f_rack_sm)
        draw.text((x0 + 44, y0 + 88), f"0{i + 1}", fill=(242, 247, 246), font=f_rack_lg)
        draw.text((x0 + 48, y0 + 206), "19\" EIA-310", fill=(112, 188, 44), font=f_mono_sm)

    # Row 1: Server Model Nameplates
    models = [
        ("ROOT R120", "1U EDGE SERVER · 8C / 32GB", (101, 214, 196)),
        ("ROOT C240", "2U COMPUTE NODE · 24C / 128GB", (139, 156, 255)),
        ("ROOT S360", "3U STORAGE ARRAY · 12 BAY / 24TB", (241, 189, 114)),
        ("ROOT A480", "4U AI ACCELERATOR · 4× GPU / 320GB", (190, 145, 255)),
    ]
    for i, (m_name, m_desc, accent) in enumerate(models):
        x0 = i * 512
        y0 = 256
        draw.rectangle([x0 + 6, y0 + 12, x0 + 506, y0 + 244], fill=(16, 20, 23), outline=(52, 60, 65), width=2)
        draw.rectangle([x0 + 6, y0 + 12, x0 + 18, y0 + 244], fill=accent)
        draw.text((x0 + 36, y0 + 46), m_name, fill=(242, 247, 246), font=f_title)
        draw.text((x0 + 36, y0 + 112), m_desc, fill=(160, 175, 178), font=f_sub)
        draw.text((x0 + 36, y0 + 174), "REV 4.2 · ROOT HARDWARE SYSTEMS", fill=(122, 204, 40), font=f_mono_sm)

    # Row 2: Replaceable Hostname & Inventory Barcode Tags
    hosts = [
        ("srv-edge-01.root.lan", "INV-RT-2026-0101", "RACK 02 · U05"),
        ("srv-comp-01.root.lan", "INV-RT-2026-0204", "RACK 02 · U08-09"),
        ("srv-stor-01.root.lan", "INV-RT-2026-0309", "RACK 02 · U12-14"),
        ("srv-aigpu-01.root.lan", "INV-RT-2026-0412", "RACK 02 · U17-20"),
    ]
    for i, (h_name, inv_no, loc) in enumerate(hosts):
        x0 = i * 512
        y0 = 512
        draw.rectangle([x0 + 6, y0 + 12, x0 + 506, y0 + 244], fill=(14, 18, 21), outline=(60, 70, 74), width=2)
        draw.rectangle([x0 + 6, y0 + 12, x0 + 18, y0 + 244], fill=(126, 211, 33))
        draw.text((x0 + 36, y0 + 36), h_name, fill=(235, 242, 240), font=f_title)
        draw.text((x0 + 36, y0 + 102), f"ASSET: {inv_no}  |  {loc}", fill=(145, 212, 90), font=f_sub)
        bx = x0 + 36
        for b in range(42):
            bw = 3 if (b * 7 + i) % 3 == 0 else 6
            draw.rectangle([bx, y0 + 158, bx + bw, y0 + 216], fill=(212, 222, 222))
            bx += bw + 4

    # Row 3: Network & Power Silkscreen Legends
    net_labels = [
        ("ROOT SW-08G", "8-PORT L2+ GIGABIT + 2× SFP+ UPLINK"),
        ("ROOT SW-16X", "16-PORT L3 MANAGED + 4× 10G SFP+"),
        ("PATCH PANEL 24P", "CAT6A SHIELDED KEYSTONE · PORTS 01–24"),
        ("ROOT PDU-16M", "16A METERED RACK PDU · 230V / 3.6KW"),
    ]
    for i, (n_title, n_sub) in enumerate(net_labels):
        x0 = i * 512
        y0 = 768
        draw.rectangle([x0 + 6, y0 + 12, x0 + 506, y0 + 244], fill=(18, 23, 26), outline=(55, 65, 70), width=2)
        draw.rectangle([x0 + 6, y0 + 12, x0 + 16, y0 + 244], fill=(86, 204, 242))
        draw.text((x0 + 36, y0 + 46), n_title, fill=(238, 244, 245), font=f_title)
        draw.text((x0 + 36, y0 + 116), n_sub, fill=(154, 170, 175), font=f_sub)
        ports_str = " ".join([f"{p:02d}" for p in range(1, 17)])
        draw.text((x0 + 36, y0 + 178), ports_str, fill=(126, 211, 33), font=f_mono_sm)

    # Bottom-Left: Feature Wall with Warm Downlight Cone ("ROOT. STABILE NETZWERKE...")
    # Match exact wall charcoal base (34, 39, 43) and feather cone to 0 at edges so zero rectangle border is visible!
    draw.rectangle([0, 1024, 1024, 2048], fill=(34, 39, 43))
    yy, xx = np.mgrid[0:1024, 0:1024].astype(np.float32)
    dx = xx - 500.0
    dy = np.maximum(1.0, yy - 35.0)
    cone_width = 48.0 + dy * 0.36
    edge_x = np.clip(np.minimum(xx, 1023.0 - xx) / 140.0, 0.0, 1.0)
    edge_y = np.clip((1023.0 - yy) / 150.0, 0.0, 1.0)
    cone = np.exp(-(dx * dx) / (2.0 * cone_width * cone_width)) * np.exp(-dy / 480.0) * edge_x * edge_y
    wall_arr = np.asarray(img.crop((0, 1024, 1024, 2048)), dtype=np.float32)
    wall_arr[:, :, 0] += cone * 115.0
    wall_arr[:, :, 1] += cone * 98.0
    wall_arr[:, :, 2] += cone * 68.0
    img.paste(Image.fromarray(np.clip(wall_arr, 0, 255).astype(np.uint8), mode="RGB"), (0, 1024))
    draw = ImageDraw.Draw(img)

    draw.text((150, 1210), "ROOT.", fill=(235, 238, 234), font=f_hero_brand)
    tagline = [
        "S T A B I L E",
        "N E T Z W E R K E",
        "F Ü R   E I N E",
        "V E R B U N D E N E",
        "Z U K U N F T .",
    ]
    for idx, line in enumerate(tagline):
        draw.text((154, 1395 + idx * 64), line, fill=(162, 170, 173), font=f_hero_sub)

    # Bottom-Right: Technical Room Signage & Safety Plaques
    signs = [
        (1048, 1048, 1990, 1260, (22, 30, 26), (126, 211, 33), "SEKTOR 01 · KALTGANG A", "ZUTRITT NUR FÜR AUTORISIERTES BETRIEBSPERSONAL"),
        (1048, 1290, 1990, 1500, (32, 26, 18), (242, 184, 75), "ACHTUNG · ESD-SCHUTZZONE", "VOR ARBEITEN AM RACK ERDUNG PRÜFEN · IEC 61340"),
        (1048, 1530, 1990, 1740, (34, 20, 20), (239, 83, 80), "BRANDSCHUTZTÜR · T90-RS", "GESCHLOSSEN HALTEN · FREIHALTEN DER RETTUNGSWEGE"),
        (1048, 1770, 1990, 1990, (18, 26, 32), (86, 204, 242), "STROMVERSORGUNG A+B · 400V", "REDUNDANTE EINSPEISUNG · VOR WARTUNG FREISCHALTEN"),
    ]
    for (x1, y1, x2, y2, bg, acc, s_title, s_sub) in signs:
        draw.rectangle([x1, y1, x2, y2], fill=bg, outline=(70, 80, 84), width=3)
        draw.rectangle([x1, y1, x1 + 18, y2], fill=acc)
        draw.text((x1 + 42, y1 + 42), s_title, fill=(240, 245, 244), font=f_title)
        draw.text((x1 + 42, y1 + 115), s_sub, fill=(175, 188, 190), font=f_sub)

    img.save(os.path.join(OUT_DIR, "root_labels_atlas_2k.png"), format="PNG")
    print("  [OK] Saved root_labels_atlas_2k.png (2048x2048 RGB)")


def generate_screen_ui_atlas(size=2048):
    print("Generating root_screens_ui_2k (2048x2048)...")
    img = Image.new("RGB", (size, size), (12, 16, 19))
    draw = ImageDraw.Draw(img)

    f_hdr = load_font(36, bold=True)
    f_sub = load_font(24, bold=True, mono=True)
    f_mono = load_font(22, bold=False, mono=True)
    f_big = load_font(64, bold=True, mono=True)

    # Top-Left (0..1024, 0..1024): Monitor 1 - Network Topology & Traffic Telemetry
    draw.rectangle([16, 16, 1008, 1008], fill=(14, 19, 22), outline=(48, 62, 66), width=3)
    draw.rectangle([16, 16, 1008, 86], fill=(20, 28, 32))
    draw.text((40, 32), "ROOT. // NETZWERK-TOPOLOGIE & UPLINK-TELEMETRIE", fill=(235, 242, 240), font=f_hdr)
    draw.ellipse([940, 38, 968, 66], fill=(126, 211, 33))

    nodes = [
        (512, 210, "CORE-RTR-01", "100G UPLINK · ONLINE", (126, 211, 33)),
        (260, 410, "TOR-SW-R01", "RACK 01 · 16P", (126, 211, 33)),
        (512, 410, "TOR-SW-R02", "RACK 02 · 16P", (126, 211, 33)),
        (764, 410, "TOR-SW-R03", "RACK 03 · 16P", (86, 204, 242)),
        (260, 620, "SRV-EDGE-01..04", "4× 1U ONLINE", (126, 211, 33)),
        (512, 620, "SRV-COMP-01..06", "6× 2U AKTIV", (126, 211, 33)),
        (764, 620, "SRV-AIGPU-01..02", "2× 4U GPU CLUSTER", (242, 184, 75)),
    ]
    links = [(0, 1), (0, 2), (0, 3), (1, 4), (2, 5), (3, 6)]
    for a, b in links:
        x1, y1, _, _, _ = nodes[a]
        x2, y2, _, _, _ = nodes[b]
        draw.line([x1, y1 + 35, x2, y2 - 35], fill=(88, 158, 45), width=4)

    for nx, ny, ntitle, nstat, ncol in nodes:
        draw.rectangle([nx - 110, ny - 36, nx + 110, ny + 36], fill=(22, 30, 35), outline=ncol, width=2)
        draw.text((nx - 96, ny - 24), ntitle, fill=(238, 244, 242), font=f_sub)
        draw.text((nx - 96, ny + 6), nstat, fill=ncol, font=f_mono)

    draw.rectangle([48, 720, 976, 972], fill=(10, 14, 17), outline=(42, 54, 58), width=2)
    draw.text((68, 736), "THROUGHPUT (GBIT/S) · CORE AGGREGATION: 48.6 GBIT/S", fill=(168, 184, 188), font=f_mono)
    for idx in range(36):
        bx = 68 + idx * 24
        bh = int(65 + 95 * (0.5 + 0.45 * np.sin(idx * 0.42)))
        col = (126, 211, 33) if bh < 145 else (86, 204, 242)
        draw.rectangle([bx, 948 - bh, bx + 16, 948], fill=col)

    # Top-Right (1024..2048, 0..1024): Monitor 2 - Rack Thermal, Power & Server Matrix
    draw.rectangle([1040, 16, 2032, 1008], fill=(14, 19, 22), outline=(48, 62, 66), width=3)
    draw.rectangle([1040, 16, 2032, 86], fill=(20, 28, 32))
    draw.text((1064, 32), "ROOT. // RACK-ENERGIE, KLIMA & SERVER-MATRIX", fill=(235, 242, 240), font=f_hdr)

    cards = [
        (1068, 118, "GESAMTLEISTUNG", "14,8 kW", "PUE 1,14 · REDUNDANT A+B", (126, 211, 33)),
        (1548, 118, "KALTGANG-TEMP.", "21,4 °C", "ABLULT 35,8 °C · CRAC OK", (86, 204, 242)),
        (1068, 318, "AKTIVE SERVER", "32 / 32", "6 RACKS · 0 KRITISCHE FEHLER", (126, 211, 33)),
        (1548, 318, "GPU-CLUSTER LAST", "84,2 %", "4U KI-KNOTEN · 68 °C", (242, 184, 75)),
    ]
    for cx, cy, ctitle, cval, csub, ccol in cards:
        draw.rectangle([cx, cy, cx + 452, cy + 174], fill=(20, 26, 30), outline=(52, 64, 68), width=2)
        draw.text((cx + 24, cy + 18), ctitle, fill=(165, 180, 184), font=f_sub)
        draw.text((cx + 24, cy + 56), cval, fill=ccol, font=f_big)
        draw.text((cx + 24, cy + 134), csub, fill=(210, 220, 222), font=f_mono)

    for r in range(6):
        rx = 1068 + r * 156
        ry = 530
        is_sel = (r == 1)
        outline_col = (126, 211, 33) if is_sel else (58, 70, 75)
        draw.rectangle([rx, ry, rx + 142, ry + 440], fill=(18, 22, 26), outline=outline_col, width=3 if is_sel else 2)
        draw.text((rx + 18, ry + 14), f"RACK 0{r + 1}", fill=(240, 245, 244), font=f_sub)
        for u in range(12):
            uy = ry + 56 + u * 30
            ucol = (94, 175, 35) if (u + r) % 7 != 0 else (235, 172, 56)
            draw.rectangle([rx + 14, uy, rx + 128, uy + 22], fill=ucol)

    # Bottom-Left (0..1024, 1024..2048): Monitor 3 - System Logs, RAID & GPU Compute Console
    draw.rectangle([16, 1040, 1008, 2032], fill=(12, 16, 19), outline=(48, 62, 66), width=3)
    draw.rectangle([16, 1040, 1008, 1110], fill=(20, 28, 32))
    draw.text((40, 1056), "ROOT. // SYSTEMPROTOKOLL, STORAGE & KI-CLUSTER", fill=(235, 242, 240), font=f_hdr)

    logs = [
        ("[07:14:02] INFO  rack_02.srv_aigpu_01  NVLink Fabric 4x GPU bereit (320 GB VRAM)", (126, 211, 33)),
        ("[07:14:05] INFO  rack_02.sw_16p_01     Port 01..16 Link-Up 10GBASE-T Full Duplex", (175, 190, 194)),
        ("[07:14:09] INFO  rack_01.srv_stor_01   ZFS Pool 'tank01' ONLINE (12x NVMe, 0 Fehler)", (126, 211, 33)),
        ("[07:14:12] WARN  rack_02.thermal       Ablufttemperatur 35.8 °C — Lüfterprofil 65%", (242, 184, 75)),
        ("[07:14:18] INFO  rack_03.pdu_01        Lastmessung Pfad A: 2,40 kW / 10,4 A @ 230V", (86, 204, 242)),
        ("[07:14:21] INFO  rack_04.srv_comp_02   Kernel 6.12-root-rt #1 SMP PREEMPT_DYNAMIC", (175, 190, 194)),
        ("[07:14:25] INFO  crac_unit_01          Kaltwasser-Vorlauf 12.2 °C / Gebläse 1420 RPM", (126, 211, 33)),
        ("[07:14:29] INFO  sec.access_door_01    Brandschutztür T90 verriegelt · Status OK", (175, 190, 194)),
    ]
    for idx, (line, col) in enumerate(logs):
        draw.text((44, 1138 + idx * 46), line, fill=col, font=f_mono)

    draw.rectangle([44, 1540, 980, 1995], fill=(16, 22, 26), outline=(52, 64, 68), width=2)
    draw.text((68, 1564), "4HE KI-SERVER // GPU-AUSLASTUNG & LÜFTERDREHZAHL", fill=(238, 244, 242), font=f_sub)
    for g in range(4):
        gy = 1630 + g * 84
        load_pct = [92, 87, 78, 81][g]
        draw.text((68, gy), f"GPU_MODULE_0{g + 1}  [{load_pct}%]", fill=(215, 225, 226), font=f_mono)
        draw.rectangle([340, gy + 4, 940, gy + 34], fill=(28, 36, 40), outline=(64, 76, 80))
        fill_w = int(600 * (load_pct / 100.0))
        draw.rectangle([340, gy + 4, 340 + fill_w, gy + 34], fill=(126, 211, 33) if load_pct < 90 else (242, 184, 75))

    # Bottom-Right (1024..2048, 1024..2048): Wall Maintenance & Backup Terminal
    draw.rectangle([1040, 1040, 2032, 2032], fill=(14, 18, 21), outline=(126, 211, 33), width=3)
    draw.rectangle([1040, 1040, 2032, 1120], fill=(24, 36, 24))
    draw.text((1068, 1060), "WARTUNGS- & BACKUP-TERMINAL // RACK 02 HUD", fill=(142, 232, 58), font=f_hdr)

    draw.rectangle([1076, 1160, 1996, 1988], fill=(18, 23, 27), outline=(112, 188, 44), width=2)
    draw.text((1116, 1198), "RACK 02", fill=(242, 247, 246), font=f_big)
    draw.line([1116, 1286, 1956, 1286], fill=(64, 76, 80), width=2)
    draw.text((1116, 1326), "[SRV]   6 SERVER AKTIV (1HE..4HE)", fill=(235, 242, 240), font=f_hdr)
    draw.line([1116, 1410, 1956, 1410], fill=(64, 76, 80), width=2)
    draw.text((1116, 1450), "[TEMP]  35,8 °C ABLUFT · 21,4 °C ZULUFT", fill=(235, 242, 240), font=f_hdr)
    draw.line([1116, 1534, 1956, 1534], fill=(64, 76, 80), width=2)
    draw.text((1116, 1574), "[PWR]   2,4 kW · PDU A+B SYNCHRON", fill=(235, 242, 240), font=f_hdr)
    draw.line([1116, 1658, 1956, 1658], fill=(64, 76, 80), width=2)

    draw.rectangle([1116, 1715, 1956, 1825], fill=(22, 32, 22), outline=(126, 211, 33), width=3)
    draw.rectangle([1142, 1738, 1212, 1802], fill=(138, 214, 42))
    draw.text((1164, 1748), "E", fill=(16, 22, 16), font=f_hdr)
    draw.text((1248, 1750), "·  RACK ÖFFNEN / WARTUNGSMODUS", fill=(240, 246, 244), font=f_hdr)
    draw.text((1116, 1875), "SNAPSHOT-BACKUP: VERIFIZIERT (SHA-256 OK) · USV: 99%", fill=(142, 212, 76), font=f_sub)

    img.save(os.path.join(OUT_DIR, "root_screens_ui_2k.png"), format="PNG")
    # Also save individual 1K [0..1] UV screen textures for standalone monitor materials
    crops = [
        ("root_screen_01_telemetry.png", (0, 0, 1024, 1024)),
        ("root_screen_02_workloads.png", (1024, 0, 2048, 1024)),
        ("root_screen_03_network.png", (0, 1024, 1024, 2048)),
        ("root_screen_04_maintenance.png", (1024, 1024, 2048, 2048)),
    ]
    for fname, box in crops:
        img.crop(box).save(os.path.join(OUT_DIR, fname), format="PNG")
    print("  [OK] Saved root_screens_ui_2k.png + 4 individual 1K screen textures")


def generate_floor_concrete_2k(size=2048):
    """
    Generates a dedicated 2048x2048 100% tileable satin-polished dark concrete raised-floor texture set
    (2x2 grid of 60x60cm tiles per repeat) so UV tiling across large halls never bleeds across atlas quadrants!
    """
    print("Generating dedicated seamless root_floor_concrete_2k (2048x2048)...")
    rng = np.random.default_rng(909)
    macro = fbm_noise(size, octaves=(4, 8, 16, 32, 64, 128), weights=(0.30, 0.25, 0.18, 0.13, 0.09, 0.05), seed=707)
    micro = tileable_noise(size, scale=256, seed=808)
    fine = rng.normal(0.0, 1.0, (size, size)).astype(np.float32)

    tile_px = size / 2.0  # 1024px per 60cm tile
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    tx_mod = np.minimum(xx % tile_px, tile_px - (xx % tile_px))
    ty_mod = np.minimum(yy % tile_px, tile_px - (yy % tile_px))
    seam_d = np.minimum(tx_mod, ty_mod)
    is_seam = seam_d < 3.5
    is_chamfer = (seam_d >= 3.5) & (seam_d < 9.5)

    # Subtle per-tile tonal variation (industrial raised concrete slabs)
    tile_id = (np.floor(xx / tile_px).astype(np.int32) * 2 + np.floor(yy / tile_px).astype(np.int32)) % 4
    tile_tint = np.choose(tile_id, [-2.5, 1.8, 2.2, -1.5]).astype(np.float32)

    base = np.zeros((size, size, 3), dtype=np.float32)
    floor_col = np.array([56.0, 61.0, 64.0], dtype=np.float32)
    for c in range(3):
        col = floor_col[c] + tile_tint + (macro - 0.5) * 22.0 + (micro - 0.5) * 8.0 + fine * 1.6
        col = np.where(is_seam, 16.0, np.where(is_chamfer, col * 0.84, col))
        base[:, :, c] = col

    rough = np.where(is_seam, 0.88, np.clip(0.28 + (macro - 0.5) * 0.14 + (micro - 0.5) * 0.05, 0.18, 0.44))
    metal = np.where(is_seam, 0.04, 0.06)
    ao = np.where(is_seam, 0.22, np.where(is_chamfer, 0.76, 0.98))
    height = np.where(is_seam, 0.10, np.where(is_chamfer, 0.36, 0.54 + (macro - 0.5) * 0.04 + (micro - 0.5) * 0.025))

    normal = height_to_normal(height, strength=3.6)
    orm = np.stack([ao * 255.0, rough * 255.0, metal * 255.0], axis=-1)

    save_image(base, "root_floor_concrete_basecolor_2k.png", "RGB")
    save_image(normal, "root_floor_concrete_normal_2k.png", "RGB")
    save_image(orm, "root_floor_concrete_orm_2k.png", "RGB")


if __name__ == "__main__":
    generate_hardware_atlas(2048)
    generate_perforated_door_mesh(2048)
    generate_architecture_atlas(2048)
    generate_floor_concrete_2k(2048)
    generate_dynamic_label_atlas(2048)
    generate_screen_ui_atlas(2048)
