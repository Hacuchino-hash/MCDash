/**
 * MeshCore packet constants based on the official protocol.
 * Reference: https://github.com/meshcore-dev/MeshCore/blob/main/src/Packet.h
 * @module decoder/constants
 */

/**
 * Header byte bitmasks.
 * The MeshCore header is a SINGLE byte with three bitfields:
 *   [7:6] Version    (PH_VER_MASK 0x03, shift 6)
 *   [5:2] Payload Type (PH_TYPE_MASK 0x0F, shift 2)
 *   [1:0] Route Type   (PH_ROUTE_MASK 0x03, shift 0)
 */
export const HEADER_MASKS = Object.freeze({
  VER_MASK: 0x03,
  VER_SHIFT: 6,
  TYPE_MASK: 0x0F,
  TYPE_SHIFT: 2,
  ROUTE_MASK: 0x03,
  ROUTE_SHIFT: 0,
});

/** Route types (header bits 0-1). */
export const ROUTE_TYPES = Object.freeze({
  TRANSPORT_FLOOD: 0x00,
  FLOOD: 0x01,
  DIRECT: 0x02,
  TRANSPORT_DIRECT: 0x03,
});

/** Payload types (header bits 2-5). */
export const PAYLOAD_TYPES = Object.freeze({
  REQ: 0x00,
  RESPONSE: 0x01,
  TXT_MSG: 0x02,
  ACK: 0x03,
  ADVERT: 0x04,
  GRP_TXT: 0x05,
  GRP_DATA: 0x06,
  ANON_REQ: 0x07,
  PATH: 0x08,
  TRACE: 0x09,
  MULTIPART: 0x0A,
  CONTROL: 0x0B,
  RAW_CUSTOM: 0x0F,
});

/** Human-readable type strings for API/display. */
export const PACKET_TYPE_NAMES = Object.freeze({
  [PAYLOAD_TYPES.REQ]: 'request',
  [PAYLOAD_TYPES.RESPONSE]: 'response',
  [PAYLOAD_TYPES.TXT_MSG]: 'text_message',
  [PAYLOAD_TYPES.ACK]: 'ack',
  [PAYLOAD_TYPES.ADVERT]: 'advert',
  [PAYLOAD_TYPES.GRP_TXT]: 'group_text',
  [PAYLOAD_TYPES.GRP_DATA]: 'group_data',
  [PAYLOAD_TYPES.ANON_REQ]: 'anon_request',
  [PAYLOAD_TYPES.PATH]: 'path',
  [PAYLOAD_TYPES.TRACE]: 'trace',
  [PAYLOAD_TYPES.MULTIPART]: 'multipart',
  [PAYLOAD_TYPES.CONTROL]: 'control',
  [PAYLOAD_TYPES.RAW_CUSTOM]: 'raw_custom',
});

/** Backward-compat type strings used by stores/routes. */
export const PACKET_TYPES = Object.freeze({
  ADVERT: 'advert',
  FLOOD: 'flood',
  DIRECT: 'direct',
  TRACE: 'trace',
  ACK: 'ack',
  GROUP_TEXT: 'group_text',
  GROUP_DATA: 'group_data',
  TEXT_MESSAGE: 'text_message',
  REQUEST: 'request',
  RESPONSE: 'response',
  PATH: 'path',
  CONTROL: 'control',
  UNKNOWN: 'unknown',
});

/** Node roles from advert appdata flags. */
export const NODE_ROLES = Object.freeze({
  REPEATER: 'repeater',
  ROOM_SERVER: 'room_server',
  COMPANION: 'companion',
  UNKNOWN: 'unknown',
});

/** MeshCore protocol limits. */
export const LIMITS = Object.freeze({
  MAX_MTU_SIZE: 256,
  MAX_PAYLOAD_SIZE: 184,
  MAX_PATH_SIZE: 64,
  ADVERT_PUBKEY_LEN: 32,
  ADVERT_TIMESTAMP_LEN: 4,
  ADVERT_SIGNATURE_LEN: 64,
  CIPHER_MAC_SIZE: 2,
});
