/**
 * MeshCore direct (unicast) packet decoder.
 * Extracts payload content and routing info.
 * @module decoder/direct
 */

/**
 * Decode a direct (unicast) packet payload.
 *
 * @param {Uint8Array} bytes - Full packet bytes
 * @param {number} headerOffset - Byte offset where payload begins
 * @returns {Readonly<{ payload: string, routeLength: number }>}
 */
export function decodeDirect(bytes, headerOffset) {
  if (headerOffset >= bytes.length) {
    return Object.freeze({ payload: '', routeLength: 0 });
  }

  const payloadBytes = bytes.slice(headerOffset);

  // First byte may encode route length (number of intermediate hops)
  const routeLength = payloadBytes.length > 0 ? payloadBytes[0] : 0;
  const messageStart = 1 + routeLength * 4; // Each route entry is a 4-byte node prefix

  let payload = '';
  if (messageStart < payloadBytes.length) {
    const chars = [];
    for (let i = messageStart; i < payloadBytes.length; i++) {
      const byte = payloadBytes[i];
      if (byte === 0x00) break;
      chars.push(byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.');
    }
    payload = chars.join('');
  }

  return Object.freeze({ payload, routeLength });
}
