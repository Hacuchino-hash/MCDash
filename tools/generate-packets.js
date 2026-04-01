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
  {
    name: "FAR_Downtown",
    id: "a1b2c3d4",
    lat: 46.8772,
    lng: -96.7898,
    role: 0x01,
  },
  {
    name: "FAR_WestAcres",
    id: "b2c3d4e5",
    lat: 46.858,
    lng: -96.859,
    role: 0x02,
  },
  {
    name: "FAR_Moorhead",
    id: "c3d4e5f6",
    lat: 46.8738,
    lng: -96.7678,
    role: 0x01,
  },
  { name: "FAR_NDSU", id: "d4e5f6a7", lat: 46.895, lng: -96.802, role: 0x03 },
  {
    name: "FAR_Airport",
    id: "e5f6a7b8",
    lat: 46.9207,
    lng: -96.8157,
    role: 0x01,
  },
  {
    name: "FAR_SouthFargo",
    id: "f6a7b8c9",
    lat: 46.835,
    lng: -96.792,
    role: 0x02,
  },
  {
    name: "FAR_NorthFargo",
    id: "a7b8c9d0",
    lat: 46.931,
    lng: -96.784,
    role: 0x03,
  },
  {
    name: "FAR_WestFargo",
    id: "b8c9d0e1",
    lat: 46.877,
    lng: -96.9,
    role: 0x01,
  },
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

// Packet type weights: group_text 40%, advert 25%, text_msg 20%, trace 15%
// Header byte = (version << 6) | (payloadType << 2) | routeType
const PACKET_TYPE_WEIGHTS = Object.freeze([
  { type: "group_text", payloadType: 0x05, routeType: 0x01, cumulative: 0.4 },
  { type: "advert", payloadType: 0x04, routeType: 0x01, cumulative: 0.65 },
  { type: "text_msg", payloadType: 0x02, routeType: 0x02, cumulative: 0.85 },
  { type: "trace", payloadType: 0x09, routeType: 0x01, cumulative: 1.0 },
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
 * Build a MeshCore packet with single-byte header, path, and payload.
 * Wire format: [header:1] [path_len:1] [path:N] [payload:M]
 *
 * Header byte = (version << 6) | (payloadType << 2) | routeType
 * path_len = ((hashSize - 1) << 6) | (hashCount & 63)
 */
function buildPacket(payloadType, routeType, sourceId, destId, payload) {
  const headerByte = (0 << 6) | (payloadType << 2) | routeType;
  const hashSize = 4; // 4 bytes per hop hash
  const hashCount = 2; // source + dest
  const pathLen = ((hashSize - 1) << 6) | (hashCount & 63);

  const srcBytes = hexToBytesSafe(sourceId);
  const dstBytes = hexToBytesSafe(destId);

  return concatBytes(
    new Uint8Array([headerByte, pathLen]),
    srcBytes.slice(0, hashSize),
    dstBytes.slice(0, hashSize),
    payload,
  );
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

  // Advert payload: 32-byte pubkey + 4-byte timestamp + 64-byte signature + appdata
  const pubkey = new Uint8Array(32);
  const srcBytes = hexToBytesSafe(sourceNode.id);
  pubkey.set(srcBytes, 0); // Put node ID at start of pubkey

  const timestamp = new Uint8Array(4);
  const now = Math.floor(Date.now() / 1000);
  timestamp[0] = now & 0xff;
  timestamp[1] = (now >> 8) & 0xff;
  timestamp[2] = (now >> 16) & 0xff;
  timestamp[3] = (now >> 24) & 0xff;

  const signature = new Uint8Array(64); // zeroed placeholder

  // Appdata: flags(1) + lat(4) + lon(4) + features(2) + name
  const flags = new Uint8Array([sourceNode.role]);
  const latBytes = float32ToBytes(sourceNode.lat);
  const lngBytes = float32ToBytes(sourceNode.lng);
  const features = new Uint8Array([0x00, 0x00]);
  const nameBytes = stringToBytes(sourceNode.name);

  const payload = concatBytes(
    pubkey,
    timestamp,
    signature,
    flags,
    latBytes,
    lngBytes,
    features,
    nameBytes,
  );
  return buildPacket(0x04, 0x01, sourceNode.id, destNode.id, payload);
}

function buildGroupTextPacket(sourceNode) {
  const destNode = pickRandom(NODES.filter((n) => n.id !== sourceNode.id));
  const message = pickRandom(FLOOD_MESSAGES);
  const messageBytes = stringToBytes(message);

  return buildPacket(0x05, 0x01, sourceNode.id, destNode.id, messageBytes);
}

function buildTextMsgPacket(sourceNode) {
  const destNode = pickRandom(NODES.filter((n) => n.id !== sourceNode.id));
  const message = stringToBytes("Direct message test");

  return buildPacket(0x02, 0x02, sourceNode.id, destNode.id, message);
}

function buildTracePacket(sourceNode) {
  const destNode = pickRandom(NODES.filter((n) => n.id !== sourceNode.id));
  const isRequest = new Uint8Array([Math.random() > 0.5 ? 0x00 : 0x01]);

  // Trace payload: direction byte + path node prefixes
  const pathNodeCount = randomInt(1, 3);
  const pathParts = [isRequest];
  for (let i = 0; i < pathNodeCount; i++) {
    pathParts.push(hexToBytesSafe(pickRandom(NODES).id));
  }

  const payload = concatBytes(...pathParts);
  return buildPacket(0x09, 0x01, sourceNode.id, destNode.id, payload);
}

const BUILDERS = Object.freeze({
  advert: buildAdvertPacket,
  group_text: buildGroupTextPacket,
  text_msg: buildTextMsgPacket,
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
      reject(
        new Error(
          `Failed to connect to MQTT broker at ${BROKER_URL}: ${err.message}`,
        ),
      );
    });
  });

  console.log(`[Generator] Connected to ${BROKER_URL}`);
  console.log(
    `[Generator] Sending ${TOTAL_COUNT} packets at ${INTERVAL_MS}ms intervals\n`,
  );

  const summary = { advert: 0, group_text: 0, text_msg: 0, trace: 0 };
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
