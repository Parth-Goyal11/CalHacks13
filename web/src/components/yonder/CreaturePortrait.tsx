"use client";

import { useEffect, useRef, useState } from "react";
import type { StoredCreature } from "./collection";
import { readCreature, saveCreatureImage } from "./memory-store";

export default function CreaturePortrait({ creature }: { creature: StoredCreature }) {
  const { id, tier } = creature;
  const draftRef = useRef(creature);
  draftRef.current = creature;
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState("Forming…");

  useEffect(() => {
    let cancel = false;
    let objectUrl = "";
    const draft = draftRef.current;
    setUrl(null);
    setStatus("Forming…");

    async function load() {
      const stored = await readCreature(id);
      if (cancel) return;
      const cached = stored?.image && stored.tier === tier ? stored.image : null;
      const blob = cached ?? (await renderCreature(draft));
      if (cancel || !blob) return;
      if (!cached) await saveCreatureImage(draft, blob);
      objectUrl = URL.createObjectURL(blob);
      if (cancel) {
        URL.revokeObjectURL(objectUrl);
        return;
      }
      setUrl(objectUrl);
      setStatus("");
    }

    load().catch((error: unknown) => {
      if (!cancel) {
        setStatus(
          error instanceof Error
            ? error.message
            : "Grok Imagine did not return a creature model.",
        );
      }
    });

    return () => {
      cancel = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, tier]);

  return (
    <figure className="creature-portrait">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- Grok Imagine returns a data image for this device.
        <img src={url} alt={`${creature.name} creature model`} />
      ) : (
        <p>{status}</p>
      )}
    </figure>
  );
}

async function renderCreature(creature: StoredCreature): Promise<Blob | null> {
  const response = await fetch("/api/creature", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: creature.name,
      motif: creature.motif,
      tier: creature.tier,
    }),
  });
  const data = (await response.json().catch(() => null)) as {
    error?: string;
    base64?: string;
    mimeType?: string;
  } | null;
  if (!response.ok || !data?.base64) {
    throw new Error(data?.error || "Grok Imagine did not return a creature model.");
  }
  const binary = atob(data.base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: data.mimeType || "image/png" });
}
