/**
 * Hex string encode/decode utilities for MeshCore packet processing.
 * @module utils/hex
 */

const HEX_REGEX = /^[0-9a-fA-F]*$/;

/**
 * Validate and normalize a hex string.
 * Pads with a leading zero if odd-length.
 *
 * @param {string} hexString
 * @returns {string} Normalized (even-length, lowercase) hex string
 * @throws {TypeError} If input is not a string
 * @throws {Error} If input contains non-hex characters
 */
function normalizeHex(hexString) {
  if (typeof hexString !== 'string') {
    throw new TypeError('Expected a hex string');
  }

  if (!HEX_REGEX.test(hexString)) {
    throw new Error('Invalid hex string: contains non-hex characters');
  }

  const padded = hexString.length % 2 !== 0 ? `0${hexString}` : hexString;
  return padded.toLowerCase();
}

/**
 * Convert a hex string to a Uint8Array.
 *
 * @param {string} hexString - Hex-encoded string
 * @returns {Uint8Array} Byte array
 */
export function hexToBytes(hexString) {
  const hex = normalizeHex(hexString);
  const length = hex.length / 2;
  const bytes = new Uint8Array(length);

  for (let i = 0; i < length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }

  return bytes;
}

/**
 * Convert a Uint8Array to a lowercase hex string.
 *
 * @param {Uint8Array} bytes - Byte array
 * @returns {string} Hex-encoded string (lowercase)
 */
export function bytesToHex(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('Expected a Uint8Array');
  }

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert a hex string to an ASCII string.
 * Non-printable characters (outside 0x20–0x7E) are replaced with '.'.
 *
 * @param {string} hexString - Hex-encoded string
 * @returns {string} ASCII representation
 */
export function hexToAscii(hexString) {
  const bytes = hexToBytes(hexString);

  return Array.from(bytes)
    .map((byte) => (byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.'))
    .join('');
}
