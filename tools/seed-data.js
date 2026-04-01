#!/usr/bin/env node

/**
 * Seed the SQLite database with sample data for local development.
 * Bypasses MQTT — inserts directly via the DB layer.
 *
 * Usage:
 *   node tools/seed-data.js
 *
 * @module tools/seed-data
 */

import { createHash, randomBytes } from "node:crypto";
import { createDatabase } from "../src/db/connection.js";
import { runMigrations } from "../src/db/migrations.js";
import { insertPacket } from "../src/db/packets.js";
import { upsertNode } from "../src/db/nodes.js";
import { upsertObserver } from "../src/db/observers.js";

// ---------------------------------------------------------------------------
// Sample data definitions — Fargo, ND area
// ---------------------------------------------------------------------------

const SAMPLE_NODES = Object.freeze([
  { id: "a1b2c3d4", name: "FAR_Downtown", role: "repeater", lat: 46.8772, lng: -96.7898 },
  { id: "b2c3d4e5", name: "FAR_WestAcres", role: "room_server", lat: 46.8580, lng: -96.8590 },
  { id: "c3d4e5f6", name: "FAR_Moorhead", role: "repeater", lat: 46.8738, lng: -96.7678 },
  { id: "d4e5f6a7", name: "FAR_NDSU", role: "companion", lat: 46.8950, lng: -96.8020 },
  { id: "e5f6a7b8", name: "FAR_Airport", role: "repeater", lat: 46.9207, lng: -96.8157 },
  { id: "f6a7b8c9", name: "FAR_SouthFargo", role: "room_server", lat: 46.8350, lng: -96.7920 },
  { id: "a7b8c9d0", name: "FAR_NorthFargo", role: "companion", lat: 46.9310, lng: -96.7840 },
  { id: "b8c9d0e1", name: "FAR_WestFargo", role: "repeater", lat: 46.8770, lng: -96.9000 },
  { id: "c9d0e1f2", name: "FAR_Dilworth", role: "repeater", lat: 46.8780, lng: -96.7030 },
  { id: "d0e1f2a3", name: "FAR_Harwood", role: "companion", lat: 46.9780, lng: -96.8080 },
]);

const SAMPLE_OBSERVERS = Object.freeze([
  { id: "obs1aabbccdd", name: "FAR_Observer1", iata: "FAR", firmware: "v2.1.3" },
  { id: "obs2eeff0011", name: "FAR_Observer2", iata: "FAR", firmware: "v2.1.2" },
  { id: "obs3aabb2233", name: "FAR_Observer3", iata: "FAR", firmware: "v2.1.3" },
]);

const PACKET_TYPES = ["advert", "flood", "direct", "trace"];

// Weighted distribution: flood 40%, advert 25%, direct 20%, trace 15%
const TYPE_WEIGHTS = Object.freeze([
  { type: "flood", cumulative: 0.40 },
  { type: "advert", cumulative: 0.65 },
  { type: "direct", cumulative: 0.85 },
  { type: "trace", cumulative: 1.00 },
]);

const TARGET_PACKET_COUNT = 500;
const DAYS_SPAN = 7;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function pickRandom(array) {
  return array[randomInt(0, array.length - 1)];
}

function pickWeightedType() {
  const roll = Math.random();
  for (const entry of TYPE_WEIGHTS) {
    if (roll <= entry.cumulative) {
      return entry.type;
    }
  }
  return "flood";
}

function generateHash(input) {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function generateRawHex() {
  return randomBytes(randomInt(16, 64)).toString("hex");
}

/**
 * Generate a random ISO timestamp within the last N days.
 */
function randomTimestamp(daysBack) {
  const now = Date.now();
  const earliest = now - daysBack * 24 * 60 * 60 * 1000;
  const ts = randomInt(earliest, now);
  return new Date(ts).toISOString();
}

// ---------------------------------------------------------------------------
// Seed functions
// ---------------------------------------------------------------------------

function seedNodes(db) {
  const now = new Date().toISOString();
  const sevenDaysAgo = new Date(Date.now() - DAYS_SPAN * 24 * 60 * 60 * 1000).toISOString();

  for (const node of SAMPLE_NODES) {
    upsertNode(db, {
      id: node.id,
      name: node.name,
      role: node.role,
      latitude: node.lat,
      longitude: node.lng,
      firmwareVersion: "v2.1.3",
      firstSeen: sevenDaysAgo,
      lastSeen: now,
      packetCount: randomInt(20, 200),
      avgSnr: randomFloat(-5, 12),
      metadata: null,
    });
  }

  console.log(`[Seed] Seeded ${SAMPLE_NODES.length} nodes`);
}

function seedObservers(db) {
  const now = new Date().toISOString();

  for (const obs of SAMPLE_OBSERVERS) {
    upsertObserver(db, {
      id: obs.id,
      name: obs.name,
      firmwareVersion: obs.firmware,
      iata: obs.iata,
      status: "online",
      lastHeartbeat: now,
      packetCount: randomInt(100, 1000),
      connectedBrokers: randomInt(1, 3),
      metadata: null,
    });
  }

  console.log(`[Seed] Seeded ${SAMPLE_OBSERVERS.length} observers`);
}

function seedPackets(db) {
  const typeCounts = { advert: 0, flood: 0, direct: 0, trace: 0 };

  for (let i = 0; i < TARGET_PACKET_COUNT; i++) {
    const type = pickWeightedType();
    const sourceNode = pickRandom(SAMPLE_NODES);
    const destNode = pickRandom(SAMPLE_NODES.filter((n) => n.id !== sourceNode.id));
    const observer = pickRandom(SAMPLE_OBSERVERS);
    const rawHex = generateRawHex();
    const timestamp = randomTimestamp(DAYS_SPAN);

    const snr = randomFloat(-20, 15);
    const rssi = randomInt(-120, -40);
    const hops = randomInt(1, 4);

    let decodedPayload = {};
    if (type === "advert") {
      decodedPayload = {
        name: sourceNode.name,
        latitude: sourceNode.lat,
        longitude: sourceNode.lng,
        role: sourceNode.role,
        firmwareVersion: "v2.1.3",
      };
    } else if (type === "flood") {
      decodedPayload = {
        payload: pickRandom([
          "Hello from the mesh!",
          "Weather: 72F, clear",
          "Node check-in: nominal",
          "Mesh traffic: low",
          "Battery 85%, solar active",
        ]),
        channel: null,
        isGroupMessage: false,
      };
    } else if (type === "direct") {
      decodedPayload = { payload: "Direct message test", routeLength: 0 };
    } else if (type === "trace") {
      decodedPayload = {
        path: [sourceNode.id, destNode.id],
        isRequest: Math.random() > 0.5,
      };
    }

    insertPacket(db, {
      hash: generateHash(`${rawHex}-${i}`),
      rawHex,
      type,
      sourceId: sourceNode.id,
      destId: destNode.id,
      observerId: observer.id,
      observerIata: "FAR",
      hops,
      hopPath: null,
      snr: Math.round(snr * 10) / 10,
      rssi,
      size: rawHex.length / 2,
      channel: null,
      decodedPayload: JSON.stringify(decodedPayload),
      timestamp,
    });

    typeCounts[type] += 1;
  }

  console.log(`[Seed] Seeded ${TARGET_PACKET_COUNT} packets`);
  for (const [type, count] of Object.entries(typeCounts)) {
    console.log(`[Seed]   ${type}: ${count}`);
  }
}

function seedLeaderboardCache(db) {
  const now = new Date().toISOString();

  const categories = ["top_nodes", "most_active", "best_snr"];
  const timeWindows = ["1h", "24h", "7d"];
  let count = 0;

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO leaderboard_cache (category, time_window, data, updated_at)
    VALUES (@category, @timeWindow, @data, @updatedAt)
  `);

  for (const category of categories) {
    for (const timeWindow of timeWindows) {
      const entries = SAMPLE_NODES.slice(0, 5).map((node, idx) => ({
        nodeId: node.id,
        nodeName: node.name,
        value: randomInt(10, 500) - idx * 20,
      }));

      stmt.run({
        category,
        timeWindow,
        data: JSON.stringify(entries),
        updatedAt: now,
      });

      count += 1;
    }
  }

  console.log(`[Seed] Seeded ${count} leaderboard cache entries`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log("[Seed] Initializing database...");
  const db = createDatabase();
  runMigrations(db);

  console.log("[Seed] Seeding data...\n");

  seedNodes(db);
  seedObservers(db);
  seedPackets(db);
  seedLeaderboardCache(db);

  db.close();

  console.log("\n[Seed] Done!");
}

main();
