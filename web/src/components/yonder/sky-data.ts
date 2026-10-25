import type { SkyPhotoResult } from "./analysis";

export type Tab = "home" | "explore" | "memories" | "profile";
export type IconName =
  | "home"
  | "explore"
  | "gallery"
  | "calendar"
  | "camera"
  | "bell"
  | "upload"
  | "bookmark"
  | "close"
  | "arrow"
  | "location"
  | "spark"
  | "plus";

export type CelestialObject = {
  id: string;
  name: string;
  kind: string;
  detail: string;
  x?: number;
  y?: number;
  tone?: "violet" | "red";
};

export type SkyPhoto = {
  id: string;
  image: string;
  title: string;
  date: string;
  location: string;
  objects: CelestialObject[];
  result?: SkyPhotoResult;
  blob?: Blob;
  createdAt?: string;
  note?: string;
  credit?: string;
};

export const IMG = {
  home: "/yonder/photo-1.jpg",
  mountain: "/yonder/photo-2.jpg",
  ridge: "/yonder/photo-3.jpg",
  field: "/yonder/photo-4.jpg",
  profile: "/yonder/photo-5.jpg",
  nebula: "/yonder/photo-6.jpg",
  orion: "/yonder/photo-7.jpg",
};

export const nightObjects: CelestialObject[] = [
  {
    id: "vega",
    name: "Vega",
    kind: "Blue-white star · 25 ly",
    detail:
      "One of the brightest stars in our sky, Vega was the northern pole star 14,000 years ago.",
    x: 28,
    y: 29,
  },
  {
    id: "deneb",
    name: "Deneb",
    kind: "Supergiant · 2,600 ly",
    detail:
      "A distant blue-white supergiant, shining with the light of nearly 200,000 Suns.",
    x: 67,
    y: 21,
    tone: "violet",
  },
  {
    id: "jupiter",
    name: "Jupiter",
    kind: "Planet · 778m km",
    detail:
      "The largest planet in our solar system is especially bright in the eastern sky tonight.",
    x: 73,
    y: 49,
  },
  {
    id: "antares",
    name: "Antares",
    kind: "Red supergiant · 550 ly",
    detail:
      "The fiery heart of Scorpius glows with a soft red light near the southern horizon.",
    x: 37,
    y: 58,
    tone: "red",
  },
];

export const photos: SkyPhoto[] = [
  {
    id: "tonight",
    image: IMG.home,
    title: "Tonight over Marin",
    date: "June 18 · 10:42 PM",
    location: "Mount Tamalpais",
    objects: nightObjects,
    credit: "Nathan Anderson · Unsplash",
  },
  {
    id: "summer-triangle",
    image: IMG.mountain,
    title: "Summer Triangle",
    date: "June 12 · 11:16 PM",
    location: "Yosemite Valley",
    objects: nightObjects.slice(0, 3),
    credit: "Lorenzo Lamonica · Unsplash",
  },
  {
    id: "ridge",
    image: IMG.ridge,
    title: "Scorpius rising",
    date: "May 28 · 9:51 PM",
    location: "Death Valley",
    objects: [nightObjects[3], nightObjects[2]],
    credit: "Kyle Goetsch · Unsplash",
  },
];

export const exploreItems = [
  { label: "Mars", meta: "East · until 2:14 AM", image: IMG.ridge },
  { label: "Andromeda", meta: "Northeast · 11:48 PM", image: IMG.field },
  { label: "Orion Nebula", meta: "Southwest · setting", image: IMG.orion },
];

export const friendPosts = [
  {
    name: "Noah",
    place: "Oakland · now",
    image: IMG.mountain,
    object: "Summer Triangle",
    initials: "NO",
  },
  {
    name: "Sofia",
    place: "Marin · 8m",
    image: IMG.ridge,
    object: "Mars rising",
    initials: "SO",
  },
  {
    name: "Eli",
    place: "Big Sur · 21m",
    image: IMG.field,
    object: "Milky Way",
    initials: "EL",
  },
];
