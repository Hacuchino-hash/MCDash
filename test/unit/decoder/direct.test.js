import { describe, it, expect } from "vitest";
import { decodePacket } from "../../../src/decoder/index.js";
import packets from "../../fixtures/packets.json" with { type: "json" };

describe("direct packet decoding", () => {
  it("decodes a valid direct packet from fixture", () => {
    const result = decodePacket(packets.direct.hex);

    expect(result.type).toBe("direct");
    expect(result.sourceId).toBe("cafebabe");
    expect(result.destId).toBe("12345678");
    expect(result.hops).toBe(1);

    expect(result.decodedPayload.payload).toBeTypeOf("string");
    expect(result.decodedPayload.routeLength).toBe(0);
    expect(result.decodedPayload.payload).toContain("Hi!");
  });

  it("handles a direct packet with no message after route", () => {
    // type=0x03, flags=0x00, source=cafebabe, dest=12345678, hops=1,
    // payload: routeLength=2, then 8 bytes of route prefixes, no message
    const hex = "0300cafebabe1234567801020011223344556677";
    const result = decodePacket(hex);

    expect(result.type).toBe("direct");
    expect(result.decodedPayload.routeLength).toBe(2);
    expect(result.decodedPayload.payload).toBe("");
  });
});
