# SpacetimeDB module

Placeholder for the **Spacetime** hackathon track.

## Role in the game

SpacetimeDB is the authoritative real-time backend for:

- Multiplayer rooms / match sessions
- Live scores and leaderboards
- Player presence during event windows (ISS passes, launches, meteor showers)
- Syncing capture submissions as they happen

## Status

Module scaffolding (schema, reducers, clients) will live here. Until then, treat this directory as the intended home for game-truth state — prefer SpacetimeDB subscriptions/reducers over polling from `/web`.

## Next steps

1. Initialize a SpacetimeDB module (Rust or C# per SpacetimeDB docs).
2. Define tables for players, sessions, events, and photo submissions.
3. Wire `/web` to subscribe for live updates.
