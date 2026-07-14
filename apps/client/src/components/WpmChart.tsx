import { useMemo } from "react";

interface WpmChartProps {
  data: number[];
  width?: number;
  height?: number;
  currentWpm?: number;
}

export function WpmChart({ data, width = 320, height = 120, currentWpm }: WpmChartProps) {
  const maxWpm = useMemo(() => Math.max(...data, currentWpm || 0, 1), [data, currentWpm]);
  const paddedMax = Math.max(maxWpm + 20, 60);

  const points = useMemo(() => {
    if (data.length < 2) return "";
    const stepX = width / (data.length - 1);
    return data.map((v, i) => `${i * stepX},${height - (v / paddedMax) * height}`).join(" ");
  }, [data, width, height, paddedMax]);

  const fillPoints = useMemo(() => {
    if (data.length < 2) return "";
    const stepX = width / (data.length - 1);
    const top = data.map((v, i) => `${i * stepX},${height - (v / paddedMax) * height}`).join(" ");
    return `0,${height} ${top} ${width - stepX},${height}`;
  }, [data, width, height, paddedMax]);

  if (data.length < 2) {
    return <div className="text-center text-[var(--text-tertiary)] text-xs py-4 tracking-wider">等待更多数据...</div>;
  }

  const latest = currentWpm ?? data[data.length - 1];

  return (
    <svg width={width} height={height} className="w-full" viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="wpm-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      <polygon points={fillPoints} fill="url(#wpm-fill)" />

      {/* Peak label */}
      {data.length > 0 && (() => {
        const peak = Math.max(...data);
        const peakIdx = data.indexOf(peak);
        const stepX = width / (data.length - 1);
        const px = peakIdx * stepX;
        const py = height - (peak / paddedMax) * height;
        return (
          <g>
            <circle cx={px} cy={py} r="3" fill="var(--accent)" />
            <text x={px} y={py - 8} textAnchor="middle" fill="var(--accent)" fontSize="10" fontFamily="monospace" fontWeight="bold">
              {peak}
            </text>
          </g>
        );
      })()}

      {/* Current WPM label */}
      <text x={width - 4} y={height - 4} textAnchor="end" fill="var(--text-secondary)" fontSize="10" fontFamily="monospace">
        {latest} wpm
      </text>
    </svg>
  );
}
