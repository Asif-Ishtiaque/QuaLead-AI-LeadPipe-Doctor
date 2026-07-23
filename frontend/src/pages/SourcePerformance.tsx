import { useMemo } from "react";
import { useSourcePerformance } from "../hooks/queries";
import { Panel, StatCard } from "../components/ui";
import { COLORS, num, prettySource, SOURCE_COLORS } from "../lib/format";
import type { SourcePerf } from "../lib/types";

export default function SourcePerformance() {
  const { data, isError, isLoading } = useSourcePerformance();
  const rows = useMemo(() => data ?? [], [data]);

  const scored = rows.filter((r) => r.avg_score != null);
  const best = scored.length ? scored.reduce((a, b) => ((b.avg_score ?? 0) > (a.avg_score ?? 0) ? b : a)) : null;
  const worst = rows.length ? rows.reduce((a, b) => (b.junk_percentage > a.junk_percentage ? b : a)) : null;
  const maxLeads = Math.max(1, ...rows.map((r) => r.leads));

  if (isError) return <div className="text-bad bg-panel rounded-xl2 border border-line p-6">Couldn’t reach the API.</div>;
  if (isLoading) return <div className="grid grid-cols-2 gap-4">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-panel border border-line animate-pulse" />)}</div>;

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label="Best source"
          value={best ? prettySource(best.source) : "—"}
          sub={best ? `avg score ${best.avg_score} · ${num(best.leads)} clean leads` : "no scored leads yet"}
          accent={COLORS.good}
        />
        <StatCard
          label="Most junk"
          value={worst ? prettySource(worst.source) : "—"}
          sub={worst ? `${worst.junk_percentage}% of its records failed validation` : "no data yet"}
          accent={COLORS.bad}
        />
      </div>

      <Panel title="Source performance" cap="Volume, average quality, and junk rate per feed. Junk = share of everything a source sent that failed validation.">
        <div className="overflow-x-auto">
          <table className="w-full text-[0.85rem]">
            <thead>
              <tr className="text-[0.68rem] uppercase tracking-wide text-faint">
                <th className="text-left pb-2.5 font-bold">Source</th>
                <th className="text-left pb-2.5 font-bold w-[34%]">Clean leads</th>
                <th className="text-right pb-2.5 font-bold">Avg score</th>
                <th className="text-right pb-2.5 font-bold">Flagged</th>
                <th className="text-right pb-2.5 font-bold">Junk %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Row key={r.source} r={r} maxLeads={maxLeads} isBest={r.source === best?.source} isWorst={r.source === worst?.source} />
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-muted">No sources yet — upload leads to populate.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Row({ r, maxLeads, isBest, isWorst }: { r: SourcePerf; maxLeads: number; isBest: boolean; isWorst: boolean }) {
  const color = SOURCE_COLORS[r.source] ?? COLORS.brand;
  const avg = r.avg_score;
  const avgColor = avg == null ? COLORS.muted : avg >= 70 ? COLORS.good : avg >= 40 ? COLORS.warn : COLORS.bad;
  const junkColor = r.junk_percentage >= 60 ? COLORS.bad : r.junk_percentage >= 30 ? COLORS.warn : COLORS.good;
  return (
    <tr className="border-t border-line">
      <td className="py-3 pr-3">
        <div className="flex items-center gap-2 font-semibold">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
          {prettySource(r.source)}
          {isBest && <span className="text-[0.62rem] font-bold text-good bg-goodbg px-1.5 py-0.5 rounded">BEST</span>}
          {isWorst && <span className="text-[0.62rem] font-bold text-bad bg-warnbg px-1.5 py-0.5 rounded">MOST JUNK</span>}
        </div>
      </td>
      <td className="py-3 pr-3">
        <div className="flex items-center gap-2.5">
          <span className="flex-1 h-2.5 rounded-full bg-pill overflow-hidden max-w-[220px]">
            <i className="block h-full rounded-full" style={{ width: `${(r.leads / maxLeads) * 100}%`, background: color }} />
          </span>
          <span className="tnum text-muted text-[0.8rem] w-14 text-right">{num(r.leads)}</span>
        </div>
      </td>
      <td className="py-3 text-right font-extrabold tnum" style={{ color: avgColor }}>{avg ?? "—"}</td>
      <td className="py-3 text-right tnum text-muted">{num(r.flagged)}</td>
      <td className="py-3 text-right font-bold tnum" style={{ color: junkColor }}>{r.junk_percentage}%</td>
    </tr>
  );
}
