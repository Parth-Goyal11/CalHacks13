# CalHacks 13 - Yonder

Phone-first astronomy app for capturing a night sky, analyzing the photo, and keeping discoveries in Memories. The current UI follows the Yonder Figma Make design; friends' posts are labeled samples until the shared backend is connected.

See [Yonder setup and remaining app work](docs/yonder-integration.md) for the combined UI/API flow, provider configuration, phone testing and deployment requirements.

The Yonder camera now runs the latest Ben `sky-image-proc` analysis through `/api/analyze-sky`: Grok detections → expanded catalog geometry checks → location/FOV cross-check → ranked highlights and coded score → Figma's photo/marker/detail-sheet UI. His newer model-reply recovery and constellation motifs are retained, and scored highlights appear in Yonder's result details. The `/events` board is reachable from Explore and shares Yonder's selected location and camera flow. Set `XAI_API_KEY` in root `.env`, optionally `SKY_VISION_MODEL`, then `npm install` and `npm run dev`. The analysis flow does not require the Python service. Confirm each photo's location and capture time in review; camera angles are optional. Results and original photos can be saved to local Memories.

Offline checks: `npm run test:yonder` and `npm run test:sky-catalog`. The older Python pipeline below remains available separately and for existing Memories.

Sky Photo (plate-solve → measure → **xAI Grok** judge → coded score) lives in this monorepo on `main`.

## Packages

| Path | Role |
|------|------|
| `web/` | Next.js + Tailwind: Yonder Home, Explore, camera, Memories, Profile; proxies `/api/sky-photo` |
| `sky_photo/` | FastAPI service: ingest → OpenCV metrics → Astrometry.net → Grok vision → `score.py` → annotated overlay |
| `nightsky/` | Local Hipparcos plate solver. Names a star only when the pattern matches one catalog sky. Run from that folder. |
| `ingest/` | Pull space-event data → Elasticsearch |
| `spacetime/` | SpacetimeDB real-time backend (placeholder) |
| `lib/` | Shared xAI Grok client (`ai` + `@ai-sdk/xai`) |

## Setup

```bash
cp .env.example .env   # fill keys as needed
npm install
```

### Environment

| Variable | Used for |
|----------|----------|
| `XAI_API_KEY` | Grok (SpaceXAI). Also used as fallback for the vision judge. |
| `VISION_API_KEY` | Sky Photo vision judge (preferred). Falls back to `XAI_API_KEY`. |
| `VISION_PROVIDER` | Must be `grok` (default). Other providers are rejected. |
| `VISION_MODEL` / `VISION_API_BASE` | Optional overrides (default model `grok-2-vision-1212`, base `https://api.x.ai/v1`). |
| `ASTROMETRY_API_KEY` | Live plate-solve + labeled star overlay via nova.astrometry.net. |
| `SKY_PHOTO_URL` | Next.js proxy target (default `http://127.0.0.1:8000`). |
| `ELASTIC_URL` / `ELASTIC_API_KEY` | Event ingest (Elastic track). |

Without Astrometry: night-sky uploads still return metrics with `identity.method = "model-estimate"`.  
Without vision keys: record keeps metrics/solve data, sets `needs_review: true`, and skips rubric/score.

### Sky Photo (Python)

Python 3.12+. From the repo root:

```bash
python -m venv .venv
# Windows: .\.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements-sky-photo.txt
pip install -e .
```

```bash
# Terminal A — Sky Photo API
npm run sky-photo
# or: .venv\Scripts\python.exe -m uvicorn sky_photo.main:app --reload --env-file .env --host 127.0.0.1 --port 8000
```

```bash
# Terminal B — Next.js (proxies /api/sky-photo → SKY_PHOTO_URL)
npm run dev
```

- App: http://localhost:3000  
- Camera: http://localhost:3000/upload - capture/gallery, review, loading, real analysis and saved Memories
- Loading design preview: http://localhost:3000/loading
- FastAPI health: http://127.0.0.1:8000/health  
- `POST /api/sky-photo` (multipart: `image`, optional `claimed_target`)  
- `GET /api/sky-photo/{photo_id}/annotated`

Successful plate-solved results can also include `annotations` with normalized solver positions for the interactive photo markers. Model estimates never receive invented marker positions. Memories currently persist on the current device/browser origin; accounts, real friends and cloud storage are separate work.

Vision is **xAI Grok only** (no Anthropic). The model returns rubric + critique; score, rarity, and points are computed only in `sky_photo/score.py`.

### Event ingest (Elastic)

```bash
npm run ingest
```

## Sky Photo tests

```bash
python -m unittest discover -s tests -v
```

Recorded-response vision tests do not call the network.

## Tracks

- **SpaceXAI** — Cursor + Grok (vision judge + `lib/` client); Imagine/Voice where useful  
- **Elastic** — Jina embeddings, Agent Builder, Workflows on Cloud Serverless  
- **Spacetime** — SpacetimeDB as the live game backend  

See `.cursorrules` for conventions.

## Night-sky catalog solver

`nightsky/` is the local identifier: Hipparcos stars, CelesTrak satellites, and a plate solver that labels a photo from the star pattern. It does not replace the Yonder camera flow. From `nightsky/`:

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\Activate.ps1
pip install -e ".[dev]"
python -m nightsky serve
```

The viewer listens on port 8741. The sky map draws the catalog over an all-sky photograph. Drag the heading and lens height to look around. On a phone, Turn with the phone follows the compass, and Show the sky behind the names hides the photograph, shows the rear camera, and leaves the names on top. Scan this photo names the camera picture from the star pattern, and a heading does not invent names. Copy `nightsky/.env.example` to `nightsky/.env` for the Bright Data token. That file stays untracked.
