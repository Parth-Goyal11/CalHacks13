import { useEffect, useRef, useState } from "react";
import type { SkyRevealResult } from "./reveal-analysis";

export default function ObjectExplanation({ reveal, figureId }: { reveal: SkyRevealResult; figureId: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function explain() {
    const figure = reveal.analysis.figures.find((item) => item.id === figureId);
    if (!figure || busy) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/figure-detail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ figure, meta: reveal.meta }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]) });
      const data = await response.json();
      if (!response.ok || typeof data.text !== "string") throw new Error("Could not load more details. Please try again.");
      setText(data.text);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not load more details.");
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <div className="object-explanation">
    {text && <p className="object-detail">{text}</p>}
    {error && <p role="alert">{error}</p>}
    {!text && <button type="button" disabled={busy} onClick={() => void explain()}>{busy ? "Reading the stars…" : "Ask Grok for more"}</button>}
  </div>;
}
