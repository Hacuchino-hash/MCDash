// NodakMesh Dashboard - Leaderboard Engine
// Calculates distance, activity, and fun leaderboards from packet/node data.

import { haversine } from "../utils/haversine.js";
import { TIME_WINDOWS, isWithinWindow } from "../utils/time-windows.js";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const TOP_N = 10;

const CATEGORIES = Object.freeze(["distance", "activity", "fun"]);

// ---- Distance Leaderboards ----

function buildSingleHopEntries(packets, nodeStore, timeWindow) {
  const entries = [];

  for (const packet of packets) {
    if (!isWithinWindow(packet.timestamp, timeWindow)) {
      continue;
    }

    const srcNode = nodeStore.getById(packet.source_id ?? packet.sourceId);
    const dstNode = nodeStore.getById(packet.dest_id ?? packet.destId);

    if (srcNode == null || dstNode == null) {
      continue;
    }
    if (srcNode.latitude == null || dstNode.latitude == null) {
      continue;
    }

    const distanceKm = haversine(
      srcNode.latitude, srcNode.longitude,
      dstNode.latitude, dstNode.longitude,
      "km",
    );
    if (distanceKm == null || distanceKm === 0) {
      continue;
    }

    const distanceMi = haversine(
      srcNode.latitude, srcNode.longitude,
      dstNode.latitude, dstNode.longitude,
      "mi",
    );

    entries.push({
      nodeA: { name: srcNode.name || srcNode.id, id: srcNode.id },
      nodeB: { name: dstNode.name || dstNode.id, id: dstNode.id },
      distanceKm,
      distanceMi,
      date: packet.timestamp,
      snr: packet.snr ?? null,
      type: packet.type,
    });
  }

  return entries;
}

function longestSingleHop(packets, nodeStore, timeWindow) {
  const entries = buildSingleHopEntries(packets, nodeStore, timeWindow);

  return entries
    .sort((a, b) => b.distanceKm - a.distanceKm)
    .slice(0, TOP_N)
    .map((entry, idx) => ({ rank: idx + 1, ...entry }));
}

function longestDirectMessage(packets, nodeStore, timeWindow) {
  const directPackets = packets.filter(
    (p) => p.type === "direct" || p.type === "TEXT_MESSAGE_APP",
  );
  const entries = buildSingleHopEntries(directPackets, nodeStore, timeWindow);

  return entries
    .sort((a, b) => b.distanceKm - a.distanceKm)
    .slice(0, TOP_N)
    .map((entry, idx) => ({ rank: idx + 1, ...entry }));
}

function longestMultiHopPath(packets, nodeStore, timeWindow) {
  const entries = [];

  for (const packet of packets) {
    if (!isWithinWindow(packet.timestamp, timeWindow)) {
      continue;
    }

    const hopPath = parseHopPath(packet.hop_path ?? packet.hopPath);
    if (hopPath.length < 2) {
      continue;
    }

    let totalKm = 0;
    let valid = true;

    for (let i = 0; i < hopPath.length - 1; i++) {
      const nodeA = nodeStore.getById(hopPath[i]);
      const nodeB = nodeStore.getById(hopPath[i + 1]);

      if (nodeA == null || nodeB == null) {
        valid = false;
        break;
      }
      if (nodeA.latitude == null || nodeB.latitude == null) {
        valid = false;
        break;
      }

      const segmentKm = haversine(
        nodeA.latitude, nodeA.longitude,
        nodeB.latitude, nodeB.longitude,
        "km",
      );
      if (segmentKm == null) {
        valid = false;
        break;
      }

      totalKm += segmentKm;
    }

    if (!valid || totalKm === 0) {
      continue;
    }

    const firstNode = nodeStore.getById(hopPath[0]);
    const lastNode = nodeStore.getById(hopPath[hopPath.length - 1]);

    entries.push({
      nodeA: { name: firstNode?.name || hopPath[0], id: hopPath[0] },
      nodeB: { name: lastNode?.name || hopPath[hopPath.length - 1], id: hopPath[hopPath.length - 1] },
      distanceKm: Math.round(totalKm * 100) / 100,
      distanceMi: Math.round(totalKm * 0.621371 * 100) / 100,
      hops: hopPath.length,
      date: packet.timestamp,
      snr: packet.snr ?? null,
    });
  }

  return entries
    .sort((a, b) => b.distanceKm - a.distanceKm)
    .slice(0, TOP_N)
    .map((entry, idx) => ({ rank: idx + 1, ...entry }));
}

function parseHopPath(hopPath) {
  if (hopPath == null) {
    return [];
  }
  if (Array.isArray(hopPath)) {
    return hopPath;
  }
  if (typeof hopPath === "string") {
    try {
      const parsed = JSON.parse(hopPath);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return hopPath.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

// ---- Activity Leaderboards ----

function buildNodePacketCounts(packets, nodeStore, timeWindow) {
  const counts = new Map();

  for (const packet of packets) {
    if (!isWithinWindow(packet.timestamp, timeWindow)) {
      continue;
    }

    const sourceId = packet.source_id ?? packet.sourceId;
    if (sourceId == null) {
      continue;
    }

    const current = counts.get(sourceId) ?? 0;
    counts.set(sourceId, current + 1);
  }

  return counts;
}

function mostActiveRepeater(packets, nodeStore, timeWindow) {
  const counts = buildNodePacketCounts(packets, nodeStore, timeWindow);
  const entries = [];

  for (const [nodeId, packetCount] of counts) {
    const node = nodeStore.getById(nodeId);
    if (node == null || node.role !== "repeater") {
      continue;
    }

    entries.push({
      node: { name: node.name || node.id, id: node.id },
      packetCount,
      role: node.role,
    });
  }

  return entries
    .sort((a, b) => b.packetCount - a.packetCount)
    .slice(0, TOP_N)
    .map((entry, idx) => ({ rank: idx + 1, ...entry }));
}

function mostReliableRepeater(packets, nodeStore, timeWindow) {
  const nodeStats = new Map();

  for (const packet of packets) {
    if (!isWithinWindow(packet.timestamp, timeWindow)) {
      continue;
    }

    const sourceId = packet.source_id ?? packet.sourceId;
    if (sourceId == null) {
      continue;
    }

    const node = nodeStore.getById(sourceId);
    if (node == null || node.role !== "repeater") {
      continue;
    }

    const stats = nodeStats.get(sourceId) ?? { total: 0, reliable: 0 };
    const updatedStats = {
      total: stats.total + 1,
      reliable: stats.reliable + (isReliablePacket(packet) ? 1 : 0),
    };
    nodeStats.set(sourceId, updatedStats);
  }

  const entries = [];

  for (const [nodeId, stats] of nodeStats) {
    if (stats.total === 0) {
      continue;
    }

    const node = nodeStore.getById(nodeId);
    const ratio = Math.round((stats.reliable / stats.total) * 100) / 100;

    entries.push({
      node: { name: node?.name || nodeId, id: nodeId },
      reliabilityRatio: ratio,
      reliableCount: stats.reliable,
      totalCount: stats.total,
      role: "repeater",
    });
  }

  return entries
    .sort((a, b) => b.reliabilityRatio - a.reliabilityRatio)
    .slice(0, TOP_N)
    .map((entry, idx) => ({ rank: idx + 1, ...entry }));
}

function isReliablePacket(packet) {
  const type = packet.type ?? "";
  return type === "ROUTING_APP" || type === "direct" || type.includes("ACK");
}

function bestSnrChampion(packets, nodeStore, timeWindow) {
  const snrByNode = new Map();

  for (const packet of packets) {
    if (!isWithinWindow(packet.timestamp, timeWindow)) {
      continue;
    }
    if (packet.snr == null || typeof packet.snr !== "number") {
      continue;
    }

    const sourceId = packet.source_id ?? packet.sourceId;
    if (sourceId == null) {
      continue;
    }

    const values = snrByNode.get(sourceId) ?? [];
    snrByNode.set(sourceId, [...values, packet.snr]);
  }

  const entries = [];

  for (const [nodeId, snrValues] of snrByNode) {
    const node = nodeStore.getById(nodeId);
    const avgSnr = snrValues.reduce((sum, v) => sum + v, 0) / snrValues.length;

    entries.push({
      node: { name: node?.name || nodeId, id: nodeId },
      avgSnr: Math.round(avgSnr * 100) / 100,
      sampleCount: snrValues.length,
      role: node?.role ?? "unknown",
    });
  }

  return entries
    .sort((a, b) => b.avgSnr - a.avgSnr)
    .slice(0, TOP_N)
    .map((entry, idx) => ({ rank: idx + 1, ...entry }));
}

function mostConnectedNode(packets, nodeStore, timeWindow) {
  const peerSets = new Map();

  for (const packet of packets) {
    if (!isWithinWindow(packet.timestamp, timeWindow)) {
      continue;
    }

    const sourceId = packet.source_id ?? packet.sourceId;
    const destId = packet.dest_id ?? packet.destId;

    if (sourceId != null && destId != null) {
      const srcPeers = peerSets.get(sourceId) ?? new Set();
      const updatedSrcPeers = new Set(srcPeers);
      updatedSrcPeers.add(destId);
      peerSets.set(sourceId, updatedSrcPeers);

      const dstPeers = peerSets.get(destId) ?? new Set();
      const updatedDstPeers = new Set(dstPeers);
      updatedDstPeers.add(sourceId);
      peerSets.set(destId, updatedDstPeers);
    }
  }

  const entries = [];

  for (const [nodeId, peers] of peerSets) {
    const node = nodeStore.getById(nodeId);
    entries.push({
      node: { name: node?.name || nodeId, id: nodeId },
      peerCount: peers.size,
      role: node?.role ?? "unknown",
    });
  }

  return entries
    .sort((a, b) => b.peerCount - a.peerCount)
    .slice(0, TOP_N)
    .map((entry, idx) => ({ rank: idx + 1, ...entry }));
}

function busiestObserver(packets, nodeStore, timeWindow) {
  const counts = new Map();

  for (const packet of packets) {
    if (!isWithinWindow(packet.timestamp, timeWindow)) {
      continue;
    }

    const observerId = packet.observer_id ?? packet.observerId;
    if (observerId == null) {
      continue;
    }

    const current = counts.get(observerId) ?? 0;
    counts.set(observerId, current + 1);
  }

  const entries = [];

  for (const [observerId, packetCount] of counts) {
    entries.push({
      node: { name: observerId, id: observerId },
      packetCount,
      role: "observer",
    });
  }

  return entries
    .sort((a, b) => b.packetCount - a.packetCount)
    .slice(0, TOP_N)
    .map((entry, idx) => ({ rank: idx + 1, ...entry }));
}

// ---- Fun Leaderboards ----

function getHourFromTimestamp(timestamp) {
  try {
    return new Date(timestamp).getHours();
  } catch {
    return -1;
  }
}

function timeRangeLeaderboard(packets, nodeStore, timeWindow, startHour, endHour, label) {
  const counts = new Map();

  for (const packet of packets) {
    if (!isWithinWindow(packet.timestamp, timeWindow)) {
      continue;
    }

    const hour = getHourFromTimestamp(packet.timestamp);
    if (hour < startHour || hour >= endHour) {
      continue;
    }

    const sourceId = packet.source_id ?? packet.sourceId;
    if (sourceId == null) {
      continue;
    }

    const current = counts.get(sourceId) ?? 0;
    counts.set(sourceId, current + 1);
  }

  const entries = [];

  for (const [nodeId, packetCount] of counts) {
    const node = nodeStore.getById(nodeId);
    entries.push({
      node: { name: node?.name || nodeId, id: nodeId },
      packetCount,
      timeRange: label,
      role: node?.role ?? "unknown",
    });
  }

  return entries
    .sort((a, b) => b.packetCount - a.packetCount)
    .slice(0, TOP_N)
    .map((entry, idx) => ({ rank: idx + 1, ...entry }));
}

function nightOwl(packets, nodeStore, timeWindow) {
  return timeRangeLeaderboard(packets, nodeStore, timeWindow, 0, 5, "midnight-5am");
}

function earlyBird(packets, nodeStore, timeWindow) {
  return timeRangeLeaderboard(packets, nodeStore, timeWindow, 5, 8, "5am-8am");
}

function marathonRunner(packets, nodeStore, timeWindow) {
  // Longest continuous activity streak (measured in distinct hours)
  const nodeHours = new Map();

  for (const packet of packets) {
    if (!isWithinWindow(packet.timestamp, timeWindow)) {
      continue;
    }

    const sourceId = packet.source_id ?? packet.sourceId;
    if (sourceId == null) {
      continue;
    }

    const hourKey = toHourKey(packet.timestamp);
    if (hourKey == null) {
      continue;
    }

    const hours = nodeHours.get(sourceId) ?? new Set();
    const updatedHours = new Set(hours);
    updatedHours.add(hourKey);
    nodeHours.set(sourceId, updatedHours);
  }

  const entries = [];

  for (const [nodeId, hours] of nodeHours) {
    const streak = longestConsecutiveStreak(hours);
    if (streak === 0) {
      continue;
    }

    const node = nodeStore.getById(nodeId);
    entries.push({
      node: { name: node?.name || nodeId, id: nodeId },
      streakHours: streak,
      role: node?.role ?? "unknown",
    });
  }

  return entries
    .sort((a, b) => b.streakHours - a.streakHours)
    .slice(0, TOP_N)
    .map((entry, idx) => ({ rank: idx + 1, ...entry }));
}

function toHourKey(timestamp) {
  try {
    const d = new Date(timestamp);
    return Math.floor(d.getTime() / 3_600_000);
  } catch {
    return null;
  }
}

function longestConsecutiveStreak(hourKeys) {
  if (hourKeys.size === 0) {
    return 0;
  }

  const sorted = Array.from(hourKeys).sort((a, b) => a - b);
  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      currentStreak += 1;
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
      }
    } else {
      currentStreak = 1;
    }
  }

  return maxStreak;
}

function newKidOnTheBlock(packets, nodeStore, timeWindow) {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const allNodes = nodeStore.getAll({ limit: 10000 });

  const newNodes = allNodes.filter((node) => {
    if (node.first_seen == null && node.firstSeen == null) {
      return false;
    }
    const firstSeen = new Date(node.first_seen ?? node.firstSeen).getTime();
    return firstSeen >= sevenDaysAgo;
  });

  // Count packets for new nodes
  const counts = buildNodePacketCounts(packets, nodeStore, timeWindow);

  const entries = newNodes.map((node) => ({
    node: { name: node.name || node.id, id: node.id },
    firstSeen: node.first_seen ?? node.firstSeen,
    packetCount: counts.get(node.id) ?? 0,
    role: node.role ?? "unknown",
  }));

  return entries
    .sort((a, b) => b.packetCount - a.packetCount)
    .slice(0, TOP_N)
    .map((entry, idx) => ({ rank: idx + 1, ...entry }));
}

// ---- Leaderboard Builders ----

const DISTANCE_BUILDERS = Object.freeze({
  "Longest Single Hop": longestSingleHop,
  "Longest Multi-Hop Path": longestMultiHopPath,
  "Longest Direct Message": longestDirectMessage,
});

const ACTIVITY_BUILDERS = Object.freeze({
  "Most Active Repeater": mostActiveRepeater,
  "Most Reliable Repeater": mostReliableRepeater,
  "Best SNR Champion": bestSnrChampion,
  "Most Connected Node": mostConnectedNode,
  "Busiest Observer": busiestObserver,
});

const FUN_BUILDERS = Object.freeze({
  "Night Owl": nightOwl,
  "Early Bird": earlyBird,
  "Marathon Runner": marathonRunner,
  "New Kid on the Block": newKidOnTheBlock,
});

const CATEGORY_BUILDERS = Object.freeze({
  distance: DISTANCE_BUILDERS,
  activity: ACTIVITY_BUILDERS,
  fun: FUN_BUILDERS,
});

// ---- Engine Factory ----

/**
 * Creates a leaderboard engine for computing and caching leaderboard data.
 *
 * @param {{ packetStore: object, nodeStore: object, db?: object }} deps
 * @returns {{ getLeaderboard, getCachedLeaderboard, refreshAll }}
 */
export function createLeaderboardEngine({ packetStore, nodeStore, db }) {
  if (packetStore == null) {
    throw new Error("packetStore is required");
  }
  if (nodeStore == null) {
    throw new Error("nodeStore is required");
  }

  function getAllPackets() {
    return packetStore.getAll({ limit: 100000 });
  }

  function getLeaderboard(category, timeWindow) {
    if (!CATEGORIES.includes(category)) {
      throw new Error(
        `Invalid category: '${category}'. Use one of: ${CATEGORIES.join(", ")}`,
      );
    }
    if (!TIME_WINDOWS.includes(timeWindow)) {
      throw new Error(
        `Invalid timeWindow: '${timeWindow}'. Use one of: ${TIME_WINDOWS.join(", ")}`,
      );
    }

    const builders = CATEGORY_BUILDERS[category];
    const packets = getAllPackets();
    const results = {};

    for (const [name, builder] of Object.entries(builders)) {
      results[name] = builder(packets, nodeStore, timeWindow);
    }

    // Cache result if DB is available
    if (db != null) {
      cacheResult(db, category, timeWindow, results);
    }

    return results;
  }

  function getCachedLeaderboard(category, timeWindow) {
    if (db == null) {
      return null;
    }

    try {
      const row = db
        .prepare("SELECT data, updated_at FROM leaderboard_cache WHERE category = ? AND time_window = ?")
        .get(category, timeWindow);

      if (row == null) {
        return null;
      }

      const age = Date.now() - new Date(row.updated_at).getTime();
      if (age > CACHE_TTL_MS) {
        return null;
      }

      return JSON.parse(row.data);
    } catch {
      return null;
    }
  }

  function refreshAll() {
    const results = {};

    for (const category of CATEGORIES) {
      results[category] = {};
      for (const timeWindow of TIME_WINDOWS) {
        results[category][timeWindow] = getLeaderboard(category, timeWindow);
      }
    }

    return results;
  }

  return Object.freeze({
    getLeaderboard,
    getCachedLeaderboard,
    refreshAll,
  });
}

// ---- Cache Helper ----

function cacheResult(db, category, timeWindow, data) {
  try {
    db.prepare(
      `INSERT OR REPLACE INTO leaderboard_cache (category, time_window, data, updated_at)
       VALUES (?, ?, ?, datetime('now'))`,
    ).run(category, timeWindow, JSON.stringify(data));
  } catch {
    // Cache write failure is non-critical; silently skip
  }
}
