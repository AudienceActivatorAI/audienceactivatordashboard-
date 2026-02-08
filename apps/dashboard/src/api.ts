import type { CodexResponse, Filters, FiltersResponse, GeoRow, OverviewResponse, VehiclesRow } from './types';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000';

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
  const res = await fetch(`${API_BASE}/api/overview?${toQuery(filters)}`);
  if (!res.ok) throw new Error('Failed to load overview');
  return res.json();
};

export const fetchGeo = async (filters: Filters): Promise<GeoRow[]> => {
  const query = toQuery(filters);
  if (filters.state && filters.city) {
    const res = await fetch(`${API_BASE}/api/geo/zip?${query}`);
    if (!res.ok) throw new Error('Failed to load zip geo');
    const data = await res.json();
    return data.rows ?? [];
  }
  if (filters.state) {
    const res = await fetch(`${API_BASE}/api/geo/city?${query}`);
    if (!res.ok) throw new Error('Failed to load city geo');
    const data = await res.json();
    return data.rows ?? [];
  }
  const res = await fetch(`${API_BASE}/api/geo/state?${query}`);
  if (!res.ok) throw new Error('Failed to load state geo');
  const data = await res.json();
  return data.rows ?? [];
};

export const fetchVehicles = async (filters: Filters): Promise<VehiclesRow[]> => {
  const res = await fetch(`${API_BASE}/api/vehicles/top?${toQuery(filters)}`);
  if (!res.ok) throw new Error('Failed to load vehicles');
  const data = await res.json();
  return data.rows ?? [];
};

export const fetchCodex = async (): Promise<CodexResponse> => {
  const res = await fetch(`${API_BASE}/api/codex`);
  if (!res.ok) throw new Error('Failed to load codex');
  return res.json();
};

export const fetchFilters = async (): Promise<FiltersResponse> => {
  const res = await fetch(`${API_BASE}/api/filters`);
  if (!res.ok) throw new Error('Failed to load filters');
  return res.json();
};
