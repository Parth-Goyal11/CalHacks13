"use client";

import { useEffect, useRef, useState } from "react";
import type { GeocodedPlace } from "./location-types";
import "maplibre-gl/dist/maplibre-gl.css";

interface DarkMapPinProps {
  place: GeocodedPlace;
  onMove: (place: GeocodedPlace) => void;
  onError?: (message: string) => void;
}

/**
 * OpenFreeMap liberty (reliable vector tiles) — we recolor it dark after load
 * so the map isn't a blank black canvas. No API key.
 */
const BASE_STYLE = "https://tiles.openfreemap.org/styles/liberty";

function makePinElement() {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "sky-gl-pin";
  el.setAttribute("aria-label", "Drag to move location");
  el.innerHTML = `<span class="sky-gl-pin-halo"></span><span class="sky-gl-pin-core"></span>`;
  return el;
}

/** Recolor a light vector style into a clean night UI. */
function applyNightTheme(map: import("maplibre-gl").Map) {
  const bg = "#0e141c";
  const water = "#152033";
  const land = "#121820";
  const road = "#3d4a5c";
  const roadMajor = "#5b6b82";
  const building = "#1a222e";
  const label = "#9aa7b8";
  const labelHalo = "rgba(10,14,20,0.85)";

  try {
    if (map.getLayer("background")) {
      map.setPaintProperty("background", "background-color", bg);
    }
  } catch {
    /* ignore */
  }

  for (const layer of map.getStyle().layers ?? []) {
    const id = layer.id;
    const type = layer.type;
    try {
      if (type === "fill") {
        if (/water/i.test(id)) {
          map.setPaintProperty(id, "fill-color", water);
        } else if (/park|wood|grass|landcover|landuse/i.test(id)) {
          map.setPaintProperty(id, "fill-color", land);
          if (map.getPaintProperty(id, "fill-opacity") !== undefined) {
            map.setPaintProperty(id, "fill-opacity", 0.55);
          }
        } else if (/building/i.test(id)) {
          map.setPaintProperty(id, "fill-color", building);
          map.setPaintProperty(id, "fill-opacity", 0.7);
        }
      } else if (type === "line") {
        if (/highway|road|street|bridge|tunnel|path|rail/i.test(id)) {
          const major = /motorway|trunk|primary|secondary/i.test(id);
          map.setPaintProperty(id, "line-color", major ? roadMajor : road);
          if (map.getPaintProperty(id, "line-opacity") !== undefined) {
            map.setPaintProperty(id, "line-opacity", major ? 0.95 : 0.75);
          }
        } else if (/boundary|border/i.test(id)) {
          map.setPaintProperty(id, "line-color", "#2a3340");
        } else if (/water/i.test(id)) {
          map.setPaintProperty(id, "line-color", water);
        }
      } else if (type === "symbol") {
        if (map.getPaintProperty(id, "text-color") !== undefined) {
          map.setPaintProperty(id, "text-color", label);
        }
        if (map.getPaintProperty(id, "text-halo-color") !== undefined) {
          map.setPaintProperty(id, "text-halo-color", labelHalo);
        }
        if (map.getPaintProperty(id, "icon-opacity") !== undefined) {
          map.setPaintProperty(id, "icon-opacity", 0.55);
        }
      }
    } catch {
      /* layer paint mismatch — skip */
    }
  }
}

export function DarkMapPin({ place, onMove, onError }: DarkMapPinProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const markerRef = useRef<import("maplibre-gl").Marker | null>(null);
  const placeRef = useRef(place);
  const onMoveRef = useRef(onMove);
  const onErrorRef = useRef(onError);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    placeRef.current = place;
    onMoveRef.current = onMove;
    onErrorRef.current = onError;
  }, [place, onMove, onError]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !containerRef.current || mapRef.current) return;

      // Next/Turbopack often breaks the default worker; serve it from /public
      maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

      const start = placeRef.current;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: BASE_STYLE,
        center: [start.longitude, start.latitude],
        zoom: 12.4,
        attributionControl: { compact: true },
      });

      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right"
      );

      const marker = new maplibregl.Marker({
        element: makePinElement(),
        draggable: true,
        anchor: "center",
      })
        .setLngLat([start.longitude, start.latitude])
        .addTo(map);

      marker.on("dragend", async () => {
        const { lng, lat } = marker.getLngLat();
        const prev = placeRef.current;
        let label = prev.label;

        try {
          const res = await fetch(
            `/api/geocode/reverse?lat=${lat}&lon=${lng}`
          );
          if (res.ok) {
            const data = await res.json();
            if (typeof data.label === "string" && data.label) {
              label = data.label;
            }
          }
        } catch {
          onErrorRef.current?.("Could not reverse-geocode the new pin.");
        }

        onMoveRef.current({
          ...prev,
          id: `pin-${lat.toFixed(5)}-${lng.toFixed(5)}`,
          label,
          latitude: lat,
          longitude: lng,
          kind: "pin",
        });
      });

      map.on("error", (e) => {
        console.error("[sky-map]", e.error);
        if (!cancelled) {
          setStatus("error");
          onErrorRef.current?.(
            e.error?.message ?? "Map failed to load tiles."
          );
        }
      });

      map.on("load", () => {
        if (cancelled) return;
        applyNightTheme(map);
        map.resize();
        setStatus("ready");
      });

      // Style can finish after first paint
      map.on("idle", () => {
        if (cancelled) return;
        map.resize();
      });

      mapRef.current = map;
      markerRef.current = marker;

      // Layout may settle a frame later inside the form
      requestAnimationFrame(() => {
        map.resize();
        setTimeout(() => map.resize(), 120);
      });
    }

    void init().catch((err) => {
      console.error("[sky-map] init", err);
      if (!cancelled) {
        setStatus("error");
        onErrorRef.current?.(
          err instanceof Error ? err.message : "Map failed to start."
        );
      }
    });

    return () => {
      cancelled = true;
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;

    const current = marker.getLngLat();
    const moved =
      Math.abs(current.lat - place.latitude) > 1e-6 ||
      Math.abs(current.lng - place.longitude) > 1e-6;

    if (moved) {
      marker.setLngLat([place.longitude, place.latitude]);
      map.easeTo({
        center: [place.longitude, place.latitude],
        duration: 450,
      });
    }
  }, [place.latitude, place.longitude]);

  return (
    <div className="sky-gl-map relative overflow-hidden rounded-lg border border-zinc-800/80 bg-[#0e141c]">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-800/80 px-3 py-2 text-xs text-zinc-400">
        <span className="font-medium text-zinc-300">
          {status === "loading"
            ? "Loading map…"
            : status === "error"
              ? "Map error"
              : "Drag the pin to refine"}
        </span>
        <span className="font-mono text-zinc-500">
          {place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}
        </span>
      </div>
      <div ref={containerRef} className="h-56 w-full sm:h-64" />
    </div>
  );
}
