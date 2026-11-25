// Baker's percentages for Junior. Everything is in grams and worked out
// from what was typed; nothing here is stored except by the caller.
//
// Hydration and salt are percentages of TOTAL flour, counting the flour
// inside the levain. "Prefermented" is the share of total flour that is
// already in the levain.

export interface LevainParts {
  /** Flour inside the finished levain. */
  flour: number;
  /** Water inside the finished levain. */
  water: number;
  /** Weight of the finished levain. */
  weight: number;
}

/** Split a weight of starter into flour and water at the given hydration (100 = equal parts). */
export function splitStarter(grams: number, hydrationPct: number): { flour: number; water: number } {
  const flour = grams / (1 + hydrationPct / 100);
  return { flour, water: grams - flour };
}

/** Feed amounts for a seed at a ratio like 1:3:3 (seed : flour : water). */
export function feedForRatio(seed: number, ratio: [number, number, number]): { flour: number; water: number } {
  const [s, f, w] = ratio;
  if (!(s > 0)) return { flour: 0, water: 0 };
  return { flour: (seed * f) / s, water: (seed * w) / s };
}

/** Parse "1:3:3" (or "1-3-3", "1 3 3"). Null if it isn't three positive numbers. */
export function parseRatio(text: string): [number, number, number] | null {
  const parts = text.trim().split(/\s*[:\-\s]\s*/).map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n) || n < 0) || parts[0] <= 0) return null;
  return parts as [number, number, number];
}

/** What is in a levain: the seed's own flour and water plus the feed. */
export function levainParts(seed: number, feedFlour: number, feedWater: number, seedHydrationPct: number): LevainParts {
  const s = splitStarter(seed, seedHydrationPct);
  return { flour: s.flour + feedFlour, water: s.water + feedWater, weight: seed + feedFlour + feedWater };
}

export interface DoughInput {
  levain: LevainParts;
  /** Grams of levain going into the dough. Defaults to all of it. */
  levainUsed?: number;
  /** Either total flour... */
  totalFlour?: number;
  /** ...or a number of loaves of a given dough weight. */
  loaves?: number;
  loafWeight?: number;
  hydrationPct: number;
  saltPct: number;
  /** Share of total flour that is a second flour (e.g. einkorn), 0-100. */
  secondFlourPct?: number;
}

export interface DoughResult {
  totalFlour: number;
  levainUsed: number;
  levainFlour: number;
  levainWater: number;
  /** Flour to add, all kinds together. */
  flourAdd: number;
  /** Of flourAdd, how much is the second flour. */
  secondFlourAdd: number;
  /** Of flourAdd, how much is the main flour. */
  mainFlourAdd: number;
  waterAdd: number;
  salt: number;
  dough: number;
  /** Share of total flour already in the levain, %. */
  prefermentedPct: number;
  warnings: string[];
}

export function dough(input: DoughInput): DoughResult {
  const h = input.hydrationPct / 100;
  const s = input.saltPct / 100;
  const used = Math.max(0, Math.min(input.levainUsed ?? input.levain.weight, input.levain.weight));
  const share = input.levain.weight > 0 ? used / input.levain.weight : 0;
  const lf = input.levain.flour * share;
  const lw = input.levain.water * share;

  let total: number;
  if (input.totalFlour != null) total = input.totalFlour;
  else total = ((input.loaves ?? 0) * (input.loafWeight ?? 0)) / (1 + h + s);

  const flourAdd = total - lf;
  const waterAdd = total * h - lw;
  const salt = total * s;
  const second = Math.max(0, Math.min(100, input.secondFlourPct ?? 0)) / 100;
  // The levain holds the starter's own flour, so the second flour all comes from what is added.
  const secondFlourAdd = Math.min(Math.max(flourAdd, 0), total * second);
  const pref = total > 0 ? (lf / total) * 100 : 0;

  const warnings: string[] = [];
  if (!(total > 0)) warnings.push("Enter a total flour or loaves and their weight.");
  else {
    if (flourAdd < 0) warnings.push("The levain alone has more flour than the dough needs. Use less levain or make more dough.");
    if (waterAdd < 0) warnings.push("The levain alone has more water than the dough needs. Raise the hydration or use less levain.");
    if (second > 0 && total * second > flourAdd + 1e-9) warnings.push("Not enough added flour to reach that share of the second flour; it is capped at all the added flour.");
    if (pref > 0 && pref < 8) warnings.push(`Only ${round1(pref)}% of the flour is prefermented. That is low; the dough may rise slowly.`);
    if (pref > 35) warnings.push(`${round1(pref)}% of the flour is prefermented. That is high; the dough may be sour and slack.`);
  }

  return {
    totalFlour: total,
    levainUsed: used,
    levainFlour: lf,
    levainWater: lw,
    flourAdd,
    secondFlourAdd,
    mainFlourAdd: flourAdd - secondFlourAdd,
    waterAdd,
    salt,
    dough: used + Math.max(flourAdd, 0) + Math.max(waterAdd, 0) + salt,
    prefermentedPct: pref,
    warnings,
  };
}

export const round1 = (n: number) => Math.round(n * 10) / 10;
/** Grams for the scale: whole grams, salt to a tenth below 20 g. */
export function grams(n: number, fine = false): string {
  if (!Number.isFinite(n)) return "–";
  return fine && Math.abs(n) < 20 ? `${round1(n)} g` : `${Math.round(n)} g`;
}
