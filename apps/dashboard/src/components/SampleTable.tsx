import type { OverviewResponse } from '../types';

type Props = {
  samples: OverviewResponse['samples'];
};

export const SampleTable = ({ samples }: Props) => {
  return (
    <div className="glass-panel p-6">
      <h3 className="font-display text-lg mb-4">Sample Records (Masked)</h3>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-white/60 text-xs uppercase tracking-widest">
              <th className="text-left pb-2">Email</th>
              <th className="text-left pb-2">Phone</th>
              <th className="text-left pb-2">Geo</th>
              <th className="text-left pb-2">Vehicle</th>
              <th className="text-right pb-2">Intent</th>
              <th className="text-left pb-2">Tier</th>
              <th className="text-left pb-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {samples.map((sample, index) => (
              <tr key={`${sample.masked_email ?? 'email'}-${index}`} className="border-t border-white/5">
                <td className="py-3">{sample.masked_email ?? '—'}</td>
                <td className="py-3">{sample.masked_phone ?? '—'}</td>
                <td className="py-3">
                  {sample.city}, {sample.state} {sample.zip}
                </td>
                <td className="py-3">
                  {sample.make} {sample.model} {sample.model_year}
                </td>
                <td className="py-3 text-right">{sample.intent_score}</td>
                <td className="py-3">{sample.intent_tier}</td>
                <td className="py-3">{sample.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
