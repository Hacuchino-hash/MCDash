// NodakMesh Dashboard - Coverage Sync Service
// Periodically fetches coverage data from MeshMapper and caches it locally.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const LOG_PREFIX = "[CoverageSync]";
const DEFAULT_SYNC_INTERVAL_SECONDS = 3600;
const DEFAULT_CACHE_FILE = "data/coverage-cache.json";

function log(message) {
  console.info(`${LOG_PREFIX} ${message}`);
}

function logError(message, err) {
  console.error(`${LOG_PREFIX} ${message}`, err);
}

function loadCacheFromFile(cacheFile) {
  try {
    const raw = readFileSync(cacheFile, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCacheToFile(cacheFile, data) {
  try {
    mkdirSync(dirname(cacheFile), { recursive: true });
    writeFileSync(cacheFile, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    logError("Failed to write cache file:", err);
  }
}

function loadCacheFromDb(db, region) {
  try {
    const row = db
      .prepare("SELECT data FROM coverage_cache WHERE region = ?")
      .get(region);

    if (row == null) {
      return null;
    }

    return JSON.parse(row.data);
  } catch {
    return null;
  }
}

function writeCacheToDb(db, region, data) {
  try {
    db.prepare(
      `INSERT OR REPLACE INTO coverage_cache (region, data, fetched_at)
       VALUES (?, ?, datetime('now'))`,
    ).run(region, JSON.stringify(data));
  } catch (err) {
    logError("Failed to write cache to DB:", err);
  }
}

/**
 * Fetch coverage data from MeshMapper API.
 * Endpoint: GET https://meshmapper.net/coverage.php?key=API_KEY
 * Reference: https://wiki.meshmapper.net/coverage-api/
 *
 * Response shape:
 * {
 *   success: boolean,
 *   region: string,
 *   grid_size: { lat, lon },
 *   generated_at: number,
 *   total_squares: number,
 *   grid_squares: [{ grid_id, bounds, coverage_type, fill_color, border_color, snr, timestamp }]
 * }
 */
async function fetchFromApi(apiUrl, region, apiKey) {
  if (!apiKey) {
    throw new Error(
      "MeshMapper API key is required (set coverage.apiKey in config)",
    );
  }

  const url = `${apiUrl}/coverage.php?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });

  if (response.status === 429) {
    throw new Error("MeshMapper API rate limit exceeded");
  }

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  const json = await response.json();

  if (json.success === false) {
    throw new Error(
      json.error || "MeshMapper API returned unsuccessful response",
    );
  }

  return json;
}

/**
 * Creates a coverage sync service for fetching and caching MeshMapper data.
 *
 * @param {object} config - Application config with coverage section.
 * @param {object} db - better-sqlite3 database instance.
 * @returns {{ start: () => void, stop: () => void, sync: () => Promise<object|null>, getCoverage: () => object|null }}
 */
export function createCoverageSync(config, db) {
  if (config == null) {
    throw new Error("config is required");
  }
  if (db == null) {
    throw new Error("db is required");
  }

  const coverageConfig = config.coverage ?? {};
  const apiUrl = coverageConfig.apiUrl ?? "";
  const apiKey = coverageConfig.apiKey ?? "";
  const region = coverageConfig.region ?? config.region ?? "US";
  const syncIntervalSeconds =
    coverageConfig.syncIntervalSeconds ?? DEFAULT_SYNC_INTERVAL_SECONDS;
  const cacheFile = coverageConfig.cacheFile ?? DEFAULT_CACHE_FILE;

  let cachedData = null;
  let intervalId = null;

  // Load initial data from cache sources
  function loadInitialCache() {
    const dbCache = loadCacheFromDb(db, region);
    if (dbCache != null) {
      cachedData = dbCache;
      return;
    }

    const fileCache = loadCacheFromFile(cacheFile);
    if (fileCache != null) {
      cachedData = fileCache;
    }
  }

  async function sync() {
    try {
      const data = await fetchFromApi(apiUrl, region, apiKey);

      if (data == null) {
        log("MeshMapper API returned no data, using cached data");
        return cachedData;
      }

      const pointCount =
        data.total_squares ??
        (Array.isArray(data.grid_squares) ? data.grid_squares.length : 0);

      cachedData = data;

      // Persist to both cache locations
      writeCacheToDb(db, region, data);
      writeCacheToFile(cacheFile, data);

      log(`Synced ${pointCount} coverage points from MeshMapper`);
      return cachedData;
    } catch (err) {
      log("MeshMapper API unavailable, using cached data");
      logError("Fetch error:", err);
      return cachedData;
    }
  }

  function getCoverage() {
    return cachedData;
  }

  function start() {
    loadInitialCache();

    // Perform initial sync
    sync().catch((err) => {
      logError("Initial sync failed:", err);
    });

    intervalId = setInterval(() => {
      sync().catch((err) => {
        logError("Periodic sync failed:", err);
      });
    }, syncIntervalSeconds * 1000);

    log(`Started with ${syncIntervalSeconds}s interval for region '${region}'`);
  }

  function stop() {
    if (intervalId != null) {
      clearInterval(intervalId);
      intervalId = null;
      log("Stopped");
    }
  }

  return Object.freeze({
    start,
    stop,
    sync,
    getCoverage,
  });
}
