const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;

/**
 * @param {import('express').Router} router
 * @param {{ packetStore, nodeStore, observerStore }} deps
 */
export default function statsRoutes(router, { packetStore, nodeStore, observerStore }) {
  router.get("/stats", (_req, res) => {
    const since = new Date(Date.now() - TWENTY_FOUR_HOURS_MS).toISOString();
    const packets24h = packetStore.getPacketsSince(since);

    const totalNodes = nodeStore.getCount();
    const activeNodes = nodeStore.getActiveCount(FIVE_MINUTES_MS);
    const repeaters = nodeStore.getRepeaters();
    const onlineObservers = observerStore.getOnline();

    const channelSet = new Set();
    for (const pkt of packets24h) {
      if (pkt.channel != null) {
        channelSet.add(pkt.channel);
      }
    }

    const uptimePercent =
      totalNodes > 0
        ? Math.round((activeNodes / totalNodes) * 100 * 100) / 100
        : 0;

    res.json({
      success: true,
      data: {
        totalNodes,
        totalPackets24h: packets24h.length,
        activeObservers: onlineObservers.length,
        activeRepeaters: repeaters.length,
        activeChannels: channelSet.size,
        uptimePercent,
      },
    });
  });
}
