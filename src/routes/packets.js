import { validateQuery } from "../middleware/validate.js";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

/**
 * @param {import('express').Router} router
 * @param {{ packetStore }} deps
 */
export default function packetRoutes(router, { packetStore }) {
  router.get(
    "/packets",
    validateQuery({
      type: { type: "string", required: false },
      sourceId: { type: "string", required: false },
      observerId: { type: "string", required: false },
      limit: { type: "number", required: false },
      offset: { type: "number", required: false },
      since: { type: "string", required: false },
    }),
    (req, res) => {
      const query = req.validatedQuery ?? {};

      const rawLimit = query.limit ?? DEFAULT_LIMIT;
      const limit = Math.min(Math.max(1, rawLimit), MAX_LIMIT);
      const offset = Math.max(0, query.offset ?? 0);

      const filters = {
        type: query.type,
        sourceId: query.sourceId,
        observerId: query.observerId,
        limit,
        offset,
      };

      let packets = packetStore.getAll(filters);

      if (query.since) {
        const sinceDate = new Date(query.since);
        if (Number.isNaN(sinceDate.getTime())) {
          return res.status(400).json({
            success: false,
            error: "Invalid 'since' timestamp",
            data: null,
          });
        }
        packets = packets.filter(
          (p) => new Date(p.receivedAt ?? p.timestamp) >= sinceDate,
        );
      }

      const total = packetStore.getCount();

      res.json({
        success: true,
        data: packets,
        meta: {
          total,
          limit,
          offset,
        },
      });
    },
  );

  router.get("/packets/:hash", (req, res) => {
    const packet = packetStore.getByHash(req.params.hash);

    if (packet == null) {
      return res.status(404).json({
        success: false,
        error: `Packet not found: ${req.params.hash}`,
        data: null,
      });
    }

    res.json({
      success: true,
      data: packet,
    });
  });

  router.post("/packets", (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({
        success: false,
        error: "Packet injection is disabled in production",
        data: null,
      });
    }

    const packet = req.body;

    if (packet == null || typeof packet !== "object" || packet.hash == null) {
      return res.status(400).json({
        success: false,
        error: "Request body must be a JSON object with at least a 'hash' property",
        data: null,
      });
    }

    const stored = packetStore.add(packet);

    res.status(201).json({
      success: true,
      data: stored,
    });
  });
}
