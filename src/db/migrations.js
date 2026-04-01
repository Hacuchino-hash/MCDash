const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS packets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hash TEXT NOT NULL,
  raw_hex TEXT NOT NULL,
  type TEXT,
  source_id TEXT,
  dest_id TEXT,
  observer_id TEXT,
  observer_iata TEXT DEFAULT 'FAR',
  hops INTEGER,
  hop_path TEXT,
  snr REAL,
  rssi INTEGER,
  size INTEGER,
  channel TEXT,
  decoded_payload TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  name TEXT,
  role TEXT,
  latitude REAL,
  longitude REAL,
  firmware_version TEXT,
  first_seen DATETIME,
  last_seen DATETIME,
  packet_count INTEGER DEFAULT 0,
  avg_snr REAL,
  metadata TEXT
);

CREATE TABLE IF NOT EXISTS observers (
  id TEXT PRIMARY KEY,
  name TEXT,
  firmware_version TEXT,
  iata TEXT DEFAULT 'FAR',
  status TEXT DEFAULT 'offline',
  last_heartbeat DATETIME,
  packet_count INTEGER DEFAULT 0,
  connected_brokers INTEGER DEFAULT 0,
  metadata TEXT
);

CREATE TABLE IF NOT EXISTS leaderboard_cache (
  category TEXT NOT NULL,
  time_window TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (category, time_window)
);

CREATE TABLE IF NOT EXISTS coverage_cache (
  region TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_packets_timestamp ON packets(timestamp);
CREATE INDEX IF NOT EXISTS idx_packets_hash ON packets(hash);
CREATE INDEX IF NOT EXISTS idx_packets_type ON packets(type);
CREATE INDEX IF NOT EXISTS idx_packets_source ON packets(source_id);
CREATE INDEX IF NOT EXISTS idx_packets_observer ON packets(observer_id);
CREATE INDEX IF NOT EXISTS idx_nodes_role ON nodes(role);
CREATE INDEX IF NOT EXISTS idx_nodes_last_seen ON nodes(last_seen);
`;

/**
 * Run all schema migrations on the given database.
 * Safe to call multiple times — uses CREATE IF NOT EXISTS.
 *
 * @param {import("better-sqlite3").Database} db
 */
export function runMigrations(db) {
  db.exec(SCHEMA_SQL);
}
