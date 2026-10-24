# CalHacks 13 — SkyScore

Real-time multiplayer game where players photograph real space events (ISS passes, launches, meteor showers) to earn points.

Sky Photo (plate-solve → measure → **xAI Grok** judge → coded score) lives in this monorepo on `main`.

## Packages

| Path | Role |
|------|------|
| `web/` | Next.js + Tailwind — player UI, `/upload` (“Add a photo”), proxies `/api/sky-photo` |
| `sky_photo/` | FastAPI service: ingest → OpenCV metrics → Astrometry.net → Grok vision → `score.py` → annotated overlay |
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
# or: uvicorn sky_photo.main:app --reload --host 127.0.0.1 --port 8000
```

```bash
# Terminal B — Next.js (proxies /api/sky-photo → SKY_PHOTO_URL)
npm run dev
```

- App: http://localhost:3000  
- Add a photo: http://localhost:3000/upload — identity badge (Plate-solved / Model estimate / Needs review), 6-bar rubric, critique, rarity frame, annotated image when solved  
- FastAPI health: http://127.0.0.1:8000/health  
- `POST /api/sky-photo` (multipart: `image`, optional `claimed_target`)  
- `GET /api/sky-photo/{photo_id}/annotated`

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
