// NodakMesh Dashboard - Health Engine Service
// Composite health score calculation (0-100)

const WEIGHTS = Object.freeze({
  observerAvailability: 0.25,
  packetDeliveryRate: 0.25,
  averageSnr: 0.20,
  nodeChurnRate: 0.15,
  repeaterUptime: 0.15,
});

const STATUS_THRESHOLDS = Object.freeze({
  healthy: 80,
  degraded: 50,
});

const ONE_HOUR_MS = 3_600_000;
const ONE_DAY_MS = 86_400_000;
const DEFAULT_SNR_THRESHOLD = -5;
const VOLUME_HIGH_MULTIPLIER = 2;
const VOLUME_LOW_MULTIPLIER = 0.5;

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function getStatus(score) {
  if (score >= STATUS_THRESHOLDS.healthy) {
    return "healthy";
  }
  if (score >= STATUS_THRESHOLDS.degraded) {
    return "degraded";
  }
  return "unhealthy";
}

function computeObserverAvailability(observerStore) {
  const total = observerStore.getCount();
  if (total === 0) {
    return 100;
  }

  const onlineCount = observerStore.getOnlineCount();
  return clamp(Math.round((onlineCount / total) * 100));
}

function computePacketDeliveryRate(packetStore) {
  const oneHourAgo = new Date(Date.now() - ONE_HOUR_MS).toISOString();
  const recentPackets = packetStore.getPacketsSince(oneHourAgo);

  if (recentPackets.length === 0) {
    return 100;
  }

  const nonFloodTypes = new Set([
    "TRACEROUTE_APP",
    "TEXT_MESSAGE_APP",
    "POSITION_APP",
    "NODEINFO_APP",
    "TELEMETRY_APP",
    "ROUTING_APP",
  ]);

  const directCount = recentPackets.filter(
    (p) => nonFloodTypes.has(p.type),
  ).length;

  return clamp(Math.round((directCount / recentPackets.length) * 100));
}

function computeAverageSnr(packetStore) {
  const oneHourAgo = new Date(Date.now() - ONE_HOUR_MS).toISOString();
  const recentPackets = packetStore.getPacketsSince(oneHourAgo);

  const snrValues = recentPackets
    .filter((p) => p.snr != null && typeof p.snr === "number")
    .map((p) => p.snr);

  if (snrValues.length === 0) {
    return 75;
  }

  const avgSnr = snrValues.reduce((sum, v) => sum + v, 0) / snrValues.length;

  // Normalize SNR to 0-100 scale
  // Typical LoRa SNR range: -20 to +10 dB
  // Map -20 -> 0, +10 -> 100
  return clamp(Math.round(((avgSnr + 20) / 30) * 100));
}

function computeNodeChurnRate(nodeStore) {
  const total = nodeStore.getCount();
  if (total === 0) {
    return 100;
  }

  const activeInLastHour = nodeStore.getActiveCount(ONE_HOUR_MS);
  return clamp(Math.round((activeInLastHour / total) * 100));
}

function computeRepeaterUptime(nodeStore) {
  const repeaters = nodeStore.getRepeaters();
  if (repeaters.length === 0) {
    return 100;
  }

  const oneDayAgo = Date.now() - ONE_DAY_MS;
  const seenRecently = repeaters.filter((r) => {
    if (r.lastSeen == null) {
      return false;
    }
    const seenAt = typeof r.lastSeen === "string"
      ? new Date(r.lastSeen).getTime()
      : r.lastSeen;
    return seenAt >= oneDayAgo;
  });

  return clamp(Math.round((seenRecently.length / repeaters.length) * 100));
}

function buildAlerts(observerStore, packetStore, nodeStore, config) {
  const alerts = [];
  const now = Date.now();
  const snrThreshold = config?.snrThreshold ?? DEFAULT_SNR_THRESHOLD;

  // Check for observers offline > 1 hour
  const allObservers = observerStore.getAll();
  for (const observer of allObservers) {
    if (observer.status !== "online") {
      const lastSeen = observer.lastHeartbeat || observer.lastSeen;
      if (lastSeen != null) {
        const offlineDuration = now - new Date(lastSeen).getTime();
        if (offlineDuration > ONE_HOUR_MS) {
          alerts.push({
            severity: "warning",
            type: "observer_offline",
            message: `Observer "${observer.name || observer.id}" has been offline for ${Math.round(offlineDuration / 60_000)} minutes`,
            observerId: observer.id,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  }

  // Check SNR degradation
  const oneHourAgo = new Date(now - ONE_HOUR_MS).toISOString();
  const recentPackets = packetStore.getPacketsSince(oneHourAgo);
  const snrValues = recentPackets
    .filter((p) => p.snr != null && typeof p.snr === "number")
    .map((p) => p.snr);

  if (snrValues.length > 0) {
    const avgSnr = snrValues.reduce((sum, v) => sum + v, 0) / snrValues.length;
    if (avgSnr < snrThreshold) {
      alerts.push({
        severity: "warning",
        type: "snr_degradation",
        message: `Average SNR (${avgSnr.toFixed(1)} dB) is below threshold (${snrThreshold} dB)`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Check unusual packet volume
  const totalPackets = packetStore.getCount();
  const hourlyRate = recentPackets.length;
  if (totalPackets > 0 && hourlyRate > 0) {
    // Rough estimate of rolling average: total packets / approximate hours of data
    const estimatedHours = Math.max(1, totalPackets / Math.max(1, hourlyRate));
    const rollingAvg = totalPackets / estimatedHours;

    if (hourlyRate > rollingAvg * VOLUME_HIGH_MULTIPLIER) {
      alerts.push({
        severity: "warning",
        type: "high_packet_volume",
        message: `Packet volume (${hourlyRate}/hr) is unusually high (>2x rolling average)`,
        timestamp: new Date().toISOString(),
      });
    } else if (hourlyRate < rollingAvg * VOLUME_LOW_MULTIPLIER && hourlyRate > 0) {
      alerts.push({
        severity: "warning",
        type: "low_packet_volume",
        message: `Packet volume (${hourlyRate}/hr) is unusually low (<0.5x rolling average)`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Check repeater disappearances
  const repeaters = nodeStore.getRepeaters();
  const oneDayAgo = now - ONE_DAY_MS;
  for (const repeater of repeaters) {
    if (repeater.lastSeen != null) {
      const seenAt = typeof repeater.lastSeen === "string"
        ? new Date(repeater.lastSeen).getTime()
        : repeater.lastSeen;
      if (seenAt < oneDayAgo) {
        alerts.push({
          severity: "error",
          type: "repeater_disappeared",
          message: `Repeater "${repeater.name || repeater.id}" not seen in over 24 hours`,
          nodeId: repeater.id,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  return alerts;
}

/**
 * Creates a health engine for computing composite mesh health scores.
 *
 * @param {{ observerStore: object, packetStore: object, nodeStore: object, config?: object }} deps
 * @returns {{ getHealthScore: () => object, getHealthHistory: (days?: number) => Array, getAlerts: () => Array }}
 */
export function createHealthEngine({ observerStore, packetStore, nodeStore, config }) {
  if (observerStore == null) {
    throw new Error("observerStore is required");
  }
  if (packetStore == null) {
    throw new Error("packetStore is required");
  }
  if (nodeStore == null) {
    throw new Error("nodeStore is required");
  }

  function getHealthScore() {
    const components = {
      observerAvailability: computeObserverAvailability(observerStore),
      packetDeliveryRate: computePacketDeliveryRate(packetStore),
      averageSnr: computeAverageSnr(packetStore),
      nodeChurnRate: computeNodeChurnRate(nodeStore),
      repeaterUptime: computeRepeaterUptime(nodeStore),
    };

    const score = Math.round(
      components.observerAvailability * WEIGHTS.observerAvailability +
      components.packetDeliveryRate * WEIGHTS.packetDeliveryRate +
      components.averageSnr * WEIGHTS.averageSnr +
      components.nodeChurnRate * WEIGHTS.nodeChurnRate +
      components.repeaterUptime * WEIGHTS.repeaterUptime,
    );

    return Object.freeze({
      score: clamp(score),
      components: Object.freeze({ ...components }),
      status: getStatus(score),
      timestamp: new Date().toISOString(),
    });
  }

  function getHealthHistory(_days = 7) {
    // Placeholder: future implementation will return stored snapshots
    return [];
  }

  function getAlerts() {
    return buildAlerts(observerStore, packetStore, nodeStore, config);
  }

  return Object.freeze({
    getHealthScore,
    getHealthHistory,
    getAlerts,
  });
}
