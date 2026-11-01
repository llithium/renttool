export interface CommuteLocation {
  lat: number;
  lng: number;
}

export interface CommuteDestination extends CommuteLocation {
  label: string;
}

export interface CommuteFilterResult {
  minutes: Record<string, number | null>;
  maximum: number;
}

export function isLocation(value: unknown): value is CommuteLocation {
  if (!value || typeof value !== 'object' || !('lat' in value) || !('lng' in value)) return false;
  return (
    typeof value.lat === 'number' &&
    Number.isFinite(value.lat) &&
    Math.abs(value.lat) <= 90 &&
    typeof value.lng === 'number' &&
    Number.isFinite(value.lng) &&
    Math.abs(value.lng) <= 180
  );
}

export function matchesCommute(label: string, filter: CommuteFilterResult | null): boolean {
  if (!filter) return true;
  const minutes = filter.minutes[label];
  return minutes != null && minutes <= filter.maximum;
}

/** Reject malformed tables; a null route stays unknown rather than becoming zero. */
export function parseDurations(data: unknown, count: number): (number | null)[] | null {
  if (
    !data ||
    typeof data !== 'object' ||
    !('code' in data) ||
    data.code !== 'Ok' ||
    !('durations' in data) ||
    !Array.isArray(data.durations) ||
    data.durations.length !== count
  )
    return null;
  const minutes: (number | null)[] = [];
  for (const row of data.durations) {
    if (!Array.isArray(row) || row.length !== 1) return null;
    const seconds: unknown = row[0];
    if (seconds === null) minutes.push(null);
    else if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0)
      minutes.push(Math.ceil(seconds / 60));
    else return null;
  }
  return minutes;
}

export function parseAddresses(data: unknown): CommuteDestination[] {
  if (!data || typeof data !== 'object' || !('features' in data) || !Array.isArray(data.features))
    return [];
  const results: CommuteDestination[] = [];
  for (const feature of data.features as unknown[]) {
    if (!feature || typeof feature !== 'object') continue;
    const { properties, geometry } = feature as Record<string, unknown>;
    if (!properties || typeof properties !== 'object' || !geometry || typeof geometry !== 'object')
      continue;
    const p = properties as Record<string, unknown>;
    if (
      !p ||
      typeof p !== 'object' ||
      p.countrycode !== 'US' ||
      !('coordinates' in geometry) ||
      !Array.isArray(geometry.coordinates)
    )
      continue;
    const [lng, lat] = geometry.coordinates;
    const location = { lat, lng };
    if (!isLocation(location)) continue;
    const street = [p.housenumber, p.street].filter((v) => typeof v === 'string').join(' ');
    const label = [
      ...new Set(
        [p.name, street, p.city || p.county, p.state, p.postcode].filter(
          (v): v is string => typeof v === 'string' && v.trim().length > 0
        )
      )
    ]
      .join(', ')
      .slice(0, 300);
    if (!label || results.some((result) => result.label === label)) continue;
    results.push({ ...location, label });
    if (results.length === 5) break;
  }
  return results;
}
