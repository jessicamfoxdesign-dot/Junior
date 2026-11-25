import { useRef, useState } from "react";
import { sendProblemReport } from "../lib/report";

/** A "Report a problem" link that opens a small form over the app. */
export function ReportProblem() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [picture, setPicture] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const close = () => { setOpen(false); setMessage(""); setPicture(null); setError(null); setSent(false); };
  const send = async () => {
    setBusy(true); setError(null);
    const r = await sendProblemReport(message, picture);
    setBusy(false);
    if (!r.saved) { setError(r.error ?? "Couldn't send. Please try again."); return; }
    setSent(true);
  };

  return (
    <>
      <button className="link small" onClick={() => setOpen(true)}>Report a problem</button>
      {open && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Report a problem" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="sheet">
            <h2>Report a problem</h2>
            {sent ? (
              <>
                <p>Thank you. Your report was sent.</p>
                <button className="primary big" onClick={close}>Close</button>
              </>
            ) : (
              <>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={5000}
                  placeholder="What happened, and what did you expect? Anything that seems wrong or confusing is worth sending." />
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => setPicture(e.target.files?.[0] ?? null)} />
                {picture
                  ? <p className="small">{picture.name} <button className="link" onClick={() => { setPicture(null); if (fileRef.current) fileRef.current.value = ""; }}>Remove</button></p>
                  : <button onClick={() => fileRef.current?.click()}>Add a screenshot or photo (optional)</button>}
                <p className="small muted">Sent with it: the time, your device and browser. Pictures are re-saved first, so they carry no location data.</p>
                {error && <p className="error">{error}</p>}
                <div className="row">
                  <button className="link" onClick={close}>Cancel</button>
                  <button className="primary" disabled={!message.trim() || busy} onClick={send}>{busy ? "Sending…" : "Send report"}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
