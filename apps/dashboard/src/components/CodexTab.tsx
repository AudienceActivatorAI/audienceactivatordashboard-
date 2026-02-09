import { useMemo, useState } from 'react';
import type { CodexResponse } from '../types';

type Props = {
  codex: CodexResponse | null;
};

export const CodexTab = ({ codex }: Props) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!codex) return [];
    const term = search.toLowerCase();
    return codex.dataDictionary.filter(
      (field) =>
        field.name.toLowerCase().includes(term) ||
        field.description.toLowerCase().includes(term)
    );
  }, [codex, search]);

  if (!codex) {
    return (
      <div className="glass-panel p-6">
        <p className="text-white/70">Loading Codex...</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="glass-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-lg">Data Dictionary</h3>
            <p className="text-sm text-white/60">
              Searchable schema reference (masked fields in UI).
            </p>
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search fields..."
            className="bg-white/10 text-white rounded-lg px-4 py-2 border border-white/10 min-w-[240px]"
          />
        </div>
        <div className="overflow-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/60 text-xs uppercase tracking-widest">
                <th className="text-left pb-2">Field</th>
                <th className="text-left pb-2">Type</th>
                <th className="text-left pb-2">Description</th>
                <th className="text-left pb-2">Example</th>
                <th className="text-left pb-2">Nullable</th>
                <th className="text-left pb-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((field) => (
                <tr key={field.name} className="border-t border-white/5">
                  <td className="py-3 font-semibold">{field.name}</td>
                  <td className="py-3">{field.type}</td>
                  <td className="py-3">{field.description}</td>
                  <td className="py-3 text-white/70">{field.example}</td>
                  <td className="py-3">{field.nullable ? 'Yes' : 'No'}</td>
                  <td className="py-3 text-white/70">{field.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-panel p-6">
          <h3 className="font-display text-lg mb-3">Metric Definitions</h3>
          <ul className="text-sm text-white/70 space-y-3">
            {codex.metricDefinitions.map((metric) => (
              <li key={metric.name}>
                <span className="font-semibold text-white">{metric.name}</span>
                <div>{metric.definition}</div>
              </li>
            ))}
          </ul>
        </div>
        <div className="glass-panel p-6">
          <h3 className="font-display text-lg mb-3">Scoring Rules</h3>
          <ul className="text-sm text-white/70 space-y-3">
            {codex.scoringRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      </div>
        <div className="glass-panel p-6">
          <h3 className="font-display text-lg mb-3">Data Notes</h3>
          <ul className="text-sm text-white/70 space-y-3">
            {codex.demoAssumptions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
    </div>
  );
};
