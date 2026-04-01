/**
 * MeshCore packet decoder — main dispatcher.
 * Converts raw hex packets from MQTT into structured objects.
 *
 * NEVER throws. Always returns a valid, frozen packet object.
 * @module decoder
 */

import { createHash } from 'node:crypto';
import { hexToBytes, bytesToHex } from '../utils/hex.js';
import { PACKET_TYPES, HEADER, TYPE_BYTE_MAP } from './constants.js';
import { decodeAdvert } from './advert.js';
import { decodeFlood } from './flood.js';
import { decodeDirect } from './direct.js';
import { decodeTrace } from './trace.js';
import { decodeChannel } from './channel.js';

/**
 * Generate a short hash (first 16 hex chars of SHA-256) for deduplication.
 *
 * @param {string} rawHex
 * @returns {string}
 */
function generatePacketHash(rawHex) {
  return createHash('sha256').update(rawHex).digest('hex').slice(0, 16);
}

/**
 * Safely read a byte at offset, returning null if out of bounds.
 *
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @returns {number | null}
 */
function safeReadByte(bytes, offset) {
  return offset < bytes.length ? bytes[offset] : null;
}

/**
 * Extract a hex-encoded prefix of the given length from bytes at offset.
 *
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @param {number} length
 * @returns {string | null}
 */
function extractPrefix(bytes, offset, length) {
  if (offset + length > bytes.length) {
    return null;
  }
  return bytesToHex(bytes.slice(offset, offset + length));
}

/**
 * Resolve the packet type string from the raw type byte.
 *
 * @param {number | null} typeByte
 * @returns {string}
 */
function resolvePacketType(typeByte) {
  if (typeByte === null) {
    return PACKET_TYPES.UNKNOWN;
  }
  return TYPE_BYTE_MAP[typeByte] ?? PACKET_TYPES.UNKNOWN;
}

/** Dispatcher map from packet type to decoder function. */
const TYPE_DECODERS = Object.freeze({
  [PACKET_TYPES.ADVERT]: (bytes, offset, _opts) => decodeAdvert(bytes, offset),
  [PACKET_TYPES.FLOOD]: (bytes, offset, _opts) => decodeFlood(bytes, offset),
  [PACKET_TYPES.DIRECT]: (bytes, offset, _opts) => decodeDirect(bytes, offset),
  [PACKET_TYPES.TRACE]: (bytes, offset, _opts) => decodeTrace(bytes, offset),
  [PACKET_TYPES.CHANNEL]: (bytes, offset, opts) =>
    decodeChannel(bytes, offset, opts.channelKeys),
});

/**
 * Build an error packet for malformed or undecodable input.
 *
 * @param {string} rawHex
 * @param {string} errorMessage
 * @param {object} metadata
 * @returns {Readonly<object>}
 */
function buildErrorPacket(rawHex, errorMessage, metadata) {
  return Object.freeze({
    hash: generatePacketHash(rawHex),
    rawHex,
    type: PACKET_TYPES.UNKNOWN,
    sourceId: null,
    destId: null,
    hops: 0,
    hopPath: Object.freeze([]),
    snr: null,
    rssi: null,
    size: 0,
    channel: null,
    decodedPayload: Object.freeze({ error: errorMessage }),
    timestamp: new Date().toISOString(),
    ...metadata,
  });
}

/**
 * Decode a raw hex MeshCore packet into a structured object.
 *
 * @param {string} rawHex - Hex-encoded packet data
 * @param {object} [metadata={}] - Additional context (observer_id, observer_iata, channelKeys, etc.)
 * @returns {Readonly<object>} Decoded packet — never throws
 */
export function decodePacket(rawHex, metadata = {}) {
  // Validate input
  if (typeof rawHex !== 'string' || rawHex.length === 0) {
    return buildErrorPacket(
      rawHex ?? '',
      'Invalid input: expected non-empty hex string',
      metadata,
    );
  }

  let bytes;
  try {
    bytes = hexToBytes(rawHex);
  } catch (err) {
    return buildErrorPacket(rawHex, `Hex decode failed: ${err.message}`, metadata);
  }

  if (bytes.length < HEADER.PAYLOAD_OFFSET) {
    return buildErrorPacket(
      rawHex,
      `Packet too short: ${bytes.length} bytes (minimum ${HEADER.PAYLOAD_OFFSET})`,
      metadata,
    );
  }

  // Extract header fields defensively
  const typeByte = safeReadByte(bytes, HEADER.TYPE_OFFSET);
  const packetType = resolvePacketType(typeByte);
  const sourceId = extractPrefix(bytes, HEADER.SOURCE_OFFSET, HEADER.SOURCE_PREFIX_LEN);
  const destId = extractPrefix(bytes, HEADER.DEST_OFFSET, HEADER.DEST_PREFIX_LEN);
  const hops = safeReadByte(bytes, HEADER.HOP_COUNT_OFFSET) ?? 0;

  // Decode type-specific payload
  const { channelKeys, ...restMetadata } = metadata;
  let decodedPayload = Object.freeze({});

  const decoder = TYPE_DECODERS[packetType];
  if (decoder) {
    try {
      decodedPayload = decoder(bytes, HEADER.PAYLOAD_OFFSET, { channelKeys: channelKeys ?? {} });
    } catch (err) {
      decodedPayload = Object.freeze({ error: `Payload decode failed: ${err.message}` });
    }
  }

  return Object.freeze({
    hash: generatePacketHash(rawHex),
    rawHex,
    type: packetType,
    sourceId,
    destId,
    hops,
    hopPath: Object.freeze([]),
    snr: null,
    rssi: null,
    size: bytes.length,
    channel: decodedPayload?.channel ?? null,
    decodedPayload,
    timestamp: new Date().toISOString(),
    ...restMetadata,
  });
}
