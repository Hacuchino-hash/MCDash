/**
 * @param {import('express').Router} router
 */
export default function leaderboardRoutes(router) {
  router.get("/leaderboards/:category", (req, res) => {
    const { category } = req.params;

    res.json({
      success: true,
      data: {
        category,
        data: [],
        message: "leaderboard engine not yet implemented",
      },
    });
  });
}
