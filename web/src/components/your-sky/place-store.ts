import type { Place } from "./tonight-data";
import { previewPlace } from "./tonight-data";

const KEY = "your-sky-place";

export function savePlace(place: Place) {
  try {
    localStorage.setItem(KEY, JSON.stringify(place));
  } catch {
    /* Private mode can block storage. The in-memory place still works. */
  }
}

export function loadPlace(): Place {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return previewPlace;
    const place = JSON.parse(raw) as Place;
    if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude) || !place.name) {
      return previewPlace;
    }
    return place;
  } catch {
    return previewPlace;
  }
}
