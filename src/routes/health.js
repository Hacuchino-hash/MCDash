import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dirname, "..", "..");
let cachedVersion = null;

function getVersion() {
  if (cachedVersion !== null) {
    return cachedVersion;
  }

  try {
    const pkg = JSON.parse(readFileSync(join(PROJECT_ROOT, "package.json"), "utf-8"));
    cachedVersion = pkg.version ?? "unknown";
  } catch {
    cachedVersion = "unknown";
  }

  return cachedVersion;
}

/**
 * @param {import('express').Router} router
 * @param {{ nodeStore, observerStore }} deps
 */
export default function healthRoutes(router, { nodeStore, observerStore }) {
  router.get("/health", (_req, res) => {
    const uptime = process.uptime();
    const version = getVersion();

    const meshHealth = {
      totalNodes: nodeStore.getCount(),
      activeNodes: nodeStore.getActiveCount(300_000),
      onlineObservers: observerStore.getOnlineCount(),
      totalObservers: observerStore.getCount(),
    };

    res.json({
      success: true,
      data: {
        status: "ok",
        uptime,
        version,
        meshHealth,
      },
    });
  });
}
