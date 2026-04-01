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

async function fetchFromApi(apiUrl, region, apiKey) {
  const url = `${apiUrl}/api/v1/coverage?region=${encodeURIComponent(region)}`;

  const headers = { "Content-Type": "application/json" };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  const json = await response.json();
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
  const syncIntervalSeconds = coverageConfig.syncIntervalSeconds ?? DEFAULT_SYNC_INTERVAL_SECONDS;
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

      const pointCount = Array.isArray(data.points)
        ? data.points.length
        : Array.isArray(data.data)
          ? data.data.length
          : Array.isArray(data)
            ? data.length
            : 0;

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
