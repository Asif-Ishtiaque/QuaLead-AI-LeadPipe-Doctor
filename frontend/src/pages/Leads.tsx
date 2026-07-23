import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSearchLeads, useExplain } from "../hooks/queries";
import { Avatar, Badge, Panel, Signals } from "../components/ui";
import { bandColor, band, leadName, initials, prettySource, STATUS_COLORS, SOURCE_COLORS, COLORS } from "../lib/format";
import type { Lead } from "../lib/types";

// Quality quick-filter presets → the flagged param the API understands.
type Quality = "all" | "high" | "suspicious";
const QUALITY: { key: Quality; label: string }[] = [
  { key: "all", label: "All" },
  { key: "high", label: "High quality" },
  { key: "suspicious", label: "Suspicious" },
];

const AV = ["#2563EB", "#7C5CFC", "#0EA5E9", "#F59E0B", "#16A34A"];
const PAGE_SIZE = 200;

export default function Leads() {
  // Seed from the ?q= param so the global top-bar search lands here with the
  // term already applied.
  const [params] = useSearchParams();
  const [q, setQ] = useState(() => params.get("q") ?? "");
  const [debouncedQ, setDebouncedQ] = useState(() => (params.get("q") ?? "").trim());
  const [selected, setSelected] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [quality, setQuality] = useState<Quality>("all");

  // If the top-bar search navigates here again with a new ?q=, adopt it.
  const urlQ = params.get("q") ?? "";
  useEffect(() => { setQ(urlQ); }, [urlQ]);

  // Debounce keystrokes so we hit the search endpoint once the user pauses,
  // not on every character.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  // "High quality" = clean + high min score; "Suspicious" = flagged.
  const flagged = quality === "suspicious" ? true : quality === "high" ? false : undefined;
  const effectiveMin = quality === "high" ? Math.max(minScore, 70) : minScore;
  const { data, isError } = useSearchLeads(debouncedQ, PAGE_SIZE, {
    source: source || undefined,
    minScore: effectiveMin > 0 ? effectiveMin : undefined,
    flagged,
  });
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  const lead = rows.find((l) => l.lead_id === selected) ?? rows[0];

  if (isError) return <div className="text-bad">Couldn’t reach the API.</div>;

  const shown = Math.min(rows.length, total);

  return (
    <div className="flex flex-col gap-[18px]">
      <Panel title="Leads" cap={`Showing ${shown.toLocaleString()} of ${total.toLocaleString()} leads`}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email…"
          className="w-full mb-3 border border-line2 rounded-xl px-3.5 py-2.5 text-[0.9rem] outline-none focus:border-brand" />

        {/* smart filters */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-4 pb-4 border-b border-line">
          <label className="flex items-center gap-2 text-[0.82rem]">
            <span className="text-muted font-semibold">Source</span>
            <select value={source} onChange={(e) => setSource(e.target.value)}
              className="border border-line2 rounded-lg px-2.5 py-1.5 text-[0.82rem] bg-panel outline-none focus:border-brand cursor-pointer">
              <option value="">All sources</option>
              {Object.keys(SOURCE_COLORS).map((s) => <option key={s} value={s}>{prettySource(s)}</option>)}
            </select>
          </label>

          <label className="flex items-center gap-2.5 text-[0.82rem]">
            <span className="text-muted font-semibold whitespace-nowrap">Min score</span>
            <input type="range" min={0} max={100} step={5} value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))} className="w-36 accent-brand cursor-pointer" />
            <span className="tnum font-bold w-7 text-right">{minScore}</span>
          </label>

          <div className="inline-flex rounded-lg border border-line2 overflow-hidden">
            {QUALITY.map((qf) => (
              <button key={qf.key} onClick={() => setQuality(qf.key)}
                className={`px-3 py-1.5 text-[0.8rem] font-semibold transition-colors ${quality === qf.key ? "bg-brand text-white" : "text-muted hover:text-ink hover:bg-content"}`}>
                {qf.label}
              </button>
            ))}
          </div>

          {(source || minScore > 0 || quality !== "all") && (
            <button onClick={() => { setSource(""); setMinScore(0); setQuality("all"); }}
              className="text-[0.8rem] text-brand font-semibold hover:underline ml-auto">Clear filters</button>
          )}
        </div>
        <div className="max-h-[360px] overflow-y-auto rounded-xl border border-line">
          <table className="w-full text-[0.85rem]">
            <thead className="sticky top-0 bg-panel"><tr className="text-[0.68rem] uppercase tracking-wide text-faint">
              <th className="text-left px-3 py-2.5 font-bold">Lead</th><th className="text-left px-3 py-2.5 font-bold">Source</th>
              <th className="text-right px-3 py-2.5 font-bold">Score</th><th className="text-left px-3 py-2.5 font-bold">Status</th></tr></thead>
            <tbody>
              {rows.map((l, i) => (
                <tr key={l.lead_id} onClick={() => setSelected(l.lead_id)}
                  className={`border-t border-line cursor-pointer hover:bg-content ${lead?.lead_id === l.lead_id ? "bg-brandbg" : ""}`}>
                  <td className="px-3 py-2.5"><div className="flex items-center gap-2.5"><Avatar text={initials(l)} color={AV[i % AV.length]} /><div><div className="font-semibold">{leadName(l)}</div><div className="text-[0.76rem] text-muted">{l.email ?? "(no email)"}</div></div></div></td>
                  <td className="px-3 py-2.5 text-muted">{prettySource(l.source)}</td>
                  <td className="px-3 py-2.5 text-right font-bold tnum" style={{ color: bandColor(l.quality_score) }}>{l.quality_score?.toFixed(0) ?? "—"}</td>
                  <td className="px-3 py-2.5"><Badge text={String(l.status)} color={STATUS_COLORS[String(l.status)] ?? COLORS.muted} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > shown && <div className="text-[0.76rem] text-muted mt-2">Showing the first {PAGE_SIZE} matches — refine your search to narrow the list.</div>}
      </Panel>

      {lead && <LeadInsight lead={lead} />}
    </div>
  );
}

function LeadInsight({ lead }: { lead: Lead }) {
  const color = bandColor(lead.quality_score);
  const score = lead.quality_score;
  const deg = score != null ? (score / 100) * 360 : 0;
  const explain = useExplain(lead.lead_id);
  return (
    <Panel title="Lead insights" cap="Why this lead scored the way it did — and what to do next.">
      <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-6 items-start">
        <div className="flex flex-col items-center gap-3">
          <div className="w-[132px] h-[132px] rounded-full grid place-items-center" style={{ background: score != null ? `conic-gradient(${color} ${deg}deg, #EEF2F7 0deg)` : "#EEF2F7" }}>
            <div className="w-[104px] h-[104px] rounded-full bg-panel grid place-items-center flex-col">
              <div className="text-[2rem] font-extrabold leading-none" style={{ color: score != null ? color : COLORS.muted }}>{score != null ? score.toFixed(0) : "—"}</div>
              <div className="text-[0.7rem] text-muted">/ 100</div>
            </div>
          </div>
          <Badge text={`${band(score)} quality`} color={color} />
          <div className="text-[0.82rem]">Status <Badge text={String(lead.status)} color={STATUS_COLORS[String(lead.status)] ?? COLORS.muted} /></div>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <div className="font-semibold mb-1.5">Why this score <span className="text-muted text-[0.8rem] font-normal">· the signals behind it</span></div>
            <Signals
              positive={explain.data?.positive_signals ?? []}
              negative={explain.data?.negative_signals ?? []}
              loading={explain.isLoading}
            />
          </div>
          <div>
            <div className="font-semibold mb-1.5">Recommended action <span className="text-muted text-[0.8rem] font-normal">· what a rep should do next</span></div>
            <div className={`rounded-xl px-4 py-3 text-[0.88rem] ${lead.status === "clean" && (score ?? 0) >= 70 ? "bg-goodbg" : "bg-warnbg"}`}>
              {lead.suggested_action ?? "No recommended action on file."}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
