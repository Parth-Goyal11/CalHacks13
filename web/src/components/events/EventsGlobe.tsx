"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { RankedCelestialEvent } from "@calhacks13/lib";
import type { GeocodedPlace } from "@/components/sky/location-types";
import {
  eventsToGlobePoints,
  RARITY_META,
  type GlobePoint,
} from "./event-ui";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

interface EventsGlobeProps {
  events: RankedCelestialEvent[];
  place: GeocodedPlace | null;
  selectedId: string | null;
  onSelect: (event: RankedCelestialEvent) => void;
  /** Bumps when the Globe tab is opened — triggers refresh zoom. */
  focusToken?: number;
}

type Mark = GlobePoint & { selected: boolean };

function makeSoftMarker(d: Mark, onSelect: (e: RankedCelestialEvent) => void) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `sky-globe-mark${d.selected ? " is-selected" : ""}`;
  btn.style.setProperty("--mark", d.color);
  btn.title = `${d.title} · ${RARITY_META[d.rarity].label}`;
  btn.setAttribute("aria-label", d.title);
  btn.innerHTML = `
    <span class="sky-globe-mark-pulse"></span>
    <span class="sky-globe-mark-pulse sky-globe-mark-pulse--late"></span>
    <span class="sky-globe-mark-soft"></span>
    <span class="sky-globe-mark-core"></span>
  `;
  btn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    onSelect(d.event);
  });
  return btn;
}

export function EventsGlobe({
  events,
  place,
  selectedId,
  onSelect,
  focusToken = 0,
}: EventsGlobeProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const [size, setSize] = useState({ w: 640, h: 420 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const points = useMemo(
    () => eventsToGlobePoints(events, place),
    [events, place]
  );

  const marks: Mark[] = useMemo(
    () => points.map((p) => ({ ...p, selected: p.id === selectedId })),
    [points, selectedId]
  );

  const ringsData = useMemo(
    () =>
      marks.map((p) => ({
        lat: p.lat,
        lng: p.lng,
        color: p.color,
        maxR: p.selected ? 6.5 : 3.2,
        speed: p.selected ? 1.4 : 0.85,
      })),
    [marks]
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({
        w: Math.max(320, Math.round(entry.contentRect.width)),
        h: Math.max(380, Math.round(entry.contentRect.height)),
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function flyTo(lat: number, lng: number, altitude: number, ms: number) {
    const g = globeRef.current;
    if (!g?.pointOfView) return;
    g.pointOfView({ lat, lng, altitude }, ms);
  }

  // Animate into the user's location whenever pin is set / globe tab refreshes
  useEffect(() => {
    if (!place || !ready) return;
    const t = window.setTimeout(() => {
      flyTo(place.latitude, place.longitude, 1.35, 1600);
    }, 120);
    return () => window.clearTimeout(t);
  }, [place?.latitude, place?.longitude, place, ready, focusToken]);

  // Soft secondary fly when an event is selected (after location settle)
  useEffect(() => {
    if (!selectedId || !ready) return;
    const point = points.find((p) => p.id === selectedId);
    if (!point) return;
    const t = window.setTimeout(() => {
      flyTo(point.lat, point.lng, 1.2, 1100);
    }, 80);
    return () => window.clearTimeout(t);
  }, [selectedId, points, ready]);

  return (
    <div
      ref={wrapRef}
      className="sky-globe-wrap relative h-[min(560px,72vh)] w-full overflow-hidden rounded-xl border border-zinc-800 bg-[#05080e]"
    >
      <Globe
        ref={globeRef}
        width={size.w}
        height={size.h}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        atmosphereColor="#7dd3fc"
        atmosphereAltitude={0.2}
        onGlobeReady={() => setReady(true)}
        // Soft HTML blooms instead of hard dots
        htmlElementsData={marks}
        htmlLat="lat"
        htmlLng="lng"
        htmlAltitude={(d: object) => ((d as Mark).selected ? 0.04 : 0.025)}
        htmlElement={(d: object) =>
          makeSoftMarker(d as Mark, (e) => onSelectRef.current(e))
        }
        htmlTransitionDuration={400}
        // Breathing rings under each bloom
        ringsData={ringsData}
        ringColor={(d: object) => (d as { color: string }).color}
        ringMaxRadius="maxR"
        ringPropagationSpeed={(d: object) => (d as { speed: number }).speed}
        ringRepeatPeriod={1400}
        ringAltitude={0.002}
      />

      <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap gap-2">
        {(Object.keys(RARITY_META) as (keyof typeof RARITY_META)[]).map((r) => (
          <span
            key={r}
            className="rounded-full border border-zinc-700/80 bg-zinc-950/70 px-2 py-0.5 text-[10px] text-zinc-300 backdrop-blur"
          >
            <span
              className="mr-1.5 inline-block h-2 w-2 rounded-full"
              style={{
                background: RARITY_META[r].color,
                boxShadow: `0 0 8px ${RARITY_META[r].color}`,
              }}
            />
            {RARITY_META[r].label}
          </span>
        ))}
      </div>

      {marks.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/50 text-sm text-zinc-400">
          {place
            ? "No mappable events in this rarity filter."
            : "Set your location — the globe will fly you there."}
        </div>
      ) : null}
    </div>
  );
}
