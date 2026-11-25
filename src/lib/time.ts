/** Value for <input type="datetime-local"> in the device's time zone. */
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Back from <input type="datetime-local"> to an ISO timestamp. */
export function fromLocalInput(v: string): string {
  return new Date(v).toISOString();
}

export function whenText(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `today ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `yesterday ${time}`;
  return `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} ${time}`;
}

const FRACTIONS: Record<string, number> = { "¼": 0.25, "½": 0.5, "¾": 0.75, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875 };

/**
 * Empty input to null, else a number. Accepts what a phone keypad allows:
 * "1.75", "1,75", "1 3/4", "1¾", "3/4", "1 ¾".
 */
export function num(v: string): number | null {
  let t = v.trim().replace(/[″"]|in(ches)?$/gi, "").trim();
  if (t === "") return null;
  let extra = 0;
  const glyph = t.match(/[¼½¾⅛⅜⅝⅞]/);
  if (glyph) {
    extra = FRACTIONS[glyph[0]];
    t = t.replace(glyph[0], "").trim();
    if (t === "") return extra;
  }
  const frac = t.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const d = Number(frac[3]);
    if (!d) return null;
    return Number(frac[1] ?? 0) + Number(frac[2]) / d + extra;
  }
  if (/^\d+,\d+$/.test(t)) t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n + extra : null;
}
