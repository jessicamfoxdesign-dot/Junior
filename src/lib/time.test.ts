import { describe, expect, it } from "vitest";
import { num } from "./time";

describe("num", () => {
  it.each([
    ["", null], ["1.75", 1.75], ["1,75", 1.75], ["1 3/4", 1.75], ["3/4", 0.75],
    ["1¾", 1.75], ["1 ¾", 1.75], ["½", 0.5], ["2″", 2], ["4 1/2 in", 4.5], ["abc", null], ["1/0", null], ["50", 50],
  ])("%s", (v, out) => expect(num(v)).toBe(out));
});
