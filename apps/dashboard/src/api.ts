import type { AudienceRow, CodexResponse, Filters, FiltersResponse, GeoRow, OverviewResponse, VehiclesRow } from './types';

const DEFAULT_API_BASE = 'http://localhost:4000';
const BUILD_API_BASE = import.meta.env.VITE_API_BASE as string | undefined;

let apiBasePromise: Promise<string> | null = null;

const resolveApiBase = async () => {
  if (BUILD_API_BASE) return BUILD_API_BASE;
  if (apiBasePromise) return apiBasePromise;
  apiBasePromise = fetch('/runtime-config.json')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => (data && typeof data.apiBase === 'string' ? data.apiBase : DEFAULT_API_BASE))
    .catch(() => DEFAULT_API_BASE);
  return apiBasePromise;
};

const toQuery = (filters: Filters) => {
  const params = new URLSearchParams();
  params.set('date_from', filters.dateFrom);
  params.set('date_to', filters.dateTo);
  if (filters.state) params.set('state', filters.state);
  if (filters.city) params.set('city', filters.city);
  if (filters.zip) params.set('zip', filters.zip);
  if (filters.make) params.set('make', filters.make);
  if (filters.model) params.set('model', filters.model);
  if (filters.modelYearBand) params.set('model_year_band', filters.modelYearBand);
  if (filters.creditRating) params.set('credit_rating', filters.creditRating);
  return params.toString();
};

export const fetchOverview = async (filters: Filters): Promise<OverviewResponse> => {
  const apiBase = await resolveApiBase();
  const res = await fetch(`${apiBase}/api/overview?${toQuery(filters)}`);
  if (!res.ok) throw new Error('Failed to load overview');
  return res.json();
};

export const fetchGeo = async (filters: Filters): Promise<GeoRow[]> => {
  const apiBase = await resolveApiBase();
  const query = toQuery(filters);
  if (filters.state && filters.city) {
    const res = await fetch(`${apiBase}/api/geo/zip?${query}`);
    if (!res.ok) throw new Error('Failed to load zip geo');
    const data = await res.json();
    return data.rows ?? [];
  }
  if (filters.state) {
    const res = await fetch(`${apiBase}/api/geo/city?${query}`);
    if (!res.ok) throw new Error('Failed to load city geo');
    const data = await res.json();
    return data.rows ?? [];
  }
  const res = await fetch(`${apiBase}/api/geo/state?${query}`);
  if (!res.ok) throw new Error('Failed to load state geo');
  const data = await res.json();
  return data.rows ?? [];
};

export const fetchVehicles = async (filters: Filters): Promise<VehiclesRow[]> => {
  const apiBase = await resolveApiBase();
  const res = await fetch(`${apiBase}/api/vehicles/top?${toQuery(filters)}`);
  if (!res.ok) throw new Error('Failed to load vehicles');
  const data = await res.json();
  return data.rows ?? [];
};

export const fetchCodex = async (): Promise<CodexResponse> => {
  const apiBase = await resolveApiBase();
  const res = await fetch(`${apiBase}/api/codex`);
  if (!res.ok) throw new Error('Failed to load codex');
  return res.json();
};

export const fetchFilters = async (): Promise<FiltersResponse> => {
  const apiBase = await resolveApiBase();
  const res = await fetch(`${apiBase}/api/filters`);
  if (!res.ok) throw new Error('Failed to load filters');
  return res.json();
};

export const fetchAudience = async (filters: Filters): Promise<AudienceRow[]> => {
  const apiBase = await resolveApiBase();
  const res = await fetch(`${apiBase}/api/audience?${toQuery(filters)}`);
  if (!res.ok) throw new Error('Failed to load audience');
  const data = await res.json();
  return data.rows ?? [];
};
