/**
 * MQTT connection manager for MeshCore mesh network data.
 * Connects to one or more MQTT brokers, subscribes to packet/status topics,
 * and emits events for downstream processing.
 *
 * @module mqtt/client
 */

import { EventEmitter } from 'node:events';
import mqtt from 'mqtt';

const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 30000;
const BACKOFF_MULTIPLIER = 2;

/**
 * Compute exponential backoff delay capped at a maximum.
 *
 * @param {number} attempt - Zero-based attempt counter.
 * @returns {number} Delay in milliseconds.
 */
function backoffDelay(attempt) {
  const delay = BACKOFF_BASE_MS * Math.pow(BACKOFF_MULTIPLIER, attempt);
  return Math.min(delay, BACKOFF_MAX_MS);
}

/**
 * Extract the observer public key from an MQTT topic.
 * Topic format: meshcore/FAR/<PUBKEY>/packets (or /status).
 *
 * @param {string} topic
 * @returns {string | null}
 */
function extractObserverKey(topic) {
  if (typeof topic !== 'string') {
    return null;
  }
  const segments = topic.split('/');
  return segments.length >= 3 ? segments[2] : null;
}

/**
 * Determine whether a topic is a status topic (ends with /status).
 *
 * @param {string} topic
 * @returns {boolean}
 */
function isStatusTopic(topic) {
  return typeof topic === 'string' && topic.endsWith('/status');
}

/**
 * Connect a single MQTT client to a broker and wire up events.
 *
 * @param {object} options
 * @param {string} options.broker - MQTT broker URL.
 * @param {string[]} options.topics - Topics to subscribe to.
 * @param {string} [options.username] - Optional username.
 * @param {string} [options.password] - Optional password.
 * @param {string} [options.label] - Human-readable label for logging.
 * @param {EventEmitter} emitter - Shared event emitter.
 * @returns {import('mqtt').MqttClient}
 */
function connectBroker({ broker, topics, username, password, label }, emitter) {
  const connectOptions = {
    reconnectPeriod: 0, // We manage reconnect ourselves for logging
  };

  if (username) {
    connectOptions.username = username;
  }
  if (password) {
    connectOptions.password = password;
  }

  const client = mqtt.connect(broker, connectOptions);
  let reconnectAttempt = 0;
  let reconnectTimer = null;

  function subscribe() {
    for (const topic of topics) {
      client.subscribe(topic, (err) => {
        if (err) {
          emitter.emit('error', {
            label,
            broker,
            topic,
            message: `Subscribe failed: ${err.message}`,
          });
        }
      });
    }
  }

  function scheduleReconnect() {
    if (reconnectTimer !== null) {
      return;
    }
    const delay = backoffDelay(reconnectAttempt);
    reconnectAttempt += 1;
    emitter.emit('disconnected', { label, broker, reconnectIn: delay });

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      client.reconnect();
    }, delay);
  }

  function clearReconnectState() {
    reconnectAttempt = 0;
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  client.on('connect', () => {
    clearReconnectState();
    emitter.emit('connected', { label, broker });
    subscribe();
  });

  client.on('message', (topic, payload) => {
    const observerKey = extractObserverKey(topic);

    if (isStatusTopic(topic)) {
      emitter.emit('status', { topic, payload, observerKey });
    } else {
      emitter.emit('packet', { topic, payload, observerKey });
    }
  });

  client.on('error', (err) => {
    emitter.emit('error', {
      label,
      broker,
      message: err.message,
    });
  });

  client.on('close', () => {
    scheduleReconnect();
  });

  client.on('offline', () => {
    emitter.emit('disconnected', { label, broker });
  });

  return client;
}

/**
 * Create an MQTT client manager that connects to all configured brokers.
 *
 * @param {object} config - Application config (see config.example.json).
 * @returns {{ close: () => void } & EventEmitter} Manager with close() and event emitter interface.
 */
export function createMqttClient(config) {
  if (config == null || typeof config !== 'object') {
    throw new Error('config is required');
  }

  if (config.mqtt?.broker == null) {
    throw new Error('config.mqtt.broker is required');
  }

  const emitter = new EventEmitter();
  const clients = [];

  // Primary broker
  const primaryTopics = [
    config.mqtt.topic,
    config.mqtt.statusTopic,
  ].filter(Boolean);

  const primaryClient = connectBroker(
    {
      broker: config.mqtt.broker,
      topics: primaryTopics,
      label: 'primary',
    },
    emitter,
  );
  clients.push(primaryClient);

  // Additional sources
  const sources = config.mqttSources ?? [];
  for (const source of sources) {
    if (source.broker == null) {
      continue;
    }

    const sourceClient = connectBroker(
      {
        broker: source.broker,
        topics: source.topics ?? [],
        username: source.username,
        password: source.password,
        label: source.name ?? source.broker,
      },
      emitter,
    );
    clients.push(sourceClient);
  }

  function close() {
    for (const client of clients) {
      client.end(true);
    }
  }

  // Return an object that delegates EventEmitter methods and exposes close()
  const manager = Object.create(emitter);
  manager.close = close;

  return manager;
}
