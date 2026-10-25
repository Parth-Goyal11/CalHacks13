# Elastic track — Agent Builder + Workflows + MCP

Search/ingest alone is **not** enough for the usual Elastic Agent Builder prize bar. Judges look for an agent that **reasons over your index with tools**, ideally **exposed via MCP**, with **Workflows** for ingest/enrichment.

## What you already have

| Piece | Status |
|-------|--------|
| Serverless index `celestial-events` | ✅ |
| Jina `semantic_text` + hybrid search / rerank | ✅ |
| Geo + `function_score` mission ranking | ✅ |
| Node ingest script | ✅ (replaceable by a Workflow) |

## What’s missing (do these in Kibana / Serverless UI)

### 1. Custom Agent Builder tools (required)

In **Agent Builder → Tools → New tool**, create at least:

**A. Index search tool** — scope: `celestial-events`  
Description: *Search upcoming sky events by natural language (meteors, moons, launches, aurora).*

**B. ES|QL tool — events near a location**

```esql
FROM celestial-events
| WHERE endsAt >= NOW()
| EVAL dist = ST_DISTANCE(location, TO_GEOPOINT(?lon, ?lat))
| WHERE globalVisibility == true OR dist < 5000000
| SORT rarityRank DESC, startsAt ASC
| LIMIT 15
| KEEP title, kind, rarity, startsAt, summary, photoTip
```

Parameters: `lat` (double), `lon` (double).

**C. ES|QL tool — search by kind / rarity**

```esql
FROM celestial-events
| WHERE endsAt >= NOW() AND (kind == ?kind OR rarity == ?rarity)
| SORT startsAt ASC
| LIMIT 20
| KEEP title, kind, rarity, startsAt, endsAt, summary
```

### 2. Agent that uses those tools

Create an agent, e.g. **SkyScore Scout**, with instructions like:

> You help photographers plan night-sky captures. Always call tools before answering. Prefer geo tools when the user gives a city or coordinates. Cite event title, time (UTC), rarity, and photo tip.

Attach tools A–C. Test in Agent Builder chat:

- “What rare events can I shoot from Berkeley in the next month?”
- “Any meteor showers coming up?”
- “Night launches worth photographing?”

### 3. Expose via MCP (usual qualify item)

1. Open **Tools → MCP server** and copy `{KIBANA_URL}/api/agent_builder/mcp`.
2. Create an API key with Agent Builder privileges.
3. Connect Cursor as an MCP host to that URL + API key.
4. Demo: ask the external host the same questions — tools run against `celestial-events`.

Docs: [Agent Builder MCP server](https://www.elastic.co/docs/explore-analyze/ai-features/agent-builder/mcp-server)

### 4. Workflows (replace ad-hoc `npm run ingest`)

In **Elastic Workflows**, build a scheduled workflow:

1. **HTTP** — optional pull from Launch Library / NOAA (or call your ingest webhook).
2. **ES bulk / index** — upsert into `celestial-events`.
3. Schedule every 6–12 hours.

Wire a **Workflow tool** into the agent so it can say “refresh the catalog” during the demo.

Docs: custom tools include a **Workflow** type — [Custom tools](https://www.elastic.co/docs/explore-analyze/ai-features/agent-builder/tools/custom-tools)

## Demo script (2–3 minutes)

1. Explore tab UI → show live geo-ranked events + hybrid search.  
2. Kibana Agent Builder → same question answered via ES|QL / index search tools.  
3. Cursor via MCP → one tool call on `celestial-events`.
4. Mention Workflow schedule for ingest (even if Node ingest still exists as fallback).

## Strong vs weak

| Weak | Strong |
|------|--------|
| “We indexed into Elastic” | Agent answers with tool traces over your index |
| Only Next.js `_search` | Agent Builder + MCP host |
| Manual `npm run ingest` only | Workflow (or Workflow tool) owns refresh |
