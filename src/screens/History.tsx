import { useEffect, useState } from "react";
import { RiseChart, type Series } from "../components/RiseChart";
import { cyclePoints, formatHours, formatInches, hoursBetween, rise, type Cycle } from "../lib/cycles";
import { deleteFeeding, deleteReading, photoUrl, updateReading } from "../lib/data";
import { fromLocalInput, num, toLocalInput, whenText } from "../lib/time";
import type { Feeding, Reading } from "../types";
import { InchInput } from "../components/InchInput";

const COLORS = ["var(--crust)", "#3f7d6e", "#6b5aa6", "#c8443a", "#8a7a3d"];

interface Props {
  cycles: Cycle[];
  onChanged: () => void;
  onEditFeeding: (f: Feeding) => void;
}

export function History({ cycles, onChanged, onEditFeeding }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const recent = cycles.filter((c) => c.baseline != null && c.readings.length).slice(0, 5);
  const overlay: Series[] = recent.map((c, i) => ({
    key: c.feeding.id,
    label: i === 0 && !c.endsAt ? "now" : new Date(c.feeding.fed_at).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }),
    color: COLORS[i % COLORS.length],
    ...cyclePoints(c, "x"),
  }));

  if (!cycles.length) return <section className="screen"><h2>History</h2><p className="muted">Nothing yet. Each feeding starts a cycle.</p></section>;

  return (
    <section className="screen">
      <h2>History</h2>
      {overlay.length > 0 && (
        <>
          <p className="muted">Rise since feeding, last {overlay.length} cycle{overlay.length > 1 ? "s" : ""}. Diamonds are streaks: the peak was at least that high, at some point before then.</p>
          <RiseChart unit="x" series={overlay} guides={[{ v: 2, label: "doubled" }]} />
        </>
      )}
      <ul className="cycles">
        {cycles.map((c) => (
          <CycleCard key={c.feeding.id} c={c} open={open === c.feeding.id}
            onToggle={() => setOpen(open === c.feeding.id ? null : c.feeding.id)}
            onChanged={onChanged} onEditFeeding={onEditFeeding} />
        ))}
      </ul>
    </section>
  );
}

function CycleCard({ c, open, onToggle, onChanged, onEditFeeding }: {
  c: Cycle; open: boolean; onToggle: () => void; onChanged: () => void; onEditFeeding: (f: Feeding) => void;
}) {
  const f = c.feeding;
  const what = [
    f.kept_g != null && `${f.kept_g}g kept`,
    f.flour_g != null && `${f.flour_g}g ${f.flour_type || "flour"}`,
    f.water_g != null && `${f.water_g}g water`,
    f.room_temp_f != null && `${f.room_temp_f}°F`,
  ].filter(Boolean).join(" · ");
  const peakRise = c.peak ? rise(c.peak.height, c.baseline) : null;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function removeFeeding() {
    setBusy(true);
    try { await deleteFeeding(f.id); onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't delete."); setBusy(false); }
  }

  return (
    <li className={`cycle ${open ? "open" : ""}`}>
      <button className="cycle-head" onClick={onToggle} aria-expanded={open}>
        <span className="when">{whenText(f.fed_at)}{!c.endsAt && <em> · current</em>}</span>
        <span className="peak">
          {c.peak ? <>Peak {formatInches(c.peak.height)}{peakRise != null && ` (${peakRise}×)`} {c.peak.seenAs === "streak" ? `by ${formatHours(c.peak.hours)}` : `at ${formatHours(c.peak.hours)}`}</> : "No readings"}
        </span>
        {what && <span className="what">{what}</span>}
      </button>
      {open && (
        <div className="cycle-body">
          {f.note && <p className="note">{f.note}</p>}
          <RiseChart unit="in" series={[{ key: f.id, label: "", color: "var(--crust)", ...cyclePoints(c, "in") }]}
            guides={c.baseline != null ? [{ v: c.baseline * 2, label: "2×" }] : []} />
          <ul className="readings">
            {c.readings.map((r) => <ReadingRow key={r.id} r={r} fedAt={f.fed_at} onChanged={onChanged} />)}
          </ul>
          <div className="actions">
            <button onClick={() => onEditFeeding(f)}>Edit feeding</button>
            {!confirmDelete
              ? <button className="link danger" onClick={() => setConfirmDelete(true)}>Delete feeding</button>
              : <span className="confirm-inline">Delete this feeding? Its readings stay and join the cycle before.
                  <button className="danger" disabled={busy} onClick={removeFeeding}>Delete</button>
                  <button className="link" onClick={() => setConfirmDelete(false)}>Keep</button></span>}
          </div>
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </li>
  );
}

function ReadingRow({ r, fedAt, onChanged }: { r: Reading; fedAt: string; onChanged: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [level, setLevel] = useState(String(r.level_in));
  const [streak, setStreak] = useState(r.streak_in == null ? "" : String(r.streak_in));
  const [when, setWhen] = useState(toLocalInput(new Date(r.taken_at)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (r.photo_path) photoUrl(r.photo_path).then(setUrl); }, [r.photo_path]);

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await fn(); onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't save."); setBusy(false); }
  }

  const corrected = r.source === "ai" && r.ai_level_in != null && Number(r.ai_level_in) !== Number(r.level_in);

  return (
    <li className="reading">
      {url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Jar" /></a> : <span className="no-photo">no photo</span>}
      <div>
        {!editing ? (
          <>
            <p><b>{formatInches(Number(r.level_in))}</b>{r.streak_in != null && <> · streak {formatInches(Number(r.streak_in))}</>}
              <small> {formatHours(hoursBetween(fedAt, r.taken_at))} after feeding, {whenText(r.taken_at)}</small></p>
            {r.source === "ai" && <p className="muted small">Read by Claude{corrected && `, corrected from ${formatInches(Number(r.ai_level_in))}`}{r.ai_note ? `. ${r.ai_note}` : ""}</p>}
            {r.note && <p className="small">{r.note}</p>}
            <div className="actions small">
              <button className="link" onClick={() => setEditing(true)}>Edit</button>
              {!confirm
                ? <button className="link danger" onClick={() => setConfirm(true)}>Delete</button>
                : <span className="confirm-inline">
                    {r.photo_path ? "Delete this reading and its photo?" : "Delete this reading?"}
                    <button className="danger" disabled={busy} onClick={() => run(() => deleteReading(r, true))}>Delete</button>
                    <button className="link" onClick={() => setConfirm(false)}>Keep</button>
                  </span>}
            </div>
          </>
        ) : (
          <div className="form compact">
            <label>Level (in)<InchInput value={level} onChange={setLevel} /></label>
            <label>Streak (in)<InchInput value={streak} onChange={setStreak} start={num(level) ?? 1} /></label>
            <label>When<input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></label>
            <div className="actions small">
              <button className="primary" disabled={busy} onClick={() => {
                const lv = num(level);
                if (lv == null || lv < 0 || lv > 24) { setError("Level should be inches, like 1.75 or 1 3/4."); return; }
                run(() => updateReading(r.id, { level_in: lv, streak_in: num(streak), taken_at: fromLocalInput(when) }));
              }}>Save</button>
              <button className="link" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    </li>
  );
}
