import { useMemo } from "react";

interface KeyboardHeatmapProps {
  errorMap: Record<string, number>;
  keyFrequency: Record<string, number>;
}

const ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

export function KeyboardHeatmap({ errorMap, keyFrequency }: KeyboardHeatmapProps) {
  const keyErrors = useMemo(() => {
    const errs: Record<string, number> = {};
    for (const [pair, count] of Object.entries(errorMap)) {
      const expected = pair.split("→")[0];
      errs[expected] = (errs[expected] || 0) + count;
    }
    return errs;
  }, [errorMap]);

  const getColor = (key: string): string => {
    const freq = keyFrequency[key] || 0;
    const errs = keyErrors[key] || 0;
    if (freq === 0) return "bg-gray-100 text-gray-400";
    const rate = errs / freq;
    if (rate === 0) return "bg-green-500/20 text-green-700";
    if (rate < 0.1) return "bg-yellow-500/30 text-yellow-800";
    if (rate < 0.25) return "bg-orange-500/40 text-orange-800";
    return "bg-red-500/50 text-red-900";
  };

  return (
    <div className="space-y-1.5">
      {ROWS.map((row, ri) => (
        <div key={ri} className="flex justify-center gap-1">
          {row.map((key) => {
            const freq = keyFrequency[key] || 0;
            const errs = keyErrors[key] || 0;
            const rate = freq > 0 ? ((errs / freq) * 100).toFixed(0) : "0";
            return (
              <div
                key={key}
                className={`w-9 h-10 flex items-center justify-center rounded text-xs font-mono font-semibold ${getColor(key)}`}
                title={`${key.toUpperCase()}: ${errs} errors / ${freq} total (${rate}%)`}
              >
                {key.toUpperCase()}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
