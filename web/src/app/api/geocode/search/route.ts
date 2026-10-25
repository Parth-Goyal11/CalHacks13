import { NextRequest } from "next/server";

interface NormalizedPlace {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  kind: string;
}

async function searchNominatim(q: string): Promise<NormalizedPlace[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "6");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "CalHacks13-SkyScore/0.1 (hackathon; night-sky photo game)",
    },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`nominatim ${res.status}`);

  const data = (await res.json()) as Array<{
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
    type?: string;
    class?: string;
  }>;

  return data.map((row) => ({
    id: String(row.place_id),
    label: row.display_name,
    latitude: Number(row.lat),
    longitude: Number(row.lon),
    kind: row.type ?? row.class ?? "place",
  }));
}

/** Photon (Komoot) — good Nominatim fallback, no API key. */
async function searchPhoton(q: string): Promise<NormalizedPlace[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "6");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`photon ${res.status}`);

  const data = (await res.json()) as {
    features?: Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: {
        osm_id?: number;
        name?: string;
        city?: string;
        state?: string;
        country?: string;
        type?: string;
      };
    }>;
  };

  return (data.features ?? [])
    .map((f, i) => {
      const coords = f.geometry?.coordinates;
      if (!coords || coords.length < 2) return null;
      const lon = coords[0];
      const lat = coords[1];
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const p = f.properties ?? {};
      const label = [p.name, p.city, p.state, p.country]
        .filter(Boolean)
        .join(", ");
      return {
        id: String(p.osm_id ?? `photon-${i}`),
        label: label || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        latitude: lat,
        longitude: lon,
        kind: p.type ?? "place",
      } satisfies NormalizedPlace;
    })
    .filter((x): x is NormalizedPlace => x != null);
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return Response.json({ results: [] });
  }

  try {
    const results = await searchNominatim(q);
    if (results.length > 0) return Response.json({ results });
  } catch (err) {
    console.warn("[geocode/search] nominatim failed", err);
  }

  try {
    const results = await searchPhoton(q);
    return Response.json({ results });
  } catch (err) {
    console.error("[geocode/search] photon failed", err);
    return Response.json(
      { error: "Geocoding failed", results: [] },
      { status: 502 }
    );
  }
}
