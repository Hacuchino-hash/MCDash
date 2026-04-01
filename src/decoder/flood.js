/**
 * MeshCore group text / flood payload decoder.
 * Used for GRP_TXT (type 0x05) and generic flood payloads.
 * Group text payloads contain the message content directly (no channel prefix).
 *
 * Reference: https://github.com/meshcore-dev/MeshCore/blob/main/docs/payloads.md
 * @module decoder/flood
 */

/**
 * Extract ASCII string from bytes, replacing non-printable chars with '.'.
 */
function extractAscii(bytes, offset, length) {
  if (offset + length > bytes.length || length <= 0) return null;

  const chars = [];
  for (let i = offset; i < offset + length; i++) {
    const byte = bytes[i];
    if (byte === 0x00) break;
    chars.push(byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.');
  }

  return chars.length > 0 ? chars.join('') : null;
}

/**
 * Decode a group text / flood payload.
 * In MeshCore, group text is a separate payload type (GRP_TXT, 0x05), not a
 * sub-format with a channel length prefix. The channel association comes from
 * the encryption key used, not from the payload structure.
 *
 * @param {Uint8Array} bytes - Full packet bytes
 * @param {number} payloadOffset - Byte offset where payload begins
 * @returns {Readonly<{ payload: string, isGroupMessage: boolean }>}
 */
export function decodeGroupText(bytes, payloadOffset) {
  if (payloadOffset >= bytes.length) {
    return Object.freeze({ payload: '', isGroupMessage: true });
  }

  const remaining = bytes.length - payloadOffset;
  const payload = extractAscii(bytes, payloadOffset, remaining) ?? '';

  return Object.freeze({ payload, isGroupMessage: true });
}
