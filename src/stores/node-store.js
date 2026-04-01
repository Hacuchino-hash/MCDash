/**
 * In-memory registry of known mesh nodes.
 * Provides sub-10ms reads for the dashboard API.
 *
 * @returns {object} Node store interface.
 */
export function createNodeStore() {
  let nodes = new Map();

  function freezeNode(node) {
    return Object.freeze({ ...node });
  }

  function upsert(node) {
    if (node == null || typeof node !== "object") {
      throw new Error("node must be a non-null object");
    }

    if (node.id == null) {
      throw new Error("node must have an id property");
    }

    const existing = nodes.get(node.id);
    const merged = existing
      ? { ...existing, ...node, lastSeen: node.lastSeen ?? new Date().toISOString() }
      : { ...node, lastSeen: node.lastSeen ?? new Date().toISOString() };

    const frozen = freezeNode(merged);
    nodes = new Map(nodes);
    nodes.set(frozen.id, frozen);
    return frozen;
  }

  function getById(id) {
    const node = nodes.get(id);
    return node ?? undefined;
  }

  function getAll({ role, limit = 100, offset = 0 } = {}) {
    let items = Array.from(nodes.values());

    if (role != null) {
      items = items.filter((n) => n.role === role);
    }

    return items.slice(offset, offset + limit);
  }

  function getRepeaters() {
    return getAll({ role: "repeater" });
  }

  function getRoomServers() {
    return getAll({ role: "room_server" });
  }

  function getCount() {
    return nodes.size;
  }

  function getActiveCount(withinMs = 3600000) {
    const cutoff = Date.now() - withinMs;
    let active = 0;

    for (const node of nodes.values()) {
      if (node.lastSeen != null) {
        const seenAt = typeof node.lastSeen === "string"
          ? new Date(node.lastSeen).getTime()
          : node.lastSeen;
        if (seenAt >= cutoff) {
          active += 1;
        }
      }
    }

    return active;
  }

  function clear() {
    nodes = new Map();
  }

  return {
    upsert,
    getById,
    getAll,
    getRepeaters,
    getRoomServers,
    getCount,
    getActiveCount,
    clear,
  };
}
