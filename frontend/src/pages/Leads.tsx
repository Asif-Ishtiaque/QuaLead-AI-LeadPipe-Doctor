import { useMemo, useState } from "react";
import { useLeads } from "../hooks/queries";
import { Avatar, Badge, Panel } from "../components/ui";
import { bandColor, band, leadName, initials, prettySource, STATUS_COLORS, COLORS } from "../lib/format";
import type { Lead } from "../lib/types";

const AV = ["#2563EB", "#7C5CFC", "#0EA5E9", "#F59E0B", "#16A34A"];

export default function Leads() {
  const { data, isError } = useLeads(100000);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const leads = data ?? [];
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = needle
      ? leads.filter((l) => [l.first_name, l.last_name, l.email].some((v) => (v ?? "").toLowerCase().includes(needle)))
      : leads;
    return [...rows].sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
  }, [leads, q]);

  const lead = filtered.find((l) => l.lead_id === selected) ?? filtered[0];

  if (isError) return <div className="text-bad">Couldn’t reach the API.</div>;

  return (
    <div className="flex flex-col gap-[18px]">
      <Panel title="Leads" cap={`Showing ${filtered.length.toLocaleString()} of ${leads.length.toLocaleString()} leads`}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email…"
          className="w-full mb-3 border border-line2 rounded-xl px-3.5 py-2.5 text-[0.9rem] outline-none focus:border-brand" />
        <div className="max-h-[360px] overflow-y-auto rounded-xl border border-line">
          <table className="w-full text-[0.85rem]">
            <thead className="sticky top-0 bg-panel"><tr className="text-[0.68rem] uppercase tracking-wide text-faint">
              <th className="text-left px-3 py-2.5 font-bold">Lead</th><th className="text-left px-3 py-2.5 font-bold">Source</th>
              <th className="text-right px-3 py-2.5 font-bold">Score</th><th className="text-left px-3 py-2.5 font-bold">Status</th></tr></thead>
            <tbody>
              {filtered.slice(0, 200).map((l, i) => (
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
        {filtered.length > 200 && <div className="text-[0.76rem] text-muted mt-2">Showing the first 200 rows — refine your search to narrow the list.</div>}
      </Panel>

      {lead && <LeadInsight lead={lead} />}
    </div>
  );
}

function LeadInsight({ lead }: { lead: Lead }) {
  const color = bandColor(lead.quality_score);
  const score = lead.quality_score;
  const deg = score != null ? (score / 100) * 360 : 0;
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
            <div className="font-semibold mb-1.5">Diagnosis <span className="text-muted text-[0.8rem] font-normal">· why this score</span></div>
            <div className="bg-brandbg text-ink rounded-xl px-4 py-3 text-[0.88rem]">{lead.diagnosis ?? "No diagnosis on file — re-ingest this lead to populate it."}</div>
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
