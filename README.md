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

### Mission board (`/events`)

Upcoming celestial windows (moons, meteor showers, launches, eclipses) ranked by **rarity** and **distance** from your map pin. Capture CTA links to `/sky`.

### Night-sky reveal (`/sky`)

1. Open http://localhost:3000/sky
2. Drop / capture a night-sky photo
3. Search a map location + time taken
4. Grok vision illuminates figures it can actually see in the frame

Requires `XAI_API_KEY` in the root `.env` (SpaceXAI track).

## Tracks

- **SpaceXAI** — Cursor + Grok Imagine/Voice
- **Elastic** — Jina embeddings, Agent Builder, Workflows on Cloud Serverless
- **Spacetime** — SpacetimeDB as the live game backend

See `.cursorrules` for conventions.
