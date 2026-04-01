/**
 * MeshCore advert packet decoder.
 * Advert payload format: [pubkey:32] [timestamp:4] [signature:64] [appdata:N]
 * Appdata: [flags:1] [lat:4] [lon:4] [features:2] [name:null-terminated]
 *
 * Reference: https://github.com/meshcore-dev/MeshCore/blob/main/docs/payloads.md
 * All multi-byte integers are little-endian.
 * @module decoder/advert
 */

import { bytesToHex } from '../utils/hex.js';
import { NODE_ROLES, LIMITS } from './constants.js';

/**
 * Read a 32-bit little-endian float from bytes at offset.
 */
function readFloat32LE(bytes, offset) {
  if (offset + 4 > bytes.length) return null;
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  for (let i = 0; i < 4; i++) {
    view.setUint8(i, bytes[offset + i]);
  }
  return view.getFloat32(0, true);
}

/**
 * Read a 32-bit little-endian unsigned int.
 */
function readUint32LE(bytes, offset) {
  if (offset + 4 > bytes.length) return null;
  return (bytes[offset]) |
         (bytes[offset + 1] << 8) |
         (bytes[offset + 2] << 16) |
         ((bytes[offset + 3] << 24) >>> 0);
}

/**
 * Read a null-terminated ASCII string from bytes starting at offset.
 */
function readNullTerminatedString(bytes, offset) {
  if (offset >= bytes.length) return { value: null, bytesConsumed: 0 };

  const chars = [];
  let i = offset;
  while (i < bytes.length && bytes[i] !== 0x00) {
    const byte = bytes[i];
    chars.push(byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.');
    i += 1;
  }

  const bytesConsumed = i < bytes.length ? i - offset + 1 : i - offset;
  return {
    value: chars.length > 0 ? chars.join('') : null,
    bytesConsumed,
  };
}

/**
 * Interpret flags byte to determine node role.
 */
function roleFromFlags(flags) {
  // Flags encoding varies by firmware; common patterns:
  // Bit 0-1: role indicator
  const roleBits = flags & 0x03;
  if (roleBits === 0x01) return NODE_ROLES.REPEATER;
  if (roleBits === 0x02) return NODE_ROLES.ROOM_SERVER;
  if (roleBits === 0x03) return NODE_ROLES.COMPANION;
  return NODE_ROLES.UNKNOWN;
}

/**
 * Decode an advert packet payload.
 *
 * @param {Uint8Array} bytes - Full packet bytes
 * @param {number} payloadOffset - Byte offset where payload begins
 * @returns {Readonly<object>}
 */
export function decodeAdvert(bytes, payloadOffset) {
  let cursor = payloadOffset;

  // 32-byte Ed25519 public key
  let publicKey = null;
  if (cursor + LIMITS.ADVERT_PUBKEY_LEN <= bytes.length) {
    publicKey = bytesToHex(bytes.slice(cursor, cursor + LIMITS.ADVERT_PUBKEY_LEN));
    cursor += LIMITS.ADVERT_PUBKEY_LEN;
  } else {
    return Object.freeze({
      publicKey: null, advertTimestamp: null, name: null,
      latitude: null, longitude: null, role: NODE_ROLES.UNKNOWN,
      firmwareVersion: null, features: null,
    });
  }

  // 4-byte unix timestamp (little-endian)
  const advertTimestamp = readUint32LE(bytes, cursor);
  if (advertTimestamp !== null) cursor += LIMITS.ADVERT_TIMESTAMP_LEN;

  // 64-byte Ed25519 signature
  if (cursor + LIMITS.ADVERT_SIGNATURE_LEN <= bytes.length) {
    cursor += LIMITS.ADVERT_SIGNATURE_LEN;
  } else {
    return Object.freeze({
      publicKey, advertTimestamp, name: null,
      latitude: null, longitude: null, role: NODE_ROLES.UNKNOWN,
      firmwareVersion: null, features: null,
    });
  }

  // Appdata starts here: [flags:1] [lat:4] [lon:4] [features:2] [name:null-terminated]
  let flags = 0;
  let role = NODE_ROLES.UNKNOWN;
  if (cursor < bytes.length) {
    flags = bytes[cursor];
    role = roleFromFlags(flags);
    cursor += 1;
  }

  const latitude = readFloat32LE(bytes, cursor);
  if (latitude !== null) cursor += 4;

  const longitude = readFloat32LE(bytes, cursor);
  if (longitude !== null) cursor += 4;

  // 2-byte features bitmask (little-endian)
  let features = null;
  if (cursor + 2 <= bytes.length) {
    features = bytes[cursor] | (bytes[cursor + 1] << 8);
    cursor += 2;
  }

  // Node name (null-terminated ASCII)
  const { value: name } = readNullTerminatedString(bytes, cursor);

  return Object.freeze({
    publicKey,
    advertTimestamp: advertTimestamp !== null ? new Date(advertTimestamp * 1000).toISOString() : null,
    name,
    latitude,
    longitude,
    role,
    features,
    firmwareVersion: null, // Not directly in advert; may come from features or separate packets
  });
}
