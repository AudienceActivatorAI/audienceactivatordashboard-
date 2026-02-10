import type { AudienceRow, Filters } from '../types';

type Props = {
  open: boolean;
  title: string;
  rows: AudienceRow[];
  onClose: () => void;
  filters: Filters;
};

const formatNumber = (value: number) => value.toLocaleString();

export const AudienceDrawer = ({ open, title, rows, onClose, filters }: Props) => {
  if (!open) return null;
  const total = rows.length;
  const email = rows.filter((row) => row.has_email).length;
  const phone = rows.filter((row) => row.has_phone).length;
  const both = rows.filter((row) => row.has_email && row.has_phone).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end lg:items-center justify-center">
      <div className="bg-ink-900 border border-white/10 w-full lg:max-w-5xl lg:rounded-2xl p-6 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-xl">{title}</h3>
            <p className="text-sm text-white/60">
              {filters.state ?? 'US'}
              {filters.city ? ` · ${filters.city}` : ''}
              {filters.zip ? ` · ${filters.zip}` : ''}
            </p>
          </div>
          <button className="btn-ghost" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="grid md:grid-cols-4 gap-4 mt-4">
          <div className="glass-panel p-4">
            <div className="text-xs uppercase tracking-widest text-white/50">Audience Size</div>
            <div className="text-xl font-semibold">{formatNumber(total)}</div>
          </div>
          <div className="glass-panel p-4">
            <div className="text-xs uppercase tracking-widest text-white/50">Email Reachable</div>
            <div className="text-xl font-semibold">{formatNumber(email)}</div>
          </div>
          <div className="glass-panel p-4">
            <div className="text-xs uppercase tracking-widest text-white/50">Phone Reachable</div>
            <div className="text-xl font-semibold">{formatNumber(phone)}</div>
          </div>
          <div className="glass-panel p-4">
            <div className="text-xs uppercase tracking-widest text-white/50">Email + Phone</div>
            <div className="text-xl font-semibold">{formatNumber(both)}</div>
          </div>
        </div>

        <div className="glass-panel p-4 mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/60 text-xs uppercase tracking-widest">
                <th className="text-left pb-2">Email</th>
                <th className="text-left pb-2">Phone</th>
                <th className="text-left pb-2">Geo</th>
                <th className="text-left pb-2">Vehicle</th>
                <th className="text-right pb-2">Intent</th>
                <th className="text-left pb-2">Tier</th>
                <th className="text-left pb-2">Credit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.masked_email ?? 'email'}-${index}`} className="border-t border-white/5">
                  <td className="py-2">{row.masked_email ?? '—'}</td>
                  <td className="py-2">{row.masked_phone ?? '—'}</td>
                  <td className="py-2">
                    {row.city}, {row.state} {row.zip}
                  </td>
                  <td className="py-2">
                    {row.make} {row.model} {row.model_year}
                  </td>
                  <td className="py-2 text-right">{row.intent_score}</td>
                  <td className="py-2">{row.intent_tier}</td>
                  <td className="py-2">{row.credit_rating}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
