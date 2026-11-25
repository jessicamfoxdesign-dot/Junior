import { useRef, useState } from "react";
import { addReading, readJar, uploadPhoto } from "../lib/data";
import { photoTime, preparePhoto } from "../lib/image";
import { fromLocalInput, num, toLocalInput } from "../lib/time";
import { formatInches } from "../lib/cycles";
import { InchInput } from "../components/InchInput";
import type { AiReading } from "../types";

interface Props {
  userId: string;
  starterId: string;
  name: string;
  onSaved: () => void;
  onCancel: () => void;
}

type Stage = "pick" | "reading" | "confirm";

export function Snap({ userId, starterId, name, onSaved, onCancel }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("pick");
  const [photo, setPhoto] = useState<{ blob: Blob; dataUrl: string } | null>(null);
  const [ai, setAi] = useState<AiReading | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [level, setLevel] = useState("");
  const [streak, setStreak] = useState("");
  const [when, setWhen] = useState(toLocalInput(new Date()));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setAiError(null);
    setAi(null);
    setWhen(toLocalInput(photoTime(file)));
    setStage("reading");
    try {
      const prepared = await preparePhoto(file);
      setPhoto(prepared);
      try {
        const result = await readJar(prepared.dataUrl);
        setAi(result);
        setLevel(result.level_in != null ? String(result.level_in) : "");
        setStreak(result.streak_in != null ? String(result.streak_in) : "");
      } catch (e) {
        setAiError(e instanceof Error ? e.message : "Couldn't read the photo.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open that photo.");
    }
    setStage("confirm");
  }

  function typeInstead() {
    setPhoto(null);
    setAi(null);
    setAiError(null);
    setWhen(toLocalInput(new Date()));
    setStage("confirm");
  }

  async function save() {
    const lv = num(level);
    if (lv == null || lv < 0 || lv > 24) {
      setError("Enter the level in inches, like 1.75 or 1 3/4.");
      return;
    }
    const st = num(streak);
    setSaving(true);
    setError(null);
    try {
      const photo_path = photo ? await uploadPhoto(userId, photo.blob) : null;
      await addReading({
        user_id: userId,
        starter_id: starterId,
        taken_at: fromLocalInput(when),
        level_in: lv,
        streak_in: st,
        source: ai ? "ai" : "manual",
        ai_level_in: ai?.level_in ?? null,
        ai_streak_in: ai?.streak_in ?? null,
        ai_model: ai?.model ?? null,
        ai_note: ai ? [ai.confidence && `confidence ${ai.confidence}`, ai.note].filter(Boolean).join(": ") : null,
        photo_path,
        note: note.trim() || null,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
      setSaving(false);
    }
  }

  return (
    <section className="screen">
      <h2>Snap {name}</h2>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={libraryRef} type="file" accept="image/*" hidden
        onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />

      {stage === "pick" && (
        <div className="pick">
          <p>Hold the phone level with the top of the starter, with the scale facing you.</p>
          <button className="primary big" onClick={() => cameraRef.current?.click()}>Take a photo</button>
          <button className="big" onClick={() => libraryRef.current?.click()}>Choose from photos</button>
          <button className="link" onClick={typeInstead}>No photo, type the level</button>
        </div>
      )}

      {stage === "reading" && <p className="reading-now">Reading the jar…</p>}

      {stage === "confirm" && (
        <div className="confirm">
          {photo && <img className="snap-photo" src={photo.dataUrl} alt="The jar" />}
          {ai && (
            <p className={`ai-says conf-${ai.confidence}`}>
              Claude reads <b>{formatInches(ai.level_in)}</b>
              {ai.streak_in != null && <>, streak at <b>{formatInches(ai.streak_in)}</b></>}
              {ai.level_in == null && " nothing it was sure of"}
              {" "}({ai.confidence} confidence). {ai.note}
            </p>
          )}
          {aiError && <p className="warn">{aiError} You can type the numbers.</p>}
          <label>Level now (inches)
            <InchInput value={level} onChange={setLevel} placeholder="1.75" />
          </label>
          <label>Highest streak (inches, optional)
            <InchInput value={streak} onChange={setStreak} placeholder="empty if none" start={num(level) ?? 1} />
          </label>
          <label>When
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </label>
          <label>Note
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button className="primary" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save reading"}</button>
            <button disabled={saving} onClick={() => setStage("pick")}>Retake</button>
            <button className="link" disabled={saving} onClick={onCancel}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
