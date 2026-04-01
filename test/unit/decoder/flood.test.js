import { describe, it, expect } from "vitest";
import { decodePacket } from "../../../src/decoder/index.js";
import packets from "../../fixtures/packets.json" with { type: "json" };

describe("flood packet decoding", () => {
  it("decodes a valid flood packet from fixture", () => {
    const result = decodePacket(packets.flood.hex);

    expect(result.type).toBe("flood");
    expect(result.sourceId).toBe("deadbeef");
    expect(result.destId).toBe("ffffffff");
    expect(result.hops).toBe(5);

    expect(result.decodedPayload.payload).toBeTypeOf("string");
    expect(result.decodedPayload.payload.length).toBeGreaterThan(0);
  });

  it("handles empty payload in a flood packet", () => {
    // Build a flood packet with type=0x02 but payload area is empty
    // Header: 02 00 aabbccdd 11223344 03 (11 bytes, no payload after offset 11)
    const emptyPayloadHex = "0200aabbccdd1122334403";
    const result = decodePacket(emptyPayloadHex);

    expect(result.type).toBe("flood");
    expect(result.decodedPayload.payload).toBe("");
  });
});
