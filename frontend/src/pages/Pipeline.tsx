import { usePipelineRuns } from "../hooks/queries";
import { Panel, StatCard } from "../components/ui";
import { COLORS, num, prettySource } from "../lib/format";
import type { PipelineRun } from "../lib/types";

const STATUS: Record<string, { label: string; color: string }> = {
  completed: { label: "Completed", color: COLORS.good },
  failed: { label: "Failed", color: COLORS.bad },
  processing: { label: "Processing", color: COLORS.brand },
};

export default function Pipeline() {
  const { data, isError, isLoading } = usePipelineRuns(30);
  const runs = data ?? [];

  if (isError) return <div className="text-bad bg-panel rounded-xl2 border border-line p-6">Couldn’t reach the API.</div>;
  if (isLoading) return <div className="h-40 rounded-2xl bg-panel border border-line animate-pulse" />;

  const totalProcessed = runs.reduce((a, r) => a + (r.processed ?? 0), 0);
  const failedRuns = runs.filter((r) => r.status === "failed").length;

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Runs shown" value={num(runs.length)} sub="most recent ingests" accent={COLORS.brand} />
        <StatCard label="Records processed" value={num(totalProcessed)} sub="across these runs" accent={COLORS.good} />
        <StatCard label="Failed runs" value={num(failedRuns)} sub={failedRuns ? "sent to review" : "all clean"} accent={failedRuns ? COLORS.bad : COLORS.good} />
      </div>

      <Panel title="Pipeline runs" cap="Every ingest batch — what came in, what was kept, and how long it took.">
        {runs.length === 0 ? (
          <div className="text-[0.85rem] text-muted bg-content border border-line rounded-xl px-4 py-3">
            No runs yet — upload a CSV to kick off the pipeline.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-[0.85rem]">
              <thead>
                <tr className="text-[0.68rem] uppercase tracking-wide text-faint bg-content">
                  <th className="text-left px-3 py-2.5 font-bold">When</th>
                  <th className="text-left px-3 py-2.5 font-bold">Source</th>
                  <th className="text-left px-3 py-2.5 font-bold">Status</th>
                  <th className="text-right px-3 py-2.5 font-bold">Processed</th>
                  <th className="text-right px-3 py-2.5 font-bold">Dupes</th>
                  <th className="text-right px-3 py-2.5 font-bold">Failed</th>
                  <th className="text-right px-3 py-2.5 font-bold">Time</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => <Row key={r.run_id} r={r} />)}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Row({ r }: { r: PipelineRun }) {
  const st = STATUS[r.status] ?? { label: r.status, color: COLORS.muted };
  return (
    <tr className="border-t border-line">
      <td className="px-3 py-2.5 text-muted whitespace-nowrap">{fmtWhen(r.started_at)}</td>
      <td className="px-3 py-2.5 font-semibold">{prettySource(r.source)}</td>
      <td className="px-3 py-2.5">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-[0.72rem] font-bold" style={{ color: st.color, background: `${st.color}1A` }}>
          {r.status === "processing" && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: st.color }} />}
          {st.label}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right font-bold tnum" style={{ color: COLORS.good }}>{r.processed != null ? num(r.processed) : "—"}</td>
      <td className="px-3 py-2.5 text-right tnum text-muted">{r.duplicates != null ? num(r.duplicates) : "—"}</td>
      <td className="px-3 py-2.5 text-right tnum" style={{ color: (r.failed ?? 0) > 0 ? COLORS.warn : COLORS.muted }}>{r.failed != null ? num(r.failed) : "—"}</td>
      <td className="px-3 py-2.5 text-right tnum text-muted">{fmtDuration(r.time_taken_ms)}</td>
    </tr>
  );
}

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function fmtDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}
