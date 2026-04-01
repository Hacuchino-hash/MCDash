import { describe, it, expect } from "vitest";
import { haversine } from "../../../src/utils/haversine.js";

describe("haversine", () => {
  // Fargo, ND: 46.8772, -96.7898
  // Moorhead, MN: 46.8738, -96.7678
  it("computes Fargo to Moorhead as approximately 1.6 km", () => {
    const distance = haversine(46.8772, -96.7898, 46.8738, -96.7678);
    expect(distance).toBeGreaterThan(1.4);
    expect(distance).toBeLessThan(2.0);
  });

  // Fargo, ND: 46.8772, -96.7898
  // Bismarck, ND: 46.8083, -100.7837
  it("computes Fargo to Bismarck as approximately 300 km", () => {
    const distance = haversine(46.8772, -96.7898, 46.8083, -100.7837);
    expect(distance).toBeGreaterThan(280);
    expect(distance).toBeLessThan(320);
  });

  it("converts to miles with unit='mi'", () => {
    const km = haversine(46.8772, -96.7898, 46.8083, -100.7837, "km");
    const mi = haversine(46.8772, -96.7898, 46.8083, -100.7837, "mi");
    // 1 km ~ 0.621371 mi
    expect(mi).toBeCloseTo(km * 0.621371, 0);
  });

  it("returns null when any coordinate is null", () => {
    expect(haversine(null, -96.7898, 46.8083, -100.7837)).toBeNull();
    expect(haversine(46.8772, null, 46.8083, -100.7837)).toBeNull();
    expect(haversine(46.8772, -96.7898, null, -100.7837)).toBeNull();
    expect(haversine(46.8772, -96.7898, 46.8083, null)).toBeNull();
  });

  it("returns null when any coordinate is undefined", () => {
    expect(haversine(undefined, -96.7898, 46.8083, -100.7837)).toBeNull();
  });

  it("returns 0 for the same point", () => {
    const distance = haversine(46.8772, -96.7898, 46.8772, -96.7898);
    expect(distance).toBe(0);
  });

  it("throws for unsupported unit", () => {
    expect(() =>
      haversine(46.8772, -96.7898, 46.8083, -100.7837, "furlongs"),
    ).toThrow(/Unsupported unit/);
  });
});
