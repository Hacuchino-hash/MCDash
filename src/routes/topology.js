/**
 * @param {import('express').Router} router
 */
export default function topologyRoutes(router) {
  router.get("/topology", (_req, res) => {
    res.json({
      success: true,
      data: {
        nodes: [],
        edges: [],
        message: "topology engine not yet implemented",
      },
    });
  });
}
