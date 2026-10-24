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
          Real-time multiplayer game: catch ISS passes, launches, and meteor
          showers on camera. Powered by Grok, Elasticsearch, and SpacetimeDB.
        </p>
        <p>
          <Link
            href="/upload"
            className="inline-block rounded-md bg-zinc-100 px-5 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-white"
          >
            Upload a sky photo
          </Link>
        </p>
      </main>
    </div>
  );
}
