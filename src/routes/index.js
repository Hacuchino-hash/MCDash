import { Router } from "express";
import healthRoutes from "./health.js";
import statsRoutes from "./stats.js";
import packetRoutes from "./packets.js";
import nodeRoutes from "./nodes.js";
import repeaterRoutes from "./repeaters.js";
import observerRoutes from "./observers.js";
import channelRoutes from "./channels.js";
import traceRoutes from "./traces.js";
import leaderboardRoutes from "./leaderboards.js";
import coverageRoutes from "./coverage.js";
import topologyRoutes from "./topology.js";

/**
 * Mounts all API route groups under /api prefix.
 *
 * @param {import('express').Application} app
 * @param {{ packetStore, nodeStore, observerStore, db, healthEngine?, topologyService?, leaderboardEngine?, coverageSync? }} deps
 */
export function mountRoutes(app, deps) {
  if (app == null) {
    throw new Error("Express app is required");
  }

  if (deps == null || typeof deps !== "object") {
    throw new Error("deps object is required");
  }

  const router = Router();

  healthRoutes(router, deps);
  statsRoutes(router, deps);
  packetRoutes(router, deps);
  nodeRoutes(router, deps);
  repeaterRoutes(router, deps);
  observerRoutes(router, deps);
  channelRoutes(router, deps);
  traceRoutes(router, deps);
  leaderboardRoutes(router, deps);
  coverageRoutes(router, deps);
  topologyRoutes(router, deps);

  app.use("/api", router);
}
