/**
 * MeshCore flood packet decoder.
 * Extracts broadcast payload and channel identifier.
 * @module decoder/flood
 */

/**
 * Decode a flood (broadcast) packet payload.
 *
 * @param {Uint8Array} bytes - Full packet bytes
 * @param {number} headerOffset - Byte offset where payload begins
 * @returns {Readonly<{ payload: string, channel: string | null, isGroupMessage: boolean }>}
 */
export function decodeFlood(bytes, headerOffset) {
  if (headerOffset >= bytes.length) {
    return Object.freeze({ payload: '', channel: null, isGroupMessage: false });
  }

  const payloadBytes = bytes.slice(headerOffset);

  // First byte of payload may indicate channel ID
  // If present, byte 0 is channel length, followed by channel name, then message
  let channel = null;
  let messageStart = 0;
  let isGroupMessage = false;

  if (payloadBytes.length > 1) {
    const channelLen = payloadBytes[0];

    // Heuristic: if first byte looks like a reasonable channel name length
    // (1-32 bytes) and we have enough data, treat it as channel + message
    if (channelLen > 0 && channelLen <= 32 && channelLen + 1 <= payloadBytes.length) {
      const possibleChannel = extractAscii(payloadBytes, 1, channelLen);

      // Only accept if channel name is printable ASCII
      if (possibleChannel !== null && /^[\x20-\x7e]+$/.test(possibleChannel)) {
        channel = possibleChannel;
        messageStart = channelLen + 1;
        isGroupMessage = true;
      }
    }
  }

  const payload = extractAscii(payloadBytes, messageStart, payloadBytes.length - messageStart) ?? '';

  return Object.freeze({ payload, channel, isGroupMessage });
}

/**
 * Extract ASCII string from bytes, replacing non-printable chars with '.'.
 *
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @param {number} length
 * @returns {string | null}
 */
function extractAscii(bytes, offset, length) {
  if (offset + length > bytes.length || length <= 0) {
    return null;
  }

  const chars = [];
  for (let i = offset; i < offset + length; i++) {
    const byte = bytes[i];
    if (byte === 0x00) break;
    chars.push(byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.');
  }

  return chars.length > 0 ? chars.join('') : null;
}
