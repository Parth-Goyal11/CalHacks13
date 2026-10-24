# CalHacks 13 — SkyScore

Real-time multiplayer game where players photograph real space events (ISS passes, launches, meteor showers) to earn points.

## Packages

| Path | Role |
|------|------|
| `web/` | Next.js + Tailwind frontend (player UI, `/upload`, API proxy) |
| `sky_photo/` | FastAPI Sky Photo service (ingest → metrics → Astrometry → vision judge → score → overlay) |
| `ingest/` | Pull space-event data → Elasticsearch |
| `spacetime/` | SpacetimeDB real-time backend (placeholder) |
| `lib/` | Shared xAI Grok client (`ai` + `@ai-sdk/xai`) |

## Setup

```bash
cp .env.example .env   # fill keys as needed
npm install
```

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
# Terminal A — plate-solve service
uvicorn sky_photo.main:app --reload --host 127.0.0.1 --port 8000
```

```bash
# Terminal B — Next.js (proxies /api/sky-photo → SKY_PHOTO_URL)
npm run dev
```

- App: http://localhost:3000
- Upload / Log “Add a photo”: http://localhost:3000/upload (identity badge, 6-bar rubric, critique, rarity frame)
- Direct FastAPI health: http://127.0.0.1:8000/health
- `ASTROMETRY_API_KEY` enables live plate-solve; without it, metrics still return with `identity.method = "model-estimate"`.
- `VISION_PROVIDER` is `grok` or `anthropic`. `VISION_API_KEY` (Grok also accepts `XAI_API_KEY`) enables the judge. The model returns a rubric only. Score, rarity, and points come from `sky_photo/score.py`. No key → `needs_review` and no score.

### Event ingest (Elastic)

```bash
npm run ingest
```

## Sky Photo tests

```bash
python -m unittest discover -s tests -v
```

## Tracks

- **SpaceXAI** — Cursor + Grok Imagine/Voice
- **Elastic** — Jina embeddings, Agent Builder, Workflows on Cloud Serverless
- **Spacetime** — SpacetimeDB as the live game backend

See `.cursorrules` for conventions.
