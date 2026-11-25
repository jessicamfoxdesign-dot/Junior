import { useEffect, useMemo, useState } from "react";
import { dough, feedForRatio, grams, levainParts, parseRatio, round1 } from "../lib/bake";
import { addBake, addLevain, deleteBake, loadBakes, setStarterHydration, updateBakeNote } from "../lib/data";
import { fromLocalInput, num, toLocalInput, whenText } from "../lib/time";
import type { Bake as BakeRow, Levain, Starter } from "../types";

interface Props {
  userId: string;
  starter: Starter;
  onStarterChange: (s: Starter) => void;
}

const RATIOS = ["1:1:1", "1:2:2", "1:3:3", "1:5:5"];

export function Bake({ userId, starter, onStarterChange }: Props) {
  const [levains, setLevains] = useState<Levain[]>([]);
  const [bakes, setBakes] = useState<BakeRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const reload = () => loadBakes(starter.id).then((d) => { setLevains(d.levains); setBakes(d.bakes); }).catch((e) => setError(e.message));
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [starter.id]);

  return (
    <section className="screen">
      <h2>Bake</h2>
      {error && <p className="error">{error}</p>}
      <LevainBuilder userId={userId} starter={starter} onStarterChange={onStarterChange} onSaved={reload} />
      <DoughCalc userId={userId} starter={starter} levains={levains} lastBake={bakes[0] ?? null} onSaved={reload} />
      <BakeLog bakes={bakes} levains={levains} onChanged={reload} />
    </section>
  );
}

/* ---------- 1. Levain build ---------- */

function LevainBuilder({ userId, starter, onStarterChange, onSaved }: { userId: string; starter: Starter; onStarterChange: (s: Starter) => void; onSaved: () => void }) {
  const [seed, setSeed] = useState("");
  const [ratio, setRatio] = useState("1:3:3");
  const [custom, setCustom] = useState(false);
  const [when, setWhen] = useState(toLocalInput(new Date()));
  const [note, setNote] = useState("");
  const [editHyd, setEditHyd] = useState(false);
  const [hyd, setHyd] = useState(String(starter.hydration_pct ?? 100));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const seedG = num(seed);
  const parsed = parseRatio(ratio);
  const feed = seedG && parsed ? feedForRatio(seedG, parsed) : null;
  const parts = seedG && feed ? levainParts(seedG, feed.flour, feed.water, starter.hydration_pct ?? 100) : null;

  async function save() {
    if (!seedG || !feed || !parsed) { setError("Enter the seed weight and a ratio like 1:3:3."); return; }
    setBusy(true); setError(null);
    try {
      await addLevain({
        user_id: userId, starter_id: starter.id, built_at: fromLocalInput(when),
        seed_g: seedG, feed_flour_g: Math.round(feed.flour * 10) / 10, feed_water_g: Math.round(feed.water * 10) / 10,
        seed_hydration_pct: starter.hydration_pct ?? 100, ratio_label: parsed.join(":"), note: note.trim() || null,
      });
      setMsg(`Saved: ${grams(seedG)} seed, ${parsed.join(":")}.`); setSeed(""); setNote(""); setWhen(toLocalInput(new Date())); onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save."); }
    setBusy(false);
  }

  async function saveHyd() {
    const h = num(hyd);
    if (h == null || h < 25 || h > 300) { setError("Starter hydration is a percentage, like 100."); return; }
    try { onStarterChange(await setStarterHydration(starter.id, h)); setEditHyd(false); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't save."); }
  }

  return (
    <div className="card-block">
      <h3>Build a levain</h3>
      <p className="muted small">
        {starter.name} is fed at {starter.hydration_pct ?? 100}% hydration{(starter.hydration_pct ?? 100) === 100 ? " (equal flour and water)" : ""}.{" "}
        {!editHyd ? <button className="link small" onClick={() => setEditHyd(true)}>Change</button>
          : <span className="confirm-inline"><input className="tiny" inputMode="numeric" value={hyd} onChange={(e) => setHyd(e.target.value)} />%<button className="link" onClick={saveHyd}>Save</button><button className="link" onClick={() => setEditHyd(false)}>Cancel</button></span>}
      </p>
      <div className="form">
        <label>Seed: the starter you weighed out (g)<input inputMode="decimal" value={seed} onChange={(e) => { setSeed(e.target.value); setMsg(null); }} placeholder="57" /></label>
        <div className="label-like">Ratio (seed : flour : water)</div>
        <div className="chips">
          {RATIOS.map((r) => <button key={r} className={!custom && ratio === r ? "chip on" : "chip"} onClick={() => { setCustom(false); setRatio(r); }}>{r}</button>)}
          <button className={custom ? "chip on" : "chip"} onClick={() => setCustom(true)}>Other</button>
        </div>
        {custom && <label>Ratio<input value={ratio} onChange={(e) => setRatio(e.target.value)} placeholder="1:4:4" /></label>}
        {parts && feed ? (
          <div className="result">
            <p className="big">Add <b>{grams(feed.flour)}</b> flour and <b>{grams(feed.water)}</b> water</p>
            <p className="muted small">Makes {grams(parts.weight)} of levain holding {grams(parts.flour)} flour and {grams(parts.water)} water.</p>
          </div>
        ) : <p className="muted small">Enter the seed weight to see what to add.</p>}
        <div className="row2">
          <label>When<input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></label>
          <label>Note<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" /></label>
        </div>
        {error && <p className="error">{error}</p>}
        {msg && <p className="ok">{msg}</p>}
        <div className="actions"><button className="primary" disabled={busy || !parts} onClick={save}>{busy ? "Saving…" : "Save levain"}</button></div>
      </div>
    </div>
  );
}

/* ---------- 2. Dough calculator ---------- */

function DoughCalc({ userId, starter, levains, lastBake, onSaved }: { userId: string; starter: Starter; levains: Levain[]; lastBake: BakeRow | null; onSaved: () => void }) {
  const [levainId, setLevainId] = useState<string>("");
  const [mode, setMode] = useState<"flour" | "loaves">("flour");
  const [flour, setFlour] = useState("1000");
  const [loaves, setLoaves] = useState("2");
  const [loafG, setLoafG] = useState("900");
  const [hyd, setHyd] = useState("75");
  const [salt, setSalt] = useState("2");
  const [secondName, setSecondName] = useState("einkorn");
  const [secondPct, setSecondPct] = useState("0");
  const [used, setUsed] = useState("");
  const [when, setWhen] = useState(toLocalInput(new Date()));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Start from the newest levain and the last bake's settings.
  useEffect(() => { if (!levainId && levains[0]) setLevainId(levains[0].id); }, [levains, levainId]);
  useEffect(() => {
    if (!lastBake) return;
    setMode(lastBake.target_mode);
    if (lastBake.target_flour_g) setFlour(String(lastBake.target_flour_g));
    if (lastBake.loaves) setLoaves(String(lastBake.loaves));
    if (lastBake.loaf_g) setLoafG(String(lastBake.loaf_g));
    setHyd(String(lastBake.hydration_pct)); setSalt(String(lastBake.salt_pct));
    if (lastBake.second_flour) setSecondName(lastBake.second_flour);
    setSecondPct(String(lastBake.second_flour_pct ?? 0));
  }, [lastBake?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const lev = levains.find((l) => l.id === levainId) ?? null;
  const parts = lev ? levainParts(Number(lev.seed_g), Number(lev.feed_flour_g), Number(lev.feed_water_g), Number(lev.seed_hydration_pct)) : null;
  const r = useMemo(() => parts ? dough({
    levain: parts, levainUsed: num(used) ?? undefined,
    totalFlour: mode === "flour" ? num(flour) ?? 0 : undefined,
    loaves: mode === "loaves" ? num(loaves) ?? 0 : undefined, loafWeight: mode === "loaves" ? num(loafG) ?? 0 : undefined,
    hydrationPct: num(hyd) ?? 0, saltPct: num(salt) ?? 0, secondFlourPct: num(secondPct) ?? 0,
  }) : null, [parts, used, mode, flour, loaves, loafG, hyd, salt, secondPct]);
  const sp = num(secondPct) ?? 0;

  async function save() {
    if (!lev || !r || r.totalFlour <= 0) return;
    setBusy(true); setError(null);
    try {
      await addBake({
        user_id: userId, starter_id: starter.id, levain_id: lev.id, mixed_at: fromLocalInput(when),
        target_mode: mode, target_flour_g: mode === "flour" ? num(flour) : null,
        loaves: mode === "loaves" ? num(loaves) : null, loaf_g: mode === "loaves" ? num(loafG) : null,
        hydration_pct: num(hyd) ?? 0, salt_pct: num(salt) ?? 0,
        second_flour: sp > 0 ? secondName.trim() || "second flour" : null, second_flour_pct: sp,
        levain_used_g: round1(r.levainUsed), total_flour_g: round1(r.totalFlour), flour_add_g: round1(r.flourAdd),
        second_flour_add_g: round1(r.secondFlourAdd), water_add_g: round1(r.waterAdd), salt_g: round1(r.salt), dough_g: round1(r.dough), note: null,
      });
      setMsg("Bake saved. Add how it turned out in the log below."); onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save."); }
    setBusy(false);
  }

  return (
    <div className="card-block">
      <h3>Mix a dough</h3>
      {!levains.length ? (
        <p className="muted">Save a levain build above first; the dough is worked out from it.</p>
      ) : (
        <div className="form">
          <label>Levain
            <select value={levainId} onChange={(e) => setLevainId(e.target.value)}>
              {levains.slice(0, 12).map((l) => (
                <option key={l.id} value={l.id}>{whenText(l.built_at)}: {Math.round(Number(l.seed_g))} g at {l.ratio_label ?? "custom"} ({Math.round(Number(l.seed_g) + Number(l.feed_flour_g) + Number(l.feed_water_g))} g)</option>
              ))}
            </select>
          </label>
          <div className="chips">
            <button className={mode === "flour" ? "chip on" : "chip"} onClick={() => setMode("flour")}>By total flour</button>
            <button className={mode === "loaves" ? "chip on" : "chip"} onClick={() => setMode("loaves")}>By loaves</button>
          </div>
          {mode === "flour"
            ? <label>Total flour, including the levain's (g)<input inputMode="numeric" value={flour} onChange={(e) => setFlour(e.target.value)} /></label>
            : <div className="row2"><label>Loaves<input inputMode="numeric" value={loaves} onChange={(e) => setLoaves(e.target.value)} /></label><label>Dough per loaf (g)<input inputMode="numeric" value={loafG} onChange={(e) => setLoafG(e.target.value)} /></label></div>}
          <div className="row2">
            <label>Hydration (%)<input inputMode="decimal" value={hyd} onChange={(e) => setHyd(e.target.value)} /></label>
            <label>Salt (%)<input inputMode="decimal" value={salt} onChange={(e) => setSalt(e.target.value)} /></label>
          </div>
          <div className="row2">
            <label>Second flour<input value={secondName} onChange={(e) => setSecondName(e.target.value)} /></label>
            <label>Its share of the flour (%)<input inputMode="decimal" value={secondPct} onChange={(e) => setSecondPct(e.target.value)} /></label>
          </div>
          <label>Levain to use (g)<input inputMode="decimal" value={used} onChange={(e) => setUsed(e.target.value)} placeholder={parts ? `all of it, ${Math.round(parts.weight)} g` : ""} /></label>

          {r && r.totalFlour > 0 && (
            <div className="result">
              <table className="recipe">
                <tbody>
                  <tr><td>Levain</td><td>{grams(r.levainUsed)}</td></tr>
                  {sp > 0 ? (<>
                    <tr><td>Bread flour</td><td>{grams(r.mainFlourAdd)}</td></tr>
                    <tr><td>{secondName || "Second flour"}</td><td>{grams(r.secondFlourAdd)}</td></tr>
                  </>) : <tr><td>Flour</td><td>{grams(r.flourAdd)}</td></tr>}
                  <tr><td>Water</td><td>{grams(r.waterAdd)}</td></tr>
                  <tr><td>Salt</td><td>{grams(r.salt, true)}</td></tr>
                  <tr className="total"><td>Dough</td><td>{grams(r.dough)}</td></tr>
                </tbody>
              </table>
              <p className="muted small">{grams(r.totalFlour)} flour in all, {round1(r.prefermentedPct)}% of it already in the levain.
                {mode === "loaves" && num(loaves) ? ` About ${grams(r.dough / (num(loaves) || 1))} per loaf.` : ""}</p>
              {sp > 0 && secondName.toLowerCase().includes("einkorn") && <p className="muted small">Einkorn has weak gluten and takes up water slowly, so einkorn doughs feel stickier; many bakers hold back a little water and add it if the dough needs it.</p>}
              {r.warnings.map((w) => <p key={w} className="warn">{w}</p>)}
            </div>
          )}
          <label>Mixed<input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></label>
          {error && <p className="error">{error}</p>}
          {msg && <p className="ok">{msg}</p>}
          <div className="actions"><button className="primary" disabled={busy || !r || r.totalFlour <= 0} onClick={save}>{busy ? "Saving…" : "Save this bake"}</button></div>
        </div>
      )}
    </div>
  );
}

/* ---------- 3. Bake log ---------- */

function BakeLog({ bakes, levains, onChanged }: { bakes: BakeRow[]; levains: Levain[]; onChanged: () => void }) {
  if (!bakes.length) return null;
  return (
    <div className="card-block">
      <h3>Bakes</h3>
      <ul className="bakes">{bakes.map((b) => <BakeItem key={b.id} b={b} lev={levains.find((l) => l.id === b.levain_id) ?? null} onChanged={onChanged} />)}</ul>
    </div>
  );
}

function BakeItem({ b, lev, onChanged }: { b: BakeRow; lev: Levain | null; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(b.note ?? "");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const second = b.second_flour && Number(b.second_flour_pct) > 0;
  async function run(fn: () => Promise<void>) { setBusy(true); setError(null); try { await fn(); onChanged(); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save."); } setBusy(false); }
  return (
    <li className="bake">
      <button className="cycle-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="when">{whenText(b.mixed_at)}</span>
        <span className="peak">{grams(Number(b.total_flour_g))} flour · {b.hydration_pct}% · {b.salt_pct}% salt{second ? ` · ${b.second_flour_pct}% ${b.second_flour}` : ""}</span>
        {b.note && <span className="what">{b.note.length > 80 ? b.note.slice(0, 80) + "…" : b.note}</span>}
      </button>
      {open && (
        <div className="cycle-body">
          <p className="small">Levain {grams(Number(b.levain_used_g))}{lev ? ` (${Math.round(Number(lev.seed_g))} g seed at ${lev.ratio_label ?? "custom"})` : ""} · {second ? `bread flour ${grams(Number(b.flour_add_g) - Number(b.second_flour_add_g))} + ${b.second_flour} ${grams(Number(b.second_flour_add_g))}` : `flour ${grams(Number(b.flour_add_g))}`} · water {grams(Number(b.water_add_g))} · salt {grams(Number(b.salt_g), true)} · dough {grams(Number(b.dough_g))}</p>
          <label>How did it bake?<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Rise, oven spring, crumb, crust, what to change next time" /></label>
          <div className="actions small">
            <button className="primary" disabled={busy} onClick={() => run(() => updateBakeNote(b.id, note.trim() || null))}>Save note</button>
            {!confirm ? <button className="link danger" onClick={() => setConfirm(true)}>Delete bake</button>
              : <span className="confirm-inline">Delete this bake?<button className="danger" disabled={busy} onClick={() => run(() => deleteBake(b.id))}>Delete</button><button className="link" onClick={() => setConfirm(false)}>Keep</button></span>}
          </div>
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </li>
  );
}
