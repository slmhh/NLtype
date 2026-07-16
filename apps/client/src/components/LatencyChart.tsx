import type { LatencyBucket } from "../types/results";

interface LatencyChartProps {
  buckets: LatencyBucket[];
}

export function LatencyChart({ buckets }: LatencyChartProps) {
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div className="space-y-2">
      {buckets.map((bucket) => {
        const pct = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;
        return (
          <div key={bucket.label} className="flex items-center gap-2 text-sm">
            <span className="w-16 text-right text-gray-500 font-mono">{bucket.label}ms</span>
            <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-8 text-right text-gray-700 font-mono">{bucket.count}</span>
          </div>
        );
      })}
    </div>
  );
}
