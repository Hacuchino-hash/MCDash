/**
 * @param {import('express').Router} router
 * @param {{ observerStore }} deps
 */
export default function observerRoutes(router, { observerStore }) {
  router.get("/observers", (_req, res) => {
    const observers = observerStore.getAll();

    res.json({
      success: true,
      data: observers,
      meta: { total: observers.length },
    });
  });

  router.get("/observers/:id", (req, res) => {
    const observer = observerStore.getById(req.params.id);

    if (observer == null) {
      return res.status(404).json({
        success: false,
        error: `Observer not found: ${req.params.id}`,
        data: null,
      });
    }

    res.json({
      success: true,
      data: observer,
    });
  });
}
