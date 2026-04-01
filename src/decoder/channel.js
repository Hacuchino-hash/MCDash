/**
 * MeshCore channel packet decoder.
 * Attempts to decrypt channel messages using provided keys.
 * @module decoder/channel
 */

import { createHash } from 'node:crypto';

/**
 * Derive a 16-byte channel key from a hashtag channel name.
 * Uses SHA-256 of the channel name, taking the first 16 bytes.
 *
 * @param {string} channelName - e.g. "#nodakmesh"
 * @returns {Uint8Array} 16-byte key
 */
export function deriveChannelKey(channelName) {
  const hash = createHash('sha256').update(channelName).digest();
  return new Uint8Array(hash.buffer, hash.byteOffset, 16);
}

/**
 * Attempt XOR-based decryption of channel payload.
 * MeshCore channel encryption details vary by firmware; this is a
 * best-effort implementation.
 *
 * @param {Uint8Array} ciphertext
 * @param {Uint8Array} key - 16-byte key
 * @returns {string | null} Decrypted ASCII text, or null if result is not valid text
 */
function attemptDecrypt(ciphertext, key) {
  if (ciphertext.length === 0 || key.length === 0) {
    return null;
  }

  const decrypted = new Uint8Array(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    decrypted[i] = ciphertext[i] ^ key[i % key.length];
  }

  // Check if result looks like valid text (majority printable ASCII)
  let printableCount = 0;
  for (const byte of decrypted) {
    if ((byte >= 0x20 && byte <= 0x7e) || byte === 0x0a || byte === 0x0d) {
      printableCount += 1;
    }
  }

  if (printableCount < decrypted.length * 0.7) {
    return null;
  }

  const chars = [];
  for (const byte of decrypted) {
    if (byte === 0x00) break;
    chars.push(byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.');
  }

  return chars.length > 0 ? chars.join('') : null;
}

/**
 * Decode a channel packet payload, attempting decryption with known keys.
 *
 * @param {Uint8Array} bytes - Full packet bytes
 * @param {number} headerOffset - Byte offset where payload begins
 * @param {Record<string, Uint8Array | string>} channelKeys - Map of channel name to key (Uint8Array or hex/hashtag string)
 * @returns {Readonly<{ channel: string | null, message: string | null, encrypted: boolean }>}
 */
export function decodeChannel(bytes, headerOffset, channelKeys = {}) {
  if (headerOffset >= bytes.length) {
    return Object.freeze({ channel: null, message: null, encrypted: true });
  }

  const payloadBytes = bytes.slice(headerOffset);

  // Try each known channel key
  for (const [channelName, rawKey] of Object.entries(channelKeys)) {
    const key = typeof rawKey === 'string'
      ? deriveChannelKey(rawKey)
      : rawKey;

    const message = attemptDecrypt(payloadBytes, key);
    if (message !== null) {
      return Object.freeze({ channel: channelName, message, encrypted: false });
    }
  }

  // No key worked — return encrypted payload
  return Object.freeze({ channel: null, message: null, encrypted: true });
}
