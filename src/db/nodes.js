/**
 * Insert or update a node record.
 * On conflict, updates last_seen, packet_count, avg_snr, and other mutable fields.
 *
 * @param {import("better-sqlite3").Database} db
 * @param {object} node
 * @returns {object} The upserted node (read back from DB).
 */
export function upsertNode(db, node) {
  const stmt = db.prepare(`
    INSERT INTO nodes (
      id, name, role, latitude, longitude,
      firmware_version, first_seen, last_seen,
      packet_count, avg_snr, metadata
    ) VALUES (
      @id, @name, @role, @latitude, @longitude,
      @firmwareVersion, @firstSeen, @lastSeen,
      @packetCount, @avgSnr, @metadata
    )
    ON CONFLICT(id) DO UPDATE SET
      name = COALESCE(excluded.name, nodes.name),
      role = COALESCE(excluded.role, nodes.role),
      latitude = COALESCE(excluded.latitude, nodes.latitude),
      longitude = COALESCE(excluded.longitude, nodes.longitude),
      firmware_version = COALESCE(excluded.firmware_version, nodes.firmware_version),
      last_seen = excluded.last_seen,
      packet_count = nodes.packet_count + 1,
      avg_snr = COALESCE(excluded.avg_snr, nodes.avg_snr),
      metadata = COALESCE(excluded.metadata, nodes.metadata)
  `);

  stmt.run({
    id: node.id,
    name: node.name ?? null,
    role: node.role ?? null,
    latitude: node.latitude ?? null,
    longitude: node.longitude ?? null,
    firmwareVersion: node.firmwareVersion ?? null,
    firstSeen: node.firstSeen ?? null,
    lastSeen: node.lastSeen ?? null,
    packetCount: node.packetCount ?? 0,
    avgSnr: node.avgSnr ?? null,
    metadata: node.metadata ?? null,
  });

  return getNodeById(db, node.id);
}

/**
 * Get a single node by id.
 *
 * @param {import("better-sqlite3").Database} db
 * @param {string} id
 * @returns {object | undefined} The node row or undefined.
 */
export function getNodeById(db, id) {
  const stmt = db.prepare("SELECT * FROM nodes WHERE id = ?");
  const row = stmt.get(id);
  return row ? { ...row } : undefined;
}

/**
 * Get all nodes with optional filters and pagination.
 *
 * @param {import("better-sqlite3").Database} db
 * @param {object} [options]
 * @param {string} [options.role] - Filter by node role.
 * @param {number} [options.limit] - Max rows (default 100).
 * @param {number} [options.offset] - Rows to skip (default 0).
 * @returns {object[]} Array of node rows.
 */
export function getAllNodes(db, options = {}) {
  const { role, limit = 100, offset = 0 } = options;

  const params = { limit, offset };
  let whereClause = "";

  if (role != null) {
    whereClause = "WHERE role = @role";
    params.role = role;
  }

  const sql = `
    SELECT * FROM nodes
    ${whereClause}
    ORDER BY last_seen DESC
    LIMIT @limit OFFSET @offset
  `;

  const stmt = db.prepare(sql);
  const rows = stmt.all(params);

  return rows.map((row) => ({ ...row }));
}

/**
 * Increment a node's packet_count by 1.
 *
 * @param {import("better-sqlite3").Database} db
 * @param {string} nodeId
 * @returns {{ changes: number }} Number of rows affected.
 */
export function incrementPacketCount(db, nodeId) {
  const stmt = db.prepare(`
    UPDATE nodes SET packet_count = packet_count + 1 WHERE id = ?
  `);
  const info = stmt.run(nodeId);
  return { changes: info.changes };
}
