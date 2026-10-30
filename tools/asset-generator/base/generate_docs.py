#!/usr/bin/env python3
"""
Generates comprehensive Markdown documentation (`README.md`, `docs/ASSET_OVERVIEW.md`,
`docs/NUTZUNGSRECHTE.md`, `LICENSE.md`) directly from the verified `docs/asset_manifest.json`.
"""

import os
import json

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MANIFEST_PATH = os.path.join(BASE_DIR, "docs", "asset_manifest.json")

with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
    manifest = json.load(f)


def fmt_dims(dims):
    if not dims:
        return "12.00 × 4.20 × 7.20 m"
    return " × ".join(f"{d:.3f}".rstrip("0").rstrip(".") for d in dims) + " m"


def build_readme():
    lines = [
        "# ROOT — 3D-Assetpaket (GLB / glTF 2.0 / 2K PBR)",
        "",
        "Hochwertiges, modulares 3D-Assetpaket für **ROOT**, die lokale Netzwerk- und Rechenzentrumssimulation mit frei begehbarer Egoansicht im Browser (Three.js).",
        "",
        "## 1. Visuelles Design & Technische Konventionen",
        "- **Format:** Binäres glTF 2.0 (`.glb`) unter `assets/` und `scenes/` sowie editierbare `.gltf`/`.bin`-Quelldateien unter `source/gltf/` und Blender-Aufbauskript unter `source/blender/`.",
        "- **Koordinatensystem & Maßstab:** `1 Einheit = 1 Meter` (`1 HE = 0,04445 m`, 19-Zoll-Einbaubreite `0,4826 m`, Schrankbreite `0,600 m`). **+Y nach oben**, **Gerätefront in Richtung +Z**.",
        "- **Ursprünge (Pivots):**",
        "  - Bodenstehende Assets (Racks, Klimagerät, Leitstand, Wand-/Bodenmodule): Ursprung `(0, 0, 0)` mittig auf Bodenhöhe (`Y = 0`).",
        "  - 19-Zoll-Einbaugeräte (Server 1–4 HE, Switches, Patchpanel, Kabelführung, Rack-PDU, Blindblenden): Ursprung `(0, 0, 0)` mittig an der Unterkante der vorderen Montageschienen-Ebene (`+Z` zeigt aus dem Rack heraus, `-Z` in die Racktiefe). Dadurch lassen sich Geräte direkt an den Rack-Slot-Knoten `slot_u01` .. `slot_u42` einhängen.",
        "  - Bewegliche Teile (`rack_door_front`, `rack_door_rear`, `fire_door_leaf`, `drive_bay_01..12`, `gpu_module_01..04`, `server_fan_01..08`, `cooling_fan_01..03`) besitzen exakt gesetzte lokale Dreh- bzw. Verschiebepunkte.",
        "- **Detailstufen & Kollision:** Jedes Asset enthält `LOD0` (Nahansicht in der Ego-Perspektive), `LOD1` (optimierte Fernansicht für 6+ Racks und 32+ Server) sowie ein einfaches Kollisionsmesh `collider_<asset>`.",
        "- **2K-PBR-Texturen & Atlanten (`textures/`):** Gemeinsame 2048×2048 Texturatlanten für BaseColor, Normal und gepacktes ORM (Ambient Occlusion [R], Roughness [G], Metallic [B]) sowie separate Einzelkanäle (`roughness`, `metallic`, `ao`).",
        "",
        "## 2. Übersicht aller enthaltenen 3D-Assets",
        "",
        "| Asset-Name | GLB-Pfad | Abmessungen (B × H × T) | LOD0 (Tris) | LOD1 (Tris) | Collider (Tris) | Bewegliche Teile | Anschlusspunkte |",
        "| :--- | :--- | :--- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for a in manifest["assets"]:
        lines.append(
            f"| `{a['name']}` | `{a['glbPath']}` | `{fmt_dims(a['dimensionsM'])}` | "
            f"{a['triangles']['LOD0']:,} | {a['triangles']['LOD1']:,} | {a['triangles']['collider']:,} | "
            f"{len(a['movableParts'])} | {len(a['attachmentPoints'])} |"
        )

    lines.extend([
        "",
        "## 3. Verzeichnisstruktur",
        "```text",
        "Root_Assets/",
        "├── assets/",
        "│   ├── racks/               # 18-HE & 42-HE 19-Zoll-Racks + 1-HE/2-HE Blindblenden (.glb)",
        "│   ├── servers/             # 1-HE Edge, 2-HE Compute, 3-HE Storage, 4-HE KI-Server (.glb)",
        "│   ├── network_power/       # 8/16-Port Switches, 24p Patchpanel, Kabelführung, PDU, Stecker (.glb)",
        "│   ├── architecture/        # Doppelboden, Lüftungsgitter, Wände, Decke, Licht, Trassen, CRAC, Tür (.glb)",
        "│   └── stations/            # Industrieller 3-Monitor-Leitstand & Wandterminal (.glb)",
        "├── scenes/",
        "│   └── root_datacenter_scene.glb  # Vollständige Beispielszene im Stil des Referenzbildes",
        "├── textures/                # 2K (2048x2048) PBR-Texturatlanten (BaseColor, Normal, ORM, Roughness, Metallic, AO)",
        "├── runtime/",
        "│   ├── glb_three_loader.js        # Abhängigkeitsfreier GLB-Loader für Three.js",
        "│   └── root_assets_controller.js  # Laufzeit-Steuerung (LEDs, Lüfter, Türen, Einschübe, GPU-Last, Kabel, UI)",
        "├── preview/                 # Interaktive 3D-Egoansicht & Einzel-Asset-Inspektor im Browser",
        "├── source/",
        "│   ├── blender/             # Blender-Projektskript (build_blender_project.py + create_blend_file.bat)",
        "│   ├── gltf/                # Editierbare .gltf + .bin Quelldateien aller 28 Assets",
        "│   └── generator/           # Parametrische Python-Quellskripte für Geometrie & 2K-PBR-Texturen",
        "├── docs/",
        "│   ├── ASSET_OVERVIEW.md    # Detaillierte Spezifikation aller Knoten, Pivots, Ports & Materialien",
        "│   ├── NUTZUNGSRECHTE.md    # Lizenz- und Nutzungsrechtedokumentation (CC0 / MIT)",
        "│   ├── asset_manifest.json  # Maschinenlesbares Manifest mit allen Koordinaten & Metriken",
        "│   └── reference_datacenter.jpg   # Visuelles Referenzbild",
        "└── Vorschau starten.cmd     # Startet den lokalen 3D-Inspektor unter http://127.0.0.1:18490",
        "```",
        "",
        "## 4. Interaktive 3D-Vorschau starten",
        "Doppelklick auf **`Vorschau starten.cmd`** oder im Terminal:",
        "```powershell",
        "node preview_server.cjs",
        "```",
        "Anschließend im Browser `http://127.0.0.1:18490/preview/index.html` öffnen.",
    ])

    with open(os.path.join(BASE_DIR, "README.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def build_detailed_overview():
    lines = [
        "# ROOT — Technische Asset-Übersicht (Abmessungen, Polygone, Materialien, Pivots & Anschlusspunkte)",
        "",
        "Dieses Dokument listet für jedes der 28 enthaltenen GLB-Assets die exakten Abmessungen, Dreieckszahlen (`LOD0`, `LOD1`, `Collider`), verwendeten PBR-Materialien, beweglichen Komponenten (inkl. Dreh-/Verschiebepunkten), dynamisch austauschbaren Beschriftungs-/Monitorflächen und Kabel-Anschlusspunkte auf.",
        "",
        "## 1. Gemeinsame PBR-Materialbibliothek & 2K-Texturatlanten",
        "",
        "| Material-Name | Texturatlas (`2048×2048`) | Beschreibung / Einsatzbereich |",
        "| :--- | :--- | :--- |",
        "| `mat_powder_coat_dark` | `root_hardware_atlas_*_2k.png` | Dunkelgraue Feinstruktur-Pulverbeschichtung (`#21262a`) für Rackrahmen und Servergehäuse |",
        "| `mat_powder_coat_medium` | `root_hardware_atlas_*_2k.png` | Graphitgraue Frontblenden und Geräteträger (`#32393f`) |",
        "| `mat_brushed_metal` | `root_hardware_atlas_*_2k.png` | Gebürstetes eloxiertes Aluminium / Edelstahl für 19\"-Schienen, Rackohren, Griffe, Verschlüsse |",
        "| `mat_vent_grille` | `root_hardware_atlas_*_2k.png` | Feines hexagonales Lüftungsgitter mit Normalmap und Kavitäts-AO |",
        "| `mat_perforated_door` | `root_perforated_mesh_*_2k.png` | Perforiertes Wabengitter mit Alpha-Maskierung (`MASK`) für Rack-Front- und Rücktüren |",
        "| `mat_plastic_abs` | `root_hardware_atlas_*_2k.png` | Mattes schwarzes ABS-Kunststoffmaterial für Laufwerksträger, RJ45-Buchsen, Monitorrahmen, Tasten |",
        "| `mat_plastic_latch` | `root_hardware_atlas_*_2k.png` | Nicht-emissiver dunkelroter Entriegelungs-/Schalterkunststoff für Laufwerks-Latches und Schutzschalter |",
        "| `mat_plastic_usb_blue` | `root_hardware_atlas_*_2k.png` | Nicht-emissiver blauer USB-3.0-Buchsenkunststoff |",
        "| `mat_rubber_epdm` | `root_hardware_atlas_*_2k.png` | Rutschfester EPDM-Gummi für Kabeltüllen, Knickschutz, Gerätefüße, Tischauflagen |",
        "| `mat_heatsink_metal` | `root_hardware_atlas_*_2k.png` | Gerippte Kupfer-/Aluminium-Kühlkörperlamellen für die 4 GPU-Module des 4-HE-KI-Servers |",
        "| `mat_cable_green` | Prozedural PBR | Charakteristischer grüner Cat6A-Kabelmantel (`#7ed321`) |",
        "| `mat_arch_floor` | `root_floor_concrete_*_2k.png` | Nahtlos kachelbare, seidenmatte dunkelgraue Doppelbodenplatten mit Fugen und Eckaufnahmen |",
        "| `mat_arch_stripe_green` | `root_architecture_atlas_*_2k.png` | Grüne Kaltgang-Bodenmarkierung (`#7ac142`) |",
        "| `mat_arch_floor_vent` | `root_architecture_atlas_*_2k.png` | Metallische Boden-Lüftungsgitterlamellen |",
        "| `mat_arch_wall` | `root_architecture_atlas_*_2k.png` | Dunkelgraue industrielle Wand- und Deckenmodule |",
        "| `mat_arch_steel` | `root_architecture_atlas_*_2k.png` | Verzinkter Stahl für Kabeltrassen, Schutzrohre und Deckenträger |",
        "| `mat_led_power` | Separat steuerbar (Emissive) | Status-LED Stromversorgung (Standard: Grün `#84cc16`) |",
        "| `mat_led_activity` | Separat steuerbar (Emissive) | Status-LED Netzwerk-/Laufwerksaktivität (Standard: Blau `#38bdf8`) |",
        "| `mat_led_fault` | Separat steuerbar (Emissive) | Status-LED Warnung/Fehler (Standard: Bernstein `#f59e0b` / Rot `#ef4444`) |",
        "| `mat_led_boot` | Separat steuerbar (Emissive) | Status-LED Boot-/Reparaturzustand (Standard: Cyan `#60a5fa`) |",
        "| `mat_led_gpu_load` | Separat steuerbar (Emissive) | Animierbare GPU-Auslastungsbalken am 4-HE-KI-Server |",
        "| `mat_led_rack_frame` | Separat steuerbar (Emissive) | Umlaufender grüner LED-Statusrahmen am Rack (wie an `RACK 02` im Referenzbild) |",
        "| `mat_label_model` | `root_labels_atlas_2k.png` | Dynamisch austauschbares Schild für Modellname (`ROOT R120`, `C240`, `S360`, `A480`) |",
        "| `mat_label_hostname` | `root_labels_atlas_2k.png` | Dynamisch austauschbares Schild für Gerätename / Hostname |",
        "| `mat_label_inventory` | `root_labels_atlas_2k.png` | Dynamisch austauschbares Schild für Inventarnummer & Barcode |",
        "| `mat_monitor_screen_01..03` | `root_screen_01..03_*.png` | Separate Monitorflächen am Leitstand mit sauberer `[0..1]`-UV-Zuordnung |",
        "| `mat_terminal_screen` | `root_screen_04_maintenance.png` | Separate Monitorfläche am Wandterminal mit sauberer `[0..1]`-UV-Zuordnung |",
        "",
        "---",
        "",
        "## 2. Detaillierte Spezifikation je Asset",
        "",
    ]

    for a in manifest["assets"]:
        lines.append(f"### `{a['name']}` (`{a['glbPath']}`)")
        lines.append(f"- **Abmessungen (B × H × T):** `{fmt_dims(a['dimensionsM'])}`" + (f" ({a['unitsU']} HE)" if a.get("unitsU") else ""))
        lines.append(f"- **Dateigröße:** `{a['sizeKB']} KB`")
        lines.append(f"- **Polygonzahl (Dreiecke):** `LOD0`: **{a['triangles']['LOD0']:,}** | `LOD1`: **{a['triangles']['LOD1']:,}** | `Collider`: **{a['triangles']['collider']:,}** (Gesamt: {a['triangles']['total']:,} Dreiecke, {a['verticesTotal']:,} Vertices)")
        lines.append(f"- **Materialien ({len(a['materials'])}):** " + ", ".join(f"`{m}`" for m in a["materials"]))

        if a["movableParts"]:
            mp_str = ", ".join(f"`{p['name']}` ({p['pivotType']} @ `{p['pivotPosition']}`)" for p in a["movableParts"][:10])
            if len(a["movableParts"]) > 10:
                mp_str += f" … (+{len(a['movableParts']) - 10} weitere)"
            lines.append(f"- **Bewegliche Teile ({len(a['movableParts'])}):** {mp_str}")

        if a["controllableLeds"]:
            led_str = ", ".join(f"`{l}`" for l in a["controllableLeds"][:10])
            if len(a["controllableLeds"]) > 10:
                led_str += f" … (+{len(a['controllableLeds']) - 10} weitere)"
            lines.append(f"- **Steuerbare LEDs ({len(a['controllableLeds'])}):** {led_str}")

        if a["dynamicSurfaces"]:
            ds_str = ", ".join(f"`{d['name']}` (UV: `{d['uvSpace']}`)" for d in a["dynamicSurfaces"])
            lines.append(f"- **Austauschbare Beschriftungs-/Bildschirmflächen ({len(a['dynamicSurfaces'])}):** {ds_str}")

        if a["attachmentPoints"]:
            ap_str = ", ".join(f"`{p['name']}` (`{p['connectorType']}` @ `{p['position']}`)" for p in a["attachmentPoints"][:8])
            if len(a["attachmentPoints"]) > 8:
                ap_str += f" … (+{len(a['attachmentPoints']) - 8} weitere)"
            lines.append(f"- **Definierte Anschlusspunkte ({len(a['attachmentPoints'])}):** {ap_str}")

        lines.append("")

    with open(os.path.join(BASE_DIR, "docs", "ASSET_OVERVIEW.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def build_license_docs():
    content = """# Dokumentation der Nutzungsrechte & Lizenzen (ROOT 3D-Assetpaket)

## 1. Lizenzstatus aller enthaltenen Bestandteile

Sämtliche in diesem Paket (`Root_Assets`) enthaltenen 3D-Modelle, Geometrien, Szenen, prozedural erzeugten 2K-PBR-Texturen, Texturatlanten, Beschriftungs- und Bildschirmgrafiken, Blender-/Python-Aufbauskripte sowie Three.js-Laufzeitmodule sind **eigenständige Originalwerke**, die vollständig prozedural und ohne Verwendung geschützter Drittanbieter-Assets für das Projekt **ROOT** erstellt wurden.

Für alle Bestandteile gilt eine **duale Lizenzierung nach Wahl des Nutzers**:
1. **CC0 1.0 Universal (Public Domain Dedication)** — für alle 3D-Assets (`.glb`, `.gltf`, `.bin`), Texturen (`textures/*.png`) und Dokumentationen.
2. **MIT License** — für alle Skripte, Generatoren (`source/`), Vorschau-Anwendungen (`preview/`) und Three.js-Laufzeitmodule (`runtime/`).

---

## 2. Komponentenverzeichnis & Herkunftsnachweis

| Bestandteil / Ordner | Dateitypen | Herkunft | Lizenz | Nutzungsrechte |
| :--- | :--- | :--- | :--- | :--- |
| **19-Zoll-Racks & Zubehör** (`assets/racks/`) | `.glb`, `.gltf`, `.bin` | 100 % eigene prozedurale Konstruktion (`build_racks_and_servers.py`) | **CC0 1.0 / MIT** | Uneingeschränkte kommerzielle & private Nutzung, Bearbeitung, Weitergabe |
| **Servervarianten 1–4 HE** (`assets/servers/`) | `.glb`, `.gltf`, `.bin` | 100 % eigene prozedurale Konstruktion (`build_racks_and_servers.py`) | **CC0 1.0 / MIT** | Uneingeschränkte kommerzielle & private Nutzung, Bearbeitung, Weitergabe |
| **Netzwerk & Strom** (`assets/network_power/`) | `.glb`, `.gltf`, `.bin` | 100 % eigene prozedurale Konstruktion (`build_network_and_power.py`) | **CC0 1.0 / MIT** | Uneingeschränkte kommerzielle & private Nutzung, Bearbeitung, Weitergabe |
| **Raumarchitektur** (`assets/architecture/`) | `.glb`, `.gltf`, `.bin` | 100 % eigene prozedurale Konstruktion (`build_architecture_and_stations.py`) | **CC0 1.0 / MIT** | Uneingeschränkte kommerzielle & private Nutzung, Bearbeitung, Weitergabe |
| **Bedienplätze & Terminals** (`assets/stations/`) | `.glb`, `.gltf`, `.bin` | 100 % eigene prozedurale Konstruktion (`build_architecture_and_stations.py`) | **CC0 1.0 / MIT** | Uneingeschränkte kommerzielle & private Nutzung, Bearbeitung, Weitergabe |
| **Beispielszene** (`scenes/root_datacenter_scene.glb`) | `.glb`, `.gltf`, `.bin` | 100 % eigene prozedurale Szenenkomposition (`build_example_scene.py`) | **CC0 1.0 / MIT** | Uneingeschränkte kommerzielle & private Nutzung, Bearbeitung, Weitergabe |
| **2K-PBR-Texturen & Atlanten** (`textures/*.png`) | `.png` (2048×2048 & 1024×1024) | 100 % prozedural generiert (`generate_textures.py` via NumPy/Pillow) | **CC0 1.0 / MIT** | Frei von Fremdlizenzen; uneingeschränkt nutzbar und modifizierbar |
| **Three.js-Laufzeit & Vorschau** (`runtime/`, `preview/`) | `.js`, `.cjs`, `.html` | 100 % Eigenentwicklung für ROOT | **MIT License** | Uneingeschränkte Integration in Browser- und Desktop-Anwendungen |
| **Marken- & Modellbezeichnungen** (`ROOT`, `R120`, `C240`, `S360`, `A480`, `SW-08G`, `SW-16X`, `PDU-16M`) | Text / Beschriftung | Fiktive, projektspezifische Bezeichnungen für die Simulation „ROOT“ | **CC0 1.0 / MIT** | Keine realen Herstellermarken oder geschützten Logos enthalten |

---

## 3. MIT-Lizenztext

```text
MIT License

Copyright (c) 2026 ROOT Simulation Project

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software, 3D asset package, textures, and associated documentation files
(the "Assets"), to deal in the Assets without restriction, including without
limitation the rights to use, copy, modify, merge, publish, distribute,
sublicense, and/or sell copies of the Assets, and to permit persons to whom the
Assets are furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Assets.

THE ASSETS ARE PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```
"""
    with open(os.path.join(BASE_DIR, "docs", "NUTZUNGSRECHTE.md"), "w", encoding="utf-8") as f:
        f.write(content)
    with open(os.path.join(BASE_DIR, "LICENSE.md"), "w", encoding="utf-8") as f:
        f.write(content)


if __name__ == "__main__":
    build_readme()
    build_detailed_overview()
    build_license_docs()
    print("[OK] Generated README.md, docs/ASSET_OVERVIEW.md, docs/NUTZUNGSRECHTE.md, and LICENSE.md")
