import { tierRank, type StoredCreature } from "./collection";

export type SkyMood = {
  /** 0 is restless, 1 is still. */
  serenity: number;
  /** 0 is a cool night, 1 is a warmer sky. */
  vibe: number;
};

const MINOR = [0, 3, 5, 7, 10, 12, 15, 17];
const MAJOR = [0, 2, 4, 7, 9, 12, 14, 19];
const WALK = [0, 2, 4, 7, 4, 2, 5, 3];
const ROOT = 50;

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

function frequency(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Coded from the weather and the collection. Clear nights sit still; cloud and daylight wake the line up. */
export function skyMood(input: {
  cloudCover: number | null;
  isDay: boolean | null;
  creatures: Pick<StoredCreature, "tier">[];
}): SkyMood {
  const night = input.isDay === false ? 1 : input.isDay === true ? 0.2 : 0.6;
  const clear = input.cloudCover == null ? 0.55 : 1 - input.cloudCover / 100;
  const ranks = input.creatures.map((creature) => tierRank(creature.tier));
  const average = ranks.length ? ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length / 6 : 0.45;
  return {
    serenity: clamp(0.12 + night * 0.42 + clear * 0.34 + average * 0.12),
    vibe: clamp(0.18 + (1 - night) * 0.34 + average * 0.32 + (1 - clear) * 0.12),
  };
}

export function moodLabel(mood: SkyMood) {
  const still = mood.serenity > 0.66 ? "Still" : mood.serenity > 0.4 ? "Quiet" : "Awake";
  const warmth = mood.vibe > 0.62 ? "warm" : mood.vibe > 0.4 ? "soft" : "cool";
  return `${still} · ${warmth}`;
}

/** A small generative pad. Serenity slows and softens it. Vibe chooses the scale and brightness. */
export class SkyTone {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private timer = 0;
  private next = 0;
  private step = 0;
  private mood: SkyMood = { serenity: 0.7, vibe: 0.35 };

  async start(mood: SkyMood) {
    this.mood = mood;
    const Context = window.AudioContext;
    if (!this.context) {
      this.context = new Context();
      this.filter = this.context.createBiquadFilter();
      this.filter.type = "lowpass";
      this.filter.frequency.value = 880;
      this.filter.Q.value = 0.35;
      this.master = this.context.createGain();
      this.master.gain.value = 0;
      this.filter.connect(this.master);
      this.master.connect(this.context.destination);
      this.drone(ROOT);
      this.drone(ROOT + 7);
    }
    await this.context.resume();
    this.shape(0.3);
    const now = this.context.currentTime;
    this.master!.gain.cancelScheduledValues(now);
    this.master!.gain.linearRampToValueAtTime(0.85, now + 0.9);
    this.next = now + 0.15;
    this.step = 0;
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.pump(), 180);
    this.pump();
  }

  setMood(mood: SkyMood) {
    this.mood = mood;
    this.shape(1.6);
  }

  stop() {
    window.clearInterval(this.timer);
    this.timer = 0;
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.linearRampToValueAtTime(0.0001, now + 0.7);
  }

  dispose() {
    this.stop();
    void this.context?.close();
    this.context = null;
  }

  private shape(seconds: number) {
    if (!this.context || !this.filter) return;
    const cutoff = Math.max(320, 480 + this.mood.vibe * 1500 - this.mood.serenity * 260);
    const now = this.context.currentTime;
    this.filter.frequency.cancelScheduledValues(now);
    this.filter.frequency.linearRampToValueAtTime(cutoff, now + seconds);
  }

  private drone(midi: number) {
    const context = this.context!;
    const osc = context.createOscillator();
    const amp = context.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency(midi);
    amp.gain.value = midi === ROOT ? 0.045 : 0.02;
    osc.connect(amp);
    amp.connect(this.filter!);
    osc.start();
  }

  private voice(time: number, midi: number, seconds: number, level: number) {
    const context = this.context!;
    const osc = context.createOscillator();
    const amp = context.createGain();
    osc.type = this.mood.serenity > 0.5 ? "sine" : "triangle";
    osc.frequency.setValueAtTime(frequency(midi), time);
    const attack = 0.06 + this.mood.serenity * 0.28;
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(level, time + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + seconds);
    osc.connect(amp);
    amp.connect(this.filter!);
    osc.start(time);
    osc.stop(time + seconds + 0.05);
  }

  private pump() {
    const context = this.context;
    if (!context || !this.timer) return;
    const scale = this.mood.vibe > 0.55 ? MAJOR : MINOR;
    while (this.next < context.currentTime + 0.55) {
      const index = WALK[this.step % WALK.length] % scale.length;
      const midi = ROOT + scale[index];
      const length = 1.6 + this.mood.serenity * 3.4;
      const level = 0.035 + (1 - this.mood.serenity) * 0.04;
      this.voice(this.next, midi, length, level);
      if (this.mood.serenity > 0.58 && this.step % 5 === 0) {
        this.voice(this.next + 0.02, midi + 12, 1.1, 0.018);
      }
      this.next += 0.7 + this.mood.serenity * 1.8;
      this.step += 1;
    }
  }
}
