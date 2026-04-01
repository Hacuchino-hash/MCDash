/**
 * Coverage API routes.
 * Returns coverage data from the coverage sync service.
 *
 * @param {import('express').Router} router
 * @param {{ coverageSync?: object }} deps
 */
export default function coverageRoutes(router, { coverageSync } = {}) {
  router.get("/coverage", (_req, res) => {
    if (coverageSync == null) {
      return res.json({
        success: true,
        data: {
          regions: [],
          message: "coverage engine not yet wired",
        },
      });
    }

    const coverage = coverageSync.getCoverage();

    if (coverage == null) {
      return res.json({
        success: true,
        data: {
          regions: [],
          message: "No coverage data available yet. Data will appear after the next sync.",
        },
      });
    }

    return res.json({
      success: true,
      data: coverage,
    });
  });
}
