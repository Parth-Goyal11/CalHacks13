"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RankedCelestialEvent } from "@calhacks13/lib";
import type { GeocodedPlace } from "@/components/sky/location-types";
import { EventSkyArt } from "./EventSkyArt";
import { EventsGlobe } from "./EventsGlobe";
import {
  byClosest,
  formatDistance,
  formatWhen,
  RARITY_META,
  RARITY_ORDER,
  type RarityFilter,
} from "./event-ui";

type BoardTab = "list" | "globe";

async function fetchNearbyEvents(
  place: GeocodedPlace | null
): Promise<RankedCelestialEvent[]> {
  const params = new URLSearchParams({
    sort: "distance",
    days: "90",
    skyVisible: "1",
  });
  if (place) {
    params.set("lat", String(place.latitude));
    params.set("lon", String(place.longitude));
    params.set("label", place.label);
  }
  const res = await fetch(`/api/celestial-events?${params}`);
  if (!res.ok) throw new Error("Event request failed");
  const data = await res.json();
  return data.events as RankedCelestialEvent[];
}

async function searchEvents(q: string): Promise<RankedCelestialEvent[]> {
  const res = await fetch(`/api/search-events?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error("Search request failed");
  const data = await res.json();
  return data.events as RankedCelestialEvent[];
}

export function EventsBoard({
  place,
  locationChosen,
  onLocation,
  compact = false,
}: {
  place: GeocodedPlace;
  locationChosen: boolean;
  onLocation: () => void;
  /** When true, hide the large page title (Explore already has one). */
  compact?: boolean;
}) {
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>("all");
  const [tab, setTab] = useState<BoardTab>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [globeFocusToken, setGlobeFocusToken] = useState(0);
  const [events, setEvents] = useState<RankedCelestialEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const cardRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const requestId = useRef(0);

  const searchActive = debouncedQuery.trim().length >= 2;
  // Stable key so parent re-creating the place object doesn't wipe search results.
  const placeKey = `${place.latitude.toFixed(5)},${place.longitude.toFixed(5)}`;

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    const id = ++requestId.current;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setSearching(searchActive);
      setError(null);
      try {
        const next = searchActive
          ? await searchEvents(debouncedQuery.trim())
          : await fetchNearbyEvents(place);
        if (id !== requestId.current || controller.signal.aborted) return;
        setEvents(next);
        setSelectedId((prev) =>
          prev && next.some((e) => e.id === prev) ? prev : null
        );
        if (searchActive) setRarityFilter("all");
      } catch {
        if (id !== requestId.current || controller.signal.aborted) return;
        setEvents([]);
        setSelectedId(null);
        setError(
          searchActive
            ? "Event search is unavailable. Please try again."
            : "Sky events are unavailable. Please try again."
        );
      } finally {
        if (id === requestId.current && !controller.signal.aborted) {
          setLoading(false);
          setSearching(false);
        }
      }
    }

    void load();
    return () => {
      controller.abort();
    };
    // placeKey (not place object identity) drives nearby reloads
  }, [placeKey, place, refreshKey, debouncedQuery, searchActive]);

  const counts = useMemo(() => {
    const c: Record<RarityFilter, number> = {
      all: events.length,
      common: 0,
      uncommon: 0,
      rare: 0,
      epic: 0,
      legendary: 0,
    };
    for (const e of events) c[e.rarity] += 1;
    return c;
  }, [events]);

  const visible = useMemo(() => {
    const filtered =
      rarityFilter === "all"
        ? events
        : events.filter((e) => e.rarity === rarityFilter);
    // Nearby: closest first. Search: keep Elasticsearch relevance order.
    if (searchActive) {
      return [...filtered].sort((a, b) => b.sortScore - a.sortScore);
    }
    return [...filtered].sort(byClosest);
  }, [events, rarityFilter, searchActive]);

  const selected = useMemo(
    () => events.find((e) => e.id === selectedId) ?? null,
    [events, selectedId]
  );

  function selectEvent(
    event: RankedCelestialEvent,
    opts?: { openList?: boolean }
  ) {
    setSelectedId(event.id);
    setRarityFilter(event.rarity);
    if (opts?.openList) setTab("list");
    requestAnimationFrame(() => {
      cardRefs.current.get(event.id)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }

  const activeBlurb =
    rarityFilter === "all"
      ? searchActive
        ? "Search results, sorted by relevance."
        : locationChosen
          ? "Sky targets near you — closest first. Use Show on globe to explore a target."
          : `Sky targets for the ${place.label} preview — choose your location for nearby results.`
      : RARITY_META[rarityFilter].blurb;

  return (
    <div className={`yonder-events${compact ? " yonder-events--compact" : ""}`}>
      {!compact ? (
        <header className="yonder-events-intro">
          <p className="eyebrow">Visible sky events</p>
          <h2 id="events-screen-title">What can you catch next?</h2>
          <p>Browse by rarity or the globe — both stay in sync.</p>
        </header>
      ) : (
        <div className="section-heading">
          <h2 id="events-screen-title">Upcoming sky events</h2>
          <span>
            {searchActive ? "Search" : locationChosen ? "Near you" : "Preview sky"}
          </span>
        </div>
      )}

      <label className="yonder-events-search">
        <span className="sr-only">Search events</span>
        <input
          type="search"
          value={query}
          placeholder="Search events (e.g. meteor, eclipse)…"
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
        />
        {(searching || loading) && <small role="status">Looking…</small>}
      </label>

      {!compact && (
        <button
          type="button"
          className="yonder-events-location"
          onClick={onLocation}
        >
          <strong>
            {locationChosen ? place.label : `${place.label} preview`}
          </strong>
          <span>{locationChosen ? "Change location" : "Choose location"}</span>
        </button>
      )}

      {!error && (
        <div className="yonder-rarity-row" role="group" aria-label="Rarity filter">
        <button
          type="button"
          className={`rarity-chip rarity-chip--all${rarityFilter === "all" ? " is-active" : ""}`}
          aria-pressed={rarityFilter === "all"}
          onClick={() => setRarityFilter("all")}
        >
          <span className="rarity-chip-dot" aria-hidden />
          All
          <em>{counts.all}</em>
        </button>
        {RARITY_ORDER.map((r) => (
          <button
            key={r}
            type="button"
            className={`rarity-chip rarity-chip--${r}${rarityFilter === r ? " is-active" : ""}`}
            aria-pressed={rarityFilter === r}
            onClick={() => setRarityFilter(r)}
          >
            <span className="rarity-chip-dot" aria-hidden />
            {RARITY_META[r].label}
            <em>{counts[r]}</em>
          </button>
        ))}
        </div>
      )}
      {!error && <p className="yonder-events-blurb">{activeBlurb}</p>}

      {!error && (
        <div className="yonder-events-tabs">
        <button
          type="button"
          className={tab === "list" ? "is-active" : undefined}
          aria-pressed={tab === "list"}
          onClick={() => setTab("list")}
        >
          {searchActive ? "Best matches" : "Closest list"}
        </button>
        <button
          type="button"
          className={tab === "globe" ? "is-active" : undefined}
          aria-pressed={tab === "globe"}
          onClick={() => {
            setTab("globe");
            setGlobeFocusToken((k) => k + 1);
          }}
        >
          Globe map
        </button>
        <button
          type="button"
          className="yonder-events-refresh"
          disabled={loading || searching}
          onClick={() => {
            setRefreshKey((k) => k + 1);
          }}
        >
          Refresh
        </button>
        </div>
      )}

      {error && (
        <div className="yonder-events-error">
          <p role="alert">{error}</p>
          <button type="button" onClick={() => setRefreshKey((k) => k + 1)}>
            Try again
          </button>
        </div>
      )}

      {!error && (tab === "globe" ? (
        <div className="yonder-events-globe">
          <EventsGlobe
            events={visible}
            place={place}
            selectedId={selectedId}
            focusToken={globeFocusToken}
            onSelect={(event) => selectEvent(event, { openList: false })}
          />
          {selected ? (
            <article
              className="yonder-event-card is-selected"
              data-rarity={selected.rarity}
              data-kind={selected.kind}
            >
              <div className="yonder-event-hero">
                <EventSkyArt kind={selected.kind} title={selected.title} />
                <div className="yonder-event-hero-overlay">
                  <span className="yonder-event-kind">Selected on globe</span>
                  <div className="yonder-event-points">
                    <strong>+{selected.points}</strong>
                    <span>pts</span>
                  </div>
                </div>
              </div>
              <div className="yonder-event-body">
                <h3>{selected.title}</h3>
                <p>{selected.summary}</p>
                <p className="yonder-event-meta">
                  {formatDistance(selected)} · {formatWhen(selected.startsAt)}
                </p>
                {selected.photoTip ? (
                  <p className="yonder-event-tip">{selected.photoTip}</p>
                ) : null}
                <button
                  type="button"
                  className="yonder-events-linkish"
                  onClick={() => selectEvent(selected, { openList: true })}
                >
                  Open in list →
                </button>
              </div>
            </article>
          ) : (
            <p className="yonder-events-empty">
              Tap a glowing point on the globe. Rarity chips filter both views.
            </p>
          )}
        </div>
      ) : (
        <ul className="yonder-event-list">
          {visible.map((event, index) => {
            const active = selectedId === event.id;
            return (
              <li
                key={event.id}
                ref={(node) => {
                  if (node) cardRefs.current.set(event.id, node);
                  else cardRefs.current.delete(event.id);
                }}
              >
                <article
                  className={`yonder-event-card${active ? " is-selected" : ""}`}
                  data-rarity={event.rarity}
                  data-kind={event.kind}
                >
                  <div className="yonder-event-card-heading">
                    <h3>{event.title}</h3>
                    <time dateTime={event.startsAt}>
                      {formatWhen(event.startsAt)}
                    </time>
                  </div>
                  <div className="yonder-event-hero">
                    <EventSkyArt kind={event.kind} title={event.title} />
                    <div className="yonder-event-hero-overlay">
                      <div className="yonder-event-badges">
                        <button
                          type="button"
                          className={`rarity-chip rarity-chip--${event.rarity}`}
                          aria-label={`Filter to ${RARITY_META[event.rarity].label} events`}
                          onClick={() => setRarityFilter(event.rarity)}
                        >
                          <span className="rarity-chip-dot" aria-hidden />
                          {RARITY_META[event.rarity].label}
                        </button>
                        <span className="yonder-event-kind">
                          {event.kind.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="yonder-event-points">
                        <strong>+{event.points}</strong>
                        <span>pts</span>
                      </div>
                    </div>
                    <span className="yonder-event-rank">#{index + 1}</span>
                  </div>
                  <div className="yonder-event-body">
                    <p>{event.summary}</p>
                    <dl className="yonder-event-stats">
                      <div>
                        <dt>When</dt>
                        <dd>{formatWhen(event.startsAt)}</dd>
                      </div>
                      <div>
                        <dt>Distance</dt>
                        <dd>{formatDistance(event)}</dd>
                      </div>
                      <div>
                        <dt>Best view</dt>
                        <dd>
                          {event.location?.label ??
                            (event.globalVisibility
                              ? "Anywhere with clear night sky"
                              : "—")}
                        </dd>
                      </div>
                    </dl>
                    {event.photoTip ? (
                      <p className="yonder-event-tip">{event.photoTip}</p>
                    ) : null}
                    <div className="yonder-event-card-footer">
                      <button
                        type="button"
                        className="yonder-events-linkish"
                        onClick={() => {
                          setSelectedId(event.id);
                          setTab("globe");
                          setGlobeFocusToken((k) => k + 1);
                        }}
                      >
                        Show on globe
                      </button>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      ))}

      {!error && loading && !searchActive ? (
        <p className="yonder-events-empty" role="status">
          Loading sky events…
        </p>
      ) : null}
      {!error && !loading && !searching && visible.length === 0 ? (
        <p className="yonder-events-empty">
          {searchActive
            ? "No events match that search. Try different words or another rarity."
            : "No events match this location and rarity. Try another category or location."}
        </p>
      ) : null}
    </div>
  );
}
