import { validateQuery } from "../middleware/validate.js";

/**
 * @param {import('express').Router} router
 * @param {{ nodeStore }} deps
 */
export default function repeaterRoutes(router, { nodeStore }) {
  router.get(
    "/repeaters",
    validateQuery({
      filter: {
        type: "enum",
        required: false,
        values: ["all", "repeaters", "room_servers", "offline"],
      },
    }),
    (req, res) => {
      const filter = req.validatedQuery?.filter ?? "all";
      let nodes;

      switch (filter) {
        case "repeaters":
          nodes = nodeStore.getRepeaters();
          break;
        case "room_servers":
          nodes = nodeStore.getRoomServers();
          break;
        case "offline": {
          const allRepeaters = nodeStore.getRepeaters();
          const fiveMinutesAgo = new Date(Date.now() - 300_000).toISOString();
          nodes = allRepeaters.filter((n) => n.lastSeen < fiveMinutesAgo);
          break;
        }
        default:
          nodes = [
            ...nodeStore.getRepeaters(),
            ...nodeStore.getRoomServers(),
          ];
          break;
      }

      res.json({
        success: true,
        data: nodes,
        meta: { total: nodes.length },
      });
    },
  );

  router.get("/repeaters/firmware", (_req, res) => {
    res.json({
      success: true,
      data: {
        firmware: [],
        message: "firmware inventory not yet implemented",
      },
    });
  });
}
