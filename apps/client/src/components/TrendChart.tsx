import { useMemo, useState } from "react";
import { useI18n } from "../context/I18nContext";
import type { GameResult } from "../types/results";

interface TrendChartProps {
  results: GameResult[];
}

type Range = "7d" | "30d" | "all";

const W = 600;
const H = 240;
const PAD = { t: 20, r: 20, b: 40, l: 50 };
const IW = W - PAD.l - PAD.r;
const IH = H - PAD.t - PAD.b;

function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

export function TrendChart({ results }: TrendChartProps) {
  const { t } = useI18n();
  const [range, setRange] = useState<Range>("30d");

  const daily = useMemo(() => {
    const now = Date.now();
    const cutoff =
      range === "7d" ? now - 7 * 86400000
      : range === "30d" ? now - 30 * 86400000
      : 0;

    const map = new Map<string, { wpm: number[]; acc: number[] }>();
    for (const r of results) {
      const t = new Date(r.createdAt).getTime();
      if (cutoff && t < cutoff) continue;
      const key = toDateKey(r.createdAt);
      let bucket = map.get(key);
      if (!bucket) { bucket = { wpm: [], acc: [] }; map.set(key, bucket); }
      bucket.wpm.push(r.wpm);
      bucket.acc.push(r.accuracy);
    }

    const entries = Array.from(map.entries())
      .map(([date, vals]) => ({
        date,
        wpm: Math.round(vals.wpm.reduce((a, b) => a + b, 0) / vals.wpm.length),
        acc: Math.round(vals.acc.reduce((a, b) => a + b, 0) / vals.acc.length),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return entries;
  }, [results, range]);

  const { maxWpm, maxAcc, minWpm, minAcc, wpmPath, accPath, labels } = useMemo(() => {
    if (daily.length === 0) return { maxWpm: 0, maxAcc: 0, minWpm: 0, minAcc: 0, wpmPath: "", accPath: "", labels: [] as string[] };

    const wpmVals = daily.map((d) => d.wpm);
    const accVals = daily.map((d) => d.acc);
    const maxWpm = Math.max(...wpmVals, 1);
    const minWpm = Math.min(...wpmVals, 0);
    const maxAcc = Math.max(...accVals, 100);
    const minAcc = Math.min(...accVals, 0);
    const wpmRange = maxWpm - minWpm || 1;
    const accRange = maxAcc - minAcc || 1;

    const labels = daily.map((d) => {
      const parts = d.date.split("-");
      return `${parts[1]}/${parts[2]}`;
    });

    const stepX = daily.length > 1 ? IW / (daily.length - 1) : IW;

    const toWpmY = (v: number) => PAD.t + IH - ((v - minWpm) / wpmRange) * IH;
    const toAccY = (v: number) => PAD.t + IH - ((v - minAcc) / accRange) * IH;

    const wpmPath = daily
      .map((d, i) => `${i === 0 ? "M" : "L"}${PAD.l + i * stepX},${toWpmY(d.wpm)}`)
      .join("");

    const accPath = daily
      .map((d, i) => `${i === 0 ? "M" : "L"}${PAD.l + i * stepX},${toAccY(d.acc)}`)
      .join("");

    return { maxWpm, maxAcc, minWpm, minAcc, wpmPath, accPath, labels };
  }, [daily]);

  if (daily.length === 0) return null;

  const stepX = daily.length > 1 ? IW / (daily.length - 1) : IW;

  return (
    <div>
      {/* Range toggle */}
      <div className="flex items-center gap-1 mb-4">
        {(["7d", "30d", "all"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1 text-xs rounded-lg font-mono transition-colors ${
              range === r
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {r === "7d" ? "7d" : r === "30d" ? "30d" : "All"}
          </button>
        ))}
      </div>

      {/* SVG chart */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: H }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
          <line
            key={frac}
            x1={PAD.l} y1={PAD.t + IH * (1 - frac)}
            x2={PAD.l + IW} y2={PAD.t + IH * (1 - frac)}
            stroke="var(--border)"
            strokeWidth={0.5}
          />
        ))}

        {/* Y-axis labels (WPM) */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
          <text
            key={frac}
            x={PAD.l - 8}
            y={PAD.t + IH * (1 - frac) + 3}
            textAnchor="end"
            fill="var(--text-tertiary)"
            fontSize={10}
            fontFamily="monospace"
          >
            {Math.round(minWpm + (maxWpm - minWpm) * frac)}
          </text>
        ))}

        {/* X-axis labels */}
        {labels.map((l, i) => {
          const showLabel = daily.length <= 7 || i % Math.max(1, Math.floor(daily.length / 7)) === 0 || i === labels.length - 1;
          if (!showLabel) return null;
          return (
            <text
              key={i}
              x={PAD.l + i * stepX}
              y={H - 10}
              textAnchor="middle"
              fill="var(--text-tertiary)"
              fontSize={9}
              fontFamily="monospace"
            >
              {l}
            </text>
          );
        })}

        {/* WPM line */}
        <path d={wpmPath} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />

        {/* Accuracy line */}
        <path d={accPath} fill="none" stroke="#4ade80" strokeWidth={2} strokeLinejoin="round" strokeDasharray="4 3" />

        {/* Data point dots */}
        {daily.map((d, i) => (
          <g key={i}>
            <circle cx={PAD.l + i * stepX} cy={PAD.t + IH - ((d.wpm - minWpm) / (maxWpm - minWpm || 1)) * IH} r={2.5} fill="var(--accent)" />
            <circle cx={PAD.l + i * stepX} cy={PAD.t + IH - ((d.acc - minAcc) / (maxAcc - minAcc || 1)) * IH} r={2.5} fill="#4ade80" />
          </g>
        ))}

        {/* Tooltip area */}
        {daily.map((d, i) => (
          <title key={i}>
            {d.date} | WPM: {d.wpm} | Acc: {d.acc}%
          </title>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-2 text-xs text-[var(--text-tertiary)]">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[var(--accent)]" />
          WPM
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5" style={{ backgroundColor: "#4ade80", textDecoration: "none" }} />
          {t("profile.accuracy")}
        </span>
      </div>
    </div>
  );
}
