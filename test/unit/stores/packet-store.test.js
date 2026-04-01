import { describe, it, expect } from "vitest";
import { createPacketStore } from "../../../src/stores/packet-store.js";

function makePacket(hash, overrides = {}) {
  return {
    hash,
    type: "flood",
    sourceId: "aabbccdd",
    destId: "11223344",
    hops: 1,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe("createPacketStore", () => {
  it("adds a packet and retrieves it", () => {
    const store = createPacketStore(100);
    const pkt = makePacket("abc123");
    store.add(pkt);

    expect(store.getCount()).toBe(1);
    const retrieved = store.getByHash("abc123");
    expect(retrieved).toBeDefined();
    expect(retrieved.hash).toBe("abc123");
  });

  it("evicts oldest packet when ring buffer is full", () => {
    const store = createPacketStore(3);

    store.add(makePacket("p1"));
    store.add(makePacket("p2"));
    store.add(makePacket("p3"));
    expect(store.getCount()).toBe(3);

    // Adding a 4th should evict p1
    store.add(makePacket("p4"));
    expect(store.getCount()).toBe(3);
    expect(store.getByHash("p1")).toBeUndefined();
    expect(store.getByHash("p4")).toBeDefined();
  });

  it("returns undefined for unknown hash", () => {
    const store = createPacketStore(10);
    expect(store.getByHash("nonexistent")).toBeUndefined();
  });

  it("filters getAll by type", () => {
    const store = createPacketStore(100);
    store.add(makePacket("f1", { type: "flood" }));
    store.add(makePacket("a1", { type: "advert" }));
    store.add(makePacket("f2", { type: "flood" }));

    const floods = store.getAll({ type: "flood" });
    expect(floods).toHaveLength(2);
    expect(floods.every((p) => p.type === "flood")).toBe(true);
  });

  it("filters getAll by sourceId", () => {
    const store = createPacketStore(100);
    store.add(makePacket("x1", { sourceId: "aaa" }));
    store.add(makePacket("x2", { sourceId: "bbb" }));

    const result = store.getAll({ sourceId: "aaa" });
    expect(result).toHaveLength(1);
    expect(result[0].sourceId).toBe("aaa");
  });

  it("supports limit and offset in getAll", () => {
    const store = createPacketStore(100);
    for (let i = 0; i < 10; i++) {
      store.add(makePacket(`item-${i}`));
    }

    const page = store.getAll({ limit: 3, offset: 2 });
    expect(page).toHaveLength(3);
  });

  it("returns the N most recent packets with getRecent", () => {
    const store = createPacketStore(100);
    store.add(makePacket("old"));
    store.add(makePacket("mid"));
    store.add(makePacket("new"));

    const recent = store.getRecent(2);
    expect(recent).toHaveLength(2);
    // Most recent first
    expect(recent[0].hash).toBe("new");
    expect(recent[1].hash).toBe("mid");
  });

  it("counts packets by type", () => {
    const store = createPacketStore(100);
    store.add(makePacket("a1", { type: "advert" }));
    store.add(makePacket("a2", { type: "advert" }));
    store.add(makePacket("f1", { type: "flood" }));

    const counts = store.getCountByType();
    expect(counts.advert).toBe(2);
    expect(counts.flood).toBe(1);
  });

  it("clears all packets", () => {
    const store = createPacketStore(100);
    store.add(makePacket("a"));
    store.add(makePacket("b"));
    expect(store.getCount()).toBe(2);

    store.clear();
    expect(store.getCount()).toBe(0);
    expect(store.getByHash("a")).toBeUndefined();
  });

  it("throws for invalid maxSize", () => {
    expect(() => createPacketStore(0)).toThrow();
    expect(() => createPacketStore(-1)).toThrow();
    expect(() => createPacketStore(1.5)).toThrow();
  });
});
