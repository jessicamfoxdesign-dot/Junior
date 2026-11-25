import { describe, expect, it } from "vitest";
import { dough, feedForRatio, grams, levainParts, parseRatio, splitStarter } from "./bake";

describe("levain", () => {
  it("1:3:3 from 57 g of seed (Jessica's levain, 22 Nov 2026)", () => {
    const feed = feedForRatio(57, [1, 3, 3]);
    expect(feed).toEqual({ flour: 171, water: 171 });
    const lev = levainParts(57, feed.flour, feed.water, 100);
    expect(lev.weight).toBe(399);
    expect(lev.flour).toBeCloseTo(199.5);
    expect(lev.water).toBeCloseTo(199.5);
  });

  it("splits a stiff starter by its hydration", () => {
    const s = splitStarter(150, 50);
    expect(s.flour).toBeCloseTo(100);
    expect(s.water).toBeCloseTo(50);
  });

  it("parses ratios", () => {
    expect(parseRatio("1:3:3")).toEqual([1, 3, 3]);
    expect(parseRatio("1-5-5")).toEqual([1, 5, 5]);
    expect(parseRatio("1 2 2")).toEqual([1, 2, 2]);
    expect(parseRatio("0:3:3")).toBeNull();
    expect(parseRatio("1:3")).toBeNull();
  });
});

describe("dough", () => {
  const lev = levainParts(57, 171, 171, 100);

  it("matches Almanac's numbers: 1,000 g flour, 75%, 2%", () => {
    const d = dough({ levain: lev, totalFlour: 1000, hydrationPct: 75, saltPct: 2 });
    expect(Math.round(d.flourAdd)).toBe(801); // 800.5
    expect(Math.round(d.waterAdd)).toBe(551); // 550.5
    expect(d.salt).toBe(20);
    expect(Math.round(d.dough)).toBe(1770);
    expect(d.prefermentedPct).toBeCloseTo(19.95, 1);
    expect(d.warnings).toEqual([]);
  });

  it("works from loaves", () => {
    const d = dough({ levain: lev, loaves: 2, loafWeight: 900, hydrationPct: 75, saltPct: 2 });
    expect(Math.round(d.totalFlour)).toBe(1017);
    expect(Math.round(d.dough)).toBe(1800);
  });

  it("splits einkorn out of the added flour", () => {
    const d = dough({ levain: lev, totalFlour: 1000, hydrationPct: 70, saltPct: 2, secondFlourPct: 20 });
    expect(d.secondFlourAdd).toBe(200);
    expect(Math.round(d.mainFlourAdd)).toBe(601);
    expect(Math.round(d.mainFlourAdd + d.secondFlourAdd)).toBe(Math.round(d.flourAdd));
  });

  it("uses part of the levain when asked", () => {
    const d = dough({ levain: lev, levainUsed: 200, totalFlour: 1000, hydrationPct: 75, saltPct: 2 });
    expect(d.levainFlour).toBeCloseTo(100, 0);
    expect(d.prefermentedPct).toBeCloseTo(10, 0);
  });

  it("warns when the levain is too much for the dough", () => {
    const d = dough({ levain: lev, totalFlour: 150, hydrationPct: 75, saltPct: 2 });
    expect(d.warnings.some((w) => w.includes("more flour"))).toBe(true);
  });

  it("formats grams for the scale", () => {
    expect(grams(800.5)).toBe("801 g");
    expect(grams(12.34, true)).toBe("12.3 g");
  });
});
