# README media

These are real application captures made for the ROOT README on 2026-10-30. They use an isolated synthetic `ROOT / OPERATIONS` demonstration save, never a personal network. The runtime source is the construction integration at `b4d2682`; ordinary interface captures use English. Room ownership, equipment, contracts, research, assignments and faults are valid demonstration presets rendered by the normal application.

`arrival.webp` is a 101-frame capture of the actual bunker arrival sequence, encoded as an animated WebP for a smaller download. The first and last frames have a short hold for readability. `arrival-poster.jpg` is the original first captured frame. The README uses the poster when reduced motion is requested and also links it directly. No generated scene has been substituted for a runtime capture.

`wordmark.svg`, `facts.svg` and `support.svg` are original, editable SVG documentation graphics. They have no remote fonts, scripts or external image references. The application captures retain the component provenance described in [NOTICE.md](../../NOTICE.md).

To refresh this gallery, start a separate local instance with its own `ROOT_PORT` and `ROOT_DATA_DIR`, use synthetic data, and capture the actual affected view after it has rendered. Keep small previews readable, give images descriptive alternative text, and check the rendered README on its current Git host. Avoid capture metadata containing local paths or credentials. The documentation graphics and media are not runtime dependencies.

Rendering compatibility was checked against the deployed Gitea 28.2.0 Markdown API. GitHub supports relative image paths and [inline WebP images](https://github.blog/changelog/2025-08-28-added-support-for-webp-images/). Encoding used ImageMagick 7.1.2-27; see its [matching animation-options documentation](https://raw.githubusercontent.com/ImageMagick/ImageMagick/7.1.2-27/www/command-line-options.html).
