import { getUpcomingCelestialEvents, type EventSortMode } from "@calhacks13/lib";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");
    const label = searchParams.get("label") ?? undefined;
    const days = Number(searchParams.get("days") ?? "90");
    const sort = (searchParams.get("sort") ?? "distance") as EventSortMode;
    const skyVisible = searchParams.get("skyVisible") !== "0";

    const observer =
      lat != null &&
      lon != null &&
      Number.isFinite(Number(lat)) &&
      Number.isFinite(Number(lon))
        ? {
            latitude: Number(lat),
            longitude: Number(lon),
            label,
          }
        : null;

    const events = await getUpcomingCelestialEvents({
      observer,
      days,
      skyVisibleOnly: skyVisible,
      sort:
        sort === "distance" || sort === "soonest" || sort === "rarity"
          ? sort
          : "distance",
    });

    return Response.json({
      observer,
      count: events.length,
      events,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load events";
    console.error("[celestial-events]", err);
    return Response.json({ error: message }, { status: 500 });
  }
}
