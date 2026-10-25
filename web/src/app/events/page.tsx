import { EventsBoard } from "@/components/events/EventsBoard";
import YourSkyShell from "@/components/your-sky/YourSkyShell";

export default function EventsPage() {
  return (
    <YourSkyShell active="events">
      <EventsBoard />
    </YourSkyShell>
  );
}
