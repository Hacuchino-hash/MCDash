/**
 * @param {import('express').Router} router
 */
export default function traceRoutes(router) {
  router.get("/traces/:hash", (req, res) => {
    res.json({
      success: true,
      data: {
        hash: req.params.hash,
        hops: [],
        message: "trace engine not yet implemented",
      },
    });
  });
}
