import { createServer } from "node:http";
import { join } from "node:path";
import express from "express";

import { loadConfig } from "./config.js";
import { createDatabase } from "./db/connection.js";
import { runMigrations } from "./db/migrations.js";
import { createPacketStore } from "./stores/packet-store.js";
import { createNodeStore } from "./stores/node-store.js";
import { createObserverStore } from "./stores/observer-store.js";
import { mountRoutes } from "./routes/index.js";
import { createWebSocketServer } from "./ws/server.js";
import { createMqttHandler } from "./mqtt/handler.js";
import { createMqttClient } from "./mqtt/client.js";
import cors from "./middleware/cors.js";
import errorHandler from "./middleware/error-handler.js";

const PROJECT_ROOT = join(import.meta.dirname, "..");
const LOG_PREFIX = "[MCDash]";

function log(message) {
  console.info(`${LOG_PREFIX} ${message}`);
}

function logError(message, err) {
  console.error(`${LOG_PREFIX} ${message}`, err);
}

async function boot() {
  // 1. Load and validate config
  const config = loadConfig();

  // 2. Initialize database
  const dbPath = config.dbPath ?? join(PROJECT_ROOT, "data", "meshcore.db");
  const db = createDatabase(dbPath);

  // 3. Run migrations
  runMigrations(db);

  // 4. Create in-memory stores
  const packetStore = createPacketStore();
  const nodeStore = createNodeStore();
  const observerStore = createObserverStore();

  // 5. Create Express app with middleware
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.static(join(PROJECT_ROOT, "public")));

  // 6. Mount routes
  mountRoutes(app, { packetStore, nodeStore, observerStore, db });

  // Error handler must be last middleware
  app.use(errorHandler);

  // 7. Start HTTP server
  const httpServer = createServer(app);

  await new Promise((resolve, reject) => {
    httpServer.listen(config.port, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });

  // 8. Create WebSocket server
  const wss = createWebSocketServer(httpServer);

  // 9. Create MQTT handler
  const mqttHandler = createMqttHandler({
    packetStore,
    nodeStore,
    observerStore,
    db,
    wsBroadcast: wss.broadcast,
    channelKeys: config.channelKeys ?? {},
  });

  // 10. Create MQTT client and wire events to handler
  const mqttClient = createMqttClient(config);

  mqttClient.on("packet", ({ topic, payload }) => {
    mqttHandler.handlePacket(topic, payload);
  });

  mqttClient.on("status", ({ topic, payload }) => {
    mqttHandler.handleStatus(topic, payload);
  });

  mqttClient.on("connected", ({ label, broker }) => {
    log(`MQTT connected to ${broker} (${label})`);
  });

  mqttClient.on("disconnected", ({ label, broker, reconnectIn }) => {
    log(`MQTT disconnected from ${broker} (${label}), reconnecting in ${reconnectIn}ms`);
  });

  mqttClient.on("error", ({ label, broker, message }) => {
    logError(`MQTT error on ${broker} (${label}): ${message}`);
  });

  // 11. Log startup info
  log(`Server started on port ${config.port}`);
  log(`MQTT connected to ${config.mqtt.broker}`);
  log(`Region: ${config.region}${config.regionName ? ` (${config.regionName})` : ""}`);
  log(`Node.js ${process.version}`);

  return { config, db, httpServer, wss, mqttClient };
}

// --- Graceful shutdown ---

let shuttingDown = false;

function createShutdown(resources) {
  return async () => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    log("Shutting down...");

    try {
      // 1. Close MQTT client
      resources.mqttClient.close();
    } catch (err) {
      logError("Error closing MQTT client:", err);
    }

    try {
      // 2. Close WebSocket server
      await resources.wss.close();
    } catch (err) {
      logError("Error closing WebSocket server:", err);
    }

    try {
      // 3. Close HTTP server
      await new Promise((resolve, reject) => {
        resources.httpServer.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    } catch (err) {
      logError("Error closing HTTP server:", err);
    }

    try {
      // 4. Close database connection
      resources.db.close();
    } catch (err) {
      logError("Error closing database:", err);
    }

    process.exit(0);
  };
}

// --- Global error handlers ---

process.on("unhandledRejection", (reason) => {
  logError("Unhandled rejection:", reason);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  logError("Uncaught exception:", err);
  process.exit(1);
});

// --- Start ---

try {
  const resources = await boot();
  const shutdown = createShutdown(resources);

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
} catch (err) {
  logError("Fatal error during startup:", err);
  process.exit(1);
}
