/**
 * Insert or update an observer record.
 * On conflict, updates mutable fields.
 *
 * @param {import("better-sqlite3").Database} db
 * @param {object} observer
 * @returns {object} The upserted observer (read back from DB).
 */
export function upsertObserver(db, observer) {
  const stmt = db.prepare(`
    INSERT INTO observers (
      id, name, firmware_version, iata, status,
      last_heartbeat, packet_count, connected_brokers, metadata
    ) VALUES (
      @id, @name, @firmwareVersion, @iata, @status,
      @lastHeartbeat, @packetCount, @connectedBrokers, @metadata
    )
    ON CONFLICT(id) DO UPDATE SET
      name = COALESCE(excluded.name, observers.name),
      firmware_version = COALESCE(excluded.firmware_version, observers.firmware_version),
      iata = COALESCE(excluded.iata, observers.iata),
      status = excluded.status,
      last_heartbeat = excluded.last_heartbeat,
      packet_count = observers.packet_count + COALESCE(excluded.packet_count, 0),
      connected_brokers = COALESCE(excluded.connected_brokers, observers.connected_brokers),
      metadata = COALESCE(excluded.metadata, observers.metadata)
  `);

  stmt.run({
    id: observer.id,
    name: observer.name ?? null,
    firmwareVersion: observer.firmwareVersion ?? null,
    iata: observer.iata ?? "FAR",
    status: observer.status ?? "offline",
    lastHeartbeat: observer.lastHeartbeat ?? null,
    packetCount: observer.packetCount ?? 0,
    connectedBrokers: observer.connectedBrokers ?? 0,
    metadata: observer.metadata ?? null,
  });

  return getObserverById(db, observer.id);
}

/**
 * Get a single observer by id.
 *
 * @param {import("better-sqlite3").Database} db
 * @param {string} id
 * @returns {object | undefined} The observer row or undefined.
 */
export function getObserverById(db, id) {
  const stmt = db.prepare("SELECT * FROM observers WHERE id = ?");
  const row = stmt.get(id);
  return row ? { ...row } : undefined;
}

/**
 * Get all observers.
 *
 * @param {import("better-sqlite3").Database} db
 * @returns {object[]} Array of observer rows.
 */
export function getAllObservers(db) {
  const stmt = db.prepare("SELECT * FROM observers ORDER BY last_heartbeat DESC");
  const rows = stmt.all();
  return rows.map((row) => ({ ...row }));
}

/**
 * Update an observer's status (online/offline).
 *
 * @param {import("better-sqlite3").Database} db
 * @param {string} id
 * @param {string} status - "online" or "offline".
 * @returns {{ changes: number }} Number of rows affected.
 */
export function updateObserverStatus(db, id, status) {
  const stmt = db.prepare("UPDATE observers SET status = ? WHERE id = ?");
  const info = stmt.run(status, id);
  return { changes: info.changes };
}
