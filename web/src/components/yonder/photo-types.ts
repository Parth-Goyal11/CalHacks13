type Rubric = {
  clarity?: number;
  tracking?: number;
  exposure?: number;
  noise?: number;
  framing?: number;
  conditions?: number;
};

type Critique = {
  strengths?: string[];
  improvements?: string[];
};

export type SkyPhotoResult = {
  reveal?: import("./reveal-analysis").SkyRevealResult;
  annotations?: { name: string; kind: string; x: number; y: number }[];
  photo_id?: string;
  is_night_sky?: boolean;
  needs_review?: boolean;
  detail?: string;
  identity?: {
    method?: string;
    confidence?: number;
    constellations?: string[];
    named_stars?: string[];
    brightest_object?: string | null;
    other?: string[];
  };
  metrics?: {
    sharpness?: number;
    star_count?: number;
    trailing?: number;
  };
  rubric?: Rubric | null;
  critique?: Critique | null;
  rarity?: string | null;
  score?: number | null;
  final_score?: number | null;
  subject_bonus?: number | null;
  award?: { badge?: string; points?: number; card_foil?: string | null } | null;
  annotated_image_url?: string | null;
  _phase?: number;
};
