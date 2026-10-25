import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-950 px-6 font-sans text-zinc-100">
      <main className="flex max-w-xl flex-col gap-6 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
          CalHacks 13
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Photograph the sky. Earn the points.
        </h1>
        <p className="text-lg leading-relaxed text-zinc-400">
          Hunt upcoming celestial events by rarity and distance, then capture
          them for score. Powered by Grok, Elasticsearch, and SpacetimeDB.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/events"
            className="rounded bg-sky-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-sky-400"
          >
            Browse upcoming events
          </Link>
          <Link
            href="/sky"
            className="rounded border border-zinc-700 px-5 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900"
          >
            Reveal the night sky
          </Link>
        </div>
      </main>
    </div>
  );
}
