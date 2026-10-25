export type Place = {
  id: number | string;
  name: string;
  region?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

export type CurrentWeather = {
  temperature: number;
  cloudCover: number;
  isDay: boolean;
  time: number;
  timezone: string;
};

export const previewPlace: Place = {
  id: "berkeley-preview", name: "Berkeley", region: "California", country: "United States",
  latitude: 37.87, longitude: -122.27, timezone: "America/Los_Angeles",
};

export const learningSources = {
  moon: "https://science.nasa.gov/moon/viewing-tips/",
  planets: "https://science.nasa.gov/skywatching/",
  constellations: "https://spaceplace.nasa.gov/constellations/en/",
};

// General learning examples, not a prediction for the current location or date.
export const discoveryExamples = [
  { id: "moon", icon: "moon", title: "The Moon", subtitle: "Look for the light and shadow", body: "The boundary between lunar day and night makes craters easier to see. A half-lit Moon can show more surface detail than a full Moon.", tip: "Its phase and position for your night will appear when local sky predictions are connected." },
  { id: "planets", icon: "star", title: "Bright planets", subtitle: "A steady point of light", body: "Some planets can look like bright stars. They often appear steadier, but a steady light alone is not enough to identify one.", tip: "We will use your place and time to check which planets are above the horizon. These examples are not confirmed sightings." },
  { id: "constellations", icon: "collection", title: "Constellations", subtitle: "Find a familiar pattern", body: "Start with a few bright stars, then trace the pattern between them. The constellations you can see change with the season, time and latitude.", tip: "Your photo and local sky calculations will help narrow the possibilities. No constellation has been identified in a photo yet." },
] as const;
