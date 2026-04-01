/**
 * MeshCore channel message decoder.
 * Uses AES-128-ECB encryption with 2-byte HMAC-SHA256 MAC.
 *
 * Key derivation for hashtag channels: SHA256("#" + roomName).slice(0, 16)
 * Channel hash (1-byte identifier): SHA256(channel_key)[0]
 *
 * References:
 * - https://jacksbrain.com/2026/01/a-hitchhiker-s-guide-to-meshcore-cryptography/
 * - https://github.com/jkingsman/meshcore-packet-knife
 * - https://github.com/michaelhart/meshcore-decoder
 * @module decoder/channel
 */

import { createHash, createCipheriv, createDecipheriv } from 'node:crypto';
import { LIMITS } from './constants.js';

/**
 * Derive a 16-byte AES key from a hashtag channel name.
 * Input must include the '#' prefix: SHA256("#roomname").slice(0, 16)
 *
 * @param {string} channelName - e.g. "#nodakmesh"
 * @returns {Buffer} 16-byte key
 */
export function deriveChannelKey(channelName) {
  const input = channelName.startsWith('#') ? channelName : `#${channelName}`;
  const hash = createHash('sha256').update(input).digest();
  return hash.subarray(0, 16);
}

/**
 * Compute the 1-byte channel hash for key selection.
 * channel_hash = SHA256(key)[0]
 *
 * @param {Buffer|Uint8Array} key - 16-byte channel key
 * @returns {number} Single byte channel hash
 */
function channelHash(key) {
  return createHash('sha256').update(key).digest()[0];
}

/**
 * Convert a hex string key to a Buffer.
 */
function hexKeyToBuffer(hexKey) {
  return Buffer.from(hexKey, 'hex');
}

/**
 * Attempt AES-128-ECB decryption of channel payload.
 *
 * @param {Uint8Array} ciphertext - Encrypted payload (without MAC)
 * @param {Buffer} key - 16-byte AES key
 * @returns {Buffer|null} Decrypted plaintext, or null on failure
 */
function aesDecrypt(ciphertext, key) {
  try {
    const decipher = createDecipheriv('aes-128-ecb', key, null);
    decipher.setAutoPadding(false);

    // AES-ECB works on 16-byte blocks; pad ciphertext to block boundary
    const blockSize = 16;
    const paddedLen = Math.ceil(ciphertext.length / blockSize) * blockSize;
    const padded = Buffer.alloc(paddedLen);
    Buffer.from(ciphertext).copy(padded);

    const decrypted = Buffer.concat([
      decipher.update(padded),
      decipher.final(),
    ]);

    return decrypted.subarray(0, ciphertext.length);
  } catch {
    return null;
  }
}

/**
 * Verify the 2-byte HMAC-SHA256 MAC.
 *
 * @param {Uint8Array} payload - Full payload including MAC
 * @param {Buffer} key - 16-byte key
 * @returns {{ ciphertext: Uint8Array, valid: boolean }}
 */
function verifyMac(payload, key) {
  if (payload.length < LIMITS.CIPHER_MAC_SIZE) {
    return { ciphertext: payload, valid: false };
  }

  const macSize = LIMITS.CIPHER_MAC_SIZE;
  const ciphertext = payload.subarray(0, payload.length - macSize);
  const receivedMac = payload.subarray(payload.length - macSize);

  const computedMac = createHash('sha256')
    .update(Buffer.from(ciphertext))
    .update(key)
    .digest()
    .subarray(0, macSize);

  const valid = receivedMac[0] === computedMac[0] && receivedMac[1] === computedMac[1];
  return { ciphertext, valid };
}

/**
 * Check if decrypted bytes are valid text (majority printable ASCII).
 */
function isValidText(decrypted) {
  if (decrypted.length === 0) return false;
  let printable = 0;
  for (const byte of decrypted) {
    if ((byte >= 0x20 && byte <= 0x7e) || byte === 0x0a || byte === 0x0d || byte === 0x00) {
      printable += 1;
    }
  }
  return printable >= decrypted.length * 0.7;
}

/**
 * Extract text from decrypted bytes.
 */
function extractText(decrypted) {
  const chars = [];
  for (const byte of decrypted) {
    if (byte === 0x00) break;
    chars.push(byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.');
  }
  return chars.length > 0 ? chars.join('') : null;
}

/**
 * Resolve a channel key config entry to a Buffer.
 * Accepts: hex string (32 chars = 16 bytes), hashtag name, or Buffer/Uint8Array.
 */
function resolveKey(rawKey) {
  if (Buffer.isBuffer(rawKey) || rawKey instanceof Uint8Array) {
    return Buffer.from(rawKey);
  }
  if (typeof rawKey === 'string') {
    // Hex key (e.g., "8b3387e9c5cdea6ac9e5edbaa115cd72")
    if (/^[0-9a-fA-F]{32}$/.test(rawKey)) {
      return hexKeyToBuffer(rawKey);
    }
    // Hashtag channel name
    return deriveChannelKey(rawKey);
  }
  return null;
}

/**
 * Decode an encrypted channel message payload.
 *
 * @param {Uint8Array} bytes - Full packet bytes
 * @param {number} payloadOffset - Byte offset where payload begins
 * @param {Record<string, string|Buffer>} channelKeys - Map of channel name to key
 * @returns {Readonly<{ channel: string|null, message: string|null, encrypted: boolean, channelHash: number|null }>}
 */
export function decodeChannel(bytes, payloadOffset, channelKeys = {}) {
  if (payloadOffset >= bytes.length) {
    return Object.freeze({ channel: null, message: null, encrypted: true, channelHash: null });
  }

  const payload = bytes.slice(payloadOffset);

  // Try each known channel key
  for (const [channelName, rawKey] of Object.entries(channelKeys)) {
    const key = resolveKey(rawKey);
    if (key === null || key.length !== 16) continue;

    // Verify MAC first
    const { ciphertext, valid } = verifyMac(payload, key);
    if (!valid) continue;

    // Attempt AES-128-ECB decryption
    const decrypted = aesDecrypt(ciphertext, key);
    if (decrypted === null) continue;

    if (isValidText(decrypted)) {
      const message = extractText(decrypted);
      return Object.freeze({
        channel: channelName,
        message,
        encrypted: false,
        channelHash: channelHash(key),
      });
    }
  }

  // No key matched — return encrypted
  return Object.freeze({
    channel: null,
    message: null,
    encrypted: true,
    channelHash: payload.length > 0 ? null : null,
  });
}
