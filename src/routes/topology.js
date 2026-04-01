/**
 * Topology API routes.
 * Returns network topology data from the topology service.
 *
 * @param {import('express').Router} router
 * @param {{ topologyService?: object }} deps
 */
export default function topologyRoutes(router, { topologyService } = {}) {
  router.get("/topology", (_req, res) => {
    if (topologyService == null) {
      return res.json({
        success: true,
        data: {
          nodes: [],
          links: [],
          message: "topology engine not yet wired",
        },
      });
    }

    try {
      const topology = topologyService.getTopology();

      return res.json({
        success: true,
        data: topology,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: `Failed to compute topology: ${err.message}`,
      });
    }
  });
}
