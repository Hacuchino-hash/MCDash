#!/usr/bin/env node

/**
 * Generate synthetic MeshCore packets and publish to a local MQTT broker.
 *
 * Usage:
 *   node tools/generate-packets.js
 *   node tools/generate-packets.js --count 50 --interval 200 --broker mqtt://localhost:1883
 *
 * @module tools/generate-packets
 */

import mqtt from "mqtt";
import { parseArgs } from "node:util";
import { bytesToHex } from "../src/utils/hex.js";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const { values: cliArgs } = parseArgs({
  options: {
    count: { type: "string", default: "100" },
    interval: { type: "string", default: "500" },
    broker: { type: "string", default: "mqtt://localhost:1883" },
  },
  strict: false,
});

const TOTAL_COUNT = Math.max(1, parseInt(cliArgs.count, 10) || 100);
const INTERVAL_MS = Math.max(10, parseInt(cliArgs.interval, 10) || 500);
const BROKER_URL = cliArgs.broker;

// ---------------------------------------------------------------------------
// Fake node definitions — Fargo, ND area (~46.87 N, ~96.79 W)
// ---------------------------------------------------------------------------

const NODES = Object.freeze([
  { name: "FAR_Downtown", id: "a1b2c3d4", lat: 46.8772, lng: -96.7898, role: 0x01 },
  { name: "FAR_WestAcres", id: "b2c3d4e5", lat: 46.8580, lng: -96.8590, role: 0x02 },
  { name: "FAR_Moorhead", id: "c3d4e5f6", lat: 46.8738, lng: -96.7678, role: 0x01 },
  { name: "FAR_NDSU", id: "d4e5f6a7", lat: 46.8950, lng: -96.8020, role: 0x03 },
  { name: "FAR_Airport", id: "e5f6a7b8", lat: 46.9207, lng: -96.8157, role: 0x01 },
  { name: "FAR_SouthFargo", id: "f6a7b8c9", lat: 46.8350, lng: -96.7920, role: 0x02 },
  { name: "FAR_NorthFargo", id: "a7b8c9d0", lat: 46.9310, lng: -96.7840, role: 0x03 },
  { name: "FAR_WestFargo", id: "b8c9d0e1", lat: 46.8770, lng: -96.9000, role: 0x01 },
]);

const OBSERVERS = Object.freeze([
  { name: "FAR_Observer1", pubkey: "obs1aabbccdd" },
  { name: "FAR_Observer2", pubkey: "obs2eeff0011" },
]);

const FLOOD_MESSAGES = Object.freeze([
  "Hello from the mesh!",
  "Weather station reporting: 72F, clear skies",
  "Node check-in: all systems nominal",
  "Emergency relay test - please ignore",
  "Mesh traffic report: low congestion",
  "Battery at 85%, solar charging active",
  "Firmware v2.1.3 available for update",
  "Good morning Fargo mesh!",
  "Signal test from downtown repeater",
  "Coverage check: can you hear me?",
]);

// Packet type weights: flood 40%, advert 25%, direct 20%, trace 15%
const PACKET_TYPE_WEIGHTS = Object.freeze([
  { type: "flood", byte: 0x02, cumulative: 0.40 },
  { type: "advert", byte: 0x01, cumulative: 0.65 },
  { type: "direct", byte: 0x03, cumulative: 0.85 },
  { type: "trace", byte: 0x04, cumulative: 1.00 },
]);

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
  for (const entry of PACKET_TYPE_WEIGHTS) {
    if (roll <= entry.cumulative) {
      return entry;
    }
  }
  return PACKET_TYPE_WEIGHTS[PACKET_TYPE_WEIGHTS.length - 1];
}

/**
 * Encode a 32-bit little-endian float into 4 bytes.
 */
function float32ToBytes(value) {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setFloat32(0, value, true);
  return new Uint8Array(buf);
}

/**
 * Encode an ASCII string into bytes (with null terminator).
 */
function stringToBytes(str) {
  const bytes = new Uint8Array(str.length + 1);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  bytes[str.length] = 0x00;
  return bytes;
}

// ---------------------------------------------------------------------------
// Packet builders — produce Uint8Array payloads that our decoder can parse
// ---------------------------------------------------------------------------

/**
 * Build a common MeshCore header (11 bytes).
 * [typeByte, flags, source(4), dest(4), hops]
 */
function buildHeader(typeByte, sourceId, destId, hops) {
  const header = new Uint8Array(11);
  header[0] = typeByte;
  header[1] = 0x00; // flags

  const srcBytes = hexToBytesSafe(sourceId);
  const dstBytes = hexToBytesSafe(destId);

  header.set(srcBytes.slice(0, 4), 2);
  header.set(dstBytes.slice(0, 4), 6);
  header[10] = hops;

  return header;
}

function hexToBytesSafe(hex) {
  const len = hex.length / 2;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function concatBytes(...arrays) {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function buildAdvertPacket(sourceNode) {
  const destNode = pickRandom(NODES.filter((n) => n.id !== sourceNode.id));
  const hops = randomInt(1, 4);

  const header = buildHeader(0x01, sourceNode.id, destNode.id, hops);
  const nameBytes = stringToBytes(sourceNode.name);
  const latBytes = float32ToBytes(sourceNode.lat);
  const lngBytes = float32ToBytes(sourceNode.lng);
  const roleBytes = new Uint8Array([sourceNode.role]);
  const fwBytes = stringToBytes("v2.1.3");

  return concatBytes(header, nameBytes, latBytes, lngBytes, roleBytes, fwBytes);
}

function buildFloodPacket(sourceNode) {
  const destNode = pickRandom(NODES.filter((n) => n.id !== sourceNode.id));
  const hops = randomInt(1, 4);
  const message = pickRandom(FLOOD_MESSAGES);

  const header = buildHeader(0x02, sourceNode.id, destNode.id, hops);
  const messageBytes = stringToBytes(message);

  return concatBytes(header, messageBytes);
}

function buildDirectPacket(sourceNode) {
  const destNode = pickRandom(NODES.filter((n) => n.id !== sourceNode.id));
  const hops = randomInt(1, 3);

  const header = buildHeader(0x03, sourceNode.id, destNode.id, hops);
  const routeLength = new Uint8Array([0]); // no intermediate hops in payload
  const message = stringToBytes("Direct message test");

  return concatBytes(header, routeLength, message);
}

function buildTracePacket(sourceNode) {
  const destNode = pickRandom(NODES.filter((n) => n.id !== sourceNode.id));
  const hops = randomInt(1, 4);

  const header = buildHeader(0x04, sourceNode.id, destNode.id, hops);
  const isRequest = new Uint8Array([Math.random() > 0.5 ? 0x00 : 0x01]);

  // Build a path of 1-3 random node prefixes
  const pathNodeCount = randomInt(1, 3);
  const pathParts = [];
  for (let i = 0; i < pathNodeCount; i++) {
    pathParts.push(hexToBytesSafe(pickRandom(NODES).id));
  }

  return concatBytes(header, isRequest, ...pathParts);
}

const BUILDERS = Object.freeze({
  advert: buildAdvertPacket,
  flood: buildFloodPacket,
  direct: buildDirectPacket,
  trace: buildTracePacket,
});

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const client = mqtt.connect(BROKER_URL);

  await new Promise((resolve, reject) => {
    client.on("connect", resolve);
    client.on("error", (err) => {
      reject(new Error(`Failed to connect to MQTT broker at ${BROKER_URL}: ${err.message}`));
    });
  });

  console.log(`[Generator] Connected to ${BROKER_URL}`);
  console.log(`[Generator] Sending ${TOTAL_COUNT} packets at ${INTERVAL_MS}ms intervals\n`);

  const summary = { advert: 0, flood: 0, direct: 0, trace: 0 };
  let sent = 0;

  for (let i = 0; i < TOTAL_COUNT; i++) {
    const typeEntry = pickWeightedType();
    const sourceNode = pickRandom(NODES);
    const observer = pickRandom(OBSERVERS);
    const topic = `meshcore/FAR/${observer.pubkey}/packets`;

    const builder = BUILDERS[typeEntry.type];
    const packetBytes = builder(sourceNode);
    const hexString = bytesToHex(packetBytes);

    // Publish as raw binary buffer
    client.publish(topic, Buffer.from(packetBytes));

    summary[typeEntry.type] += 1;
    sent += 1;

    console.log(
      `[Generator] Sent ${typeEntry.type} packet from ${sourceNode.name} via ${observer.name} (${hexString.slice(0, 24)}...)`,
    );

    if (i < TOTAL_COUNT - 1) {
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
    }
  }

  // Wait for outgoing messages to flush
  await new Promise((resolve) => setTimeout(resolve, 500));
  client.end();

  console.log("\n[Generator] === Summary ===");
  console.log(`[Generator] Total packets sent: ${sent}`);
  for (const [type, count] of Object.entries(summary)) {
    console.log(`[Generator]   ${type}: ${count}`);
  }
}

main().catch((err) => {
  console.error(`[Generator] Fatal error: ${err.message}`);
  process.exit(1);
});
