import { describe, expect, it } from "vitest";
import { buildCycles, formatHours, formatInches, isFalling, rise } from "./cycles";
import type { Feeding, Reading } from "../types";

const feed = (id: string, fed_at: string, start_level_in: number | null = null): Feeding => ({
  id, user_id: "u", starter_id: "s", fed_at, kept_g: null, flour_g: null, flour_type: null,
  water_g: null, room_temp_f: null, start_level_in, note: null,
});
const read = (id: string, taken_at: string, level_in: number, streak_in: number | null = null): Reading => ({
  id, user_id: "u", starter_id: "s", taken_at, level_in, streak_in, source: "manual",
  ai_level_in: null, ai_streak_in: null, ai_model: null, ai_note: null, photo_path: null, note: null,
});

describe("buildCycles", () => {
  const feedings = [feed("f2", "2026-11-21T02:00:00Z", 1.5), feed("f1", "2026-11-20T02:00:00Z")];
  const readings = [
    read("r0", "2026-11-20T01:00:00Z", 9), // before any feeding: belongs to no cycle
    read("r1", "2026-11-20T02:05:00Z", 1.25),
    read("r2", "2026-11-20T08:00:00Z", 3.5),
    read("r3", "2026-11-21T01:59:00Z", 2),
    read("r4", "2026-11-21T14:00:00Z", 1.75, 4.5),
  ];
  const [now, prev] = buildCycles(feedings, readings);

  it("puts each reading in the cycle of the feeding before it, newest cycle first", () => {
    expect(now.feeding.id).toBe("f2");
    expect(now.readings.map((r) => r.id)).toEqual(["r4"]);
    expect(prev.readings.map((r) => r.id)).toEqual(["r1", "r2", "r3"]);
    expect(prev.endsAt).toBe("2026-11-21T02:00:00Z");
    expect(now.endsAt).toBeNull();
  });

  it("uses the typed start level, else the first reading", () => {
    expect([now.baseline, now.baselineFrom]).toEqual([1.5, "feeding"]);
    expect([prev.baseline, prev.baselineFrom]).toEqual([1.25, "reading"]);
  });

  it("finds the peak from readings, or from a streak higher than any reading", () => {
    expect(prev.peak).toEqual({ height: 3.5, seenAs: "level", hours: 6 });
    expect(now.peak).toEqual({ height: 4.5, seenAs: "streak", hours: 12 });
    expect(isFalling(now)).toBe(true);
    expect(isFalling(prev)).toBe(true);
  });
});

describe("formatting", () => {
  it("rises as a multiple", () => {
    expect(rise(4.5, 1.5)).toBe(3);
    expect(rise(2, null)).toBeNull();
  });
  it("hours", () => {
    expect(formatHours(5 + 10 / 60)).toBe("5h 10m");
    expect(formatHours(0.5)).toBe("30m");
    expect(formatHours(3)).toBe("3h");
  });
  it("inches", () => {
    expect(formatInches(1.75)).toBe("1¾″");
    expect(formatInches(0.5)).toBe("½″");
    expect(formatInches(4)).toBe("4″");
    expect(formatInches(0)).toBe("0″");
    expect(formatInches(2.4)).toBe("2.4″");
    expect(formatInches(3.15)).toBe("3.15″");
  });
});
