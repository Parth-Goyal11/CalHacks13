import {
  findConstellationPattern,
  normalizeStarName,
  type ScoreResult,
  type SkyAnalysis,
  type SkyFigure,
} from "@calhacks13/lib";
import type { BrightPoint, SceneSketch } from "./sample-scene";

type Voice = "bell" | "pluck" | "bow" | "glass";
type Shape = "rise" | "fall" | "zigzag" | "hold" | "pair" | "cluster" | "arc";

const SCALES: Record<string, number[]> = {
  pentatonic: [0, 3, 5, 7, 10],
  yo: [0, 2, 5, 7, 9],
  major: [0, 2, 4, 7, 9],
  hirajoshi: [0, 2, 3, 7, 8],
  dorian: [0, 2, 3, 5, 7, 9],
  lydian: [0, 2, 4, 6, 7, 9],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
};

const ROOTS = [36, 38, 40, 41, 43, 45];

const SHAPES: Record<string, Shape> = {
  orion: "rise",
  "ursa major": "arc",
  "big dipper": "arc",
  cassiopeia: "zigzag",
  cygnus: "arc",
  "summer triangle": "cluster",
  lyra: "hold",
  aquila: "fall",
  leo: "rise",
  taurus: "rise",
  pleiades: "cluster",
  gemini: "pair",
  "canis major": "rise",
  scorpius: "fall",
  pegasus: "hold",
  andromeda: "hold",
  auriga: "rise",
  bootes: "rise",
  crux: "cluster",
  "southern cross": "cluster",
  sagittarius: "arc",
};

const VOICES: Record<string, Voice> = {
  orion: "pluck",
  "ursa major": "bow",
  "big dipper": "bow",
  cassiopeia: "glass",
  cygnus: "bow",
  "summer triangle": "bell",
  lyra: "glass",
  aquila: "pluck",
  leo: "bow",
  taurus: "pluck",
  pleiades: "bell",
  gemini: "bell",
  "canis major": "pluck",
  scorpius: "pluck",
  pegasus: "bow",
  andromeda: "glass",
  auriga: "bell",
  bootes: "bow",
  crux: "glass",
  "southern cross": "glass",
  sagittarius: "pluck",
};

interface ToneNote {
  freq: number;
  gain: number;
  pan: number;
  decay: number;
  sparkle: number;
  voice: Voice;
  delay: number;
}

interface Phrase {
  notes: ToneNote[];
  every: number;
  next: number;
}

interface SkyTone {
  rootMidi: number;
  filterHz: number;
  filterQ: number;
  air: number;
  pace: number;
  scale: number[];
  chord: number[];
  pulseHz: number;
}

const QUIET: SceneSketch = {
  points: [],
  luminance: 0.16,
  warmth: 0.35,
  contrast: 0.35,
  haze: 0.35,
};

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}

function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

function figureKey(name: string): string {
  const pattern = findConstellationPattern(name);
  return normalizeStarName(pattern?.name ?? name);
}

function shapeFor(name: string): Shape {
  return SHAPES[figureKey(name)] ?? "arc";
}

function voiceFor(name: string): Voice {
  return VOICES[figureKey(name)] ?? (["bell", "pluck", "bow", "glass"] as const)[hashString(name) % 4];
}

function toneFromSeed(sketch: SceneSketch, seed: number, cloudy = false, clear = false): SkyTone {
  const scaleNames = cloudy
    ? ["hirajoshi", "phrygian", "pentatonic"]
    : sketch.warmth > 0.62
      ? ["major", "yo", "lydian"]
      : ["pentatonic", "dorian", "yo", "lydian"];
  const scale = SCALES[scaleNames[seed % scaleNames.length] ?? "pentatonic"] ?? SCALES.pentatonic;
  const chords = sketch.warmth > 0.65
    ? [[0, 4, 7], [0, 2, 7], [0, 7, 16]]
    : [[0, 7, 12], [0, 5, 10], [0, 3, 7], [0, 2, 7], [0, 7, 15]];
  const chord = chords[seed % chords.length] ?? [0, 7, 12];
  let pulseHz = 0;
  if (!cloudy && sketch.contrast > 0.35) {
    pulseHz = seed % 3 === 0 ? 0 : seed % 3 === 1 ? 0.4 : 0.72;
  }
  return {
    rootMidi: ROOTS[seed % ROOTS.length] ?? 38,
    filterHz: Math.max(280, Math.min(1100, 340 + sketch.contrast * 520 - sketch.haze * 80)),
    filterQ: 0.25 + (seed % 5) * 0.12,
    air: cloudy ? Math.max(0.7, 0.22 + sketch.haze * 0.65) : clear ? 0.18 : 0.22 + sketch.haze * 0.65,
    pace: 0.85 + (1 - sketch.luminance) * 0.7,
    scale,
    chord,
    pulseHz,
  };
}

function toneFromSketch(sketch: SceneSketch): SkyTone {
  const seed = hashString(
    `${sketch.points.length}:${sketch.warmth.toFixed(2)}:${sketch.contrast.toFixed(2)}:${sketch.luminance.toFixed(2)}`
  );
  return toneFromSeed(sketch, seed);
}

function toneFromSky(analysis: SkyAnalysis, score: ScoreResult | null, sketch: SceneSketch): SkyTone {
  const text = `${analysis.skyConditions ?? ""} ${analysis.overview ?? ""}`.toLowerCase();
  const cloudy = /cloud|haze|fog|murk|pollution|glow/.test(text);
  const clear = /clear|crisp|milky|dark|transparent|still/.test(text);
  const names = analysis.figures.map((figure) => figure.name).join("|");
  const seed = hashString(`${names}:${sketch.warmth.toFixed(2)}:${analysis.figures.length}`);
  const tone = toneFromSeed(sketch, seed, cloudy, clear);
  const rubric = score?.rubric;
  if (rubric) {
    tone.filterHz = Math.max(
      280,
      Math.min(1100, 300 + rubric.clarity * 48 + rubric.conditions * 24 - rubric.noise * 30)
    );
    tone.pace = 0.8 + (10 - rubric.exposure) * 0.05 + (cloudy ? 0.25 : 0);
  }
  if (analysis.figures.some((figure) => figure.kind === "moon")) {
    tone.rootMidi = 41;
    tone.chord = [0, 3, 7];
    tone.air = Math.max(tone.air, 0.4);
  }
  return tone;
}

function degreeMidi(tone: SkyTone, y: number, spread: number): number {
  const steps = tone.scale;
  const slot = Math.round((1 - y) * spread);
  const octave = Math.floor(slot / steps.length);
  const step = steps[((slot % steps.length) + steps.length) % steps.length] ?? 0;
  return tone.rootMidi + 24 + octave * 12 + step;
}

function delaysFor(shape: Shape, count: number): number[] {
  return Array.from({ length: count }, (_, index) => {
    if (shape === "zigzag") return index * 0.18;
    if (shape === "hold") return index * 0.82;
    if (shape === "cluster") return index * 0.1;
    if (shape === "pair") return (index % 2) * 0.06 + Math.floor(index / 2) * 0.7;
    if (shape === "fall") return index * 0.24;
    if (shape === "arc") return index * 0.28;
    return index * 0.32;
  });
}

function orderByShape(points: BrightPoint[], shape: Shape): BrightPoint[] {
  const byPitch = [...points].sort((a, b) => a.y - b.y);
  if (shape === "fall") return [...byPitch].reverse();
  if (shape === "zigzag") {
    const pool = [...byPitch];
    const ordered: BrightPoint[] = [];
    while (pool.length) {
      const high = pool.shift();
      if (high) ordered.push(high);
      const low = pool.pop();
      if (low) ordered.push(low);
    }
    return ordered;
  }
  if (shape === "arc") {
    const mid = Math.ceil(byPitch.length / 2);
    return [...byPitch.slice(0, mid), ...byPitch.slice(mid).reverse()];
  }
  if (shape === "cluster" || shape === "hold") return byPitch.slice(0, shape === "hold" ? 3 : 4);
  return byPitch;
}

function phraseFromPoints(
  points: BrightPoint[],
  shape: Shape,
  voice: Voice,
  tone: SkyTone,
  when: number,
  panBias: number
): Phrase {
  const chosen = orderByShape(points, shape).slice(0, 5);
  const delays = delaysFor(shape, chosen.length);
  const notes: ToneNote[] = chosen.map((point, index) => {
    const brightness = Math.min(1, Math.max(0.15, point.brightness));
    const decay =
      voice === "pluck" ? 0.55 + brightness * 0.35 : shape === "hold" ? 2.6 : shape === "cluster" ? 1.05 : 1.7;
    return {
      freq: midiToFreq(degreeMidi(tone, point.y, shape === "cluster" ? 4 : 8)),
      gain: (0.016 + brightness * 0.032) * (voice === "bow" ? 0.8 : 1),
      pan: Math.max(-0.7, Math.min(0.7, (point.x - 0.5) * 1.2 + panBias)),
      decay,
      sparkle: voice === "glass" || brightness > 0.75 ? 0.2 : 0.04,
      voice,
      delay: delays[index] ?? 0,
    };
  });
  const everyBase = shape === "hold" ? 15 : shape === "cluster" ? 9.5 : shape === "zigzag" ? 8.2 : 12;
  return { notes, every: everyBase * tone.pace, next: when };
}

function pointsOf(figure: SkyFigure): BrightPoint[] {
  return figure.stars.map((star) => ({
    x: star.x,
    y: star.y,
    brightness: star.brightness ?? (figure.kind === "planet" || figure.kind === "moon" ? 0.85 : 0.5),
  }));
}

function phrasesFromSketch(sketch: SceneSketch, tone: SkyTone, now: number): Phrase[] {
  const sorted = [...sketch.points].sort((a, b) => b.brightness - a.brightness).slice(0, 18);
  if (sorted.length === 0) return [];
  const shapes: Shape[] = ["rise", "zigzag", "arc", "cluster"];
  const voices: Voice[] = ["bell", "glass", "pluck", "bow"];
  const bands = shapes.map((_, index) => sorted.filter((__, pointIndex) => pointIndex % shapes.length === index));
  return bands
    .filter((band) => band.length > 0)
    .map((band, index) =>
      phraseFromPoints(
        band,
        shapes[index] ?? "arc",
        voices[index] ?? "bell",
        tone,
        now + 0.4 + index * 2.4,
        (index - 1) * 0.15
      )
    );
}

function phrasesFromAnalysis(analysis: SkyAnalysis, tone: SkyTone, sketch: SceneSketch, now: number): Phrase[] {
  const figures = analysis.figures
    .map((figure) => ({ figure, points: pointsOf(figure) }))
    .filter((row) => row.points.length > 0)
    .slice(0, 6);
  if (figures.length === 0) return phrasesFromSketch(sketch, tone, now);
  return figures.map((row, index) =>
    phraseFromPoints(
      row.points,
      shapeFor(row.figure.name),
      voiceFor(row.figure.name),
      tone,
      now + 0.35 + index * 2.1,
      0
    )
  );
}

/**
 * Generative night piece. The photo picks the scale, root, and chord.
 * Each constellation then plays its own phrase shape and instrument.
 */
export class SkyAmbience {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private drones: OscillatorNode[] = [];
  private droneGain: GainNode | null = null;
  private airGain: GainNode | null = null;
  private airSource: AudioBufferSourceNode | null = null;
  private lfo: OscillatorNode | null = null;
  private timer: number | null = null;
  private phrases: Phrase[] = [];
  private figures: SkyFigure[] = [];
  private tone: SkyTone = toneFromSketch(QUIET);
  private nextPulse = 0;
  private muted = false;
  private closed = false;

  arm(): void {
    if (this.closed) return;
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = "lowpass";
      this.filter.frequency.value = 700;
      this.filter.Q.value = 0.4;
      this.filter.connect(this.master);
      this.master.connect(this.ctx.destination);
    }
    void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.85, now + 0.35);
  }

  playScene(sketch: SceneSketch): void {
    if (this.closed) return;
    this.arm();
    const tone = toneFromSketch(sketch);
    this.applyTone(tone);
    const now = this.ctx?.currentTime ?? 0;
    this.phrases = phrasesFromSketch(sketch, tone, now);
    this.nextPulse = now + 1.2;
    this.ensureClock();
  }

  playSky(analysis: SkyAnalysis, score: ScoreResult | null, sketch: SceneSketch | null): void {
    if (this.closed) return;
    this.arm();
    const scene = sketch ?? QUIET;
    this.figures = analysis.figures;
    const tone = toneFromSky(analysis, score, scene);
    this.applyTone(tone);
    const now = this.ctx?.currentTime ?? 0;
    this.phrases = phrasesFromAnalysis(analysis, tone, scene, now);
    this.nextPulse = now + 0.8;
    this.ensureClock();
  }

  /** One constellation's phrase, played as its points land. */
  flourish(name: string): void {
    if (this.closed || !this.ctx) return;
    const figure = this.figures.find((item) => item.name === name);
    const points = figure ? pointsOf(figure) : [];
    if (points.length === 0) return;
    const phrase = phraseFromPoints(points, shapeFor(name), voiceFor(name), this.tone, 0, 0);
    const now = this.ctx.currentTime + 0.04;
    for (const note of phrase.notes) {
      this.chime({ ...note, gain: note.gain * 1.45 }, now + note.delay);
    }
  }

  stop(): void {
    this.closed = true;
    if (this.timer != null) window.clearInterval(this.timer);
    this.timer = null;
    for (const drone of this.drones) {
      try {
        drone.stop();
      } catch {
        /* already stopped */
      }
    }
    this.drones = [];
    try {
      this.lfo?.stop();
      this.airSource?.stop();
    } catch {
      /* already stopped */
    }
    void this.ctx?.close();
    this.ctx = null;
  }

  private applyTone(tone: SkyTone): void {
    this.tone = tone;
    const ctx = this.ctx;
    const filter = this.filter;
    if (!ctx || !filter) return;
    const now = ctx.currentTime;
    this.ensureDrones(tone);
    filter.frequency.cancelScheduledValues(now);
    filter.frequency.linearRampToValueAtTime(tone.filterHz, now + 2.2);
    filter.Q.cancelScheduledValues(now);
    filter.Q.linearRampToValueAtTime(tone.filterQ, now + 1.4);
    if (this.airGain) {
      this.airGain.gain.cancelScheduledValues(now);
      this.airGain.gain.linearRampToValueAtTime(0.01 * tone.air, now + 1.6);
    }
  }

  private ensureDrones(tone: SkyTone): void {
    const ctx = this.ctx;
    const filter = this.filter;
    if (!ctx || !filter) return;
    if (this.drones.length > 0) {
      this.retuneDrones(tone);
      return;
    }
    const now = ctx.currentTime;
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0.0001;
    this.droneGain.gain.linearRampToValueAtTime(0.1, now + 1.8);
    this.droneGain.connect(filter);

    tone.chord.forEach((semitone, index) => {
      const osc = ctx.createOscillator();
      osc.type = index === 0 ? "sine" : "triangle";
      osc.frequency.value = midiToFreq(tone.rootMidi + semitone);
      const gain = ctx.createGain();
      gain.gain.value = index === 0 ? 0.55 : index === 1 ? 0.3 : 0.18;
      osc.connect(gain);
      gain.connect(this.droneGain!);
      osc.start();
      this.drones.push(osc);
    });

    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = 0.04 + (tone.rootMidi % 5) * 0.012;
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0, now);
    lfoGain.gain.linearRampToValueAtTime(0.014, now + 2.4);
    this.lfo.connect(lfoGain);
    lfoGain.connect(this.droneGain.gain);
    this.lfo.start();

    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const channel = noise.getChannelData(0);
    for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;
    this.airSource = ctx.createBufferSource();
    this.airSource.buffer = noise;
    this.airSource.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 420 + (tone.rootMidi % 6) * 40;
    band.Q.value = 0.5;
    this.airGain = ctx.createGain();
    this.airGain.gain.value = 0.01 * tone.air;
    this.airSource.connect(band);
    band.connect(this.airGain);
    this.airGain.connect(this.master!);
    this.airSource.start();
  }

  private retuneDrones(tone: SkyTone): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    this.drones.forEach((osc, index) => {
      const semitone = tone.chord[index];
      if (semitone == null) return;
      osc.frequency.cancelScheduledValues(now);
      osc.frequency.exponentialRampToValueAtTime(midiToFreq(tone.rootMidi + semitone), now + 2.4);
    });
  }

  private ensureClock(): void {
    if (this.timer != null) return;
    this.timer = window.setInterval(() => this.tick(), 160);
  }

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx || this.closed) return;
    const now = ctx.currentTime;
    const horizon = now + 0.45;
    for (const phrase of this.phrases) {
      if (phrase.next > horizon) continue;
      const at = Math.max(phrase.next, now + 0.02);
      for (const note of phrase.notes) this.chime(note, at + note.delay);
      phrase.next += phrase.every;
      if (phrase.next < now) phrase.next = now + phrase.every * 0.5;
    }
    if (this.tone.pulseHz > 0 && this.nextPulse <= horizon) {
      this.pulse(Math.max(this.nextPulse, now + 0.02));
      this.nextPulse += 1 / this.tone.pulseHz;
      if (this.nextPulse < now) this.nextPulse = now + 1 / this.tone.pulseHz;
    }
  }

  private pulse(time: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(midiToFreq(this.tone.rootMidi + 24), time);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.012, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);
    osc.connect(gain);
    gain.connect(master);
    osc.start(time);
    osc.stop(time + 0.12);
  }

  private chime(note: ToneNote, time: number): void {
    const ctx = this.ctx;
    const filter = this.filter;
    const master = this.master;
    if (!ctx || !filter || !master) return;
    const dest = note.voice === "pluck" ? master : filter;
    const osc = ctx.createOscillator();
    osc.type = note.voice === "bow" ? "sawtooth" : note.voice === "pluck" ? "triangle" : "sine";
    osc.frequency.setValueAtTime(note.freq, time);
    if (note.voice === "pluck") {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, note.freq * 0.97), time + note.decay);
    }
    const gain = ctx.createGain();
    const attack = note.voice === "bow" ? 0.22 : 0.03;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, note.gain), time + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + note.decay);
    const pan = ctx.createStereoPanner();
    pan.pan.setValueAtTime(note.pan, time);
    osc.connect(gain);
    gain.connect(pan);
    pan.connect(dest);
    osc.start(time);
    osc.stop(time + note.decay + 0.08);

    if (note.sparkle > 0.08 && note.voice !== "bow") {
      const overtone = ctx.createOscillator();
      overtone.type = "sine";
      overtone.frequency.setValueAtTime(note.freq * (note.voice === "glass" ? 3 : 2), time);
      const overGain = ctx.createGain();
      overGain.gain.setValueAtTime(0.0001, time);
      overGain.gain.exponentialRampToValueAtTime(note.gain * note.sparkle, time + 0.03);
      overGain.gain.exponentialRampToValueAtTime(0.0001, time + note.decay * 0.5);
      overtone.connect(overGain);
      overGain.connect(pan);
      overtone.start(time);
      overtone.stop(time + note.decay * 0.55);
    }
  }
}
