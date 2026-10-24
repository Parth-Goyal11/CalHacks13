import type { Place } from "@/components/your-sky/tonight-data";

type GeocodingResult = { id?: unknown; name?: unknown; admin1?: unknown; country?: unknown; latitude?: unknown; longitude?: unknown; timezone?: unknown };

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 100) return Response.json({ error: "Enter a city name between 2 and 100 characters." }, { status: 400 });
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.search = new URLSearchParams({ name: query, count: "5", language: "en", format: "json" }).toString();
  try {
    const response = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Search unavailable");
    const data = await response.json();
    const places: Place[] = [];
    for (const result of (Array.isArray(data.results) ? data.results : []) as GeocodingResult[]) {
      if (typeof result.id !== "number" || typeof result.name !== "string" || typeof result.latitude !== "number" || typeof result.longitude !== "number" || !Number.isFinite(result.latitude) || !Number.isFinite(result.longitude) || Math.abs(result.latitude) > 90 || Math.abs(result.longitude) > 180) continue;
      let timezone: string | undefined;
      if (typeof result.timezone === "string") {
        try { new Intl.DateTimeFormat("en-US", { timeZone: result.timezone }); timezone = result.timezone; } catch { /* Use weather's resolved timezone instead. */ }
      }
      places.push({ id: result.id, name: result.name, region: typeof result.admin1 === "string" ? result.admin1 : undefined, country: typeof result.country === "string" ? result.country : undefined, latitude: result.latitude, longitude: result.longitude, timezone });
    }
    return Response.json({ places });
  } catch {
    return Response.json({ error: "City search is unavailable right now. Please try again." }, { status: 502 });
  }
}
