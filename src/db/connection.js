import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const PROJECT_ROOT = join(import.meta.dirname, "..", "..");
const DEFAULT_DB_PATH = join(PROJECT_ROOT, "data", "meshcore.db");

/**
 * Create and configure a SQLite database connection.
 * Enables WAL mode and foreign keys for performance and integrity.
 *
 * @param {string} [dbPath] - Path to the database file. Defaults to data/meshcore.db.
 * @returns {import("better-sqlite3").Database} Configured database instance.
 */
export function createDatabase(dbPath = DEFAULT_DB_PATH) {
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  return db;
}
