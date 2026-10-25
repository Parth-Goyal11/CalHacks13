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
  | "plus"
  | "heart"
  | "comment";

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
  labelSide?: "left";
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
  annotationStatus?: "catalog" | "preview";
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

// Original-image coordinates from the offline catalog pass; see docs/demo-sky-annotations.md.
const star = (name: string, constellation: string, x: number, y: number, detail: string, labelSide?: "left"): CelestialObject => ({
  id: name.toLowerCase(), name, x, y, kind: `Star · ${constellation}`, detail, labelSide,
});

export const demoSkies: SkyPhoto[] = [
  { id: "shared-sky-1", image: "/yonder/skies/sky-1.png", title: "Cassiopeia after dark", date: "", location: "", curated: true, annotationStatus: "catalog",
    overview: "Cassiopeia stands out in this rich star field. Caph, Navi, and Segin trace part of its familiar zigzag. Tap a label to explore each star.",
    objects: [star("Caph", "Cassiopeia", 50.7703, 39.4811, "Beta Cassiopeiae · HIP 746. One of the named stars in Cassiopeia’s zigzag; matched to the Hipparcos catalog in this photo."), star("Navi", "Cassiopeia", 52.4562, 50.1015, "Gamma Cassiopeiae · HIP 4427. A central star in Cassiopeia’s pattern, matched to the Hipparcos catalog."), star("Segin", "Cassiopeia", 50.9753, 62.9396, "Epsilon Cassiopeiae · HIP 8886. Follow the pattern from Navi toward Segin, another catalog-matched point in this field.")] },
  { id: "shared-sky-2", image: "/yonder/skies/sky-2.png", title: "Orion above the treetops", date: "", location: "", curated: true, annotationStatus: "catalog",
    overview: "Orion rises above the treetops. Betelgeuse and Rigel frame the constellation, with Alnilam at the center of Orion’s Belt.",
    objects: [star("Betelgeuse", "Orion", 50.7751, 37.6672, "Alpha Orionis · HIP 27989. Catalog-matched in the upper part of Orion, above the belt."), star("Alnilam", "Orion", 50.2995, 49.6878, "Epsilon Orionis · HIP 26311. The middle star of Orion’s Belt; Alnitak and Mintaka lie beside it."), star("Rigel", "Orion", 52.0731, 60.3708, "Beta Orionis · HIP 24436. A bright catalog-matched star below Orion’s Belt, just above the trees.")] },
  { id: "shared-sky-3", image: "/yonder/skies/sky-3.png", title: "A glimpse of Gemini", date: "", location: "", curated: true, annotationStatus: "preview",
    overview: "Explore a Gemini candidate pattern featuring Mebsuta and Mekbuda. These preview annotations show the discovery experience; this match still needs confirmation.",
    objects: [star("Mebsuta", "Gemini · Preview", 49.168, 22.3722, "Epsilon Geminorum · HIP 32246. A candidate catalog match shown for the demo; its identification in this photo is unconfirmed."), star("Mekbuda", "Gemini · Preview", 41.0894, 28.7897, "Zeta Geminorum · HIP 34088. A second candidate in the Gemini pattern. Preview placement, pending a stronger sky solve.")] },
  { id: "shared-sky-4", image: "/yonder/skies/sky-4.png", title: "Two lights in Canis Minor", date: "", location: "", curated: true, annotationStatus: "preview",
    overview: "Procyon and Gomeisa form a compact Canis Minor candidate pattern. Preview labels let you explore the stars while the photo match remains unconfirmed.",
    objects: [star("Procyon", "Canis Minor · Preview", 26.3843, 48.4459, "Alpha Canis Minoris · HIP 37279. A bright candidate match, included as a demo preview."), star("Gomeisa", "Canis Minor · Preview", 31.6696, 44.6366, "Beta Canis Minoris · HIP 36188. The companion point in this candidate pattern; preview identification awaiting confirmation.", "left")] },
  { id: "shared-sky-5", image: "/yonder/skies/sky-5.png", title: "Tracing Draco", date: "", location: "", curated: true, annotationStatus: "catalog",
    overview: "Draco winds through the dark. Eltanin and Athebyne are two named points matched in this photograph’s star field.",
    objects: [star("Eltanin", "Draco", 61.1225, 45.8899, "Gamma Draconis · HIP 87833. A named star matched through the Draco pattern in this photo."), star("Athebyne", "Draco", 34.077, 38.7796, "Eta Draconis · HIP 80331. A second catalog-matched star along Draco’s winding pattern.")] },
  { id: "shared-sky-6", image: "/yonder/skies/sky-6.png", title: "The Dipper between the trees", date: "", location: "", curated: true, annotationStatus: "catalog",
    overview: "The Big Dipper’s bowl appears above the trees. Follow Megrez to Merak and Dubhe, three catalog-matched stars in Ursa Major.",
    objects: [star("Megrez", "Ursa Major", 44.2586, 40.333, "Delta Ursae Majoris · HIP 59774. A corner of the Big Dipper’s bowl, matched in this photo."), star("Merak", "Ursa Major", 42.9299, 53.6017, "Beta Ursae Majoris · HIP 53910. One of the two outer stars of the Big Dipper’s bowl.", "left"), star("Dubhe", "Ursa Major", 52.1428, 52.3945, "Alpha Ursae Majoris · HIP 54061. The other outer corner of the Big Dipper’s bowl, matched to the catalog.")] },
];

export const friendPosts = [
  { name: "Noah", avatar: "/yonder/people/noah-demo.jpg", photo: demoSkies[0] },
  { name: "Sofia", avatar: "/yonder/people/sofia-demo.jpg", photo: demoSkies[1] },
  { name: "Eli", avatar: "/yonder/people/eli-demo.jpg", photo: demoSkies[2] },
  { name: "Mina", avatar: "/yonder/people/friends-duo.jpg", photo: demoSkies[3] },
];
