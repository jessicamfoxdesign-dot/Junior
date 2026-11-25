// A cycle is one feeding and every reading taken after it, up to the next
// feeding. All of Junior's numbers are worked out here, from the stored
// rows, and never stored themselves.

import type { Feeding, Reading } from "../types";

export interface Peak {
  /** Highest height seen, inches. */
  height: number;
  /** "level": a reading caught it. "streak": only the residue line shows it. */
  seenAs: "level" | "streak";
  /** Hours after feeding: when it was read, or for a streak, the latest it can have been. */
  hours: number;
}

export interface Cycle {
  feeding: Feeding;
  readings: Reading[];
  /** Height right after feeding: the typed start level, else the first reading. */
  baseline: number | null;
  baselineFrom: "feeding" | "reading" | null;
  latest: Reading | null;
  peak: Peak | null;
  /** End of this cycle: the next feeding, or null if it is the current one. */
  endsAt: string | null;
}

const ms = (iso: string) => new Date(iso).getTime();
export const hoursBetween = (from: string, to: string) => (ms(to) - ms(from)) / 3_600_000;

/** Feedings and readings in any order; cycles come back newest first. */
export function buildCycles(feedings: Feeding[], readings: Reading[]): Cycle[] {
  const fs = [...feedings].sort((a, b) => ms(a.fed_at) - ms(b.fed_at));
  const rs = [...readings].sort((a, b) => ms(a.taken_at) - ms(b.taken_at));
  const cycles: Cycle[] = fs.map((feeding, i) => {
    const endsAt = fs[i + 1]?.fed_at ?? null;
    const start = ms(feeding.fed_at);
    const end = endsAt ? ms(endsAt) : Infinity;
    const mine = rs.filter((r) => ms(r.taken_at) >= start && ms(r.taken_at) < end);
    return summarise(feeding, mine, endsAt);
  });
  return cycles.reverse();
}

function summarise(feeding: Feeding, readings: Reading[], endsAt: string | null): Cycle {
  let baseline: number | null = null;
  let baselineFrom: Cycle["baselineFrom"] = null;
  if (feeding.start_level_in != null) {
    baseline = Number(feeding.start_level_in);
    baselineFrom = "feeding";
  } else if (readings.length) {
    baseline = Number(readings[0].level_in);
    baselineFrom = "reading";
  }

  let peak: Peak | null = null;
  for (const r of readings) {
    const h = hoursBetween(feeding.fed_at, r.taken_at);
    const level = Number(r.level_in);
    if (!peak || level > peak.height) peak = { height: level, seenAs: "level", hours: h };
    if (r.streak_in != null) {
      const streak = Number(r.streak_in);
      // A streak only proves the peak happened before this reading.
      if (streak > peak.height) peak = { height: streak, seenAs: "streak", hours: h };
    }
  }

  return { feeding, readings, baseline, baselineFrom, latest: readings.at(-1) ?? null, peak, endsAt };
}

/** Height as a multiple of the starting height, e.g. 2.4 means "2.4x". */
export function rise(height: number | null | undefined, baseline: number | null): number | null {
  if (height == null || baseline == null || baseline <= 0) return null;
  return Math.round((height / baseline) * 10) / 10;
}

/** Is the starter past its peak? True once the latest reading is clearly below the best seen. */
export function isFalling(c: Cycle): boolean {
  if (!c.latest || !c.peak) return false;
  return c.peak.height - Number(c.latest.level_in) >= 0.25;
}

/** "3h 20m" */
export function formatHours(h: number): string {
  if (!Number.isFinite(h) || h < 0) return "";
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  if (hh === 0) return `${mm}m`;
  return mm === 0 ? `${hh}h` : `${hh}h ${mm}m`;
}

/** 1.75 -> "1¾″" ; other values to two decimals. */
export function formatInches(v: number | null | undefined): string {
  if (v == null) return "–";
  const whole = Math.floor(v + 1e-9);
  const frac = Math.round((v - whole) * 100);
  const glyph: Record<number, string> = { 0: "", 25: "¼", 50: "½", 75: "¾" };
  if (frac in glyph) return `${whole || (frac ? "" : "0")}${glyph[frac]}″`;
  return `${Number(v.toFixed(2))}″`;
}

/** Chart points for one cycle, in inches or as a multiple of the start height. */
export function cyclePoints(c: Cycle, unit: "in" | "x") {
  const conv = (v: number) => (unit === "in" ? v : c.baseline ? v / c.baseline : NaN);
  const points: { h: number; v: number }[] = [];
  const streaks: { h: number; v: number }[] = [];
  if (c.baselineFrom === "feeding" && c.baseline != null) points.push({ h: 0, v: conv(c.baseline) });
  for (const r of c.readings) {
    const h = hoursBetween(c.feeding.fed_at, r.taken_at);
    points.push({ h, v: conv(Number(r.level_in)) });
    if (r.streak_in != null) streaks.push({ h, v: conv(Number(r.streak_in)) });
  }
  return { points: points.filter((p) => Number.isFinite(p.v)), streaks: streaks.filter((p) => Number.isFinite(p.v)) };
}
