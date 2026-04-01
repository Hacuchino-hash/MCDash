import express from "express";
import { createPacketStore } from "../../../src/stores/packet-store.js";
import { createNodeStore } from "../../../src/stores/node-store.js";
import { createObserverStore } from "../../../src/stores/observer-store.js";
import { mountRoutes } from "../../../src/routes/index.js";
import errorHandler from "../../../src/middleware/error-handler.js";

/**
 * Create a fully wired Express app with in-memory stores for testing.
 * No real MQTT or SQLite connections are needed.
 *
 * @returns {{ app: import('express').Application, packetStore: object, nodeStore: object, observerStore: object }}
 */
export function createTestApp() {
  const app = express();
  app.use(express.json());

  const packetStore = createPacketStore(1000);
  const nodeStore = createNodeStore();
  const observerStore = createObserverStore();

  const deps = { packetStore, nodeStore, observerStore, db: null };
  mountRoutes(app, deps);
  app.use(errorHandler);

  return { app, packetStore, nodeStore, observerStore };
}

/**
 * Start the test app on an ephemeral port and return the base URL.
 * Call the returned `close` function to shut down the server.
 *
 * @returns {Promise<{ baseUrl: string, close: () => Promise<void>, packetStore: object, nodeStore: object, observerStore: object }>}
 */
export async function startTestServer() {
  const { app, packetStore, nodeStore, observerStore } = createTestApp();

  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const close = () =>
    new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });

  return { baseUrl, close, packetStore, nodeStore, observerStore };
}
