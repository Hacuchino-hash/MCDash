/**
 * MQTT message routing and processing.
 * Decodes packets, updates stores, persists to DB, and broadcasts via WebSocket.
 *
 * All dependencies are injected for testability.
 *
 * @module mqtt/handler
 */

import { bytesToHex } from '../utils/hex.js';
import { decodePacket } from '../decoder/index.js';
import { PACKET_TYPES } from '../decoder/constants.js';
import { insertPacket } from '../db/packets.js';
import { upsertNode } from '../db/nodes.js';
import { upsertObserver } from '../db/observers.js';

/**
 * Extract the observer public key from an MQTT topic.
 * Topic format: meshcore/FAR/<PUBKEY>/packets (or /status).
 *
 * @param {string} topic
 * @returns {string | null}
 */
function extractObserverId(topic) {
  if (typeof topic !== 'string') {
    return null;
  }
  const segments = topic.split('/');
  return segments.length >= 3 ? segments[2] : null;
}

/**
 * Extract the IATA code (2nd segment) from an MQTT topic.
 *
 * @param {string} topic
 * @returns {string}
 */
function extractIata(topic) {
  if (typeof topic !== 'string') {
    return 'FAR';
  }
  const segments = topic.split('/');
  return segments.length >= 2 ? segments[1] : 'FAR';
}

/**
 * Safely convert a raw MQTT payload (Buffer) to a hex string.
 *
 * @param {Buffer | Uint8Array} rawPayload
 * @returns {string}
 */
function payloadToHex(rawPayload) {
  const bytes = rawPayload instanceof Uint8Array
    ? rawPayload
    : new Uint8Array(rawPayload);
  return bytesToHex(bytes);
}

/**
 * Safely parse a JSON payload, returning null on failure.
 *
 * @param {Buffer | Uint8Array | string} rawPayload
 * @returns {object | null}
 */
function safeParseJson(rawPayload) {
  try {
    const text = typeof rawPayload === 'string'
      ? rawPayload
      : rawPayload.toString('utf-8');
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Build a node record from an ADVERT decoded packet.
 *
 * @param {Readonly<object>} packet
 * @returns {object}
 */
function nodeFromAdvert(packet) {
  const payload = packet.decodedPayload ?? {};
  return {
    id: packet.sourceId,
    name: payload.name ?? null,
    role: payload.role ?? null,
    latitude: payload.latitude ?? null,
    longitude: payload.longitude ?? null,
    firmwareVersion: payload.firmwareVersion ?? null,
    lastSeen: packet.timestamp,
  };
}

/**
 * Persist a packet to the database (fire-and-forget).
 * Errors are caught and reported via console.error to avoid
 * crashing the pipeline.
 *
 * @param {object} deps
 * @param {Readonly<object>} packet
 */
function persistPacket(deps, packet) {
  try {
    if (deps.db != null) {
      insertPacket(deps.db, packet);
    }
  } catch (err) {
    deps.onError?.('db_insert_packet', err);
  }
}

/**
 * Persist a node to the database (fire-and-forget).
 *
 * @param {object} deps
 * @param {object} node
 */
function persistNode(deps, node) {
  try {
    if (deps.db != null) {
      upsertNode(deps.db, node);
    }
  } catch (err) {
    deps.onError?.('db_upsert_node', err);
  }
}

/**
 * Persist an observer to the database (fire-and-forget).
 *
 * @param {object} deps
 * @param {object} observer
 */
function persistObserver(deps, observer) {
  try {
    if (deps.db != null) {
      upsertObserver(deps.db, observer);
    }
  } catch (err) {
    deps.onError?.('db_upsert_observer', err);
  }
}

/**
 * Create an MQTT message handler with injected dependencies.
 *
 * @param {object} deps
 * @param {object} deps.packetStore - Packet store (add method).
 * @param {object} deps.nodeStore - Node store (upsert method).
 * @param {object} deps.observerStore - Observer store (upsert, updateHeartbeat methods).
 * @param {object} [deps.db] - SQLite database instance (optional).
 * @param {Function} deps.wsBroadcast - WebSocket broadcast function.
 * @param {object} [deps.channelKeys] - Channel decryption keys.
 * @param {Function} [deps.onError] - Error callback (operation, err).
 * @returns {{ handlePacket: Function, handleStatus: Function }}
 */
export function createMqttHandler(deps) {
  if (deps == null || typeof deps !== 'object') {
    throw new Error('deps object is required');
  }

  if (deps.packetStore == null) {
    throw new Error('deps.packetStore is required');
  }

  if (deps.nodeStore == null) {
    throw new Error('deps.nodeStore is required');
  }

  if (deps.observerStore == null) {
    throw new Error('deps.observerStore is required');
  }

  if (typeof deps.wsBroadcast !== 'function') {
    throw new Error('deps.wsBroadcast must be a function');
  }

  const { packetStore, nodeStore, observerStore, wsBroadcast, channelKeys } = deps;

  /**
   * Handle a raw packet message from MQTT.
   *
   * @param {string} topic - MQTT topic the message arrived on.
   * @param {Buffer | Uint8Array} rawPayload - Raw binary payload.
   */
  function handlePacket(topic, rawPayload) {
    if (rawPayload == null || rawPayload.length === 0) {
      return;
    }

    const observerId = extractObserverId(topic);
    const observerIata = extractIata(topic);
    const hexString = payloadToHex(rawPayload);

    const decoded = decodePacket(hexString, {
      observerId,
      observerIata,
      channelKeys: channelKeys ?? {},
    });

    // Add to in-memory store
    packetStore.add(decoded);

    // Persist to database (fire-and-forget)
    persistPacket(deps, decoded);

    // If ADVERT, upsert the source node
    if (decoded.type === PACKET_TYPES.ADVERT && decoded.sourceId != null) {
      const node = nodeFromAdvert(decoded);
      nodeStore.upsert(node);
      persistNode(deps, node);
    }

    // Update observer heartbeat (best-effort)
    if (observerId != null) {
      try {
        observerStore.updateHeartbeat(observerId);
      } catch {
        // Observer may not exist yet; upsert a minimal record
        observerStore.upsert({
          id: observerId,
          iata: observerIata,
          status: 'online',
          lastHeartbeat: new Date().toISOString(),
        });
      }
    }

    // Broadcast to WebSocket clients
    wsBroadcast('packet', decoded);
  }

  /**
   * Handle an observer status message from MQTT.
   *
   * @param {string} topic - MQTT topic the message arrived on.
   * @param {Buffer | Uint8Array | string} rawPayload - JSON status payload.
   */
  function handleStatus(topic, rawPayload) {
    const parsed = safeParseJson(rawPayload);
    if (parsed == null) {
      return;
    }

    const observerId = extractObserverId(topic);
    if (observerId == null) {
      return;
    }

    const observerIata = extractIata(topic);

    const observerData = {
      id: observerId,
      iata: observerIata,
      status: parsed.online === true ? 'online' : 'offline',
      firmwareVersion: parsed.firmware ?? null,
      lastHeartbeat: new Date().toISOString(),
      packetCount: parsed.packetCount ?? 0,
    };

    // Update in-memory store
    observerStore.upsert(observerData);

    // Persist to database (fire-and-forget)
    persistObserver(deps, observerData);

    // Broadcast to WebSocket clients
    wsBroadcast('observer_status', observerData);
  }

  return { handlePacket, handleStatus };
}
