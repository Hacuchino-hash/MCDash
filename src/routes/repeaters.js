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
    const allNodes = nodeStore.getAll({ limit: 10000 });

    const versionMap = new Map();

    for (const node of allNodes) {
      const version = node.firmwareVersion ?? node.firmware_version;
      if (version == null || version === "") {
        continue;
      }

      const existing = versionMap.get(version) ?? { version, count: 0, nodes: [] };
      versionMap.set(version, {
        ...existing,
        count: existing.count + 1,
        nodes: [...existing.nodes, { id: node.id, name: node.name || node.id }],
      });
    }

    const versions = Array.from(versionMap.values()).sort(
      (a, b) => b.count - a.count,
    );

    res.json({
      success: true,
      data: { versions },
    });
  });
}
