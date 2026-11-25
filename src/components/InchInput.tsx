import { num } from "../lib/time";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Where the first + press starts when the field is empty. */
  start?: number;
}

/** Inches: type it, or step by the jar's quarter-inch marks. */
export function InchInput({ value, onChange, placeholder, start = 1 }: Props) {
  const step = (d: number) => {
    const cur = num(value);
    const base = cur == null ? start - (d > 0 ? 0.25 : -0.25) : cur;
    const next = Math.min(24, Math.max(0, Math.round((base + d) * 4) / 4));
    onChange(String(next));
  };
  return (
    <span className="inch-input">
      <button type="button" aria-label="Down a quarter inch" onClick={() => step(-0.25)}>−¼</button>
      <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      <button type="button" aria-label="Up a quarter inch" onClick={() => step(0.25)}>+¼</button>
    </span>
  );
}
