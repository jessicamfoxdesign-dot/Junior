import { useEffect, useState } from "react";
import { Jar } from "../components/Jar";
import { RiseChart } from "../components/RiseChart";
import { cyclePoints, formatHours, formatInches, hoursBetween, isFalling, rise, type Cycle } from "../lib/cycles";
import { photoUrl } from "../lib/data";
import { whenText } from "../lib/time";

interface Props {
  name: string;
  current: Cycle | null;
  onSnap: () => void;
  onFeed: () => void;
}

export function Today({ name, current, onSnap, onFeed }: Props) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!current) {
    return (
      <section className="screen">
        <div className="hero-empty">
          <Jar level={null} baseline={null} streak={null} />
          <div>
            <h2>Hello, {name}.</h2>
            <p>Log a feeding to start the first cycle. Then snap the jar now and then, and the chart fills in.</p>
            <div className="actions">
              <button className="primary" onClick={onFeed}>Log a feeding</button>
              <button onClick={onSnap}>Snap the jar</button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const c = current;
  const now = new Date().toISOString();
  const since = hoursBetween(c.feeding.fed_at, now);
  const latest = c.latest;
  const level = latest ? Number(latest.level_in) : c.baseline;
  const streak = c.readings.reduce<number | null>((m, r) => (r.streak_in != null && (m == null || r.streak_in > m) ? Number(r.streak_in) : m), null);
  const nowRise = rise(level, c.baseline);
  const peakRise = c.peak ? rise(c.peak.height, c.baseline) : null;
  const falling = isFalling(c);
  const { points, streaks } = cyclePoints(c, "in");

  let mood: string;
  if (!latest) mood = "Fed and waiting. Snap the jar to see how it's going.";
  else if (falling) mood = `${name} has peaked and is falling. Hungry soon.`;
  else if (nowRise != null && nowRise >= 2) mood = `${name} has doubled and is still going.`;
  else mood = `${name} is rising.`;

  return (
    <section className="screen">
      <div className="hero">
        <Jar level={level ?? null} baseline={c.baseline} streak={streak} />
        <div className="stats">
          <p className="mood">{mood}</p>
          <dl>
            <div><dt>Fed</dt><dd>{formatHours(since)} ago <small>{whenText(c.feeding.fed_at)}</small></dd></div>
            <div><dt>Now</dt><dd>{latest ? <>{formatInches(Number(latest.level_in))}{nowRise != null && <> · {nowRise}×</>} <small>{whenText(latest.taken_at)}</small></> : "–"}</dd></div>
            <div><dt>Peak</dt><dd>{c.peak ? <>{formatInches(c.peak.height)}{peakRise != null && <> · {peakRise}×</>} <small>{c.peak.seenAs === "streak" ? `by ${formatHours(c.peak.hours)}, from the streak` : `at ${formatHours(c.peak.hours)}`}</small></> : "–"}</dd></div>
            <div><dt>Start</dt><dd>{c.baseline != null ? <>{formatInches(c.baseline)} <small>{c.baselineFrom === "feeding" ? "typed at feeding" : "first reading"}</small></> : "–"}</dd></div>
          </dl>
          <div className="actions">
            <button className="primary" onClick={onSnap}>Snap</button>
            <button onClick={onFeed}>Feed</button>
          </div>
        </div>
      </div>
      <h3>This cycle</h3>
      <RiseChart
        unit="in"
        series={[{ key: c.feeding.id, label: "now", color: "var(--crust)", points, streaks }]}
        guides={c.baseline != null ? [{ v: c.baseline * 2, label: "2×" }] : []}
      />
      {latest?.photo_path && <LastPhoto path={latest.photo_path} when={latest.taken_at} />}
    </section>
  );
}

function LastPhoto({ path, when }: { path: string; when: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { photoUrl(path).then(setUrl); }, [path]);
  if (!url) return null;
  return (
    <figure className="last-photo">
      <img src={url} alt="Latest photo of the jar" />
      <figcaption>Latest photo, {whenText(when)}</figcaption>
    </figure>
  );
}
