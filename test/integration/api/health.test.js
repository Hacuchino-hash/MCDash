import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer } from "../helpers/test-server.js";

describe("GET /api/health", () => {
  let baseUrl;
  let close;

  beforeAll(async () => {
    const server = await startTestServer();
    baseUrl = server.baseUrl;
    close = server.close;
  });

  afterAll(async () => {
    await close();
  });

  it("returns status ok with JSON envelope", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("ok");
    expect(body.data.uptime).toBeTypeOf("number");
    expect(body.data.version).toBeTypeOf("string");
    expect(body.data.meshHealth).toBeDefined();
    expect(body.data.meshHealth.totalNodes).toBeTypeOf("number");
  });
});
