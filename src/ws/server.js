import { WebSocketServer } from "ws";

const HEARTBEAT_INTERVAL_MS = 30_000;
const PONG_TIMEOUT_MS = 10_000;
const WS_PATH = "/ws";

const ALLOWED_EVENTS = new Set([
  "packet",
  "node_update",
  "observer_status",
  "health_update",
  "leaderboard_update",
]);

/**
 * Creates a WebSocket server that upgrades on /ws and broadcasts events.
 *
 * @param {import('http').Server} httpServer - The HTTP server to attach to.
 * @returns {{ broadcast, getClientCount, close }}
 */
export function createWebSocketServer(httpServer) {
  if (httpServer == null) {
    throw new Error("httpServer is required");
  }

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url, `http://${request.headers.host}`)
      .pathname;

    if (pathname !== WS_PATH) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws) => {
    ws.isAlive = true;

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("error", () => {
      // Swallow per-client errors to prevent server crash
    });
  });

  const heartbeatTimer = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }

      ws.isAlive = false;
      ws.ping();

      const pongTimer = setTimeout(() => {
        if (!ws.isAlive) {
          ws.terminate();
        }
      }, PONG_TIMEOUT_MS);

      pongTimer.unref();
    }
  }, HEARTBEAT_INTERVAL_MS);

  heartbeatTimer.unref();

  function broadcast(event, data) {
    if (!ALLOWED_EVENTS.has(event)) {
      return;
    }

    const message = JSON.stringify({
      event,
      data,
      timestamp: new Date().toISOString(),
    });

    for (const client of wss.clients) {
      if (client.readyState === 1) {
        client.send(message);
      }
    }
  }

  function getClientCount() {
    return wss.clients.size;
  }

  function close() {
    clearInterval(heartbeatTimer);

    for (const client of wss.clients) {
      client.terminate();
    }

    return new Promise((resolve, reject) => {
      wss.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  return Object.freeze({ broadcast, getClientCount, close });
}
