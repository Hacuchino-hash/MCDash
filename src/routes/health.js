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
 * @param {{ nodeStore, observerStore, healthEngine?: object }} deps
 */
export default function healthRoutes(router, { nodeStore, observerStore, healthEngine }) {
  router.get("/health", (_req, res) => {
    const uptime = process.uptime();
    const version = getVersion();

    const meshHealth = {
      totalNodes: nodeStore.getCount(),
      activeNodes: nodeStore.getActiveCount(300_000),
      onlineObservers: observerStore.getOnlineCount(),
      totalObservers: observerStore.getCount(),
    };

    // Use health engine if available, otherwise return basic data
    if (healthEngine != null) {
      const healthScore = healthEngine.getHealthScore();
      const alerts = healthEngine.getAlerts();

      return res.json({
        success: true,
        data: {
          status: healthScore.status,
          score: healthScore.score,
          components: healthScore.components,
          uptime,
          version,
          meshHealth,
          alerts,
          timestamp: healthScore.timestamp,
        },
      });
    }

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

  router.get("/health/history", (_req, res) => {
    if (healthEngine != null) {
      const history = healthEngine.getHealthHistory();
      return res.json({
        success: true,
        data: history,
      });
    }

    res.json({
      success: true,
      data: [],
    });
  });

  router.get("/health/alerts", (_req, res) => {
    if (healthEngine != null) {
      const alerts = healthEngine.getAlerts();
      return res.json({
        success: true,
        data: alerts,
      });
    }

    res.json({
      success: true,
      data: [],
    });
  });
}
