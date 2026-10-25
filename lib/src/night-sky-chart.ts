import * as Astronomy from "astronomy-engine";
import { NAMED_STARS } from "./named-stars";

export type NightSkyKind = "star" | "planet" | "moon";

export type NightSkyObject = {
  id: string;
  name: string;
  kind: NightSkyKind;
  mag: number | null;
  alt: number;
  az: number;
  raDeg: number | null;
  decDeg: number | null;
  hip: number | null;
  anchor: boolean;
};

export type NightSkyChart = {
  takenAt: string;
  latitude: number;
  longitude: number;
  objects: NightSkyObject[];
};

const WANDERERS: { body: Astronomy.Body; name: string; kind: NightSkyKind }[] = [
  { body: Astronomy.Body.Moon, name: "Moon", kind: "moon" },
  { body: Astronomy.Body.Mercury, name: "Mercury", kind: "planet" },
  { body: Astronomy.Body.Venus, name: "Venus", kind: "planet" },
  { body: Astronomy.Body.Mars, name: "Mars", kind: "planet" },
  { body: Astronomy.Body.Jupiter, name: "Jupiter", kind: "planet" },
  { body: Astronomy.Body.Saturn, name: "Saturn", kind: "planet" },
];

function round(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Named Hipparcos stars plus the Moon and naked-eye planets, placed for one
 * observer and time. Azimuth is degrees clockwise from true north.
 */
export function nightSkyChart(latitude: number, longitude: number, when = new Date()): NightSkyChart {
  const observer = new Astronomy.Observer(latitude, longitude, 0);
  const objects: NightSkyObject[] = [];

  for (const star of NAMED_STARS) {
    const horizontal = Astronomy.Horizon(when, observer, star.raDeg / 15, star.decDeg, "normal");
    if (horizontal.altitude <= -1) continue;
    objects.push({
      id: `hip-${star.hip}`,
      name: star.name,
      kind: "star",
      mag: star.mag,
      alt: round(horizontal.altitude),
      az: round((horizontal.azimuth + 360) % 360),
      raDeg: star.raDeg,
      decDeg: star.decDeg,
      hip: star.hip,
      anchor: star.name === "Polaris",
    });
  }

  for (const wanderer of WANDERERS) {
    const equatorial = Astronomy.Equator(wanderer.body, when, observer, true, true);
    const horizontal = Astronomy.Horizon(when, observer, equatorial.ra, equatorial.dec, "normal");
    if (horizontal.altitude <= -1) continue;
    objects.push({
      id: wanderer.name.toLowerCase(),
      name: wanderer.name,
      kind: wanderer.kind,
      mag: null,
      alt: round(horizontal.altitude),
      az: round((horizontal.azimuth + 360) % 360),
      raDeg: round(equatorial.ra * 15),
      decDeg: round(equatorial.dec),
      hip: null,
      anchor: false,
    });
  }

  objects.sort((a, b) => (a.mag ?? -2) - (b.mag ?? -2));
  return {
    takenAt: when.toISOString(),
    latitude,
    longitude,
    objects,
  };
}
