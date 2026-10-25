"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RankedCelestialEvent } from "@calhacks13/lib";
import type { GeocodedPlace } from "@/components/sky/location-types";
import { EventsGlobe } from "./EventsGlobe";
import {
  byClosest,
  formatDistance,
  formatWhen,
  RARITY_META,
  RARITY_ORDER,
  type RarityFilter,
} from "./event-ui";

type MainTab = "rarity" | "globe";

async function fetchEvents(
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load events");
  return data.events as RankedCelestialEvent[];
}

export function EventsBoard({
  place,
  onLocation,
  onCapture,
}: {
  place: GeocodedPlace;
  onLocation: () => void;
  onCapture: (target?: string) => void;
}) {
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>("all");
  const [tab, setTab] = useState<MainTab>("rarity");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [globeFocusToken, setGlobeFocusToken] = useState(0);
  const [events, setEvents] = useState<RankedCelestialEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const next = await fetchEvents(place);
        if (!cancelled) {
          setEvents(next);
          setSelectedId((prev) =>
            prev && next.some((e) => e.id === prev) ? prev : null
          );
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load events");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [place, refreshKey]);

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
    return [...filtered].sort(byClosest);
  }, [events, rarityFilter]);

  const selected = useMemo(
    () => events.find((e) => e.id === selectedId) ?? null,
    [events, selectedId]
  );

  function selectEvent(event: RankedCelestialEvent, opts?: { openList?: boolean }) {
    setSelectedId(event.id);
    setRarityFilter(event.rarity);
    if (opts?.openList) setTab("rarity");
    requestAnimationFrame(() => {
      cardRefs.current.get(event.id)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }

  function selectFromList(event: RankedCelestialEvent) {
    setSelectedId(event.id);
    // Keep rarity filter if All, or jump to that rarity when browsing a category
  }

  const activeBlurb =
    rarityFilter === "all"
      ? "Sky targets you can photograph — closest first. Click a card or a globe pin."
      : RARITY_META[rarityFilter].blurb;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-400/80">
            Visible sky events
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            What can you catch next?
          </h1>
          <p className="mt-3 text-base leading-relaxed text-zinc-400">
            Browse by rarity or explore the globe — selecting on either side
            highlights the other.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onCapture()}
          className="shrink-0 rounded-md bg-sky-500 px-4 py-2.5 text-center text-sm font-semibold !text-zinc-950 transition hover:bg-sky-400"
        >Capture one</button>
      </header>

      {/* Shared rarity chips — drive both list + globe */}
      <div>
        <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">
          Rarity filter
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setRarityFilter("all")}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              rarityFilter === "all"
                ? "border-sky-300 bg-sky-300 text-zinc-950"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
            }`}
          >
            All ({counts.all})
          </button>
          {RARITY_ORDER.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRarityFilter(r)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                rarityFilter === r
                  ? RARITY_META[r].active
                  : RARITY_META[r].chip
              }`}
            >
              {RARITY_META[r].label} ({counts[r]})
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-zinc-500">{activeBlurb}</p>
      </div>

      {/* Interconnected tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-px">
        <button
          type="button"
          onClick={() => setTab("rarity")}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
            tab === "rarity"
              ? "border-sky-400 text-sky-200"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Closest list
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("globe");
            setRefreshKey((k) => k + 1);
            setGlobeFocusToken((k) => k + 1);
          }}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
            tab === "globe"
              ? "border-sky-400 text-sky-200"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Globe map
        </button>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
          className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-rose-900/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-200"
        >
          {error}
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {tab === "globe" ? (
            <div className="flex flex-col gap-3">
              <EventsGlobe
                events={visible}
                place={place}
                selectedId={selectedId}
                focusToken={globeFocusToken}
                onSelect={(event) => selectEvent(event, { openList: false })}
              />
              {selected ? (
                <div className="rounded-xl border border-sky-800/50 bg-sky-950/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-sky-400/80">
                        Selected on globe
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-zinc-50">
                        {selected.title}
                      </h2>
                      <p className="mt-1 text-sm text-zinc-400">
                        {selected.summary}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => selectEvent(selected, { openList: true })}
                      className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-500"
                    >
                      Open in list →
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => onCapture(selected.title)} className="rounded-md bg-zinc-100 px-3 py-2 text-xs font-semibold !text-zinc-950 hover:bg-white">Photograph this event</button>
                    <span className="self-center text-xs text-zinc-500">
                      {formatDistance(selected)} · {formatWhen(selected.startsAt)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">
                  Click a glowing point on the globe. Rarity chips filter both
                  views.
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {!place ? (
                <p className="rounded-md border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-500">
                  Set your location so launches / eclipses / ISS can sort by
                  distance. Moons & showers count as in your sky.
                </p>
              ) : null}

              <ul className="flex flex-col gap-3">
                {visible.map((event, index) => {
                  const meta = RARITY_META[event.rarity];
                  const active = selectedId === event.id;
                  return (
                    <li
                      key={event.id}
                      ref={(node) => {
                        if (node) cardRefs.current.set(event.id, node);
                        else cardRefs.current.delete(event.id);
                      }}
                      className={`cursor-pointer rounded-xl border p-4 transition ${
                        active
                          ? "border-sky-500/70 bg-sky-950/30 ring-1 ring-sky-500/30"
                          : "border-zinc-800 bg-zinc-950/70 hover:border-zinc-700"
                      }`}
                      onClick={() => selectFromList(event)}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[10px] text-zinc-600">
                              #{index + 1}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRarityFilter(event.rarity);
                              }}
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${meta.chip}`}
                            >
                              {meta.label}
                            </button>
                            <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                              {event.kind.replace(/_/g, " ")}
                            </span>
                          </div>
                          <h2 className="mt-2 text-lg font-semibold text-zinc-50">
                            {event.title}
                          </h2>
                          <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                            {event.summary}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold tabular-nums text-amber-300/90">
                            +{event.points}
                          </p>
                          <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                            pts
                          </p>
                        </div>
                      </div>

                      <dl className="mt-4 grid gap-2 text-xs text-zinc-500 sm:grid-cols-3">
                        <div>
                          <dt className="uppercase tracking-wider text-zinc-600">
                            When
                          </dt>
                          <dd className="mt-0.5 text-zinc-300">
                            {formatWhen(event.startsAt)}
                          </dd>
                        </div>
                        <div>
                          <dt className="uppercase tracking-wider text-zinc-600">
                            Distance
                          </dt>
                          <dd className="mt-0.5 text-zinc-300">
                            {formatDistance(event)}
                          </dd>
                        </div>
                        <div>
                          <dt className="uppercase tracking-wider text-zinc-600">
                            Best view
                          </dt>
                          <dd className="mt-0.5 truncate text-zinc-300">
                            {event.location?.label ??
                              (event.globalVisibility
                                ? "Anywhere with clear night sky"
                                : "—")}
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" onClick={(e) => { e.stopPropagation(); onCapture(event.title); }} className="inline-flex rounded-md bg-zinc-100 px-3 py-2 text-xs font-semibold !text-zinc-950 transition hover:bg-white">Photograph this event</button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(event.id);
                            setTab("globe");
                          }}
                          className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-zinc-500"
                        >
                          Show on globe
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {loading ? (
                <p className="text-sm text-zinc-500">Loading sky events…</p>
              ) : null}
              {!loading && visible.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Nothing in this rarity window — try another category.
                </p>
              ) : null}
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
            Your location
          </h2>
          <button type="button" onClick={onLocation} className="w-full rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-left text-sm text-zinc-200 hover:border-zinc-600">
            {place.label} <span className="float-right text-zinc-500">Change location</span>
          </button>
          <div className="rounded-md border border-zinc-800 bg-zinc-950/50 p-3 text-xs leading-relaxed text-zinc-500">
            <p className="font-medium text-zinc-400">How it connects</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-4">
              <li>Rarity chips filter the list and the globe together.</li>
              <li>Click a list card → it stays selected on the globe.</li>
              <li>Click a globe pin → opens details; jump back to the list.</li>
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
}
