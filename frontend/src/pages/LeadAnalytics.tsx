import { useMemo } from "react";
import { useLeads } from "../hooks/queries";
import { Avatar, Panel, StatCard } from "../components/ui";
import { AvgBySource, ScoreHistogram, SignalRadar, type RadarSeries } from "../components/charts";
import { avgBySource, buildRadar, buildScoreHistogram } from "../lib/derive";
import { bandColor, COLORS, initials, leadName, num, prettySource } from "../lib/format";

export default function LeadAnalytics() {
  const { data, isError } = useLeads(100000);
  const leads = data ?? [];
  const scored = useMemo(() => leads.filter((l) => l.quality_score != null), [leads]);

  const hi = scored.filter((l) => (l.quality_score ?? 0) >= 70);
  const med = scored.filter((l) => (l.quality_score ?? 0) >= 40 && (l.quality_score ?? 0) < 70);
  const lo = scored.filter((l) => (l.quality_score ?? 0) < 40);
  const consentPct = scored.length ? Math.round((scored.filter((l) => l.consent).length / scored.length) * 100) : 0;

  const hist = useMemo(() => buildScoreHistogram(leads), [leads]);
  const bySrc = useMemo(() => avgBySource(leads), [leads]);
  const radar = useMemo(() => buildRadar(leads), [leads]);
  const top = useMemo(() => [...scored].sort((a, b) => (b.quality_score ?? 0) - (a.quality_score ?? 0)).slice(0, 8), [scored]);

  if (isError) return <div className="text-bad">Couldn’t reach the API.</div>;
  const pct = (n: number) => (scored.length ? Math.round((n / scored.length) * 1000) / 10 : 0);

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Scored leads" value={num(scored.length)} sub="in view" accent={COLORS.brand} />
        <StatCard label="High quality" value={num(hi.length)} sub={`${pct(hi.length)}% of scored`} accent={COLORS.good} />
        <StatCard label="Low quality" value={num(lo.length)} sub={`${pct(lo.length)}% — deprioritize`} accent={COLORS.bad} />
        <StatCard label="Consented" value={`${consentPct}%`} sub="opted in to contact" accent={COLORS.dup} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px]">
        <Panel title="Quality funnel" cap="How scored leads split across the priority bands.">
          <div className="flex flex-col items-center gap-2 pt-1">
            <Fbar label="High" value={hi.length} pct={100} color={COLORS.good} />
            <Fbar label="Medium" value={med.length} pct={hi.length ? Math.round((med.length / hi.length) * 100) : 100} color={COLORS.warn} />
            <Fbar label="Low" value={lo.length} pct={hi.length ? Math.round((lo.length / hi.length) * 100) : 100} color={COLORS.bad} />
          </div>
        </Panel>
        <Panel title="Score distribution" cap="Every scored lead, bucketed 0–100."><ScoreHistogram data={hist} /></Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px]">
        <Panel title="Avg score by source" cap="Which feed brings the strongest leads."><AvgBySource data={bySrc} /></Panel>
        <Panel title="Signal completeness by source" cap="Share of each feed’s leads carrying every quality signal.">
          <SignalRadar axes={radar.axes} series={radar.series as RadarSeries[]} />
          <div className="flex gap-4 justify-center text-[0.8rem] mt-1.5">
            {radar.series.map((s) => <span key={s.source} className="inline-flex items-center gap-1.5"><i className="w-4 h-[3px] rounded" style={{ background: s.color }} />{prettySource(s.source)}</span>)}
          </div>
        </Panel>
      </div>

      <Panel title="Top leads to work now" cap="Highest-scoring leads in view — your call list.">
        <table className="w-full text-[0.85rem]">
          <thead><tr className="text-[0.68rem] uppercase tracking-wide text-faint">
            <th className="text-left pb-2.5 font-bold">Name</th><th className="text-left pb-2.5 font-bold">Source</th>
            <th className="text-right pb-2.5 font-bold">Score</th><th className="text-left pb-2.5 pl-4 font-bold">Why it scored high</th></tr></thead>
          <tbody>
            {top.map((l, i) => (
              <tr key={l.lead_id} className="border-t border-line">
                <td className="py-2.5"><div className="flex items-center gap-2.5"><Avatar text={initials(l)} color={["#2563EB","#7C5CFC","#0EA5E9","#F59E0B","#16A34A"][i % 5]} /><span className="font-semibold">{leadName(l)}</span></div></td>
                <td className="py-2.5 text-muted">{prettySource(l.source)}</td>
                <td className="py-2.5 text-right font-extrabold tnum" style={{ color: bandColor(l.quality_score) }}>{l.quality_score?.toFixed(0)}</td>
                <td className="py-2.5 pl-4 text-muted max-w-[340px]">{l.diagnosis ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function Fbar({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  return (
    <div className="text-white rounded-lg py-3.5 text-center font-bold" style={{ width: `${Math.max(24, Math.min(100, pct))}%`, background: color }}>
      {num(value)}<span className="block font-semibold opacity-90 text-[0.74rem] mt-0.5">{label}</span>
    </div>
  );
}
