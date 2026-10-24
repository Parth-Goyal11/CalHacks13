# CalHacks 13 — SkyScore

Real-time multiplayer game where players photograph real space events (ISS passes, launches, meteor showers) to earn points.

## Packages

| Path | Role |
|------|------|
| `web/` | Next.js + Tailwind frontend |
| `ingest/` | Pull space-event data → Elasticsearch |
| `spacetime/` | SpacetimeDB real-time backend (placeholder) |
| `lib/` | Shared xAI Grok client (`ai` + `@ai-sdk/xai`) |

## Setup

```bash
cp .env.example .env   # fill XAI_API_KEY, ELASTIC_URL, ELASTIC_API_KEY
npm install
npm run dev            # Next.js at http://localhost:3000
npm run ingest         # index demo space events into Elasticsearch
```

### Night-sky reveal (`/sky`)

1. Open http://localhost:3000/sky
2. Upload or capture a night-sky photo
3. Enter location (lat/lon), time taken, optional facing direction
4. Grok vision returns constellation stick figures overlaid on the image — click a figure for details / “Ask Grok for more”

Requires `XAI_API_KEY` in the root `.env` (SpaceXAI track).

## Tracks

- **SpaceXAI** — Cursor + Grok Imagine/Voice
- **Elastic** — Jina embeddings, Agent Builder, Workflows on Cloud Serverless
- **Spacetime** — SpacetimeDB as the live game backend

See `.cursorrules` for conventions.
