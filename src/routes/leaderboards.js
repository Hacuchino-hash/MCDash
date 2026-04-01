/**
 * Leaderboard API routes.
 * Accepts optional leaderboardEngine dependency — falls back to placeholder if absent.
 *
 * @param {import('express').Router} router
 * @param {{ leaderboardEngine?: object }} deps
 */
export default function leaderboardRoutes(router, { leaderboardEngine } = {}) {
  router.get("/leaderboards/:category", (req, res) => {
    const { category } = req.params;
    const timeWindow = req.query.window || "all";

    const validCategories = ["distance", "activity", "fun"];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        error: `Invalid category: '${category}'. Use one of: ${validCategories.join(", ")}`,
      });
    }

    const validWindows = ["24h", "7d", "30d", "all"];
    if (!validWindows.includes(timeWindow)) {
      return res.status(400).json({
        success: false,
        error: `Invalid time window: '${timeWindow}'. Use one of: ${validWindows.join(", ")}`,
      });
    }

    if (leaderboardEngine == null) {
      return res.json({
        success: true,
        data: {
          category,
          timeWindow,
          leaderboards: {},
          message: "leaderboard engine not yet wired",
        },
      });
    }

    try {
      // Try cache first
      const cached = leaderboardEngine.getCachedLeaderboard(category, timeWindow);
      if (cached != null) {
        return res.json({
          success: true,
          data: {
            category,
            timeWindow,
            leaderboards: cached,
            cached: true,
          },
        });
      }

      // Compute fresh
      const leaderboards = leaderboardEngine.getLeaderboard(category, timeWindow);

      return res.json({
        success: true,
        data: {
          category,
          timeWindow,
          leaderboards,
          cached: false,
        },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: `Failed to compute leaderboard: ${err.message}`,
      });
    }
  });
}
