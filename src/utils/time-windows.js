/**
 * Time window helpers for leaderboard and analytics queries.
 * @module utils/time-windows
 */

/** Supported time window identifiers. */
export const TIME_WINDOWS = Object.freeze(['24h', '7d', '30d', 'all']);

/** Duration of each window in milliseconds (except 'all'). */
const WINDOW_DURATIONS_MS = Object.freeze({
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
});

/**
 * Get the start Date for a given time window.
 *
 * @param {string} window - One of '24h', '7d', '30d', 'all'
 * @returns {Date|null} Start date for the window, or null for 'all'
 * @throws {Error} If the window string is not recognized
 */
export function getWindowStart(window) {
  if (!TIME_WINDOWS.includes(window)) {
    throw new Error(
      `Invalid window: '${window}'. Use one of: ${TIME_WINDOWS.join(', ')}`,
    );
  }

  if (window === 'all') {
    return null;
  }

  const durationMs = WINDOW_DURATIONS_MS[window];
  return new Date(Date.now() - durationMs);
}

/**
 * Check whether a timestamp falls within the given time window.
 *
 * @param {number|Date} timestamp - Timestamp (ms since epoch) or Date object
 * @param {string} window - One of '24h', '7d', '30d', 'all'
 * @returns {boolean} True if the timestamp is within the window
 */
export function isWithinWindow(timestamp, window) {
  if (window === 'all') {
    return true;
  }

  const start = getWindowStart(window);
  const time = timestamp instanceof Date ? timestamp.getTime() : timestamp;

  return time >= start.getTime();
}

/**
 * Format a duration in milliseconds into a human-readable string.
 *
 * Examples: "45s", "2h 15m", "3d 12h"
 *
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Human-readable duration
 */
export function formatDuration(ms) {
  if (ms < 0) {
    return '0s';
  }

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const remainingHours = hours % 24;
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;

  const parts = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (remainingHours > 0) {
    parts.push(`${remainingHours}h`);
  }
  if (remainingMinutes > 0 && days === 0) {
    parts.push(`${remainingMinutes}m`);
  }
  if (remainingSeconds > 0 && hours === 0 && days === 0) {
    parts.push(`${remainingSeconds}s`);
  }

  return parts.length > 0 ? parts.join(' ') : '0s';
}
