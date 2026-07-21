import {
  Bar, BarChart, Cell, Pie, PieChart, PolarAngleAxis, PolarGrid, Radar, RadarChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { COLORS, num, prettySource, SOURCE_COLORS, STATUS_COLORS } from "../lib/format";

const AXIS = { fontSize: 12, fill: COLORS.muted };

export function SourceBars({ data }: { data: { source: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
        <XAxis dataKey="source" tickFormatter={prettySource} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={44} />
        <Tooltip formatter={(v: number) => num(v)} cursor={{ fill: "#00000008" }} />
        <Bar dataKey="count" radius={[8, 8, 4, 4]} maxBarSize={64}>
          {data.map((d) => <Cell key={d.source} fill={SOURCE_COLORS[d.source] ?? COLORS.brand} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function OutcomeDonut({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <div className="flex items-center gap-6 flex-wrap">
      <ResponsiveContainer width={190} height={190}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={1} stroke="none">
            {data.map((d) => <Cell key={d.name} fill={STATUS_COLORS[d.name] ?? COLORS.muted} />)}
          </Pie>
          <Tooltip formatter={(v: number) => `${num(v)} (${((v / total) * 100).toFixed(1)}%)`} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-2.5 text-[0.84rem]">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded" style={{ background: STATUS_COLORS[d.name] ?? COLORS.muted }} />
            <span className="capitalize">{d.name}</span>
            <b className="ml-auto tnum">{total ? ((d.value / total) * 100).toFixed(1) : "0"}%</b>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScoreHistogram({ data }: { data: { bucket: string; clean: number; flagged: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
        <XAxis dataKey="bucket" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={44} />
        <Tooltip formatter={(v: number) => num(v)} cursor={{ fill: "#00000008" }} />
        <Bar dataKey="clean" stackId="s" fill={COLORS.good} radius={[0, 0, 0, 0]} />
        <Bar dataKey="flagged" stackId="s" fill={COLORS.warn} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AvgBySource({ data }: { data: { source: string; avg: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart layout="vertical" data={data} margin={{ top: 6, right: 20, left: 8, bottom: 0 }}>
        <XAxis type="number" domain={[0, 100]} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="source" tickFormatter={prettySource} tick={AXIS} axisLine={false} tickLine={false} width={92} />
        <Tooltip formatter={(v: number) => `${v} avg`} cursor={{ fill: "#00000008" }} />
        <Bar dataKey="avg" radius={[4, 4, 4, 4]} maxBarSize={26}>
          {data.map((d) => (
            <Cell key={d.source} fill={d.avg >= 70 ? COLORS.good : d.avg >= 40 ? COLORS.warn : COLORS.bad} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export type RadarSeries = { source: string; color: string; values: Record<string, number> };
export function SignalRadar({ axes, series }: { axes: string[]; series: RadarSeries[] }) {
  const data = axes.map((axis) => {
    const row: Record<string, number | string> = { axis };
    series.forEach((s) => (row[s.source] = s.values[axis] ?? 0));
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={230}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="#E3E6EC" />
        <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: COLORS.muted }} />
        {series.map((s) => (
          <Radar key={s.source} dataKey={s.source} stroke={s.color} fill={s.color} fillOpacity={0.13} strokeWidth={2} />
        ))}
        <Tooltip formatter={(v: number) => `${v}%`} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// Diverging "butterfly": clean (left) vs flagged (right) across score bands.
export function Butterfly({ rows }: { rows: { band: string; clean: number; flagged: number }[] }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.clean, r.flagged]));
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-4 justify-center text-[0.8rem] font-semibold mb-1.5">
        <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: COLORS.brand }} />Clean</span>
        <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: COLORS.warn }} />Flagged</span>
      </div>
      {rows.map((r) => (
        <div key={r.band} className="grid grid-cols-[1fr_58px_1fr] items-center gap-2">
          <div className="flex justify-end"><div className="h-[15px] rounded" style={{ width: `${(r.clean / max) * 100}%`, background: COLORS.brand }} title={`${num(r.clean)} clean`} /></div>
          <div className="text-center text-[0.74rem] text-muted font-semibold tnum">{r.band}</div>
          <div className="flex justify-start"><div className="h-[15px] rounded" style={{ width: `${(r.flagged / max) * 100}%`, background: COLORS.warn }} title={`${num(r.flagged)} flagged`} /></div>
        </div>
      ))}
    </div>
  );
}
