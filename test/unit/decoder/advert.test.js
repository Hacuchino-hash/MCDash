import { describe, it, expect } from "vitest";
import { decodePacket } from "../../../src/decoder/index.js";
import packets from "../../fixtures/packets.json" with { type: "json" };

describe("advert packet decoding", () => {
  it("decodes a valid advert packet from fixture", () => {
    const result = decodePacket(packets.advert.hex);

    expect(result.type).toBe("advert");
    expect(result.sourceId).toBe("aabbccdd");
    expect(result.destId).toBe("11223344");
    expect(result.hops).toBe(2);
    expect(result.size).toBeGreaterThan(0);

    // Payload contains decoded advert fields
    expect(result.decodedPayload.name).toBe("Node1");
    expect(result.decodedPayload.role).toBe("repeater");
    expect(result.decodedPayload.latitude).toBeTypeOf("number");
    expect(result.decodedPayload.longitude).toBeTypeOf("number");
  });

  it("handles a truncated advert gracefully (malformed fixture)", () => {
    const result = decodePacket(packets.malformed.hex);

    // Should not throw; returns an error/unknown packet
    expect(result).toBeDefined();
    expect(result.type).toBe("unknown");
    expect(result.decodedPayload).toBeDefined();
    expect(result.decodedPayload.error).toBeTypeOf("string");
  });
});
