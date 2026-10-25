"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CONSTELLATION_PATTERNS } from "@calhacks13/lib";
import { useDeviceSkyAttitude } from "@/hooks/useDeviceSkyAttitude";

type SkyKind = "star" | "planet" | "moon";

type SkyObject = {
  id: string;
  name: string;
  kind: SkyKind;
  mag: number | null;
  alt: number;
  az: number;
  raDeg: number | null;
  decDeg: number | null;
  hip: number | null;
  anchor: boolean;
};

type SkyChart = {
  takenAt: string;
  objects: SkyObject[];
};

type Aim = {
  azimuth: number;
  altitude: number;
  roll: number;
  fov: number;
  width: number;
  height: number;
};

type Vec3 = [number, number, number];

function unit(altitudeDeg: number, azimuthDeg: number): Vec3 {
  const altitude = (altitudeDeg * Math.PI) / 180;
  const azimuth = (azimuthDeg * Math.PI) / 180;
  return [
    Math.cos(altitude) * Math.sin(azimuth),
    Math.cos(altitude) * Math.cos(azimuth),
    Math.sin(altitude),
  ];
}

function dot(a: Vec3, b: Vec3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(vector: Vec3, factor: number): Vec3 {
  return [vector[0] * factor, vector[1] * factor, vector[2] * factor];
}

function norm(vector: Vec3) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function basis(aim: Aim): { right: Vec3; up: Vec3; forward: Vec3 } {
  const forward = unit(aim.altitude, aim.azimuth);
  let right = cross(forward, [0, 0, 1]);
  if (norm(right) < 1e-4) {
    const heading = unit(0, aim.azimuth);
    right = cross(forward, heading);
  }
  right = scale(right, 1 / norm(right));
  let up = cross(right, forward);
  up = scale(up, 1 / norm(up));
  const roll = (aim.roll * Math.PI) / 180;
  const cosine = Math.cos(roll);
  const sine = Math.sin(roll);
  return {
    right: add(scale(right, cosine), scale(up, -sine)),
    up: add(scale(right, sine), scale(up, cosine)),
    forward,
  };
}

function project(altitudeDeg: number, azimuthDeg: number, aim: Aim) {
  const frame = basis(aim);
  const star = unit(altitudeDeg, azimuthDeg);
  const depth = dot(star, frame.forward);
  if (depth <= 0.02) return null;
  const focal = aim.width / 2 / Math.tan(((aim.fov * Math.PI) / 180) / 2);
  const x = (aim.width - 1) / 2 + (focal * dot(star, frame.right)) / depth;
  const y = (aim.height - 1) / 2 - (focal * dot(star, frame.up)) / depth;
  if (x < -20 || y < -20 || x > aim.width + 20 || y > aim.height + 20) return null;
  return { x, y };
}

async function readSkyChart(response: Response): Promise<(SkyChart & { error?: string }) | null> {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as SkyChart & { error?: string };
  } catch {
    return null;
  }
}

function formatHours(degrees: number) {
  const hours = ((degrees / 15) % 24 + 24) % 24;
  const whole = Math.floor(hours);
  const minutes = Math.floor((hours - whole) * 60);
  return `${whole}h ${String(minutes).padStart(2, "0")}m`;
}

export default function NightSkyMap({
  latitude,
  longitude,
  placeName,
}: {
  latitude: number;
  longitude: number;
  placeName: string;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const hits = useRef<{ object: SkyObject; x: number; y: number }[]>([]);
  const [chart, setChart] = useState<SkyChart | null>(null);
  const [error, setError] = useState("");
  const [heading, setHeading] = useState(0);
  const [tilt, setTilt] = useState(38);
  const [roll, setRoll] = useState(0);
  const [fov, setFov] = useState(68);
  const [follow, setFollow] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const attitude = useDeviceSkyAttitude(follow, heading, tilt);

  const aimHeading = follow && attitude.source === "device" ? attitude.azimuthDeg : heading;
  const aimTilt = follow && attitude.source === "device" ? Math.max(0, attitude.elevationDeg) : tilt;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setError("");
    const params = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
    });
    fetch(`/api/night-sky?${params}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const data = await readSkyChart(response);
        if (!active) return;
        if (!response.ok || !data?.objects) {
          throw new Error("The night sky could not be placed.");
        }
        setChart(data);
      })
      .catch(() => {
        if (!active || controller.signal.aborted) return;
        setError("The night sky could not be placed.");
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [latitude, longitude]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => {
      const rect = stage.getBoundingClientRect();
      setFrame({ width: Math.round(rect.width), height: Math.round(rect.height) });
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const lines = useMemo(() => {
    const byName = new Map((chart?.objects ?? []).map((object) => [object.name.toLowerCase(), object]));
    const drawn: { from: SkyObject; to: SkyObject }[] = [];
    const seen = new Set<string>();
    for (const pattern of CONSTELLATION_PATTERNS) {
      for (const line of pattern.lines) {
        const from = byName.get(line.from.toLowerCase());
        const to = byName.get(line.to.toLowerCase());
        if (!from || !to) continue;
        const key = [from.id, to.id].sort().join(":");
        if (seen.has(key)) continue;
        seen.add(key);
        drawn.push({ from, to });
      }
    }
    return drawn;
  }, [chart]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage || !chart) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const rect = stage.getBoundingClientRect();
    const width = Math.max(2, Math.round(rect.width));
    const height = Math.max(2, Math.round(rect.height));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const aim: Aim = {
      azimuth: aimHeading,
      altitude: aimTilt,
      roll,
      fov,
      width,
      height,
    };
    context.clearRect(0, 0, width, height);
    if (!cameraOn) {
      const sky = context.createRadialGradient(width / 2, height, 20, width / 2, height * 0.7, height);
      sky.addColorStop(0, "#1a2744");
      sky.addColorStop(0.55, "#070b14");
      sky.addColorStop(1, "#05070c");
      context.fillStyle = sky;
      context.fillRect(0, 0, width, height);
    }

    const placed = new Map<string, { object: SkyObject; x: number; y: number }>();
    for (const object of chart.objects) {
      const point = project(object.alt, object.az, aim);
      if (point) placed.set(object.id, { object, ...point });
    }

    context.lineWidth = 1;
    context.strokeStyle = "rgba(226, 177, 90, 0.45)";
    for (const line of lines) {
      const from = placed.get(line.from.id);
      const to = placed.get(line.to.id);
      if (!from || !to) continue;
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
    }

    const nextHits: { object: SkyObject; x: number; y: number }[] = [];
    for (const mark of placed.values()) {
      const bright = mark.object.mag == null ? 1 : Math.max(0, 4.5 - mark.object.mag);
      const radius = mark.object.anchor ? 4.2 : 1.4 + bright * 0.7;
      context.fillStyle = mark.object.kind === "star" ? "#fff8e7" : "#9ad7ff";
      context.beginPath();
      context.arc(mark.x, mark.y, radius, 0, Math.PI * 2);
      context.fill();
      const label =
        mark.object.kind !== "star" ||
        mark.object.anchor ||
        mark.object.id === selectedId ||
        (mark.object.mag != null && mark.object.mag <= 1.8);
      if (label) {
        context.fillStyle = "rgba(243, 239, 230, 0.92)";
        context.font = "12px Segoe UI, sans-serif";
        context.fillText(mark.object.name, mark.x + radius + 3, mark.y - 3);
      }
      nextHits.push(mark);
    }
    hits.current = nextHits;
  }, [aimHeading, aimTilt, cameraOn, chart, fov, frame, lines, roll, selectedId]);

  async function toggleCamera() {
    if (cameraOn) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setCameraOn(false);
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = media;
      if (videoRef.current) {
        videoRef.current.srcObject = media;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch {
      setError("The camera stayed off. The sliders still turn the map.");
    }
  }

  function chooseAt(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    let best: SkyObject | null = null;
    let bestDistance = 22;
    for (const hit of hits.current) {
      const distance = Math.hypot(hit.x - x, hit.y - y);
      if (distance < bestDistance) {
        best = hit.object;
        bestDistance = distance;
      }
    }
    setSelectedId(best?.id ?? null);
  }

  const selected = chart?.objects.find((object) => object.id === selectedId) ?? null;
  const polaris = chart?.objects.find((object) => object.anchor);

  return (
    <section className="night-sky" aria-label="Night sky map">
      <div className="night-sky-heading">
        <p>Night sky</p>
        <h2>{placeName}</h2>
      </div>
      <div ref={stageRef} className={`night-sky-stage ${cameraOn ? "has-camera" : ""}`}>
        <video ref={videoRef} playsInline autoPlay muted />
        <canvas ref={canvasRef} onPointerDown={chooseAt} aria-label="Sky map. Choose a named star." />
      </div>
      <p className="night-sky-note">
        {error
          ? error
          : polaris
            ? `Polaris is ${polaris.alt.toFixed(0)}° up. That height is this latitude. Heading 0 faces true north.`
            : "Heading 0 faces true north. Lens height 0 is the horizon."}
      </p>
      <div className="night-sky-aim">
        <label>
          Heading {Math.round(aimHeading)}°
          <input
            type="range"
            min={0}
            max={360}
            value={Math.round(aimHeading)}
            onChange={(event) => {
              setFollow(false);
              setHeading(Number(event.target.value));
            }}
          />
        </label>
        <label>
          Lens height {Math.round(aimTilt)}°
          <input
            type="range"
            min={0}
            max={90}
            value={Math.round(aimTilt)}
            onChange={(event) => {
              setFollow(false);
              setTilt(Number(event.target.value));
            }}
          />
        </label>
        <label>
          Roll {roll}°
          <input
            type="range"
            min={-45}
            max={45}
            value={roll}
            onChange={(event) => setRoll(Number(event.target.value))}
          />
        </label>
        <label>
          Lens width {fov}°
          <input
            type="range"
            min={35}
            max={100}
            value={fov}
            onChange={(event) => setFov(Number(event.target.value))}
          />
        </label>
      </div>
      <div className="night-sky-actions">
        <button type="button" onClick={() => void (follow ? setFollow(false) : attitude.requestPermission().then(setFollow))}>
          {follow ? "Use the sliders" : "Turn with the phone"}
        </button>
        <button type="button" onClick={() => void toggleCamera()}>
          {cameraOn ? "Hide the camera" : "Show the sky behind the names"}
        </button>
      </div>
      {selected ? (
        <dl className="night-sky-card">
          <div>
            <dt>Name</dt>
            <dd>{selected.name}</dd>
          </div>
          <div>
            <dt>Catalog</dt>
            <dd>{selected.hip ? `Hipparcos ${selected.hip}` : selected.kind === "moon" ? "The Moon" : "Planet"}</dd>
          </div>
          <div>
            <dt>Magnitude</dt>
            <dd>{selected.mag == null ? "—" : selected.mag.toFixed(2)}</dd>
          </div>
          <div>
            <dt>Altitude</dt>
            <dd>{selected.alt.toFixed(1)}°</dd>
          </div>
          <div>
            <dt>Azimuth</dt>
            <dd>{selected.az.toFixed(1)}°</dd>
          </div>
          <div>
            <dt>Right ascension</dt>
            <dd>{selected.raDeg == null ? "—" : formatHours(selected.raDeg)}</dd>
          </div>
          <div>
            <dt>Declination</dt>
            <dd>{selected.decDeg == null ? "—" : `${selected.decDeg.toFixed(2)}°`}</dd>
          </div>
        </dl>
      ) : (
        <p className="night-sky-note">Choose a named dot for its Hipparcos place and where it is right now.</p>
      )}
    </section>
  );
}
