import type { VehiclesRow } from '../types';

type Props = {
  rows: VehiclesRow[];
};

const formatNumber = (value: number) => value.toLocaleString();

export const VehicleDemand = ({ rows }: Props) => {
  return (
    <div className="glass-panel p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg">Top Vehicle Demand</h3>
        <span className="chip">Weighted shoppers</span>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-white/60 text-xs uppercase tracking-widest">
              <th className="text-left pb-2">Make</th>
              <th className="text-left pb-2">Model</th>
              <th className="text-right pb-2">Year</th>
              <th className="text-right pb-2">Shoppers</th>
              <th className="text-right pb-2">Avg Intent</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.make}-${row.model}-${row.model_year}`}
                className="border-t border-white/5"
              >
                <td className="py-3">{row.make}</td>
                <td className="py-3">{row.model}</td>
                <td className="py-3 text-right">{row.model_year}</td>
                <td className="py-3 text-right">{formatNumber(row.shopper_count)}</td>
                <td className="py-3 text-right">{row.avg_intent_score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
