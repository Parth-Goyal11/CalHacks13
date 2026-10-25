"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  projectSkyToScreen,
  type PredictedFigure,
  type ProjectedEventMarker,
  type RankedCelestialEvent,
} from "@calhacks13/lib";
import { useDeviceSkyAttitude } from "@/hooks/useDeviceSkyAttitude";
import { RARITY_META } from "@/components/events/event-ui";
import { IconButton } from "./SkyIcon";
import type { Place } from "./tonight-data";

const FOV_DEG = 68;

async function fetchNearbyEvents(
  place: Place
): Promise<RankedCelestialEvent[]> {
  const params = new URLSearchParams({
    sort: "distance",
    days: "14",
    skyVisible: "1",
    lat: String(place.latitude),
    lon: String(place.longitude),
    label: place.name,
  });
  const res = await fetch(`/api/celestial-events?${params}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load events");
  return (data.events as RankedCelestialEvent[]).slice(0, 24);
}

function compassLabel(deg: number) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

export default function SkyFinder({
  place,
  onClose,
  onSelectEvent,
}: {
  place: Place;
  onClose: () => void;
  onSelectEvent: (event: RankedCelestialEvent) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [events, setEvents] = useState<RankedCelestialEvent[]>([]);
  const [eventsError, setEventsError] = useState("");
  const [tick, setTick] = useState(0);
  const [manualOpen, setManualOpen] = useState(false);
  const [hintEventId, setHintEventId] = useState<string | null>(null);

  const attitude = useDeviceSkyAttitude(true, 0, 40);

  useEffect(() => {
    dialog.current?.showModal();
    return () => {
      generation.current += 1;
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    const current = ++generation.current;
    async function connect() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera needs HTTPS or localhost.");
        }
        const media = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (current !== generation.current) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = media;
        if (video.current) {
          video.current.srcObject = media;
          await video.current.play();
        }
        setCameraReady(true);
        setCameraError("");
      } catch (error) {
        if (current !== generation.current) return;
        const denied =
          error instanceof DOMException && error.name === "NotAllowedError";
        setCameraError(
          denied
            ? "Allow camera access to aim at the sky, or close and try again."
            : "Could not open the camera. Check permissions and try again."
        );
      }
    }
    void connect();
    return () => {
      generation.current += 1;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const next = await fetchNearbyEvents(place);
        if (!cancelled) {
          setEvents(next);
          setEventsError("");
          const iss = next.find((e) => e.kind === "iss_pass" && e.inRange);
          if (iss) setHintEventId(iss.id);
        }
      } catch (e) {
        if (!cancelled) {
          setEventsError(
            e instanceof Error ? e.message : "Could not load sky events"
          );
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [place.latitude, place.longitude, place.name]);

  // Re-project a few times a second so labels track motion smoothly.
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 200);
    return () => window.clearInterval(id);
  }, []);

  const projection = useMemo(() => {
    void tick;
    return projectSkyToScreen({
      latitude: place.latitude,
      longitude: place.longitude,
      facingAz: attitude.azimuthDeg,
      cameraElevation: attitude.elevationDeg,
      fovDegrees: FOV_DEG,
      events,
    });
  }, [
    tick,
    place.latitude,
    place.longitude,
    attitude.azimuthDeg,
    attitude.elevationDeg,
    events,
  ]);

  const inFrameFigures = projection.figures.filter((f) => f.inFrame);
  const inFrameEvents = projection.events.filter((e) => e.inFrame);
  const nearestOff =
    projection.events.find((e) => !e.inFrame) ?? null;
  const hintMarker =
    projection.events.find((e) => e.event.id === hintEventId) ??
    projection.events.find((e) => e.event.kind === "iss_pass") ??
    null;

  function chooseEvent(marker: ProjectedEventMarker) {
    onSelectEvent(marker.event);
  }

  return (
    <dialog
      ref={dialog}
      className="sky-finder"
      aria-labelledby="sky-finder-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="sky-finder-stage">
        <video
          ref={video}
          className="sky-finder-video"
          playsInline
          muted
          autoPlay
          aria-hidden
        />
        {!cameraReady && !cameraError && (
          <p className="sky-finder-status" role="status">
            Opening camera…
          </p>
        )}
        {cameraError && (
          <div className="sky-finder-status sky-finder-status--error">
            <p>{cameraError}</p>
          </div>
        )}

        <div className="sky-finder-hud" aria-hidden={!cameraReady}>
          {inFrameFigures.map((fig) => (
            <FigureLabel key={fig.name} figure={fig} />
          ))}
          {inFrameEvents.map((marker) => (
            <EventMarker
              key={marker.event.id}
              marker={marker}
              onSelect={() => chooseEvent(marker)}
            />
          ))}
        </div>

        <header className="sky-finder-top">
          <IconButton
            label="Close sky finder"
            icon="close"
            onClick={onClose}
          />
          <div className="sky-finder-title-block">
            <p className="eyebrow">Sky Finder</p>
            <h2 id="sky-finder-title">{place.name}</h2>
          </div>
          <button
            type="button"
            className="sky-finder-manual-toggle"
            onClick={() => setManualOpen((v) => !v)}
            aria-expanded={manualOpen}
          >
            Aim
          </button>
        </header>

        <div className="sky-finder-compass" aria-live="polite">
          <strong>
            {compassLabel(attitude.azimuthDeg)}{" "}
            {Math.round(attitude.azimuthDeg)}°
          </strong>
          <span>elev {Math.round(attitude.elevationDeg)}°</span>
          <small>
            {attitude.source === "device"
              ? attitude.absolute
                ? "Live compass"
                : "Device tilt"
              : attitude.permission === "denied" ||
                  attitude.permission === "unsupported"
                ? "Manual aim"
                : "Waiting for sensors"}
          </small>
        </div>

        {attitude.permission !== "granted" &&
          attitude.permission !== "unsupported" &&
          attitude.source !== "device" && (
            <button
              type="button"
              className="sky-finder-perm"
              onClick={() => void attitude.requestPermission()}
            >
              Enable motion / compass
            </button>
          )}

        {attitude.source === "device" &&
          hintMarker &&
          !hintMarker.inFrame && (
            <p className="sky-finder-hint" role="status">
              {hintMarker.event.kind === "iss_pass"
                ? "Point toward ISS"
                : `Turn toward ${hintMarker.event.title}`}
              <span>
                {hintMarker.turnDeg > 8
                  ? ` → ${Math.round(Math.abs(hintMarker.turnDeg))}° right`
                  : hintMarker.turnDeg < -8
                    ? ` ← ${Math.round(Math.abs(hintMarker.turnDeg))}° left`
                    : hintMarker.offsetElDeg > 8
                      ? " · tilt up"
                      : hintMarker.offsetElDeg < -8
                        ? " · tilt down"
                        : " · almost there"}
              </span>
            </p>
          )}

        {manualOpen && (
          <div className="sky-finder-manual">
            <label>
              Azimuth
              <input
                type="range"
                min={0}
                max={359}
                value={Math.round(attitude.azimuthDeg)}
                onChange={(e) =>
                  attitude.setManualAzimuth(Number(e.target.value))
                }
              />
            </label>
            <label>
              Elevation
              <input
                type="range"
                min={-10}
                max={90}
                value={Math.round(attitude.elevationDeg)}
                onChange={(e) =>
                  attitude.setManualElevation(Number(e.target.value))
                }
              />
            </label>
          </div>
        )}

        <footer className="sky-finder-dock">
          {eventsError && (
            <p className="sky-finder-dock-error">{eventsError}</p>
          )}
          <p className="sky-finder-dock-meta">
            {inFrameFigures.length} figures · {inFrameEvents.length} events in
            view
            {nearestOff && !inFrameEvents.length
              ? ` · nearest: ${nearestOff.event.title}`
              : ""}
          </p>
          <ul className="sky-finder-chips">
            {projection.events.slice(0, 6).map((marker) => (
              <li key={marker.event.id}>
                <button
                  type="button"
                  className={
                    marker.inFrame
                      ? "sky-finder-chip is-in-view"
                      : "sky-finder-chip"
                  }
                  onClick={() => chooseEvent(marker)}
                >
                  <span
                    className={`sky-finder-chip-dot rarity-${marker.event.rarity}`}
                    aria-hidden
                  />
                  <span className="sky-finder-chip-text">
                    <strong>{marker.event.title}</strong>
                    <small>
                      {marker.inFrame
                        ? "In view · tap to capture"
                        : `${Math.round(Math.abs(marker.turnDeg))}° turn · ${RARITY_META[marker.event.rarity].label}`}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </footer>
      </div>
    </dialog>
  );
}

function FigureLabel({ figure }: { figure: PredictedFigure }) {
  if (figure.predictedX == null || figure.predictedY == null) return null;
  return (
    <div
      className="sky-finder-figure"
      style={{
        left: `${figure.predictedX * 100}%`,
        top: `${figure.predictedY * 100}%`,
      }}
    >
      <span className="sky-finder-figure-dot" />
      <span className="sky-finder-figure-name">{figure.name}</span>
    </div>
  );
}

function EventMarker({
  marker,
  onSelect,
}: {
  marker: ProjectedEventMarker;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`sky-finder-event rarity-${marker.event.rarity}`}
      style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }}
      onClick={onSelect}
      aria-label={`${marker.event.title}, ${RARITY_META[marker.event.rarity].label}. Open for capture.`}
    >
      <span className="sky-finder-event-pulse" aria-hidden />
      <span className="sky-finder-event-label">
        <strong>{marker.event.title}</strong>
        <small>
          {marker.event.points} pts · {RARITY_META[marker.event.rarity].label}
        </small>
      </span>
    </button>
  );
}
