import { describe, it, expect } from "vitest";
import { hexToBytes, bytesToHex, hexToAscii } from "../../../src/utils/hex.js";

describe("hexToBytes / bytesToHex roundtrip", () => {
  it("roundtrips a known hex string", () => {
    const original = "deadbeef";
    const bytes = hexToBytes(original);
    const result = bytesToHex(bytes);
    expect(result).toBe(original);
  });

  it("roundtrips an empty hex string", () => {
    const bytes = hexToBytes("");
    expect(bytes.length).toBe(0);
    expect(bytesToHex(bytes)).toBe("");
  });
});

describe("hexToBytes", () => {
  it("pads odd-length hex with leading zero", () => {
    // "f" becomes "0f" which is byte 15
    const bytes = hexToBytes("f");
    expect(bytes.length).toBe(1);
    expect(bytes[0]).toBe(0x0f);
  });

  it("rejects non-hex characters", () => {
    expect(() => hexToBytes("xyz123")).toThrow(/non-hex/i);
  });

  it("rejects non-string input", () => {
    expect(() => hexToBytes(42)).toThrow(/hex string/i);
  });
});

describe("bytesToHex", () => {
  it("throws for non-Uint8Array input", () => {
    expect(() => bytesToHex([0xde, 0xad])).toThrow(/Uint8Array/i);
  });

  it("produces lowercase output", () => {
    const result = bytesToHex(new Uint8Array([0xab, 0xcd]));
    expect(result).toBe("abcd");
  });
});

describe("hexToAscii", () => {
  it("converts printable ASCII bytes to characters", () => {
    // "48656c6c6f" = "Hello"
    const result = hexToAscii("48656c6c6f");
    expect(result).toBe("Hello");
  });

  it("replaces non-printable bytes with '.'", () => {
    // 0x01 is non-printable, 0x41 is 'A'
    const result = hexToAscii("0141");
    expect(result).toBe(".A");
  });

  it("handles a fully non-printable hex string", () => {
    const result = hexToAscii("000102");
    expect(result).toBe("...");
  });
});
