> Historical notice supplied with ROOT 3D Asset Package 1.0. It applies to the supplied code/assets, not to all later additions or to vendored Three.js. Authorship assertions below are preserved as supplied evidence; current component attribution is in [NOTICE.md](../../NOTICE.md).

# Dokumentation der Nutzungsrechte & Lizenzen (ROOT 3D-Assetpaket)

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
