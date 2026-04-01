import { describe, it, expect } from "vitest";
import { decodePacket } from "../../../src/decoder/index.js";
import packets from "../../fixtures/packets.json" with { type: "json" };

describe("text message (direct) packet decoding", () => {
  it("decodes a text message packet from fixture", () => {
    const result = decodePacket(packets.direct_text.hex);

    expect(result.type).toBe("text_message");
    expect(result.hops).toBe(2);
    expect(result.hopPath).toHaveLength(2);
    expect(result.decodedPayload).toBeDefined();
  });

  it("decodes an ACK packet", () => {
    const result = decodePacket(packets.ack.hex);

    expect(result.type).toBe("ack");
    expect(result.decodedPayload.acknowledged).toBe(true);
  });

  it("decodes a trace packet", () => {
    const result = decodePacket(packets.trace.hex);

    expect(result.type).toBe("trace");
    expect(result.hops).toBe(2);
  });
});
