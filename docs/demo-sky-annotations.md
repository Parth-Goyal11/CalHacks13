# Demo sky annotations

The six supplied photographs use precomputed annotations, separate from the live camera analysis. No capture locations or dates are invented.

ESA [tetra3](https://github.com/esa/tetra3), commit `f9fa2eb9a32a5efc529e2d86f0b59f35b1e9028d`, matched extracted centroids from 30% image crops against its bundled Hipparcos J2000 magnitude ≤7 database. Matched HIP IDs were joined to the repository's named-star catalog. Crop coordinates were transformed back to original-image percentages. These are cropped projection calibrations, not a full-frame FITS WCS.

| Photo | Pattern | UI status | Stricter recheck |
| --- | --- | --- | --- |
| sky-1 | Cassiopeia | Catalog matched | 16 matches; probability 1.58e-29 |
| sky-2 | Orion | Catalog matched | 20 matches; probability 2.99e-42 |
| sky-3 | Gemini candidate | Demo preview | Failed stricter recheck |
| sky-4 | Canis Minor candidate | Demo preview | Failed stricter recheck |
| sky-5 | Draco | Catalog matched | 10 matches; probability 1.21e-15 |
| sky-6 | Big Dipper / Ursa Major | Catalog matched | 7 matches; probability 4.49e-10 |

The stricter pass halves the match radius to 0.005 and requires a false-positive probability below 1e-9. `demo-sky-evidence/named-stars.json` records the original candidate coordinates and HIP IDs; `strict-recheck.json` records the independent stricter validation. Probabilities are solver estimates, not guaranteed certainty. Sky 3/4 remain explicitly illustrative previews, including in their object descriptions.

The app displays only a small selection of named stars to keep labels readable. No unverified planet detections or synthetic scores are added. The demo's local likes and comments stay in memory for the current page session and are not sent to a service.
