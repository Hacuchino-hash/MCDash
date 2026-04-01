/**
 * MeshCore trace packet decoder.
 * Extracts trace path (node prefixes) and direction.
 * @module decoder/trace
 */

import { bytesToHex } from '../utils/hex.js';

const NODE_PREFIX_LEN = 4;

/**
 * Decode a trace packet payload.
 *
 * @param {Uint8Array} bytes - Full packet bytes
 * @param {number} headerOffset - Byte offset where payload begins
 * @returns {Readonly<{ path: ReadonlyArray<string>, isRequest: boolean }>}
 */
export function decodeTrace(bytes, headerOffset) {
  if (headerOffset >= bytes.length) {
    return Object.freeze({ path: Object.freeze([]), isRequest: true });
  }

  const payloadBytes = bytes.slice(headerOffset);

  // First byte indicates direction: 0 = request, non-zero = response
  const isRequest = payloadBytes.length > 0 ? payloadBytes[0] === 0x00 : true;

  // Remaining bytes are 4-byte node prefixes forming the trace path
  const path = [];
  let cursor = 1;

  while (cursor + NODE_PREFIX_LEN <= payloadBytes.length) {
    const prefix = payloadBytes.slice(cursor, cursor + NODE_PREFIX_LEN);
    path.push(bytesToHex(prefix));
    cursor += NODE_PREFIX_LEN;
  }

  return Object.freeze({
    path: Object.freeze(path),
    isRequest,
  });
}
