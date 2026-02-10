import type { GeoRow } from '../types';

type Props = {
  rows: GeoRow[];
  level: 'state' | 'city' | 'zip';
  state?: string;
  city?: string;
  onSelect: (next: { state?: string; city?: string; zip?: string }) => void;
};

const formatNumber = (value: number) => value.toLocaleString();

export const GeoDrilldown = ({ rows, level, state, city, onSelect }: Props) => {
  return (
    <div className="glass-panel p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display text-lg">Geo Intelligence</h3>
          <p className="text-sm text-white/60">
            {level === 'state'
              ? 'Click a state to drill into cities.'
              : level === 'city'
                ? `State: ${state} · Click a city to drill into ZIPs.`
                : `State: ${state} · City: ${city}`}
          </p>
        </div>
        <div className="flex gap-2 text-xs text-white/60">
          <span className="chip">US → State → City → ZIP</span>
        </div>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-white/60 text-xs uppercase tracking-widest">
              <th className="text-left pb-2">Location</th>
              <th className="text-right pb-2">Identified</th>
              <th className="text-right pb-2">Contactable</th>
              <th className="text-right pb-2">High Intent</th>
              <th className="text-right pb-2">Avg Intent</th>
              <th className="text-right pb-2">Opportunity</th>
              <th className="text-right pb-2">Home Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const label =
                level === 'state' ? row.state : level === 'city' ? row.city : row.zip;
              return (
                <tr
                  key={`${row.state}-${row.city}-${row.zip ?? ''}`}
                  className="border-t border-white/5 hover:bg-white/5 cursor-pointer"
                  onClick={() => {
                    if (level === 'state') {
                      onSelect({ state: row.state });
                    } else if (level === 'city') {
                      onSelect({ state: row.state, city: row.city });
                    } else {
                      onSelect({ state: row.state, city: row.city, zip: row.zip });
                    }
                  }}
                >
                  <td className="py-3">{label}</td>
                  <td className="py-3 text-right">{formatNumber(row.identified_shoppers)}</td>
                  <td className="py-3 text-right">
                    {formatNumber(row.contactable_shoppers ?? 0)}
                  </td>
                  <td className="py-3 text-right">{formatNumber(row.high_intent_shoppers)}</td>
                  <td className="py-3 text-right">{row.avg_intent_score}</td>
                  <td className="py-3 text-right">{row.opportunity_index}</td>
                  <td className="py-3 text-right">
                    {row.median_home_value ? `$${formatNumber(row.median_home_value)}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
