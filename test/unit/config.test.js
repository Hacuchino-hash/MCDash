import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "../../src/config.js";

function createTempConfig(config) {
  const dir = join(tmpdir(), `config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  const configPath = join(dir, "config.json");
  writeFileSync(configPath, JSON.stringify(config));
  return { dir, configPath };
}

const VALID_CONFIG = {
  port: 3000,
  siteName: "Test Dashboard",
  region: "TST",
  regionName: "Test Region",
  mqtt: {
    broker: "mqtt://localhost:1883",
    topic: "meshcore/TST/+/packets",
    statusTopic: "meshcore/TST/+/status",
  },
  channelKeys: {
    public: "abc123",
  },
  coverage: {
    enabled: false,
    apiUrl: "https://example.com",
    apiKey: "",
  },
  defaultMapCenter: [46.8772, -96.7898],
  defaultMapZoom: 10,
};

describe("config loader", () => {
  const savedEnv = {};
  const ENV_KEYS = [
    "PORT",
    "DB_PATH",
    "MQTT_BROKER",
    "COVERAGE_API_URL",
    "COVERAGE_API_KEY",
    "NODE_ENV",
  ];

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  it("loads a valid config file", () => {
    const { configPath, dir } = createTempConfig(VALID_CONFIG);
    try {
      const config = loadConfig(configPath);
      expect(config.port).toBe(3000);
      expect(config.region).toBe("TST");
      expect(config.mqtt.broker).toBe("mqtt://localhost:1883");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns a frozen (immutable) config object", () => {
    const { configPath, dir } = createTempConfig(VALID_CONFIG);
    try {
      const config = loadConfig(configPath);
      expect(Object.isFrozen(config)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws when config file is missing", () => {
    expect(() => loadConfig("/nonexistent/config.json")).toThrow(
      /Config file not found/,
    );
  });

  it("throws when config file contains invalid JSON", () => {
    const { dir } = createTempConfig(VALID_CONFIG);
    const badPath = join(dir, "bad.json");
    writeFileSync(badPath, "{ not valid json }");
    try {
      expect(() => loadConfig(badPath)).toThrow(/invalid JSON/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws when required fields are missing", () => {
    const { configPath, dir } = createTempConfig({ siteName: "No port or mqtt" });
    try {
      expect(() => loadConfig(configPath)).toThrow(/Missing required fields/);
      expect(() => loadConfig(configPath)).toThrow(/port/);
      expect(() => loadConfig(configPath)).toThrow(/mqtt\.broker/);
      expect(() => loadConfig(configPath)).toThrow(/region/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("applies PORT env override", () => {
    process.env.PORT = "8080";
    const { configPath, dir } = createTempConfig(VALID_CONFIG);
    try {
      const config = loadConfig(configPath);
      expect(config.port).toBe(8080);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("applies MQTT_BROKER env override", () => {
    process.env.MQTT_BROKER = "mqtt://remote:1883";
    const { configPath, dir } = createTempConfig(VALID_CONFIG);
    try {
      const config = loadConfig(configPath);
      expect(config.mqtt.broker).toBe("mqtt://remote:1883");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("applies COVERAGE_API_URL and COVERAGE_API_KEY env overrides", () => {
    process.env.COVERAGE_API_URL = "https://override.example.com";
    process.env.COVERAGE_API_KEY = "secret-key";
    const { configPath, dir } = createTempConfig(VALID_CONFIG);
    try {
      const config = loadConfig(configPath);
      expect(config.coverage.apiUrl).toBe("https://override.example.com");
      expect(config.coverage.apiKey).toBe("secret-key");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("applies DB_PATH and NODE_ENV env overrides", () => {
    process.env.DB_PATH = "/tmp/test.db";
    process.env.NODE_ENV = "production";
    const { configPath, dir } = createTempConfig(VALID_CONFIG);
    try {
      const config = loadConfig(configPath);
      expect(config.dbPath).toBe("/tmp/test.db");
      expect(config.nodeEnv).toBe("production");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("preserves existing config values when no env overrides set", () => {
    const { configPath, dir } = createTempConfig(VALID_CONFIG);
    try {
      const config = loadConfig(configPath);
      expect(config.siteName).toBe("Test Dashboard");
      expect(config.mqtt.topic).toBe("meshcore/TST/+/packets");
      expect(config.coverage.enabled).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
