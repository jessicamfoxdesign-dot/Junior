import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { buildCycles } from "./lib/cycles";
import { ensureStarter, loadAll, supabase } from "./lib/data";
import type { Feeding, Reading, Starter } from "./types";
import { Today } from "./screens/Today";
import { Snap } from "./screens/Snap";
import { Feed } from "./screens/Feed";
import { History } from "./screens/History";
import { Bake } from "./screens/Bake";
import { ReportProblem } from "./components/ReportProblem";

type Tab = "today" | "snap" | "feed" | "bake" | "history";

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div className="splash">Junior</div>;
  if (!session) return <SignIn />;
  return <Signed userId={session.user.id} />;
}

function SignIn() {
  const [error, setError] = useState<string | null>(null);
  async function go() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.hostname === "localhost" ? `${window.location.origin}/` : `https://${window.location.host}/` },
    });
    if (error) setError(error.message);
  }
  return (
    <main className="signin">
      <h1>Junior</h1>
      <p>A sourdough starter's diary.</p>
      <button className="primary big" onClick={go}>Sign in with Google</button>
      <p className="small muted agree">By continuing you agree to the <a href="https://jessicafoxdesign.com/terms/" target="_blank" rel="noopener">Terms</a>, <a href="https://jessicafoxdesign.com/privacy/" target="_blank" rel="noopener">Privacy Policy</a> and <a href="https://jessicafoxdesign.com/acceptable-use/" target="_blank" rel="noopener">Acceptable Use Policy</a>. For adults 18 and over.</p>
      {error && <p className="error">{error}</p>}
    </main>
  );
}

function Signed({ userId }: { userId: string }) {
  const [tab, setTab] = useState<Tab>("today");
  const [starter, setStarter] = useState<Starter | null>(null);
  const [feedings, setFeedings] = useState<Feeding[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [editing, setEditing] = useState<Feeding | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (s?: Starter) => {
    const st = s ?? starter;
    if (!st) return;
    try {
      const data = await loadAll(st.id);
      setFeedings(data.feedings);
      setReadings(data.readings);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load.");
    }
  }, [starter]);

  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    // Junior shares Kitchen Compass's household list. Anyone else gets a plain note, not an error.
    supabase.rpc("is_allowed").then(({ data, error }) => setAllowed(error ? true : data === true));
  }, [userId]);

  useEffect(() => {
    if (allowed !== true) return;
    ensureStarter(userId)
      .then((s) => { setStarter(s); return reload(s); })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, allowed]);

  const cycles = useMemo(() => buildCycles(feedings, readings), [feedings, readings]);
  const current = cycles[0] ?? null;
  const lastFeeding = feedings[0] ?? null;

  const done = () => { setEditing(null); setTab("today"); reload(); };

  if (allowed === false) {
    return (
      <main className="signin">
        <h1>Junior</h1>
        <p>This account isn't on the household list. Ask whoever runs Kitchen Compass to add your email, then sign in again.</p>
        <button className="primary big" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </main>
    );
  }

  if (!starter) {
    return <div className="splash">{error ? <p className="error">{error}</p> : "Junior"}</div>;
  }

  return (
    <div className="app">
      <header className="top">
        <h1>{starter.name}</h1>
        <span className="top-links">
          <ReportProblem />
          <button className="link small" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </span>
      </header>
      {error && <p className="error banner">{error} <button className="link" onClick={() => reload()}>Retry</button></p>}
      <main>
        {tab === "today" && <Today name={starter.name} current={current} onSnap={() => setTab("snap")} onFeed={() => setTab("feed")} />}
        {tab === "snap" && <Snap userId={userId} starterId={starter.id} name={starter.name} onSaved={done} onCancel={() => setTab("today")} />}
        {tab === "feed" && <Feed key={editing?.id ?? "new"} userId={userId} starterId={starter.id} name={starter.name}
          last={lastFeeding} editing={editing} onSaved={done} onCancel={() => { setEditing(null); setTab(editing ? "history" : "today"); }} />}
        {tab === "bake" && <Bake userId={userId} starter={starter} onStarterChange={setStarter} />}
        {tab === "history" && <History cycles={cycles} onChanged={() => reload()}
          onEditFeeding={(f) => { setEditing(f); setTab("feed"); }} />}
      </main>
      <p className="policy-links small muted">
        <a href="https://jessicafoxdesign.com/terms/" target="_blank" rel="noopener">Terms</a>
        <a href="https://jessicafoxdesign.com/privacy/" target="_blank" rel="noopener">Privacy</a>
        <a href="https://jessicafoxdesign.com/acceptable-use/" target="_blank" rel="noopener">Acceptable use</a>
      </p>
      <nav className="tabs">
        {(["today", "snap", "feed", "bake", "history"] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => { setEditing(null); setTab(t); }}>
            <TabIcon t={t} />
            <span>{t[0].toUpperCase() + t.slice(1)}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function TabIcon({ t }: { t: Tab }) {
  const p = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (t === "today") return <svg {...p}><rect x="6" y="5" width="12" height="16" rx="3" /><path d="M8 3h8M6 13h12" /></svg>;
  if (t === "snap") return <svg {...p}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>;
  if (t === "bake") return <svg {...p}><path d="M4 14c0-4 3.6-7 8-7s8 3 8 7v3H4z" /><path d="M8 11c1 1 2 1.5 4 1.5s3-.5 4-1.5" /></svg>;
  if (t === "feed") return <svg {...p}><path d="M5 11h14l-1.5 9h-11z" /><path d="M9 11V7a3 3 0 0 1 6 0v4" /></svg>;
  return <svg {...p}><path d="M4 19V5M4 19h16" /><path d="M7 15l4-5 3 3 5-6" /></svg>;
}
