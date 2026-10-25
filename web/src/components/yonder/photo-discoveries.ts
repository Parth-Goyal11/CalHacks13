import type { SkyPhotoResult } from "./photo-types";

export type PhotoObject = {
  id: string;
  name: string;
  kind: string;
  x?: number;
  y?: number;
};

// These are illustrative UI points on the sample image, never live detections.
export const sampleObjects: PhotoObject[] = [
  { id: "milky-way", name: "Milky Way", kind: "Galaxy", x: 54, y: 31 },
  { id: "star-field", name: "Star field", kind: "Stars", x: 24, y: 19 },
];

export const sampleResult: SkyPhotoResult = {
  is_night_sky: true,
  identity: { method: "demo", other: ["Milky Way", "Star field"] },
};

export function objectsFromResult(result: SkyPhotoResult): PhotoObject[] {
  const identity = result.identity;
  const groups = [
    { names: identity?.constellations, kind: "Constellation" },
    { names: identity?.named_stars, kind: "Star" },
    {
      names: identity?.brightest_object ? [identity.brightest_object] : [],
      kind: "Bright object",
    },
    { names: identity?.other, kind: "Sky feature" },
  ];
  const seen = new Set<string>();
  return groups.flatMap(({ names, kind }) =>
    (Array.isArray(names) ? names : [])
      .filter(
        (name): name is string =>
          typeof name === "string" && Boolean(name.trim()),
      )
      // Solver diagnostics are not celestial objects and must never become detections.
      .filter(
        (name) =>
          !/^solve (?:failed:|pending vision estimate)/i.test(name.trim()),
      )
      .filter((name) => {
        const key = name.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((name) => {
        const annotation =
          identity?.method === "plate-solved"
            ? result.annotations?.find(
                (point) =>
                  point.name.trim().toLowerCase() ===
                    name.trim().toLowerCase() &&
                  Number.isFinite(point.x) &&
                  Number.isFinite(point.y) &&
                  point.x >= 0 &&
                  point.x <= 1 &&
                  point.y >= 0 &&
                  point.y <= 1,
              )
            : undefined;
        return {
          id: `${kind}-${name}`,
          name: name.trim(),
          kind,
          x: annotation ? annotation.x * 100 : undefined,
          y: annotation ? annotation.y * 100 : undefined,
        };
      }),
  );
}

export function learningFor(object: PhotoObject) {
  const name = object.name.toLowerCase();
  if (name.includes("milky way"))
    return {
      body: "The Milky Way is our home galaxy. From inside its disk, its many distant stars can appear as a pale band across a dark sky.",
      tip: "A darker location and less moonlight can make faint features easier to see. This photo alone does not tell us whether the band is visible from your location tonight.",
      source: "https://science.nasa.gov/universe/galaxies/",
    };
  if (name.includes("moon"))
    return {
      body: "The boundary between lunar day and night makes craters easier to see. The shadows along that boundary reveal the shape of the surface.",
      tip: "The Moon changes its position and appearance through the month. Your photo has not yet been matched to a verified capture location and time.",
      source: "https://science.nasa.gov/moon/viewing-tips/",
    };
  if (object.kind === "Constellation")
    return {
      body: "A constellation is a named region of the sky. Its familiar star pattern can help you find your way, even though the stars can be very different distances from Earth.",
      tip: "Which constellations you can see depends on your latitude, the date and the time. Local visibility calculations are not connected to this result yet.",
      source: "https://spaceplace.nasa.gov/constellations/en/",
    };
  return {
    body: "A sky photo can reveal more points of light than you notice at first. Darker surroundings and time for your eyes to adjust can help you explore them.",
    tip: "Use the identification status as a guide. A model suggestion needs confirmation; a location-aware explanation for this object is not connected yet.",
    source: "https://science.nasa.gov/skywatching/",
  };
}
