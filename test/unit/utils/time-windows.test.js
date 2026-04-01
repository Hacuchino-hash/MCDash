import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getWindowStart,
  isWithinWindow,
  formatDuration,
  TIME_WINDOWS,
} from "../../../src/utils/time-windows.js";

describe("getWindowStart", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a Date 24h ago for '24h'", () => {
    const start = getWindowStart("24h");
    const expected = new Date("2026-03-31T12:00:00.000Z");
    expect(start.getTime()).toBe(expected.getTime());
  });

  it("returns a Date 7 days ago for '7d'", () => {
    const start = getWindowStart("7d");
    const expected = new Date("2026-03-25T12:00:00.000Z");
    expect(start.getTime()).toBe(expected.getTime());
  });

  it("returns a Date 30 days ago for '30d'", () => {
    const start = getWindowStart("30d");
    const expected = new Date("2026-03-02T12:00:00.000Z");
    expect(start.getTime()).toBe(expected.getTime());
  });

  it("returns null for 'all'", () => {
    expect(getWindowStart("all")).toBeNull();
  });

  it("throws for an invalid window string", () => {
    expect(() => getWindowStart("1h")).toThrow(/Invalid window/);
  });
});

describe("isWithinWindow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true for 'all' regardless of timestamp", () => {
    expect(isWithinWindow(0, "all")).toBe(true);
    expect(isWithinWindow(Date.now(), "all")).toBe(true);
  });

  it("returns true for a recent timestamp within '24h'", () => {
    const recentMs = Date.now() - 60 * 60 * 1000; // 1 hour ago
    expect(isWithinWindow(recentMs, "24h")).toBe(true);
  });

  it("returns false for an old timestamp outside '24h'", () => {
    const oldMs = Date.now() - 48 * 60 * 60 * 1000; // 2 days ago
    expect(isWithinWindow(oldMs, "24h")).toBe(false);
  });

  it("accepts a Date object as timestamp", () => {
    const recentDate = new Date(Date.now() - 60 * 60 * 1000);
    expect(isWithinWindow(recentDate, "24h")).toBe(true);
  });
});

describe("formatDuration", () => {
  it("formats seconds", () => {
    expect(formatDuration(45_000)).toBe("45s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(135_000)).toBe("2m 15s");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(2 * 3600_000 + 15 * 60_000)).toBe("2h 15m");
  });

  it("formats days and hours", () => {
    expect(formatDuration(3 * 86400_000 + 12 * 3600_000)).toBe("3d 12h");
  });

  it("returns '0s' for zero", () => {
    expect(formatDuration(0)).toBe("0s");
  });

  it("returns '0s' for negative values", () => {
    expect(formatDuration(-1000)).toBe("0s");
  });
});

describe("TIME_WINDOWS", () => {
  it("contains the expected entries", () => {
    expect(TIME_WINDOWS).toEqual(["24h", "7d", "30d", "all"]);
  });

  it("is frozen", () => {
    expect(Object.isFrozen(TIME_WINDOWS)).toBe(true);
  });
});
