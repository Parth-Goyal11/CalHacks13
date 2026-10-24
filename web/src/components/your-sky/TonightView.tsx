"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { SkyIcon } from "./SkyIcon";
import { discoveryExamples, learningSources, previewPlace, type CurrentWeather, type Place } from "./tonight-data";
import styles from "./YourSky.module.css";

type WeatherState = { status: "loading" } | { status: "error" } | { status: "ready"; data: CurrentWeather };
type Sheet = "location" | (typeof discoveryExamples)[number]["id"] | null;

function subscribeClock(onChange: () => void) {
  const timer = window.setInterval(onChange, 60000);
  return () => window.clearInterval(timer);
}
function clockSnapshot() { return Math.floor(Date.now() / 60000) * 60000; }
function serverClockSnapshot() { return null; }

function coordinateLabel(place: Place) {
  return `${Math.abs(place.latitude).toFixed(2)}° ${place.latitude < 0 ? "S" : "N"}, ${Math.abs(place.longitude).toFixed(2)}° ${place.longitude < 0 ? "W" : "E"}`;
}

function viewingNote(weather: CurrentWeather) {
  if (weather.isDay) return "It's daylight here. Check again after sunset; cloud cover can change before tonight.";
  if (weather.cloudCover <= 20) return "Few clouds in the model. Find a darker spot and give your eyes time to adjust.";
  if (weather.cloudCover <= 65) return "Clouds may break up your view. Look for gaps and start with the brightest objects.";
  return "Clouds may hide much of the sky. Check again later for a clearer window.";
}

export default function TonightView() {
  const [place, setPlace] = useState<Place>(previewPlace);
  const [source, setSource] = useState<"preview" | "city" | "device">("preview");
  const now = useSyncExternalStore(subscribeClock, clockSnapshot, serverClockSnapshot);
  const [weather, setWeather] = useState<WeatherState>({ status: "loading" });
  const [reload, setReload] = useState(0);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const searchRequest = useRef<AbortController | null>(null);
  const geoRequest = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const parameters = new URLSearchParams({ lat: place.latitude.toFixed(2), lon: place.longitude.toFixed(2) });
    async function loadWeather() {
      try {
        const response = await fetch(`/api/tonight?${parameters}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Weather unavailable");
        const data: CurrentWeather = await response.json();
        if (!controller.signal.aborted) setWeather({ status: "ready", data });
      } catch {
        if (!controller.signal.aborted) setWeather({ status: "error" });
      }
    }
    void loadWeather();
    return () => controller.abort();
  }, [place.latitude, place.longitude, reload]);

  useEffect(() => {
    const element = dialog.current;
    if (sheet && element && !element.open) element.showModal();
    if (!sheet && element?.open) element.close();
  }, [sheet]);

  useEffect(() => {
    if (!sheet) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [sheet]);

  useEffect(() => {
    const timer = window.setInterval(() => setReload((value) => value + 1), 300000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => { searchRequest.current?.abort(); geoRequest.current += 1; }, []);

  function closeSheet() {
    geoRequest.current += 1;
    searchRequest.current?.abort();
    setLocating(false);
    setSearching(false);
    setSheet(null);
  }

  function choosePlace(next: Place, nextSource: "city" | "device") {
    geoRequest.current += 1;
    searchRequest.current?.abort();
    setPlace({ ...next, latitude: Math.round(next.latitude * 100) / 100, longitude: Math.round(next.longitude * 100) / 100 });
    setWeather({ status: "loading" });
    setReload((value) => value + 1);
    setSource(nextSource);
    setLocationError("");
    setLocating(false);
    setSearching(false);
    setSheet(null);
  }

  async function searchCities(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (searching) return;
    if (query.trim().length < 2) { setLocationError("Enter at least two letters to search."); return; }
    searchRequest.current?.abort();
    const controller = new AbortController();
    searchRequest.current = controller;
    setSearching(true);
    setLocationError("");
    setResults(null);
    try {
      const response = await fetch(`/api/locations?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
      if (!response.ok) throw new Error("Search unavailable");
      const data: { places: Place[] } = await response.json();
      if (!controller.signal.aborted) setResults(data.places);
    } catch {
      if (!controller.signal.aborted) setLocationError("City search is unavailable right now. Please try again.");
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  }

  function useDeviceLocation() {
    if (locating) return;
    if (!navigator.geolocation) { setLocationError("Location is unavailable in this browser. Search for a city instead."); return; }
    const request = ++geoRequest.current;
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition((position) => {
      if (request !== geoRequest.current) return;
      choosePlace({ id: "device", name: "Your location", latitude: position.coords.latitude, longitude: position.coords.longitude }, "device");
    }, (error) => {
      if (request !== geoRequest.current) return;
      setLocating(false);
      setLocationError(error.code === 1 ? "Location access was declined. You can still choose a city below." : "We couldn't find your location. Try again or choose a city.");
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }

  const data = weather.status === "ready" ? weather.data : null;
  const timezone = data?.timezone ?? place.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const date = now === null ? "Your night starts here" : new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: timezone }).format(now);
  const discovery = discoveryExamples.find((item) => item.id === sheet);

  return <>
    <div className={styles.pageHeading}>
      <div><h1>Tonight</h1><p className={styles.date}>{date}</p></div>
      <button className={styles.locationButton} onClick={() => { setLocationError(""); setSheet("location"); }} aria-label="Change location">
        <SkyIcon name="location" /><span><strong>{place.name}{place.region ? `, ${place.region}` : ""}</strong><span className={styles.coordinates}>{coordinateLabel(place)}{source === "preview" ? " · Preview location" : " · Approximate"}</span></span><SkyIcon name="down" />
      </button>
    </div>

    <div className={styles.tonightGrid}>
      <section className={styles.conditions} aria-labelledby="conditions-title" aria-busy={weather.status === "loading"}>
        <div className={styles.sectionHeading}><h2 id="conditions-title">Outside now</h2><SkyIcon name={data?.isDay ? "sun" : "moon"} /></div>
        {weather.status === "loading" ? <div className={styles.weatherLoading} role="status"><div /><div /><span>Checking the weather…</span></div> : weather.status === "error" ? <div className={styles.weatherError} role="status"><p>We could not load the weather.</p><p>Your photo tools are still ready.</p><button className={styles.textButton} onClick={() => { setWeather({ status: "loading" }); setReload((value) => value + 1); }}>Try again</button></div> : <>
          <div className={styles.weatherMetrics}>
            <div><span className={styles.weatherValue}>{Math.round(weather.data.temperature)}<span>°C</span></span><span className={styles.metricLabel}>Temperature</span></div>
            <div><span className={styles.weatherValue}>{Math.round(weather.data.cloudCover)}<span>%</span></span><span className={styles.metricLabel}>Cloud cover</span></div>
          </div>
          <p className={styles.viewingNote}>{viewingNote(weather.data)}</p>
          <p className={styles.weatherCredit}><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a><span>Model updated {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: timezone }).format(weather.data.time * 1000)}</span></p>
        </>}
      </section>

      <section className={styles.captureCard} aria-labelledby="capture-title">
        <div className={styles.photo}><Image src="/your-sky/night-sky.jpg" alt="An illustrative night-sky photograph above an Alpine mountain ridge" fill preload sizes="(max-width: 767px) 100vw, 560px" /></div>
        <div className={styles.captureCopy}><h2 id="capture-title">See what is above you.</h2><p>Take a photo. Get curious about what you see.</p></div>
      </section>

      <section className={styles.discoveries} aria-labelledby="discoveries-title">
        <h2 id="discoveries-title">A few things to look for</h2>
        <p className={styles.exampleNote}>Example targets. Local visibility comes next.</p>
        <div className={styles.discoveryList}>{discoveryExamples.map((item) => <button className={styles.discoveryRow} key={item.id} onClick={() => setSheet(item.id)}><span className={styles.objectIcon}><SkyIcon name={item.icon} /></span><span><strong>{item.title}</strong><span>{item.subtitle}</span></span><SkyIcon name="chevron" /></button>)}</div>
      </section>
    </div>
    <p className={styles.photoCredit}>Sky photograph by <a href="https://unsplash.com/photos/IXM3iSrj3QE" target="_blank" rel="noreferrer">Micha Lehmann / Unsplash</a>. Image is illustrative.</p>

    <dialog ref={dialog} className={styles.sheet} onClose={closeSheet} onCancel={closeSheet} onClick={(event) => { if (event.target === event.currentTarget) closeSheet(); }} aria-labelledby={sheet === "location" ? "location-title" : "object-title"}>
      <div className={styles.sheetContent}>
        <button className={styles.closeButton} onClick={closeSheet} aria-label="Close"><SkyIcon name="close" /></button>
        {sheet === "location" ? <>
          <h2 id="location-title">Your place under the sky</h2>
          <p className={styles.sheetDescription}>Choose where you are looking up.</p>
          <button className={styles.locationAction} onClick={useDeviceLocation} aria-disabled={locating} aria-busy={locating}><SkyIcon name="location" />{locating ? "Finding your location…" : "Use my location"}</button>
          <p className={styles.privacyNote}>With your permission, we round your coordinates before requesting weather from Open-Meteo. You can choose a city instead.</p>
          <form onSubmit={searchCities} className={styles.cityForm}>
            <label htmlFor="city-search">Or search for a city</label>
            <div><input id="city-search" name="city" type="search" autoComplete="off" value={query} onChange={(event) => { searchRequest.current?.abort(); setSearching(false); setResults(null); setLocationError(""); setQuery(event.target.value); }} maxLength={100} placeholder="For example, Berkeley…" /><button type="submit" aria-label="Search cities" aria-disabled={searching} aria-busy={searching}><SkyIcon name="search" /></button></div>
          </form>
          <div aria-live="polite" aria-atomic="true" className={styles.searchStatus}>{locationError || (searching ? "Searching cities…" : results?.length === 0 ? "No cities found. Try a nearby city or add the country." : results ? `${results.length} places found. Choose one below.` : "")}</div>
          {results && <ul className={styles.cityResults}>{results.map((result) => <li key={result.id}><button onClick={() => choosePlace(result, "city")}><span><strong>{result.name}</strong><span>{[result.region, result.country].filter(Boolean).join(", ")}</span></span><SkyIcon name="chevron" /></button></li>)}</ul>}
          <p className={styles.searchAttribution}>City search by Open-Meteo and GeoNames.</p>
        </> : discovery ? <>
          <div className={styles.detailIcon}><SkyIcon name={discovery.icon} /></div><h2 id="object-title">{discovery.title}</h2>
          <p className={styles.objectBody}>{discovery.body}</p><div className={styles.localNote}><h3>For your night</h3><p>{discovery.tip}</p></div><a className={styles.textButton} href={learningSources[discovery.id]} target="_blank" rel="noreferrer" aria-label="Read more with NASA (opens in a new tab)">Read more with NASA</a><button className={styles.primary} onClick={closeSheet}>Back to Tonight</button>
        </> : null}
      </div>
    </dialog>
  </>;
}
