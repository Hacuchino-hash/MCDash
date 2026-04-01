/**
 * MeshCore advert packet decoder.
 * Extracts node name, GPS coordinates, role, and firmware version.
 * @module decoder/advert
 */

import { NODE_ROLES } from './constants.js';

const ROLE_BYTE_MAP = Object.freeze({
  0x01: NODE_ROLES.REPEATER,
  0x02: NODE_ROLES.ROOM_SERVER,
  0x03: NODE_ROLES.COMPANION,
});

/**
 * Read a null-terminated ASCII string from bytes starting at offset.
 * Non-printable characters are replaced with '.'.
 *
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @returns {{ value: string | null, bytesConsumed: number }}
 */
function readNullTerminatedString(bytes, offset) {
  if (offset >= bytes.length) {
    return { value: null, bytesConsumed: 0 };
  }

  const chars = [];
  let i = offset;

  while (i < bytes.length && bytes[i] !== 0x00) {
    const byte = bytes[i];
    chars.push(byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.');
    i += 1;
  }

  // Skip the null terminator if present
  const bytesConsumed = i < bytes.length ? i - offset + 1 : i - offset;

  return {
    value: chars.length > 0 ? chars.join('') : null,
    bytesConsumed,
  };
}

/**
 * Read a 32-bit little-endian float from bytes at offset.
 *
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @returns {number | null}
 */
function readFloat32LE(bytes, offset) {
  if (offset + 4 > bytes.length) {
    return null;
  }

  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  for (let i = 0; i < 4; i++) {
    view.setUint8(i, bytes[offset + i]);
  }
  return view.getFloat32(0, true);
}

/**
 * Decode an advert packet payload.
 *
 * @param {Uint8Array} bytes - Full packet bytes
 * @param {number} headerOffset - Byte offset where payload begins
 * @returns {Readonly<{ name: string | null, latitude: number | null, longitude: number | null, role: string, firmwareVersion: string | null }>}
 */
export function decodeAdvert(bytes, headerOffset) {
  let cursor = headerOffset;

  // Extract node name (null-terminated)
  const { value: name, bytesConsumed } = readNullTerminatedString(bytes, cursor);
  cursor += bytesConsumed;

  // Extract GPS coordinates (two 32-bit LE floats)
  const latitude = readFloat32LE(bytes, cursor);
  if (latitude !== null) {
    cursor += 4;
  }

  const longitude = readFloat32LE(bytes, cursor);
  if (longitude !== null) {
    cursor += 4;
  }

  // Extract role byte
  let role = NODE_ROLES.UNKNOWN;
  if (cursor < bytes.length) {
    role = ROLE_BYTE_MAP[bytes[cursor]] ?? NODE_ROLES.UNKNOWN;
    cursor += 1;
  }

  // Extract firmware version (null-terminated string, if remaining bytes)
  const { value: firmwareVersion } = readNullTerminatedString(bytes, cursor);

  return Object.freeze({
    name,
    latitude,
    longitude,
    role,
    firmwareVersion,
  });
}
