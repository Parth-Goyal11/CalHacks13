/**
 * Placeholder fetchers for real space events.
 * Replace with live APIs (ISS passes, launch schedules, meteor showers).
 */

export type SpaceEventType = "iss_pass" | "launch" | "meteor_shower";

export interface SpaceEvent {
  id: string;
  type: SpaceEventType;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location?: { lat: number; lon: number };
  source: string;
  raw?: Record<string, unknown>;
}

export async function fetchSpaceEvents(): Promise<SpaceEvent[]> {
  // Demo fixtures until live providers are wired.
  const now = Date.now();

  return [
    {
      id: "iss-demo-1",
      type: "iss_pass",
      title: "ISS visible pass (demo)",
      description: "International Space Station overhead pass — photograph for points.",
      startsAt: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(now + 2.1 * 60 * 60 * 1000).toISOString(),
      location: { lat: 37.7749, lon: -122.4194 },
      source: "demo",
    },
    {
      id: "launch-demo-1",
      type: "launch",
      title: "Orbital launch window (demo)",
      description: "Night launch visible from the coast — capture the plume trail.",
      startsAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(now + 25 * 60 * 60 * 1000).toISOString(),
      location: { lat: 28.5721, lon: -80.648 },
      source: "demo",
    },
    {
      id: "meteor-demo-1",
      type: "meteor_shower",
      title: "Meteor shower peak (demo)",
      description: "Peak radiant overnight — long exposures score bonus points.",
      startsAt: new Date(now + 48 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(now + 60 * 60 * 60 * 1000).toISOString(),
      source: "demo",
    },
  ];
}
