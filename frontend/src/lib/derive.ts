import { SOURCE_COLORS } from "./format";
import type { Lead } from "./types";

// Clean-vs-flagged counts across fixed score buckets (the "butterfly").
export function buildButterfly(leads: Lead[]) {
  const buckets: [string, (n: number) => boolean][] = [
    ["80–100", (n) => n >= 80],
    ["70–79", (n) => n >= 70 && n < 80],
    ["60–69", (n) => n >= 60 && n < 70],
    ["50–59", (n) => n >= 50 && n < 60],
    ["40–49", (n) => n >= 40 && n < 50],
    ["0–39", (n) => n < 40],
  ];
  return buckets.map(([band, test]) => {
    const inBucket = leads.filter((l) => l.quality_score != null && test(l.quality_score));
    return {
      band,
      clean: inBucket.filter((l) => l.status === "clean").length,
      flagged: inBucket.filter((l) => l.status === "flagged").length,
    };
  });
}

// Per-source share (%) of leads carrying each quality signal — the radar.
const SIGNALS: [string, (l: Lead) => boolean][] = [
  ["Email", (l) => !!l.email],
  ["Phone", (l) => !!l.phone_e164],
  ["Consent", (l) => !!l.consent],
  ["Campaign", (l) => !!l.campaign_id],
  ["Name", (l) => !!l.first_name],
];

export function buildRadar(leads: Lead[], maxSources = 3) {
  const axes = SIGNALS.map((s) => s[0]);
  const bySource = new Map<string, Lead[]>();
  for (const l of leads) {
    if (!bySource.has(l.source)) bySource.set(l.source, []);
    bySource.get(l.source)!.push(l);
  }
  const topSources = [...bySource.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, maxSources);
  const series = topSources.map(([source, rows]) => ({
    source,
    color: SOURCE_COLORS[source] ?? "#2563EB",
    values: Object.fromEntries(SIGNALS.map(([name, fn]) => [name, Math.round((rows.filter(fn).length / rows.length) * 100)])),
  }));
  return { axes, series };
}

export function buildScoreHistogram(leads: Lead[]) {
  const buckets = ["0–19", "20–39", "40–59", "60–79", "80–100"];
  const idx = (n: number) => (n >= 80 ? 4 : n >= 60 ? 3 : n >= 40 ? 2 : n >= 20 ? 1 : 0);
  const rows = buckets.map((bucket) => ({ bucket, clean: 0, flagged: 0 }));
  for (const l of leads) {
    if (l.quality_score == null) continue;
    const r = rows[idx(l.quality_score)];
    if (l.status === "flagged") r.flagged++;
    else r.clean++;
  }
  return rows;
}

export function avgBySource(leads: Lead[]) {
  const m = new Map<string, { sum: number; n: number }>();
  for (const l of leads) {
    if (l.quality_score == null) continue;
    const e = m.get(l.source) ?? { sum: 0, n: 0 };
    e.sum += l.quality_score;
    e.n++;
    m.set(l.source, e);
  }
  return [...m.entries()]
    .map(([source, { sum, n }]) => ({ source, avg: Math.round((sum / n) * 10) / 10 }))
    .sort((a, b) => a.avg - b.avg);
}
