import { nightSkyChart } from "@calhacks13/lib/night-sky-chart";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const latitude = Number(params.get("lat"));
  const longitude = Number(params.get("lon"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return Response.json({ error: "The sky map needs a latitude and a longitude." }, { status: 400 });
  }
  const chart = nightSkyChart(latitude, longitude, new Date());
  return Response.json(chart, { headers: { "Cache-Control": "private, max-age=60" } });
}
