/**
 * @param {import('express').Router} router
 */
export default function channelRoutes(router) {
  router.get("/channels", (_req, res) => {
    res.json({
      success: true,
      data: [],
      meta: { total: 0 },
    });
  });

  router.get("/channels/:name/messages", (req, res) => {
    res.json({
      success: true,
      data: {
        channel: req.params.name,
        messages: [],
        message: "channel messaging not yet implemented",
      },
    });
  });
}
