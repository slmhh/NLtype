import { useMemo } from "react";

interface ErrorTableProps {
  errorMap: Record<string, number>;
  totalEvents: number;
}

export function ErrorTable({ errorMap, totalEvents }: ErrorTableProps) {
  const sorted = useMemo(() => {
    return Object.entries(errorMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
  }, [errorMap]);

  if (sorted.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">No errors</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 border-b">
            <th className="text-left py-1 px-2">Expected</th>
            <th className="text-left py-1 px-2">Typed</th>
            <th className="text-right py-1 px-2">Count</th>
            <th className="text-right py-1 px-2">%</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(([pair, count]) => {
            const [exp, typed] = pair.split("→");
            const pct = totalEvents > 0 ? ((count / totalEvents) * 100).toFixed(1) : "0";
            return (
              <tr key={pair} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-1 px-2 font-mono">
                  <span className="inline-block min-w-[1ch]">{exp || " "}</span>
                </td>
                <td className="py-1 px-2 font-mono">
                  <span className="inline-block min-w-[1ch] text-red-600">{typed || " "}</span>
                </td>
                <td className="py-1 px-2 text-right font-mono">{count}</td>
                <td className="py-1 px-2 text-right text-gray-500">{pct}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
