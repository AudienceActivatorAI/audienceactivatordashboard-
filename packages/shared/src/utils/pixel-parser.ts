/**
 * Pixel Event Data Parser
 *
 * Parses EventData JSON from pixel CSV files to extract vehicle information
 * from URLs and other tracking data
 */

import { safeJsonParse } from './index.js';

export interface ParsedEventData {
  url?: string;
  timestamp?: string;
  referrer?: string;
  screenWidth?: number;
  screenHeight?: number;
  videoId?: string;
  videoAction?: string;
  scrollDepth?: number;
  clickTarget?: string;
  fileUrl?: string;
  copiedText?: string;
  [key: string]: unknown;
}

export interface VehicleInfo {
  year?: number;
  make?: string;
  model?: string;
  vin?: string;
  url: string;
  timestamp?: string;
}

/**
 * Parse EventData JSON string
 *
 * @param eventDataString - JSON string from CSV EventData column
 * @returns Parsed event data object or null if invalid
 *
 * @example
 * parseEventData('{"url": "https://...", "timestamp": "2025-11-14T22:41:13Z"}')
 */
export function parseEventData(eventDataString: string | null | undefined): ParsedEventData | null {
  if (!eventDataString) return null;

  // Handle already-parsed objects
  if (typeof eventDataString === 'object') {
    return eventDataString as ParsedEventData;
  }

  return safeJsonParse<ParsedEventData>(eventDataString, null);
}

/**
 * Extract vehicle information from a URL
 *
 * Supports various URL patterns:
 * - /lynnwood-used-cars/detail/2011-Ford-Mustang/vin/1ZVBP8AM4B5152239/
 * - /inventory/2024-Honda-Accord-VIN123456/
 * - /vehicle/detail?year=2024&make=Toyota&model=Camry
 *
 * @param url - Vehicle detail page URL
 * @returns Vehicle info or null if not a vehicle URL
 */
export function extractVehicleFromUrl(url: string | null | undefined): VehicleInfo | null {
  if (!url) return null;

  try {
    // Pattern 1: /detail/YEAR-MAKE-MODEL/vin/VIN/
    const pattern1 = /\/detail\/(\d{4})-([^-]+)-([^/]+)\/vin\/([^/]+)/i;
    const match1 = url.match(pattern1);
    if (match1) {
      return {
        year: parseInt(match1[1], 10),
        make: decodeURIComponent(match1[2]).replace(/-/g, ' '),
        model: decodeURIComponent(match1[3]).replace(/-/g, ' '),
        vin: match1[4],
        url,
      };
    }

    // Pattern 2: /inventory/YEAR-MAKE-MODEL-VIN/
    const pattern2 = /\/inventory\/(\d{4})-([^-]+)-([^-]+)-([A-HJ-NPR-Z0-9]{17})/i;
    const match2 = url.match(pattern2);
    if (match2) {
      return {
        year: parseInt(match2[1], 10),
        make: decodeURIComponent(match2[2]).replace(/-/g, ' '),
        model: decodeURIComponent(match2[3]).replace(/-/g, ' '),
        vin: match2[4],
        url,
      };
    }

    // Pattern 3: Query parameters (?year=2024&make=Toyota&model=Camry&vin=...)
    const urlObj = new URL(url, 'https://example.com'); // Base URL for relative paths
    const params = urlObj.searchParams;
    if (params.has('year') || params.has('make') || params.has('model') || params.has('vin')) {
      const yearStr = params.get('year');
      return {
        year: yearStr ? parseInt(yearStr, 10) : undefined,
        make: params.get('make') || undefined,
        model: params.get('model') || undefined,
        vin: params.get('vin') || undefined,
        url,
      };
    }

    // Pattern 4: Generic vehicle detail page (contains "vehicle", "inventory", "cars", etc.)
    // Extract year-make-model from path segments
    if (/\/(vehicle|inventory|cars|detail)/i.test(url)) {
      const segments = url.split('/').filter(Boolean);
      for (const segment of segments) {
        // Look for patterns like "2024-Honda-Accord"
        const vehicleMatch = segment.match(/^(\d{4})-([^-]+)-(.+)$/);
        if (vehicleMatch) {
          return {
            year: parseInt(vehicleMatch[1], 10),
            make: decodeURIComponent(vehicleMatch[2]).replace(/-/g, ' '),
            model: decodeURIComponent(vehicleMatch[3]).replace(/-/g, ' '),
            url,
          };
        }
      }
    }

    return null;
  } catch (error) {
    // Invalid URL format
    return null;
  }
}

/**
 * Extract vehicle information from parsed EventData
 *
 * @param eventData - Parsed event data object
 * @returns Vehicle info or null if no vehicle found
 */
export function extractVehicleFromEventData(eventData: ParsedEventData | null): VehicleInfo | null {
  if (!eventData) return null;

  const url = eventData.url as string | undefined;
  if (!url) return null;

  const vehicleInfo = extractVehicleFromUrl(url);
  if (!vehicleInfo) return null;

  // Add timestamp from event data
  if (eventData.timestamp) {
    vehicleInfo.timestamp = eventData.timestamp as string;
  }

  return vehicleInfo;
}

/**
 * Parse EventData string and extract vehicle info in one step
 *
 * @param eventDataString - JSON string from CSV EventData column
 * @returns Vehicle info or null if not found
 *
 * @example
 * const vehicle = parseVehicleFromEventData(csvRow.EventData);
 * if (vehicle) {
 *   console.log(`${vehicle.year} ${vehicle.make} ${vehicle.model}`);
 * }
 */
export function parseVehicleFromEventData(eventDataString: string | null | undefined): VehicleInfo | null {
  const eventData = parseEventData(eventDataString);
  return extractVehicleFromEventData(eventData);
}

/**
 * Determine the primary vehicle from a list based on timestamp priority
 *
 * Strategy:
 * 1. Most recent timestamp wins
 * 2. If no timestamps, return first vehicle
 * 3. If no vehicles, return null
 *
 * @param vehicles - Array of vehicle info objects
 * @returns Primary vehicle or null
 */
export function determinePrimaryVehicle(vehicles: VehicleInfo[]): VehicleInfo | null {
  if (vehicles.length === 0) return null;
  if (vehicles.length === 1) return vehicles[0];

  // Filter vehicles with timestamps
  const withTimestamps = vehicles.filter((v) => v.timestamp);

  if (withTimestamps.length === 0) {
    // No timestamps, return first vehicle
    return vehicles[0];
  }

  // Sort by timestamp descending (most recent first)
  const sorted = withTimestamps.sort((a, b) => {
    const dateA = new Date(a.timestamp!);
    const dateB = new Date(b.timestamp!);
    return dateB.getTime() - dateA.getTime();
  });

  return sorted[0];
}

/**
 * Format vehicle for display
 *
 * @param vehicle - Vehicle info
 * @returns Formatted string like "2024 Honda Accord"
 */
export function formatVehicle(vehicle: VehicleInfo | null): string {
  if (!vehicle) return 'Unknown Vehicle';

  const parts: string[] = [];
  if (vehicle.year) parts.push(vehicle.year.toString());
  if (vehicle.make) parts.push(vehicle.make);
  if (vehicle.model) parts.push(vehicle.model);

  return parts.length > 0 ? parts.join(' ') : 'Unknown Vehicle';
}

/**
 * Deduplicate vehicles by VIN or URL
 *
 * @param vehicles - Array of vehicle info objects
 * @returns Deduplicated array with most recent timestamp for each vehicle
 */
export function deduplicateVehicles(vehicles: VehicleInfo[]): VehicleInfo[] {
  const seen = new Map<string, VehicleInfo>();

  for (const vehicle of vehicles) {
    // Use VIN as primary key, fall back to URL
    const key = vehicle.vin || vehicle.url;

    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, vehicle);
      continue;
    }

    // Keep vehicle with most recent timestamp
    if (vehicle.timestamp && existing.timestamp) {
      const vehicleDate = new Date(vehicle.timestamp);
      const existingDate = new Date(existing.timestamp);
      if (vehicleDate > existingDate) {
        seen.set(key, vehicle);
      }
    } else if (vehicle.timestamp && !existing.timestamp) {
      // Prefer vehicle with timestamp
      seen.set(key, vehicle);
    }
  }

  return Array.from(seen.values());
}
