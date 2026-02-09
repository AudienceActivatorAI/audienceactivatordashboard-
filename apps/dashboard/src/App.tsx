import { useEffect, useMemo, useState } from 'react';
import { fetchCodex, fetchFilters, fetchGeo, fetchOverview, fetchVehicles } from './api';
import type { CodexResponse, Filters, FiltersResponse, GeoRow, OverviewResponse, VehiclesRow } from './types';
import { FilterBar } from './components/FilterBar';
import { TabNav, type TabKey } from './components/TabNav';
import { KpiCards } from './components/KpiCards';
import { TrendChart } from './components/TrendChart';
import { GeoDrilldown } from './components/GeoDrilldown';
import { VehicleDemand } from './components/VehicleDemand';
import { IntentSegments } from './components/IntentSegments';
import { CodexTab } from './components/CodexTab';
import { SampleTable } from './components/SampleTable';

const getDefaultDates = () => {
  const today = new Date();
  const dateTo = today.toISOString().slice(0, 10);
  const dateFrom = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return { dateFrom, dateTo };
};

export default function App() {
  const { dateFrom, dateTo } = getDefaultDates();
  const [filters, setFilters] = useState<Filters>({ dateFrom, dateTo });
  const [activeTab, setActiveTab] = useState<TabKey>('Overview');
  const [options, setOptions] = useState<FiltersResponse | null>(null);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [geoRows, setGeoRows] = useState<GeoRow[]>([]);
  const [vehicles, setVehicles] = useState<VehiclesRow[]>([]);
  const [codex, setCodex] = useState<CodexResponse | null>(null);
  const [showSamples, setShowSamples] = useState(false);

  const geoLevel = useMemo(() => {
    if (filters.city) return 'zip';
    if (filters.state) return 'city';
    return 'state';
  }, [filters.city, filters.state]);

  useEffect(() => {
    fetchFilters()
      .then(setOptions)
      .catch(() => {
        setOptions({ states: [], makes: [], models: [], yearBands: [], creditRatings: [] });
      });
  }, []);

  useEffect(() => {
    fetchOverview(filters)
      .then(setOverview)
      .catch(() => setOverview(null));
    fetchGeo(filters)
      .then(setGeoRows)
      .catch(() => setGeoRows([]));
    fetchVehicles(filters)
      .then(setVehicles)
      .catch(() => setVehicles([]));
  }, [filters]);

  useEffect(() => {
    if (activeTab !== 'Codex') return;
    if (codex) return;
    fetchCodex()
      .then(setCodex)
      .catch(() => setCodex(null));
  }, [activeTab, codex]);

  const handleGeoSelect = (next: { state?: string; city?: string; zip?: string }) => {
    setFilters((prev) => ({
      ...prev,
      state: next.state ?? prev.state,
      city: next.city,
      zip: next.zip,
    }));
  };

  const handleResetGeo = () => {
    setFilters((prev) => ({
      ...prev,
      state: undefined,
      city: undefined,
      zip: undefined,
    }));
  };

  return (
    <div className="min-h-screen">
      <header className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <span className="chip text-white/70">DealerBDC.AI</span>
            <h1 className="text-3xl md:text-4xl font-display mt-4">
              In-Market + High-Intent Vehicle Shoppers
            </h1>
            <p className="text-white/70 mt-3 max-w-xl">
              In-market shopper intelligence with intent scoring and geo drilldowns.
            </p>
          </div>
          <div className="flex gap-3">
            <button className="btn-ghost" type="button">
              Export snapshot
            </button>
            <button className="btn-primary" type="button">
              Share demo link
            </button>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <TabNav activeTab={activeTab} onChange={setActiveTab} />
          <div className="text-xs text-white/60">
            Drilldown scope: {filters.state ?? 'US'}
            {filters.city ? ` → ${filters.city}` : ''}
            {filters.zip ? ` → ${filters.zip}` : ''}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-16 grid gap-6">
        <FilterBar filters={filters} options={options} onChange={setFilters} onResetGeo={handleResetGeo} />

        {activeTab === 'Overview' && overview && (
          <div className="grid gap-6">
            <KpiCards
              identified={overview.kpis.identifiedShoppers}
              highIntent={overview.kpis.highIntentShoppers}
              avgIntent={overview.kpis.avgIntentScore}
              opportunity={overview.kpis.opportunityIndex}
            />
            <div className="grid lg:grid-cols-[2fr,1fr] gap-6">
              <TrendChart data={overview.trend} />
              <IntentSegments
                warm={overview.segments.warm}
                hot={overview.segments.hot}
                superhot={overview.segments.superhot}
              />
            </div>
            <div className="glass-panel p-4 flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg">Sample Records</h3>
                <p className="text-sm text-white/60">
                  Masked records for context (max 10).
                </p>
              </div>
              <button
                className="btn-ghost"
                onClick={() => setShowSamples((prev) => !prev)}
                type="button"
              >
                {showSamples ? 'Hide' : 'Show'} sample records
              </button>
            </div>
            {showSamples && <SampleTable samples={overview.samples} />}
          </div>
        )}

        {activeTab === 'Geo Intelligence' && (
          <GeoDrilldown
            rows={geoRows}
            level={geoLevel}
            state={filters.state}
            city={filters.city}
            onSelect={handleGeoSelect}
          />
        )}

        {activeTab === 'Vehicle Demand' && <VehicleDemand rows={vehicles} />}

        {activeTab === 'Intent & Segments' && overview && (
          <div className="grid gap-6">
            <IntentSegments
              warm={overview.segments.warm}
              hot={overview.segments.hot}
              superhot={overview.segments.superhot}
            />
            <div className="glass-panel p-6">
              <h3 className="font-display text-lg mb-3">Opportunity Index</h3>
              <p className="text-white/70">
                Opportunity Index blends weighted intent score and high-intent ratio. Use it to rank
                markets where both volume and urgency intersect.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'Codex' && <CodexTab codex={codex} />}
      </main>
    </div>
  );
}
