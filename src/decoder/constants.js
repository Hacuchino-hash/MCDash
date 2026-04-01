/**
 * MeshCore packet type constants and header field offsets.
 * @module decoder/constants
 */

export const PACKET_TYPES = Object.freeze({
  ADVERT: 'advert',
  FLOOD: 'flood',
  DIRECT: 'direct',
  TRACE: 'trace',
  ACK: 'ack',
  PATH_REQ: 'path_req',
  PATH_RESP: 'path_resp',
  CHANNEL: 'channel',
  UNKNOWN: 'unknown',
});

/**
 * MeshCore packet header structure.
 * First 2 bytes typically contain type/flags.
 * These offsets are best-effort based on available references and may
 * vary between firmware versions.
 */
export const HEADER = Object.freeze({
  TYPE_OFFSET: 0,
  FLAGS_OFFSET: 1,
  SOURCE_OFFSET: 2,
  DEST_OFFSET: 6,
  HOP_COUNT_OFFSET: 10,
  PAYLOAD_OFFSET: 11,
  SOURCE_PREFIX_LEN: 4,
  DEST_PREFIX_LEN: 4,
});

/** Node roles advertised in advert packets. */
export const NODE_ROLES = Object.freeze({
  REPEATER: 'repeater',
  ROOM_SERVER: 'room_server',
  COMPANION: 'companion',
  UNKNOWN: 'unknown',
});

/**
 * Map from raw type byte values to PACKET_TYPES.
 * These mappings are best-effort; unknown values fall through to UNKNOWN.
 */
export const TYPE_BYTE_MAP = Object.freeze({
  0x01: PACKET_TYPES.ADVERT,
  0x02: PACKET_TYPES.FLOOD,
  0x03: PACKET_TYPES.DIRECT,
  0x04: PACKET_TYPES.TRACE,
  0x05: PACKET_TYPES.ACK,
  0x06: PACKET_TYPES.PATH_REQ,
  0x07: PACKET_TYPES.PATH_RESP,
  0x08: PACKET_TYPES.CHANNEL,
});
