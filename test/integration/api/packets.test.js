import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { startTestServer } from "../helpers/test-server.js";

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

describe("packets API", () => {
  let baseUrl;
  let close;
  let packetStore;

  beforeAll(async () => {
    const server = await startTestServer();
    baseUrl = server.baseUrl;
    close = server.close;
    packetStore = server.packetStore;
  });

  afterAll(async () => {
    await close();
  });

  beforeEach(() => {
    packetStore.clear();
  });

  describe("GET /api/packets", () => {
    it("returns a JSON envelope with empty data when no packets exist", async () => {
      const res = await fetch(`${baseUrl}/api/packets`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
      expect(body.meta).toBeDefined();
      expect(body.meta.total).toBe(0);
    });

    it("returns packets with limit and offset pagination", async () => {
      for (let i = 0; i < 10; i++) {
        packetStore.add(makePacket(`pkt-${i}`));
      }

      const res = await fetch(`${baseUrl}/api/packets?limit=3&offset=2`);
      const body = await res.json();

      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(3);
      expect(body.meta.limit).toBe(3);
      expect(body.meta.offset).toBe(2);
      expect(body.meta.total).toBe(10);
    });
  });

  describe("GET /api/packets/:hash", () => {
    it("returns the packet for a valid hash", async () => {
      packetStore.add(makePacket("target-hash"));

      const res = await fetch(`${baseUrl}/api/packets/target-hash`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.hash).toBe("target-hash");
    });

    it("returns 404 for an invalid hash", async () => {
      const res = await fetch(`${baseUrl}/api/packets/nonexistent`);
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.success).toBe(false);
      expect(body.error).toContain("not found");
    });
  });

  describe("POST /api/packets", () => {
    it("injects a packet in dev mode", async () => {
      const pkt = makePacket("injected-1");

      const res = await fetch(`${baseUrl}/api/packets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pkt),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);

      // Verify it was stored
      expect(packetStore.getByHash("injected-1")).toBeDefined();
    });

    it("returns 400 for invalid body", async () => {
      const res = await fetch(`${baseUrl}/api/packets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noHash: true }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
    });
  });
});
