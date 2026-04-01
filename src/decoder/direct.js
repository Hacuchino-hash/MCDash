/**
 * MeshCore direct / text message decoder.
 * Used for TXT_MSG (type 0x02) payloads — point-to-point routed messages.
 * These are encrypted with ECDH-derived AES keys in practice, but here we
 * extract the raw payload bytes for display.
 *
 * Reference: https://github.com/meshcore-dev/MeshCore/blob/main/docs/payloads.md
 * @module decoder/direct
 */

/**
 * Decode a direct (text message) payload.
 * Note: Direct messages are encrypted via ECDH shared secret (X25519).
 * Without the recipient's private key, we can only show raw bytes.
 *
 * @param {Uint8Array} bytes - Full packet bytes
 * @param {number} payloadOffset - Byte offset where payload begins
 * @returns {Readonly<{ payload: string, encrypted: boolean, payloadSize: number }>}
 */
export function decodeDirect(bytes, payloadOffset) {
  if (payloadOffset >= bytes.length) {
    return Object.freeze({ payload: '', encrypted: true, payloadSize: 0 });
  }

  const payloadBytes = bytes.slice(payloadOffset);

  // Try to extract printable ASCII (will only work for unencrypted test data)
  const chars = [];
  let printableCount = 0;
  for (const byte of payloadBytes) {
    if (byte === 0x00) break;
    if (byte >= 0x20 && byte <= 0x7e) {
      chars.push(String.fromCharCode(byte));
      printableCount += 1;
    } else {
      chars.push('.');
    }
  }

  const isLikelyEncrypted = chars.length > 0 && (printableCount / chars.length) < 0.5;

  return Object.freeze({
    payload: chars.join(''),
    encrypted: isLikelyEncrypted,
    payloadSize: payloadBytes.length,
  });
}
