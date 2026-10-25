import { NextRequest } from "next/server";

async function reverseNominatim(lat: string, lon: string) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", lat);
  url.searchParams.set("lon", lon);
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "CalHacks13-SkyScore/0.1 (hackathon; night-sky photo game)",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);

  const data = (await res.json()) as {
    display_name?: string;
    lat?: string;
    lon?: string;
  };

  return {
    label: data.display_name ?? `${lat}, ${lon}`,
    latitude: Number(data.lat ?? lat),
    longitude: Number(data.lon ?? lon),
  };
}

async function reversePhoton(lat: string, lon: string) {
  const url = new URL("https://photon.komoot.io/reverse");
  url.searchParams.set("lat", lat);
  url.searchParams.set("lon", lon);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`photon ${res.status}`);

  const data = (await res.json()) as {
    features?: Array<{
      properties?: {
        name?: string;
        city?: string;
        state?: string;
        country?: string;
      };
    }>;
  };
  const p = data.features?.[0]?.properties ?? {};
  const label =
    [p.name, p.city, p.state, p.country].filter(Boolean).join(", ") ||
    `${lat}, ${lon}`;

  return {
    label,
    latitude: Number(lat),
    longitude: Number(lon),
  };
}

export async function GET(request: NextRequest) {
  const lat = request.nextUrl.searchParams.get("lat");
  const lon = request.nextUrl.searchParams.get("lon");
  if (lat == null || lon == null) {
    return Response.json({ error: "lat and lon required" }, { status: 400 });
  }

  try {
    return Response.json(await reverseNominatim(lat, lon));
  } catch (err) {
    console.warn("[geocode/reverse] nominatim failed", err);
  }

  try {
    return Response.json(await reversePhoton(lat, lon));
  } catch (err) {
    console.error("[geocode/reverse] photon failed", err);
    // Still return coords so the pin can be placed
    return Response.json({
      label: `${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}`,
      latitude: Number(lat),
      longitude: Number(lon),
    });
  }
}
