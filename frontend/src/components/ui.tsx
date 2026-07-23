import type { ReactNode } from "react";
import { COLORS, num } from "../lib/format";
import { ErrorBoundary } from "./ErrorBoundary";

export function KpiCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="bg-panel rounded-2xl p-[18px] border border-line shadow-card transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="w-11 h-11 rounded-xl bg-pill grid place-items-center mb-[34px] [&>svg]:w-[22px] [&>svg]:h-[22px] [&>svg]:stroke-brand">{icon}</div>
      <div className="text-[0.82rem] text-muted font-semibold">{label}</div>
      <div className="text-[1.7rem] font-extrabold tracking-tight mt-1 tnum">{value}</div>
    </div>
  );
}

export function StatCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="bg-panel rounded-2xl px-[17px] py-[15px] border border-line shadow-card transition hover:-translate-y-0.5 hover:shadow-lift" style={{ borderLeft: `4px solid ${accent}` }}>
      <div className="text-[0.7rem] text-muted font-bold uppercase tracking-wide">{label}</div>
      <div className="text-[1.5rem] font-bold tracking-tight mt-0.5 tnum">{value}</div>
      <div className="text-[0.72rem] text-muted mt-0.5">{sub}</div>
    </div>
  );
}

export function Panel({ title, action, cap, children }: { title: string; action?: ReactNode; cap?: string; children: ReactNode }) {
  return (
    <div className="bg-panel rounded-xl2 px-[22px] py-5 border border-line shadow-card">
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="m-0 text-[1.02rem] font-bold">{title}</h3>
        {action}
      </div>
      {cap && <p className="text-[0.78rem] text-muted m-0 mb-3.5">{cap}</p>}
      <ErrorBoundary label={title}>{children}</ErrorBoundary>
    </div>
  );
}

export function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span className="inline-flex items-center px-3 py-[3px] rounded-full text-[0.75rem] font-bold" style={{ color, background: `${color}1A` }}>
      {text}
    </span>
  );
}

export function Avatar({ text, color }: { text: string; color: string }) {
  return (
    <span className="w-[30px] h-[30px] rounded-full grid place-items-center text-white font-bold text-[0.76rem] shrink-0" style={{ background: color }}>
      {text}
    </span>
  );
}

// Explainability panel: the concrete signals behind a score as +/- rows.
export function Signals({ positive, negative, loading }: { positive: string[]; negative: string[]; loading?: boolean }) {
  if (loading) return <div className="h-16 rounded-xl bg-content border border-line animate-pulse" />;
  const rows = [
    ...positive.map((text) => ({ text, good: true })),
    ...negative.map((text) => ({ text, good: false })),
  ];
  if (!rows.length) return <div className="text-[0.82rem] text-muted">No standout signals — an ordinary, complete lead.</div>;
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <div key={r.text} className="flex items-center gap-2.5 text-[0.86rem] rounded-lg px-2.5 py-1.5"
          style={{ background: `${(r.good ? COLORS.good : COLORS.bad)}12` }}>
          <span className="w-[18px] h-[18px] rounded-full grid place-items-center text-white text-[0.66rem] font-black shrink-0"
            style={{ background: r.good ? COLORS.good : COLORS.bad }}>{r.good ? "✓" : "✕"}</span>
          <span className="first-letter:uppercase">{r.text}</span>
        </div>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="text-[0.85rem] text-muted bg-content border border-line rounded-xl px-4 py-3">{children}</div>;
}

export function fmt(n: number): string {
  return num(n);
}
