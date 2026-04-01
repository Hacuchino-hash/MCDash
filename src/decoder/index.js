/**
 * MeshCore packet decoder — main dispatcher.
 * Parses single-byte header with bitfields, variable-length path, then payload.
 *
 * Reference: https://github.com/meshcore-dev/MeshCore/blob/main/src/Packet.h
 * Wire format: [header:1] [transport_codes:0|4] [path_len:1] [path:0-64] [payload:0-184]
 *
 * NEVER throws. Always returns a valid, frozen packet object.
 * @module decoder
 */

import { createHash } from 'node:crypto';
import { hexToBytes, bytesToHex } from '../utils/hex.js';
import {
  HEADER_MASKS,
  ROUTE_TYPES,
  PAYLOAD_TYPES,
  PACKET_TYPE_NAMES,
  PACKET_TYPES,
} from './constants.js';
import { decodeAdvert } from './advert.js';
import { decodeGroupText } from './flood.js';
import { decodeDirect } from './direct.js';
import { decodeTrace } from './trace.js';
import { decodeChannel } from './channel.js';

/**
 * Generate a short hash (first 16 hex chars of SHA-256) for deduplication.
 */
function generatePacketHash(rawHex) {
  return createHash('sha256').update(rawHex).digest('hex').slice(0, 16);
}

/**
 * Parse the single-byte header into version, payload type, and route type.
 */
function parseHeader(headerByte) {
  const version = (headerByte >> HEADER_MASKS.VER_SHIFT) & HEADER_MASKS.VER_MASK;
  const payloadType = (headerByte >> HEADER_MASKS.TYPE_SHIFT) & HEADER_MASKS.TYPE_MASK;
  const routeType = (headerByte >> HEADER_MASKS.ROUTE_SHIFT) & HEADER_MASKS.ROUTE_MASK;
  return { version, payloadType, routeType };
}

/**
 * Determine if the route type includes transport codes (4 bytes: two uint16).
 */
function hasTransportCodes(routeType) {
  return routeType === ROUTE_TYPES.TRANSPORT_FLOOD ||
         routeType === ROUTE_TYPES.TRANSPORT_DIRECT;
}

/**
 * Parse the path_len byte.
 * path_len = ((hash_size - 1) << 6) | (hash_count & 63)
 */
function parsePathLen(pathLenByte) {
  const hashSize = ((pathLenByte >> 6) & 0x03) + 1;  // 1-3 bytes per hop hash
  const hashCount = pathLenByte & 0x3F;               // up to 63 hops
  return { hashSize, hashCount };
}

/**
 * Map payload type + route type to a human-readable type string.
 */
function resolvePacketType(payloadType, routeType) {
  if (payloadType === PAYLOAD_TYPES.ADVERT) return PACKET_TYPES.ADVERT;
  if (payloadType === PAYLOAD_TYPES.TRACE) return PACKET_TYPES.TRACE;
  if (payloadType === PAYLOAD_TYPES.ACK) return PACKET_TYPES.ACK;
  if (payloadType === PAYLOAD_TYPES.GRP_TXT) return PACKET_TYPES.GROUP_TEXT;
  if (payloadType === PAYLOAD_TYPES.GRP_DATA) return PACKET_TYPES.GROUP_DATA;
  if (payloadType === PAYLOAD_TYPES.TXT_MSG) return PACKET_TYPES.TEXT_MESSAGE;
  if (payloadType === PAYLOAD_TYPES.PATH) return PACKET_TYPES.PATH;
  if (payloadType === PAYLOAD_TYPES.CONTROL) return PACKET_TYPES.CONTROL;
  if (payloadType === PAYLOAD_TYPES.REQ) return PACKET_TYPES.REQUEST;
  if (payloadType === PAYLOAD_TYPES.RESPONSE) return PACKET_TYPES.RESPONSE;

  // Fallback based on route type
  const isFlood = routeType === ROUTE_TYPES.FLOOD || routeType === ROUTE_TYPES.TRANSPORT_FLOOD;
  const isDirect = routeType === ROUTE_TYPES.DIRECT || routeType === ROUTE_TYPES.TRANSPORT_DIRECT;
  if (isFlood) return PACKET_TYPES.FLOOD;
  if (isDirect) return PACKET_TYPES.DIRECT;

  return PACKET_TYPES.UNKNOWN;
}

function buildErrorPacket(rawHex, errorMessage, metadata) {
  return Object.freeze({
    hash: generatePacketHash(rawHex || ''),
    rawHex: rawHex || '',
    type: PACKET_TYPES.UNKNOWN,
    payloadType: null,
    routeType: null,
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
 * @param {object} [metadata={}] - Additional context (observerId, observerIata, channelKeys, etc.)
 * @returns {Readonly<object>} Decoded packet — never throws
 */
export function decodePacket(rawHex, metadata = {}) {
  if (typeof rawHex !== 'string' || rawHex.length === 0) {
    return buildErrorPacket(rawHex, 'Invalid input: expected non-empty hex string', metadata);
  }

  let bytes;
  try {
    bytes = hexToBytes(rawHex);
  } catch (err) {
    return buildErrorPacket(rawHex, `Hex decode failed: ${err.message}`, metadata);
  }

  // Minimum: 1 byte header + 1 byte path_len = 2 bytes
  if (bytes.length < 2) {
    return buildErrorPacket(rawHex, `Packet too short: ${bytes.length} bytes`, metadata);
  }

  // Parse header byte
  const { payloadType, routeType, version } = parseHeader(bytes[0]);
  const packetType = resolvePacketType(payloadType, routeType);

  // Cursor tracks current position after header
  let cursor = 1;

  // Transport codes: present for TRANSPORT_FLOOD and TRANSPORT_DIRECT (4 bytes)
  let transportCodes = null;
  if (hasTransportCodes(routeType)) {
    if (cursor + 4 > bytes.length) {
      return buildErrorPacket(rawHex, 'Packet too short for transport codes', metadata);
    }
    const srcCode = bytes[cursor] | (bytes[cursor + 1] << 8);
    const dstCode = bytes[cursor + 2] | (bytes[cursor + 3] << 8);
    transportCodes = { srcCode, dstCode };
    cursor += 4;
  }

  // Path length byte
  if (cursor >= bytes.length) {
    return buildErrorPacket(rawHex, 'Packet too short for path_len', metadata);
  }
  const pathLenByte = bytes[cursor];
  cursor += 1;

  const { hashSize, hashCount } = parsePathLen(pathLenByte);
  const totalPathBytes = hashSize * hashCount;

  // Extract hop path
  const hopPath = [];
  if (cursor + totalPathBytes <= bytes.length) {
    for (let i = 0; i < hashCount; i++) {
      const hopOffset = cursor + (i * hashSize);
      const hopBytes = bytes.slice(hopOffset, hopOffset + hashSize);
      hopPath.push(bytesToHex(hopBytes));
    }
    cursor += totalPathBytes;
  } else {
    // Path extends beyond packet — take what we can
    cursor = bytes.length;
  }

  // Source and dest from hop path (first and last entries if available)
  const sourceId = hopPath.length > 0 ? hopPath[0] : null;
  const destId = hopPath.length > 1 ? hopPath[hopPath.length - 1] : null;

  // Remaining bytes are payload
  const payloadOffset = cursor;
  const { channelKeys, ...restMetadata } = metadata;

  let decodedPayload = Object.freeze({});

  try {
    if (payloadType === PAYLOAD_TYPES.ADVERT) {
      decodedPayload = decodeAdvert(bytes, payloadOffset);
    } else if (payloadType === PAYLOAD_TYPES.GRP_TXT || payloadType === PAYLOAD_TYPES.GRP_DATA) {
      decodedPayload = decodeChannel(bytes, payloadOffset, channelKeys ?? {});
    } else if (payloadType === PAYLOAD_TYPES.TXT_MSG) {
      decodedPayload = decodeDirect(bytes, payloadOffset);
    } else if (payloadType === PAYLOAD_TYPES.TRACE) {
      decodedPayload = decodeTrace(bytes, payloadOffset);
    } else if (payloadType === PAYLOAD_TYPES.ACK) {
      decodedPayload = Object.freeze({ acknowledged: true });
    } else {
      // Generic payload extraction for unknown types
      decodedPayload = decodeGroupText(bytes, payloadOffset);
    }
  } catch (err) {
    decodedPayload = Object.freeze({ error: `Payload decode failed: ${err.message}` });
  }

  return Object.freeze({
    hash: generatePacketHash(rawHex),
    rawHex,
    type: packetType,
    payloadType,
    routeType,
    version,
    sourceId,
    destId,
    hops: hashCount,
    hopPath: Object.freeze(hopPath),
    transportCodes: transportCodes ? Object.freeze(transportCodes) : null,
    snr: null,
    rssi: null,
    size: bytes.length,
    channel: decodedPayload?.channel ?? null,
    decodedPayload,
    timestamp: new Date().toISOString(),
    ...restMetadata,
  });
}
