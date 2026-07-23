import { useState } from "react";
import { useCallList, useSetDisposition, useExplain } from "../hooks/queries";
import { Avatar, Badge, Panel, Signals } from "../components/ui";
import { band, bandColor, COLORS, initials, leadName, prettySource } from "../lib/format";
import type { CallStatus } from "../lib/types";

const AV = ["#2563EB", "#7C5CFC", "#0EA5E9", "#F59E0B", "#16A34A"];

// The four rep dispositions, with the colour + label each shows as a button.
const ACTIONS: { status: CallStatus; label: string; color: string }[] = [
  { status: "contacted", label: "Contacted", color: COLORS.good },
  { status: "follow_up", label: "Follow up", color: COLORS.warn },
  { status: "high_priority", label: "High priority", color: COLORS.brand },
  { status: "not_interested", label: "Not interested", color: COLORS.bad },
];

const QUEUE_SIZE = 25;

export default function CallList() {
  const { data, isLoading, isError, refetch, isFetching } = useCallList(QUEUE_SIZE);
  const setStatus = useSetDisposition();
  const [idx, setIdx] = useState(0);
  const [acted, setActed] = useState<Record<string, CallStatus>>({});

  const list = data ?? [];
  const lead = list[idx];
  const explain = useExplain(lead?.lead_id);

  if (isError) return <div className="text-bad bg-panel rounded-xl2 border border-line p-6">Couldn’t reach the API.</div>;
  if (isLoading) return <div className="h-64 rounded-2xl bg-panel border border-line animate-pulse" />;

  async function disposition(status: CallStatus) {
    if (!lead) return;
    await setStatus.mutateAsync({ leadId: lead.lead_id, status });
    setActed((a) => ({ ...a, [lead.lead_id]: status }));
    setIdx((i) => i + 1); // advance through the working snapshot
  }

  function reload() {
    setActed({});
    setIdx(0);
    refetch();
  }

  const worked = Object.keys(acted).length;

  // End-of-queue state.
  if (!lead) {
    return (
      <div className="flex flex-col gap-[18px]">
        <Progress idx={list.length} total={list.length} worked={worked} />
        <Panel title="Queue cleared" cap="You’ve worked every lead in this batch.">
          <div className="text-center py-8">
            <div className="text-4xl mb-3">✅</div>
            <div className="font-semibold">Nice — {worked} lead{worked === 1 ? "" : "s"} dispositioned.</div>
            <div className="text-muted text-[0.85rem] mt-1">Reload to pull the next highest-scoring batch.</div>
            <button onClick={reload} disabled={isFetching}
              className="mt-4 rounded-xl px-5 py-2.5 font-semibold text-white bg-brand disabled:opacity-50">
              {isFetching ? "Loading…" : "Reload queue"}
            </button>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <Progress idx={idx} total={list.length} worked={worked} />

      <Panel
        title="Work this lead"
        cap="Your highest-scoring unworked leads, prioritized. Set a disposition to move to the next."
        action={
          <div className="flex items-center gap-3 text-[0.82rem]">
            <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}
              className="text-muted hover:text-ink disabled:opacity-40">← Prev</button>
            <button onClick={() => setIdx((i) => i + 1)}
              className="text-brand font-semibold hover:underline">Skip →</button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] gap-6 items-start">
          {/* score gauge */}
          <div className="flex flex-col items-center gap-3">
            <Gauge score={lead.quality_score} />
            <Badge text={`${band(lead.quality_score)} quality`} color={bandColor(lead.quality_score)} />
            {acted[lead.lead_id] && <Badge text={`✓ ${acted[lead.lead_id]!.replace("_", " ")}`} color={COLORS.good} />}
          </div>

          {/* identity + contact + reason */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Avatar text={initials(lead)} color={AV[idx % AV.length]} />
              <div>
                <div className="text-[1.1rem] font-bold leading-tight">{leadName(lead)}</div>
                <div className="text-[0.82rem] text-muted">{prettySource(lead.source)}{lead.campaign_id ? ` · ${lead.campaign_id}` : ""}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Contact label="Email" value={lead.email} />
              <Contact label="Phone" value={lead.phone_e164} />
            </div>

            <div>
              <div className="text-[0.78rem] font-semibold text-muted mb-1">Why this lead <span className="font-normal">· the signals behind the score</span></div>
              <Signals
                positive={explain.data?.positive_signals ?? []}
                negative={explain.data?.negative_signals ?? []}
                loading={explain.isLoading}
              />
            </div>
            <div>
              <div className="text-[0.78rem] font-semibold text-muted mb-1">Suggested action</div>
              <div className="bg-goodbg rounded-xl px-4 py-3 text-[0.88rem]">{lead.suggested_action ?? "No recommended action on file."}</div>
            </div>
          </div>
        </div>

        {/* disposition buttons */}
        <div className="flex flex-wrap gap-2.5 mt-5 pt-4 border-t border-line">
          {ACTIONS.map((a) => (
            <button key={a.status} onClick={() => disposition(a.status)} disabled={setStatus.isPending}
              className="rounded-xl px-4 py-2.5 font-semibold text-white text-[0.88rem] transition active:scale-95 disabled:opacity-50"
              style={{ background: a.color }}>
              {a.label}
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Progress({ idx, total, worked }: { idx: number; total: number; worked: number }) {
  const pct = total ? Math.round((Math.min(idx, total) / total) * 100) : 0;
  return (
    <div className="bg-panel rounded-2xl px-[22px] py-4 border border-line shadow-card">
      <div className="flex items-center justify-between text-[0.82rem] mb-2">
        <span className="font-semibold">Lead {Math.min(idx + 1, total)} of {total}</span>
        <span className="text-muted">{worked} worked this session</span>
      </div>
      <div className="h-2 rounded-full bg-pill overflow-hidden">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Gauge({ score }: { score: number | null | undefined }) {
  const color = bandColor(score);
  const deg = score != null ? (score / 100) * 360 : 0;
  return (
    <div className="w-[120px] h-[120px] rounded-full grid place-items-center" style={{ background: score != null ? `conic-gradient(${color} ${deg}deg, #EEF2F7 0deg)` : "#EEF2F7" }}>
      <div className="w-[94px] h-[94px] rounded-full bg-panel grid place-items-center flex-col">
        <div className="text-[1.8rem] font-extrabold leading-none" style={{ color: score != null ? color : COLORS.muted }}>{score != null ? score.toFixed(0) : "—"}</div>
        <div className="text-[0.66rem] text-muted">/ 100</div>
      </div>
    </div>
  );
}

function Contact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="bg-content rounded-xl px-3.5 py-2.5 border border-line">
      <div className="text-[0.68rem] uppercase tracking-wide text-faint font-bold">{label}</div>
      <div className={`text-[0.9rem] mt-0.5 truncate ${value ? "font-semibold" : "text-muted italic"}`}>{value ?? "not captured"}</div>
    </div>
  );
}
