import { useState } from "react";
import { addFeeding, updateFeeding } from "../lib/data";
import { fromLocalInput, num, toLocalInput } from "../lib/time";
import type { Feeding } from "../types";
import { InchInput } from "../components/InchInput";

interface Props {
  userId: string;
  starterId: string;
  name: string;
  last: Feeding | null;
  /** When set, this feeding is being edited instead of a new one added. */
  editing?: Feeding | null;
  onSaved: () => void;
  onCancel: () => void;
}

const str = (v: number | string | null | undefined) => (v == null ? "" : String(v));

export function Feed({ userId, starterId, name, last, editing, onSaved, onCancel }: Props) {
  const src = editing ?? null;
  const [when, setWhen] = useState(toLocalInput(src ? new Date(src.fed_at) : new Date()));
  const [kept, setKept] = useState(str(src?.kept_g));
  const [flour, setFlour] = useState(str(src?.flour_g));
  const [flourType, setFlourType] = useState(src?.flour_type ?? "");
  const [water, setWater] = useState(str(src?.water_g));
  const [temp, setTemp] = useState(str(src?.room_temp_f));
  const [start, setStart] = useState(str(src?.start_level_in));
  const [note, setNote] = useState(src?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function sameAsLast() {
    if (!last) return;
    setKept(str(last.kept_g));
    setFlour(str(last.flour_g));
    setFlourType(last.flour_type ?? "");
    setWater(str(last.water_g));
    setTemp(str(last.room_temp_f));
  }

  const k = num(kept), f = num(flour), w = num(water);
  const ratio = k && f && w ? `1 : ${round(f / k)} : ${round(w / k)}` : null;
  const hydration = f && w ? `${Math.round((w / f) * 100)}% water to flour` : null;

  async function save() {
    const st = num(start);
    if (st != null && (st < 0 || st > 24)) { setError("Starting level should be in inches, like 1.5."); return; }
    setSaving(true);
    setError(null);
    const row = {
      fed_at: fromLocalInput(when),
      kept_g: k, flour_g: f, flour_type: flourType.trim() || null, water_g: w,
      room_temp_f: num(temp), start_level_in: st, note: note.trim() || null,
    };
    try {
      if (editing) await updateFeeding(editing.id, row);
      else await addFeeding({ ...row, user_id: userId, starter_id: starterId });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
      setSaving(false);
    }
  }

  return (
    <section className="screen">
      <h2>{editing ? "Edit feeding" : `Feed ${name}`}</h2>
      {!editing && last && <button className="link" onClick={sameAsLast}>Same as last time</button>}
      <div className="form">
        <label>When<input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></label>
        <div className="row3">
          <label>Kept (g)<input inputMode="numeric" value={kept} onChange={(e) => setKept(e.target.value)} /></label>
          <label>Flour (g)<input inputMode="numeric" value={flour} onChange={(e) => setFlour(e.target.value)} /></label>
          <label>Water (g)<input inputMode="numeric" value={water} onChange={(e) => setWater(e.target.value)} /></label>
        </div>
        {(ratio || hydration) && <p className="muted">{[ratio, hydration].filter(Boolean).join(" · ")}</p>}
        <label>Flour type<input value={flourType} onChange={(e) => setFlourType(e.target.value)} placeholder="e.g. bread flour, 20% rye" /></label>
        <label>Room temp (°F)<input inputMode="numeric" value={temp} onChange={(e) => setTemp(e.target.value)} /></label>
        <label>Level after feeding (in)<InchInput value={start} onChange={setStart} placeholder="or snap it" /></label>
        <label>Note<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" /></label>
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button className="primary" disabled={saving} onClick={save}>{saving ? "Saving…" : editing ? "Save changes" : "Save feeding"}</button>
          <button className="link" disabled={saving} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </section>
  );
}

const round = (n: number) => Math.round(n * 10) / 10;
