import type { Filters, FiltersResponse } from '../types';

type Props = {
  filters: Filters;
  options: FiltersResponse | null;
  onChange: (next: Filters) => void;
  onResetGeo: () => void;
};

export const FilterBar = ({ filters, options, onChange, onResetGeo }: Props) => {
  return (
    <div className="glass-panel p-4 flex flex-wrap gap-4 items-end">
      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-widest text-white/60">Date From</span>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(event) => onChange({ ...filters, dateFrom: event.target.value })}
          className="bg-white/10 text-white rounded-lg px-3 py-2 border border-white/10"
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-widest text-white/60">Date To</span>
        <input
          type="date"
          value={filters.dateTo}
          onChange={(event) => onChange({ ...filters, dateTo: event.target.value })}
          className="bg-white/10 text-white rounded-lg px-3 py-2 border border-white/10"
        />
      </div>
      <div className="flex flex-col gap-1 min-w-[140px]">
        <span className="text-xs uppercase tracking-widest text-white/60">State</span>
        <select
          value={filters.state ?? ''}
          onChange={(event) =>
            onChange({
              ...filters,
              state: event.target.value || undefined,
              city: undefined,
              zip: undefined,
            })
          }
          className="bg-white/10 text-white rounded-lg px-3 py-2 border border-white/10"
        >
          <option value="">All</option>
          {options?.states.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1 min-w-[160px]">
        <span className="text-xs uppercase tracking-widest text-white/60">Make</span>
        <select
          value={filters.make ?? ''}
          onChange={(event) =>
            onChange({
              ...filters,
              make: event.target.value || undefined,
              model: undefined,
            })
          }
          className="bg-white/10 text-white rounded-lg px-3 py-2 border border-white/10"
        >
          <option value="">All</option>
          {options?.makes.map((make) => (
            <option key={make} value={make}>
              {make}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1 min-w-[160px]">
        <span className="text-xs uppercase tracking-widest text-white/60">Model</span>
        <select
          value={filters.model ?? ''}
          onChange={(event) =>
            onChange({
              ...filters,
              model: event.target.value || undefined,
            })
          }
          className="bg-white/10 text-white rounded-lg px-3 py-2 border border-white/10"
        >
          <option value="">All</option>
          {options?.models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1 min-w-[140px]">
        <span className="text-xs uppercase tracking-widest text-white/60">Year Band</span>
        <select
          value={filters.modelYearBand ?? ''}
          onChange={(event) =>
            onChange({
              ...filters,
              modelYearBand: event.target.value || undefined,
            })
          }
          className="bg-white/10 text-white rounded-lg px-3 py-2 border border-white/10"
        >
          <option value="">All</option>
          {options?.yearBands.map((band) => (
            <option key={band} value={band}>
              {band}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1 min-w-[120px]">
        <span className="text-xs uppercase tracking-widest text-white/60">Credit</span>
        <select
          value={filters.creditRating ?? ''}
          onChange={(event) =>
            onChange({
              ...filters,
              creditRating: event.target.value || undefined,
            })
          }
          className="bg-white/10 text-white rounded-lg px-3 py-2 border border-white/10"
        >
          <option value="">All</option>
          {options?.creditRatings.map((rating) => (
            <option key={rating} value={rating}>
              {rating}
            </option>
          ))}
        </select>
      </div>
      <button className="btn-ghost" onClick={onResetGeo} type="button">
        Reset geo drilldown
      </button>
    </div>
  );
};
