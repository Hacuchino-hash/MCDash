/**
 * @param {import('express').Router} router
 */
export default function coverageRoutes(router) {
  router.get("/coverage", (_req, res) => {
    res.json({
      success: true,
      data: {
        regions: [],
        message: "coverage engine not yet implemented",
      },
    });
  });
}
