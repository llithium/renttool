/** Great-circle distance between two points in miles (haversine). */
export function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 3958.8; // Earth radius, miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function isValidCoordinates(
  lat: number | null | undefined,
  lng: number | null | undefined
): boolean {
  return (
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof lng === 'number' &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Read a complete, in-range latitude/longitude pair from a request query.
 *
 * Number(null) and Number('') both produce zero, so callers must distinguish
 * absent or blank query parameters from the valid coordinate (0, 0).
 */
export function coordinatesFromSearch(
  search: URLSearchParams
): readonly [latitude: number, longitude: number] | undefined {
  const rawLatitude = search.get('lat');
  const rawLongitude = search.get('lng');
  if (rawLatitude == null || rawLongitude == null || !rawLatitude.trim() || !rawLongitude.trim()) {
    return undefined;
  }

  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return undefined;
  }
  return [latitude, longitude];
}
