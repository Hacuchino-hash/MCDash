/**
 * Insert a decoded packet record into the database.
 *
 * @param {import("better-sqlite3").Database} db
 * @param {object} packet
 * @returns {{ id: number }} The inserted row id.
 */
export function insertPacket(db, packet) {
  const stmt = db.prepare(`
    INSERT INTO packets (
      hash, raw_hex, type, source_id, dest_id,
      observer_id, observer_iata, hops, hop_path,
      snr, rssi, size, channel, decoded_payload, timestamp
    ) VALUES (
      @hash, @rawHex, @type, @sourceId, @destId,
      @observerId, @observerIata, @hops, @hopPath,
      @snr, @rssi, @size, @channel, @decodedPayload, @timestamp
    )
  `);

  const info = stmt.run({
    hash: packet.hash,
    rawHex: packet.rawHex,
    type: packet.type ?? null,
    sourceId: packet.sourceId ?? null,
    destId: packet.destId ?? null,
    observerId: packet.observerId ?? null,
    observerIata: packet.observerIata ?? "FAR",
    hops: packet.hops ?? null,
    hopPath: packet.hopPath ?? null,
    snr: packet.snr ?? null,
    rssi: packet.rssi ?? null,
    size: packet.size ?? null,
    channel: packet.channel ?? null,
    decodedPayload: packet.decodedPayload ?? null,
    timestamp: packet.timestamp ?? null,
  });

  return { id: Number(info.lastInsertRowid) };
}

/**
 * Find a packet by its hash.
 *
 * @param {import("better-sqlite3").Database} db
 * @param {string} hash
 * @returns {object | undefined} The packet row or undefined.
 */
export function getPacketByHash(db, hash) {
  const stmt = db.prepare("SELECT * FROM packets WHERE hash = ?");
  const row = stmt.get(hash);
  return row ? { ...row } : undefined;
}

/**
 * Query packets with optional filters and pagination.
 *
 * @param {import("better-sqlite3").Database} db
 * @param {object} [options]
 * @param {string} [options.type] - Filter by packet type.
 * @param {string} [options.sourceId] - Filter by source node id.
 * @param {string} [options.observerId] - Filter by observer id.
 * @param {number} [options.limit] - Max rows to return (default 100).
 * @param {number} [options.offset] - Rows to skip (default 0).
 * @param {string} [options.since] - ISO timestamp lower bound.
 * @returns {object[]} Array of packet rows.
 */
export function getPackets(db, options = {}) {
  const {
    type,
    sourceId,
    observerId,
    limit = 100,
    offset = 0,
    since,
  } = options;

  const conditions = [];
  const params = {};

  if (type != null) {
    conditions.push("type = @type");
    params.type = type;
  }

  if (sourceId != null) {
    conditions.push("source_id = @sourceId");
    params.sourceId = sourceId;
  }

  if (observerId != null) {
    conditions.push("observer_id = @observerId");
    params.observerId = observerId;
  }

  if (since != null) {
    conditions.push("timestamp >= @since");
    params.since = since;
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT * FROM packets
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT @limit OFFSET @offset
  `;

  params.limit = limit;
  params.offset = offset;

  const stmt = db.prepare(sql);
  const rows = stmt.all(params);

  return rows.map((row) => ({ ...row }));
}
