import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { startTestServer } from "../helpers/test-server.js";
import fixtureNodes from "../../fixtures/nodes.json" with { type: "json" };

describe("nodes API", () => {
  let baseUrl;
  let close;
  let nodeStore;

  beforeAll(async () => {
    const server = await startTestServer();
    baseUrl = server.baseUrl;
    close = server.close;
    nodeStore = server.nodeStore;
  });

  afterAll(async () => {
    await close();
  });

  beforeEach(() => {
    nodeStore.clear();
  });

  function seedNodes() {
    for (const node of fixtureNodes) {
      nodeStore.upsert(node);
    }
  }

  describe("GET /api/nodes", () => {
    it("returns all nodes", async () => {
      seedNodes();

      const res = await fetch(`${baseUrl}/api/nodes`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(fixtureNodes.length);
    });

    it("filters by role", async () => {
      seedNodes();

      const res = await fetch(`${baseUrl}/api/nodes?role=repeater`);
      const body = await res.json();

      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data.every((n) => n.role === "repeater")).toBe(true);
    });

    it("returns empty array when no nodes match filter", async () => {
      seedNodes();

      const res = await fetch(`${baseUrl}/api/nodes?role=nonexistent_role`);
      const body = await res.json();

      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
    });
  });

  describe("GET /api/nodes/:id", () => {
    it("returns a node by valid id", async () => {
      seedNodes();

      const res = await fetch(`${baseUrl}/api/nodes/node-fargo-01`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe("node-fargo-01");
      expect(body.data.name).toBe("Fargo Repeater Alpha");
    });

    it("returns 404 for an invalid id", async () => {
      const res = await fetch(`${baseUrl}/api/nodes/does-not-exist`);
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.success).toBe(false);
      expect(body.error).toContain("not found");
    });
  });
});
