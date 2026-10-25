import type { SkyPhotoResult } from "./analysis";

export type Tab = "home" | "explore" | "memories" | "profile" | "events";
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
  figureId?: string;
  motif?: string;
  accent?: string;
  highlightRank?: number;
  highlightReason?: string;
  highlightPoints?: number;
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
  curated?: boolean;
  overview?: string;
};

export const IMG = {
  home: "/yonder/skies/sky-1.png",
  mountain: "/yonder/photo-2.jpg",
  ridge: "/yonder/photo-3.jpg",
  field: "/yonder/photo-4.jpg",
  profile: "/yonder/people/jason-liu.jpeg",
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

const highlight = (id: string, name: string, x: number, y: number): CelestialObject => ({
  id, name, x, y, kind: "Photo highlight", highlightRank: 1,
  detail: "A visible feature highlighted in this photograph. A sky solve is needed to confirm a catalog identity.",
});

export const demoSkies: SkyPhoto[] = [
  { id: "shared-sky-1", image: "/yonder/skies/sky-1.png", title: "A sky full of stars", date: "", location: "", curated: true,
    overview: "A dense field of stars fills the blue night sky. Explore the crowded central band and a brighter point to its right.",
    objects: [highlight("star-field", "Dense star field", 53, 38), highlight("bright-point", "Bright star", 73, 50)] },
  { id: "shared-sky-2", image: "/yonder/skies/sky-2.png", title: "Above the treetops", date: "", location: "", curated: true,
    overview: "A three-star line stands above the illuminated treetops, with a brighter isolated star to the left. The foreground gives the sky a sense of scale.",
    objects: [highlight("three-stars", "Three-star line", 48, 51), highlight("bright-star", "Bright star", 12, 56)] },
  { id: "shared-sky-3", image: "/yonder/skies/sky-3.png", title: "Patterns in the dark", date: "", location: "", curated: true,
    overview: "Several compact star patterns cross this wide sky. A three-star line on the right contrasts with an isolated bright point lower in the frame.",
    objects: [highlight("three-stars", "Three-star line", 80, 57), highlight("bright-star", "Bright star", 49, 77)] },
  { id: "shared-sky-4", image: "/yonder/skies/sky-4.png", title: "A quieter night", date: "", location: "", curated: true,
    overview: "The darker exposure keeps the background subdued and the brighter stars distinct. Compare the three-star line with the brighter point below it.",
    objects: [highlight("three-stars", "Three-star line", 80, 57), highlight("bright-star", "Bright star", 49, 77)] },
  { id: "shared-sky-5", image: "/yonder/skies/sky-5.png", title: "Quiet points of light", date: "", location: "", curated: true,
    overview: "Widely spaced points stand out against a dark, softly textured sky. A tree silhouette at the edge frames the open star field.",
    objects: [highlight("upper-point", "Upper bright point", 59, 42), highlight("lower-point", "Lower bright point", 90, 79)] },
  { id: "shared-sky-6", image: "/yonder/skies/sky-6.png", title: "Between the trees", date: "", location: "", curated: true,
    overview: "Tree silhouettes form a low horizon beneath a sparse field of stars. Look for the bright pair in the upper half and compare their spacing.",
    objects: [highlight("left-point", "Left bright point", 45, 43), highlight("right-point", "Right bright point", 84, 31)] },
];

export const friendPosts = [
  { name: "Noah", avatar: "/yonder/people/noah-demo.jpg", photo: demoSkies[0] },
  { name: "Sofia", avatar: "/yonder/people/sofia-demo.jpg", photo: demoSkies[1] },
  { name: "Eli", avatar: "/yonder/people/eli-demo.jpg", photo: demoSkies[2] },
  { name: "Mina", avatar: "/yonder/people/friends-duo.jpg", photo: demoSkies[3] },
];
