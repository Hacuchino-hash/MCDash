import { validateQuery } from "../middleware/validate.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * @param {import('express').Router} router
 * @param {{ nodeStore }} deps
 */
export default function nodeRoutes(router, { nodeStore }) {
  router.get(
    "/nodes",
    validateQuery({
      role: { type: "string", required: false },
      limit: { type: "number", required: false },
      offset: { type: "number", required: false },
    }),
    (req, res) => {
      const query = req.validatedQuery ?? {};
      const limit = Math.min(Math.max(1, query.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
      const offset = Math.max(0, query.offset ?? 0);

      const nodes = nodeStore.getAll({ role: query.role, limit, offset });
      const total = nodeStore.getCount();

      res.json({
        success: true,
        data: nodes,
        meta: { total, limit, offset },
      });
    },
  );

  router.get("/nodes/:id", (req, res) => {
    const node = nodeStore.getById(req.params.id);

    if (node == null) {
      return res.status(404).json({
        success: false,
        error: `Node not found: ${req.params.id}`,
        data: null,
      });
    }

    res.json({
      success: true,
      data: node,
    });
  });

  router.get("/nodes/:id/analytics", (req, res) => {
    const node = nodeStore.getById(req.params.id);

    if (node == null) {
      return res.status(404).json({
        success: false,
        error: `Node not found: ${req.params.id}`,
        data: null,
      });
    }

    res.json({
      success: true,
      data: {
        nodeId: req.params.id,
        message: "analytics engine not yet implemented",
      },
    });
  });

  router.get("/nodes/:id/peers", (req, res) => {
    const node = nodeStore.getById(req.params.id);

    if (node == null) {
      return res.status(404).json({
        success: false,
        error: `Node not found: ${req.params.id}`,
        data: null,
      });
    }

    res.json({
      success: true,
      data: {
        nodeId: req.params.id,
        peers: [],
        message: "peer discovery not yet implemented",
      },
    });
  });
}
