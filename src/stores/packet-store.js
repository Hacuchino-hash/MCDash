/**
 * In-memory ring buffer store for decoded packets.
 * Provides sub-10ms reads for the dashboard API.
 *
 * @param {number} maxSize - Maximum number of packets to hold in the buffer.
 * @returns {object} Packet store interface.
 */
export function createPacketStore(maxSize = 10000) {
  if (!Number.isInteger(maxSize) || maxSize < 1) {
    throw new Error(`maxSize must be a positive integer, got: ${maxSize}`);
  }

  let buffer = new Array(maxSize);
  let head = 0;
  let count = 0;
  let hashIndex = new Map();

  function freezePacket(packet) {
    return Object.freeze({ ...packet });
  }

  function add(packet) {
    if (packet == null || typeof packet !== "object") {
      throw new Error("packet must be a non-null object");
    }

    if (packet.hash == null) {
      throw new Error("packet must have a hash property");
    }

    // Evict the oldest packet if buffer is full
    if (count === maxSize) {
      const evicted = buffer[head];
      if (evicted != null) {
        hashIndex.delete(evicted.hash);
      }
    }

    const frozen = freezePacket(packet);
    buffer[head] = frozen;
    hashIndex.set(frozen.hash, frozen);

    head = (head + 1) % maxSize;
    if (count < maxSize) {
      count += 1;
    }
  }

  function toOrderedArray() {
    if (count === 0) return [];

    const result = new Array(count);
    // Most recent first: walk backwards from head
    for (let i = 0; i < count; i++) {
      const idx = (head - 1 - i + maxSize) % maxSize;
      result[i] = buffer[idx];
    }
    return result;
  }

  function getAll({ type, sourceId, observerId, limit = 50, offset = 0 } = {}) {
    let items = toOrderedArray();

    if (type != null) {
      items = items.filter((p) => p.type === type);
    }
    if (sourceId != null) {
      items = items.filter((p) => p.sourceId === sourceId);
    }
    if (observerId != null) {
      items = items.filter((p) => p.observerId === observerId);
    }

    return items.slice(offset, offset + limit);
  }

  function getByHash(hash) {
    const packet = hashIndex.get(hash);
    return packet ?? undefined;
  }

  function getRecent(n = 10) {
    const ordered = toOrderedArray();
    return ordered.slice(0, n);
  }

  function getCount() {
    return count;
  }

  function getCountByType() {
    const counts = {};
    for (let i = 0; i < count; i++) {
      const idx = (head - 1 - i + maxSize) % maxSize;
      const packet = buffer[idx];
      const type = packet.type ?? "unknown";
      counts[type] = (counts[type] ?? 0) + 1;
    }
    return { ...counts };
  }

  function getPacketsSince(timestamp) {
    const ordered = toOrderedArray();
    return ordered.filter((p) => p.timestamp > timestamp);
  }

  function clear() {
    buffer = new Array(maxSize);
    head = 0;
    count = 0;
    hashIndex = new Map();
  }

  return {
    add,
    getAll,
    getByHash,
    getRecent,
    getCount,
    getCountByType,
    getPacketsSince,
    clear,
  };
}
