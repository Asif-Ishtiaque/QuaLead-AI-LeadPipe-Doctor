import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Panel } from "../components/ui";
import { num } from "../lib/format";
import type { IngestSummary } from "../lib/types";

export default function Upload() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IngestSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    if (!file) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const summary = await api.uploadCsv(file);
      setResult(summary);
      qc.invalidateQueries(); // refresh dashboard data
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const mapping = result?.field_mapping ?? {};
  const mapped = Object.entries(mapping).filter(([, v]) => v);
  const unmapped = Object.entries(mapping).filter(([, v]) => !v).map(([k]) => k);

  return (
    <Panel title="Upload leads" cap="Drop any CSV — from any CRM, ad platform, or spreadsheet, with whatever column names it uses. QuaLead AI figures out which columns are the name, email, phone, and so on, then cleans, validates, scores, and diagnoses every row. Nothing is dropped — messy leads are flagged, never deleted.">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl px-6 py-10 text-center cursor-pointer transition ${dragging ? "border-brand bg-brandbg" : "border-line2 bg-content hover:border-brand"}`}
      >
        <div className="text-3xl mb-2">📥</div>
        <div className="font-semibold">{file ? file.name : "Drag & drop a CSV here"}</div>
        <div className="text-[0.8rem] text-muted mt-1">{file ? `${(file.size / 1024).toFixed(0)} KB — click Analyze below` : "or click to browse · any CSV, any headers"}</div>
        <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button onClick={analyze} disabled={!file || busy}
          className="rounded-xl px-5 py-2.5 font-semibold text-white bg-brand disabled:opacity-40 disabled:cursor-not-allowed">
          {busy ? "Analyzing…" : "Analyze leads"}
        </button>
        {file && !busy && <button onClick={() => { setFile(null); setResult(null); setError(null); }} className="text-muted text-sm hover:text-ink">Clear</button>}
      </div>

      {error && <div className="mt-4 text-bad bg-white border border-line rounded-xl px-4 py-3 text-sm">{error}</div>}

      {result && (
        <div className="mt-5">
          <div className="text-good font-semibold mb-3">✓ Analysis complete — your leads are in.</div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Metric label="Scored & kept" value={num(result.scored)} />
            <Metric label="Duplicates merged" value={num(result.duplicates)} />
            <Metric label="Invalid rows" value={num(result.invalid)} />
          </div>
          {mapped.length > 0 && (
            <div className="rounded-xl border border-line overflow-hidden">
              <div className="bg-content px-4 py-2.5 text-[0.8rem] font-semibold">How your columns were mapped</div>
              <table className="w-full text-[0.84rem]">
                <tbody>
                  {mapped.map(([col, to]) => (
                    <tr key={col} className="border-t border-line"><td className="px-4 py-2">{col}</td><td className="px-4 py-2 text-right text-brand font-semibold">{to}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {unmapped.length > 0 && <div className="text-[0.78rem] text-muted mt-2">Kept in raw_payload, not mapped: {unmapped.join(", ")}</div>}
        </div>
      )}
    </Panel>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-content rounded-xl px-4 py-3 border border-line">
      <div className="text-[0.72rem] text-muted uppercase tracking-wide font-bold">{label}</div>
      <div className="text-[1.4rem] font-bold tnum mt-0.5">{value}</div>
    </div>
  );
}
