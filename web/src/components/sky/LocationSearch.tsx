"use client";

import dynamic from "next/dynamic";
import { useId, useRef, useState } from "react";
import type { GeocodedPlace } from "./location-types";

export type { GeocodedPlace };

const DarkMapPin = dynamic(
  () => import("./DarkMapPin").then((m) => m.DarkMapPin),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-56 items-center justify-center rounded-lg border border-zinc-800 bg-[#0b0f14] text-xs text-zinc-500 sm:h-64">
        Loading map…
      </div>
    ),
  }
);

interface LocationSearchProps {
  value: GeocodedPlace | null;
  onChange: (place: GeocodedPlace | null) => void;
  onError?: (message: string) => void;
  /** Hide the Leaflet pin map (e.g. events page already has a globe). */
  showMap?: boolean;
}

function geoErrorMessage(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "Location permission denied. Allow location for this site, or search for a place.";
    case err.POSITION_UNAVAILABLE:
      return "GPS unavailable right now. Search for a city instead.";
    case err.TIMEOUT:
      return "Location request timed out. Try again, or search for a place.";
    default:
      return "Could not read location. Search for a place instead.";
  }
}

function readPosition(
  options: PositionOptions
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export function LocationSearch({
  value,
  onChange,
  onError,
  showMap = true,
}: LocationSearchProps) {
  const listId = useId();
  const [draft, setDraft] = useState("");
  const [results, setResults] = useState<GeocodedPlace[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);

  const query = value ? value.label : draft;

  function clearError() {
    onError?.("");
  }

  function scheduleSearch(text: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = text.trim();
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const id = ++reqId.current;
      try {
        const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (id !== reqId.current) return;
        if (!res.ok) {
          onError?.(data.error ?? "Location search failed.");
          setResults([]);
          return;
        }
        const next = (data.results as GeocodedPlace[]) ?? [];
        setResults(next);
        setOpen(next.length > 0);
        if (next.length === 0) {
          onError?.("No places found — try a city or landmark name.");
        } else {
          clearError();
        }
      } catch {
        if (id === reqId.current) onError?.("Location search failed.");
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 350);
  }

  function selectPlace(place: GeocodedPlace) {
    clearError();
    onChange(place);
    setDraft("");
    setResults([]);
    setOpen(false);
    setLoading(false);
  }

  function clearPlace() {
    clearError();
    onChange(null);
    setDraft("");
    setResults([]);
    setOpen(false);
  }

  async function requestMyLocation() {
    if (!navigator.geolocation) {
      onError?.("Geolocation is not available in this browser. Search instead.");
      return;
    }

    // Secure context required (https or localhost)
    if (
      typeof window !== "undefined" &&
      !window.isSecureContext &&
      window.location.hostname !== "localhost"
    ) {
      onError?.(
        "Browser location needs HTTPS (or localhost). Search for a place instead."
      );
      return;
    }

    setGeoBusy(true);
    clearError();

    try {
      let pos: GeolocationPosition;
      try {
        pos = await readPosition({
          enableHighAccuracy: false,
          timeout: 20000,
          maximumAge: 60_000,
        });
      } catch {
        // Second try: high accuracy (some devices flip which works)
        pos = await readPosition({
          enableHighAccuracy: true,
          timeout: 25000,
          maximumAge: 0,
        });
      }

      const latitude = pos.coords.latitude;
      const longitude = pos.coords.longitude;

      try {
        const res = await fetch(
          `/api/geocode/reverse?lat=${latitude}&lon=${longitude}`
        );
        const data = await res.json();
        selectPlace({
          id: `geo-${latitude.toFixed(5)}-${longitude.toFixed(5)}`,
          label:
            data.label ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
          latitude: Number(data.latitude ?? latitude),
          longitude: Number(data.longitude ?? longitude),
          kind: "current",
        });
      } catch {
        selectPlace({
          id: `geo-${latitude.toFixed(5)}-${longitude.toFixed(5)}`,
          label: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
          latitude,
          longitude,
          kind: "current",
        });
      }
    } catch (err) {
      if (err && typeof err === "object" && "code" in err) {
        onError?.(geoErrorMessage(err as GeolocationPositionError));
      } else {
        onError?.("Could not read location. Search for a place instead.");
      }
    } finally {
      setGeoBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-zinc-400">Location</span>
        <div className="relative">
          <input
            value={query}
            role="combobox"
            aria-expanded={open && results.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            placeholder="Search a city, park, observatory…"
            className="w-full rounded-md border border-zinc-800 bg-zinc-900/80 px-3 py-2 pr-24 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-sky-600"
            onChange={(e) => {
              const next = e.target.value;
              if (value) onChange(null);
              setDraft(next);
              scheduleSearch(next);
            }}
            onFocus={() => {
              if (results.length) setOpen(true);
            }}
            onBlur={() => {
              setTimeout(() => setOpen(false), 150);
            }}
          />
          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-zinc-500">
            {loading ? "Searching…" : null}
          </div>

          {open && results.length > 0 ? (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-zinc-700 bg-zinc-950 py-1 shadow-lg"
              onMouseDown={(e) => e.preventDefault()}
            >
              {results.map((place, index) => (
                <li key={place.id} role="option" aria-selected={index === 0}>
                  <button
                    type="button"
                    className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-zinc-900"
                    onClick={() => selectPlace(place)}
                  >
                    <span className="text-zinc-100">{place.label}</span>
                    <span className="text-xs text-zinc-500">
                      {place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void requestMyLocation()}
          disabled={geoBusy}
          className="text-sm text-sky-400 hover:text-sky-300 disabled:opacity-50"
        >
          {geoBusy ? "Locating…" : "Use my current location"}
        </button>
        {value ? (
          <button
            type="button"
            onClick={clearPlace}
            className="text-sm text-zinc-500 hover:text-zinc-300"
          >
            Clear
          </button>
        ) : null}
      </div>

      {showMap && value ? (
        <DarkMapPin
          place={value}
          onMove={(p) => {
            clearError();
            onChange(p);
          }}
          onError={onError}
        />
      ) : !value ? (
        <p className="text-xs text-zinc-600">
          Type a place name and pick a result — more reliable than GPS in some
          browsers.
        </p>
      ) : null}
    </div>
  );
}
