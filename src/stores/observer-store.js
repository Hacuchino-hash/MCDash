/**
 * In-memory registry of observer nodes.
 * Provides sub-10ms reads for the dashboard API.
 *
 * @returns {object} Observer store interface.
 */
export function createObserverStore() {
  let observers = new Map();

  function freezeObserver(observer) {
    return Object.freeze({ ...observer });
  }

  function upsert(observer) {
    if (observer == null || typeof observer !== "object") {
      throw new Error("observer must be a non-null object");
    }

    if (observer.id == null) {
      throw new Error("observer must have an id property");
    }

    const existing = observers.get(observer.id);
    const merged = existing
      ? { ...existing, ...observer }
      : { ...observer };

    const frozen = freezeObserver(merged);
    observers = new Map(observers);
    observers.set(frozen.id, frozen);
    return frozen;
  }

  function getById(id) {
    const observer = observers.get(id);
    return observer ?? undefined;
  }

  function getAll() {
    return Array.from(observers.values());
  }

  function getOnline() {
    return Array.from(observers.values()).filter((o) => o.status === "online");
  }

  function getOffline() {
    return Array.from(observers.values()).filter((o) => o.status !== "online");
  }

  function updateStatus(id, status) {
    const existing = observers.get(id);
    if (existing == null) {
      throw new Error(`Observer not found: ${id}`);
    }

    const updated = freezeObserver({ ...existing, status });
    observers = new Map(observers);
    observers.set(id, updated);
    return updated;
  }

  function updateHeartbeat(id) {
    const existing = observers.get(id);
    if (existing == null) {
      throw new Error(`Observer not found: ${id}`);
    }

    const updated = freezeObserver({
      ...existing,
      lastHeartbeat: new Date().toISOString(),
    });
    observers = new Map(observers);
    observers.set(id, updated);
    return updated;
  }

  function getCount() {
    return observers.size;
  }

  function getOnlineCount() {
    let online = 0;
    for (const observer of observers.values()) {
      if (observer.status === "online") {
        online += 1;
      }
    }
    return online;
  }

  function clear() {
    observers = new Map();
  }

  return {
    upsert,
    getById,
    getAll,
    getOnline,
    getOffline,
    updateStatus,
    updateHeartbeat,
    getCount,
    getOnlineCount,
    clear,
  };
}
