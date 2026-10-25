import type { CurrentWeather } from "@/components/yonder/tonight-data";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const rawLat = params.get("lat");
  const rawLon = params.get("lon");
  const latitude = Number(rawLat);
  const longitude = Number(rawLon);
  if (!rawLat?.trim() || !rawLon?.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return Response.json({ error: "Valid latitude and longitude are required." }, { status: 400 });
  }
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({ latitude: latitude.toFixed(2), longitude: longitude.toFixed(2), current: "temperature_2m,cloud_cover,is_day", timezone: "auto", timeformat: "unixtime", forecast_days: "1" }).toString();
  try {
    const response = await fetch(url, { next: { revalidate: 300 }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Weather unavailable");
    const result = await response.json();
    const current = result.current;
    if (!current || !Number.isFinite(current.temperature_2m) || !Number.isFinite(current.cloud_cover) || current.cloud_cover < 0 || current.cloud_cover > 100 || !Number.isFinite(current.time) || ![0, 1].includes(current.is_day) || typeof result.timezone !== "string") throw new Error("Invalid weather response");
    new Intl.DateTimeFormat("en-US", { timeZone: result.timezone });
    const weather: CurrentWeather = { temperature: current.temperature_2m, cloudCover: current.cloud_cover, isDay: current.is_day === 1, time: current.time, timezone: result.timezone };
    return Response.json(weather, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch {
    return Response.json({ error: "Weather is unavailable right now. Please try again." }, { status: 502 });
  }
}
