import { describe, it, expect } from "vitest";
import { decodePacket } from "../../../src/decoder/index.js";
import packets from "../../fixtures/packets.json" with { type: "json" };

describe("advert packet decoding", () => {
  it("decodes a valid advert packet from fixture", () => {
    const result = decodePacket(packets.advert.hex);

    expect(result.type).toBe("advert");
    expect(result.hops).toBe(1);
    expect(result.hopPath.length).toBe(1);
    expect(result.size).toBeGreaterThan(0);
    expect(result.decodedPayload).toBeDefined();
    expect(result.decodedPayload.publicKey).toBeTruthy();
    expect(result.hash).toHaveLength(16);
  });

  it("handles a truncated packet gracefully", () => {
    const result = decodePacket(packets.malformed.hex);

    expect(result.type).toBe("unknown");
    expect(result.decodedPayload.error).toBeDefined();
  });

  it("never throws on malformed input", () => {
    expect(() => decodePacket("")).not.toThrow();
    expect(() => decodePacket(null)).not.toThrow();
    expect(() => decodePacket("zzzz")).not.toThrow();
  });
});
