import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dirname, "..");
const CONFIG_PATH = join(PROJECT_ROOT, "config.json");

const REQUIRED_FIELDS = [
  { path: ["port"], label: "port" },
  { path: ["mqtt", "broker"], label: "mqtt.broker" },
  { path: ["region"], label: "region" },
];

function readConfigFile(configPath) {
  try {
    const raw = readFileSync(configPath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(
        `Config file not found at ${configPath}. Copy config.example.json to config.json and edit it.`,
      );
    }
    if (err instanceof SyntaxError) {
      throw new Error(`Config file contains invalid JSON: ${err.message}`);
    }
    throw new Error(`Failed to read config file: ${err.message}`);
  }
}

function applyEnvOverrides(config) {
  const overrides = {};

  if (process.env.PORT !== undefined) {
    overrides.port = Number(process.env.PORT);
  }

  if (process.env.DB_PATH !== undefined) {
    overrides.dbPath = process.env.DB_PATH;
  }

  if (process.env.NODE_ENV !== undefined) {
    overrides.nodeEnv = process.env.NODE_ENV;
  }

  const mqttOverrides = {};
  if (process.env.MQTT_BROKER !== undefined) {
    mqttOverrides.broker = process.env.MQTT_BROKER;
  }

  const coverageOverrides = {};
  if (process.env.COVERAGE_API_URL !== undefined) {
    coverageOverrides.apiUrl = process.env.COVERAGE_API_URL;
  }
  if (process.env.COVERAGE_API_KEY !== undefined) {
    coverageOverrides.apiKey = process.env.COVERAGE_API_KEY;
  }

  const mqtt =
    Object.keys(mqttOverrides).length > 0
      ? { ...config.mqtt, ...mqttOverrides }
      : config.mqtt;

  const coverage =
    Object.keys(coverageOverrides).length > 0
      ? { ...config.coverage, ...coverageOverrides }
      : config.coverage;

  return {
    ...config,
    ...overrides,
    mqtt,
    coverage,
  };
}

function getNestedValue(obj, pathSegments) {
  let current = obj;
  for (const segment of pathSegments) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function validateConfig(config) {
  const missing = REQUIRED_FIELDS.filter(
    ({ path }) => getNestedValue(config, path) == null,
  ).map(({ label }) => label);

  if (missing.length > 0) {
    throw new Error(
      `Config validation failed. Missing required fields: ${missing.join(", ")}`,
    );
  }
}

export function loadConfig(configPath = CONFIG_PATH) {
  const fileConfig = readConfigFile(configPath);
  const merged = applyEnvOverrides(fileConfig);
  validateConfig(merged);
  return Object.freeze(merged);
}

let _config = null;

export function getConfig() {
  if (_config === null) {
    _config = loadConfig();
  }
  return _config;
}
