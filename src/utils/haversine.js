/**
 * Haversine distance calculator for GPS coordinates.
 * @module utils/haversine
 */

const EARTH_RADIUS_KM = 6371;

const UNIT_MULTIPLIERS = Object.freeze({
  km: 1,
  mi: 0.621371,
  nm: 0.539957,
});

/**
 * Convert degrees to radians.
 * @param {number} degrees
 * @returns {number}
 */
const toRadians = (degrees) => (degrees * Math.PI) / 180;

/**
 * Calculate the distance between two GPS coordinates using the Haversine formula.
 *
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @param {string} [unit='km'] - Distance unit: 'km', 'mi', or 'nm'
 * @returns {number|null} Distance rounded to 2 decimal places, or null if any coordinate is null/undefined
 */
export function haversine(lat1, lon1, lat2, lon2, unit = 'km') {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
    return null;
  }

  const multiplier = UNIT_MULTIPLIERS[unit];
  if (multiplier == null) {
    throw new Error(`Unsupported unit: '${unit}'. Use 'km', 'mi', or 'nm'.`);
  }

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distanceKm = EARTH_RADIUS_KM * c;
  const distance = distanceKm * multiplier;

  return Math.round(distance * 100) / 100;
}
