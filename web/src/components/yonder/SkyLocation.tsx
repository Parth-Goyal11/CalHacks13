"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { IconButton, SkyIcon } from "./SkyIcon";
import { previewPlace, type CurrentWeather, type Place } from "./tonight-data";

export function useSkyWeather() {
  const [place, setPlace] = useState<Place>(previewPlace);
  const [chosen, setChosen] = useState(false);
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [weatherError, setWeatherError] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const params = new URLSearchParams({
          lat: place.latitude.toFixed(2),
          lon: place.longitude.toFixed(2),
        });
        const response = await fetch(`/api/tonight?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Weather unavailable");
        const current: CurrentWeather = await response.json();
        if (!controller.signal.aborted) {
          setWeather(current);
          setWeatherError(false);
        }
      } catch {
        if (!controller.signal.aborted) setWeatherError(true);
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 300000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [place.latitude, place.longitude, reload]);
  function choosePlace(next: Place) {
    setWeather(null);
    setWeatherError(false);
    setChosen(true);
    setPlace({
      ...next,
      latitude: Math.round(next.latitude * 100) / 100,
      longitude: Math.round(next.longitude * 100) / 100,
    });
  }
  return {
    place,
    weather,
    weatherError,
    chosen,
    choosePlace,
    retry: () => setReload((value) => value + 1),
  };
}

export function coordinateLabel(place: Place) {
  return `${Math.abs(place.latitude).toFixed(2)}° ${place.latitude < 0 ? "S" : "N"} · ${Math.abs(place.longitude).toFixed(2)}° ${place.longitude < 0 ? "W" : "E"}`;
}

export function conditionLabel(weather: CurrentWeather | null) {
  if (!weather) return "Sky conditions";
  return weather.cloudCover <= 20
    ? "Few clouds"
    : weather.cloudCover <= 65
      ? "Partly cloudy"
      : "Cloudy";
}

export function LocationSheet({
  onChoose,
  onClose,
}: {
  onChoose: (place: Place) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    dialog.current?.showModal();
    return () => {
      controller.current?.abort();
      generation.current += 1;
    };
  }, []);
  async function search(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (query.trim().length < 2) {
      setError("Enter at least two letters.");
      return;
    }
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setError("");
    setPlaces(null);
    try {
      const response = await fetch(
        `/api/locations?q=${encodeURIComponent(query.trim())}`,
        { signal: request.signal },
      );
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (!request.signal.aborted) setPlaces(result.places);
    } catch {
      if (!request.signal.aborted)
        setError("City search is unavailable. Please try again.");
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }
  function useDevice() {
    if (busy) return;
    if (!navigator.geolocation) {
      setError("Location is unavailable. Search for a city instead.");
      return;
    }
    setBusy(true);
    setError("");
    const serial = ++generation.current;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (serial !== generation.current) return;
        onChoose({
          id: "device",
          name: "Your location",
          latitude: Math.round(position.coords.latitude * 100) / 100,
          longitude: Math.round(position.coords.longitude * 100) / 100,
        });
      },
      (issue) => {
        if (serial !== generation.current) return;
        setBusy(false);
        setError(
          issue.code === 1
            ? "Location access is off. You can choose a city instead."
            : "We could not find your location. Try a city instead.",
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }
  return (
    <dialog
      ref={dialog}
      className="utility-dialog"
      aria-labelledby="location-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="sheet-heading">
        <div>
          <p>Your corner of the sky</p>
          <h2 id="location-title">Location</h2>
        </div>
        <IconButton label="Close location" icon="close" onClick={onClose} />
      </div>
      <p className="utility-copy">
        Berkeley is the default. Choose a city or use your approximate location
        for current weather.
      </p>
      <button
        className="utility-primary"
        type="button"
        disabled={busy}
        onClick={useDevice}
      >
        <SkyIcon name="location" size={18} />
        Use my location
      </button>
      <form onSubmit={search}>
        <label htmlFor="yonder-city">City</label>
        <div className="search-row">
          <input
            id="yonder-city"
            placeholder="Search for a city"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={100}
            autoComplete="off"
          />
          <button type="submit" disabled={busy}>
            Search
          </button>
        </div>
      </form>
      {busy && <p role="status">Finding your sky…</p>}
      {error && <p role="alert">{error}</p>}
      {places && (
        <div className="city-results">
          {places.length ? (
            places.map((place) => (
              <button
                type="button"
                key={place.id}
                onClick={() => onChoose(place)}
              >
                <strong>{place.name}</strong>
                <span>
                  {[place.region, place.country].filter(Boolean).join(", ")}
                </span>
              </button>
            ))
          ) : (
            <p>No cities found. Try another name.</p>
          )}
        </div>
      )}
      <p className="local-note">
        Device coordinates are rounded to two decimal places.
      </p>
    </dialog>
  );
}
