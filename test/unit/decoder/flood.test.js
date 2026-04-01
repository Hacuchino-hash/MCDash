import { describe, it, expect } from "vitest";
import { decodePacket } from "../../../src/decoder/index.js";
import packets from "../../fixtures/packets.json" with { type: "json" };

describe("group text packet decoding", () => {
  it("decodes a group text packet from fixture", () => {
    const result = decodePacket(packets.group_text.hex);

    expect(result.type).toBe("group_text");
    expect(result.hops).toBe(2);
    expect(result.hopPath).toHaveLength(2);
    expect(result.size).toBeGreaterThan(0);
  });

  it("decodes a transport flood packet with transport codes", () => {
    const result = decodePacket(packets.transport_flood.hex);

    expect(result.transportCodes).toBeDefined();
    expect(result.transportCodes).not.toBeNull();
    expect(result.hops).toBe(1);
  });

  it("returns frozen result", () => {
    const result = decodePacket(packets.group_text.hex);
    expect(Object.isFrozen(result)).toBe(true);
  });
});
