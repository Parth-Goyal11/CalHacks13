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

## Tracks

- **SpaceXAI** — Cursor + Grok Imagine/Voice
- **Elastic** — Jina embeddings, Agent Builder, Workflows on Cloud Serverless
- **Spacetime** — SpacetimeDB as the live game backend

See `.cursorrules` for conventions.
