import type { SkyCaptureMeta } from "@calhacks13/lib";
import { useState } from "react";
import { localInputToIso } from "@/lib/image";

export type CaptureDraft = { latitude: string; longitude: string; takenAt: string; facing: string; elevation: string; fov: string; notes: string };

export function captureMeta(draft: CaptureDraft): SkyCaptureMeta | null {
  const latitude = Number(draft.latitude), longitude = Number(draft.longitude);
  const takenAt = localInputToIso(draft.takenAt);
  if (!draft.latitude.trim() || !draft.longitude.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || !takenAt) return null;
  const optional = (value: string, min: number, max: number) => value.trim() && Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max;
  if ((draft.facing && !optional(draft.facing, 0, 360)) || (draft.elevation && !optional(draft.elevation, 0, 90)) || (draft.fov && !optional(draft.fov, 1, 180))) return null;
  return { latitude, longitude, takenAt, facingDegrees: draft.facing ? Number(draft.facing) : undefined, elevationDegrees: draft.elevation ? Number(draft.elevation) : undefined, fovDegrees: draft.fov ? Number(draft.fov) : undefined, notes: draft.notes.trim() || undefined };
}

export default function CaptureDetails({ draft, onChange, error }: { draft: CaptureDraft; onChange: (draft: CaptureDraft) => void; error: string }) {
  const [geoError, setGeoError] = useState("");
  const [locating, setLocating] = useState(false);
  const field = (key: keyof CaptureDraft, value: string) => onChange({ ...draft, [key]: value });
  function locate() {
    if (!navigator.geolocation) { setGeoError("Location is unavailable. Enter the photo coordinates below."); return; }
    setLocating(true);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(({ coords }) => { onChange({ ...draft, latitude: coords.latitude.toFixed(5), longitude: coords.longitude.toFixed(5) }); setLocating(false); }, () => { setGeoError("Could not read location. Enter the photo coordinates below."); setLocating(false); }, { timeout: 12000 });
  }
  return <section className="capture-details" aria-label="Photo location and time">
    <h2>Where was your sky?</h2>
    <p>Confirm the photo’s location and time. For older photos, enter where and when you took them.</p>
    {draft.notes && <p className="capture-target-note">Looking for <strong>{draft.notes}</strong></p>}
    <button type="button" disabled={locating} onClick={locate}>{locating ? "Finding location…" : "Use current location"}</button>
    {geoError && <p role="alert">{geoError}</p>}
    <div className="capture-fields">
      <label>Latitude<input inputMode="decimal" type="number" min="-90" max="90" value={draft.latitude} onChange={(e) => field("latitude", e.target.value)} /></label>
      <label>Longitude<input inputMode="decimal" type="number" min="-180" max="180" value={draft.longitude} onChange={(e) => field("longitude", e.target.value)} /></label>
    </div>
    <label>Time taken · your device’s time zone<input type="datetime-local" value={draft.takenAt} onChange={(e) => field("takenAt", e.target.value)} /></label>
    <details><summary>Camera direction & notes · optional</summary>
      <p>Leave direction blank if unknown. We assume about 40° elevation and a 70° field of view when omitted.</p>
      <div className="capture-fields">
        <label>Facing ° · 0 north<input type="number" min="0" max="360" placeholder="Unknown" value={draft.facing} onChange={(e) => field("facing", e.target.value)} /></label>
        <label>Elevation °<input type="number" min="0" max="90" placeholder="40" value={draft.elevation} onChange={(e) => field("elevation", e.target.value)} /></label>
        <label>Field of view °<input type="number" min="1" max="180" placeholder="70" value={draft.fov} onChange={(e) => field("fov", e.target.value)} /></label>
      </div>
      <label>Notes<textarea rows={2} value={draft.notes} onChange={(e) => field("notes", e.target.value)} /></label>
    </details>
    {error && <p className="capture-detail-error" role="alert">{error}</p>}
  </section>;
}
