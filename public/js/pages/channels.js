// NodakMesh Dashboard - Channels Page (read-only chat view)

import { api } from "../api.js";
import { ws } from "../app.js";

let container = null;
let messageList = null;
let wsHandler = null;
let activeChannel = null;
let messages = [];

// ---- Rendering ----

function formatTimestamp(ts) {
  if (!ts) {
    return "";
  }
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return "";
  }
}

function renderChannelSelector(parent, channels) {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "margin-bottom:1rem;display:flex;align-items:center;gap:0.75rem;";

  const label = document.createElement("label");
  label.textContent = "Channel:";
  label.style.cssText = "font-weight:500;font-size:0.875rem;color:var(--text-secondary);";

  const select = document.createElement("select");
  select.className = "input";
  select.style.cssText = "flex:1;max-width:20rem;";

  if (channels.length === 0) {
    const opt = document.createElement("option");
    opt.textContent = "No channels available";
    opt.disabled = true;
    select.appendChild(opt);
  } else {
    for (const channel of channels) {
      const opt = document.createElement("option");
      opt.value = channel.name || channel;
      opt.textContent = channel.name || channel;
      select.appendChild(opt);
    }
  }

  select.addEventListener("change", () => {
    activeChannel = select.value;
    loadChannelMessages(activeChannel);
  });

  wrapper.appendChild(label);
  wrapper.appendChild(select);
  parent.appendChild(wrapper);

  return select;
}

function renderMessage(msg) {
  const row = document.createElement("div");
  row.style.cssText = `
    display:flex;gap:0.75rem;padding:0.5rem 0;
    border-bottom:1px solid var(--color-border);font-size:0.8125rem;
  `;

  const sender = document.createElement("span");
  sender.style.cssText = "font-weight:600;color:var(--accent);flex-shrink:0;min-width:6rem;";
  sender.textContent = msg.sender || msg.from || "Unknown";

  const text = document.createElement("span");
  text.style.cssText = "flex:1;color:var(--color-text-primary);word-break:break-word;";
  text.textContent = msg.text || msg.message || "";

  const time = document.createElement("span");
  time.style.cssText = "color:var(--text-secondary);font-size:0.75rem;flex-shrink:0;";
  time.textContent = formatTimestamp(msg.timestamp);

  row.appendChild(sender);
  row.appendChild(text);
  row.appendChild(time);

  return row;
}

function renderMessages() {
  if (messageList == null) {
    return;
  }
  messageList.innerHTML = "";

  if (messages.length === 0) {
    const empty = document.createElement("div");
    empty.style.cssText = "text-align:center;color:var(--text-secondary);padding:2rem;font-size:0.875rem;";
    empty.textContent = "No messages in this channel";
    messageList.appendChild(empty);
    return;
  }

  for (const msg of messages) {
    messageList.appendChild(renderMessage(msg));
  }

  // Auto-scroll to bottom
  messageList.scrollTop = messageList.scrollHeight;
}

function renderNoKeysWarning(parent) {
  const warning = document.createElement("div");
  warning.className = "card";
  warning.style.cssText = "text-align:center;padding:2rem;";

  const icon = document.createElement("div");
  icon.style.cssText = "font-size:2rem;margin-bottom:0.75rem;";
  icon.textContent = "\uD83D\uDD12";

  const text = document.createElement("div");
  text.style.cssText = "color:var(--text-secondary);font-size:0.875rem;";
  text.textContent = "Channel decryption keys not configured";

  warning.appendChild(icon);
  warning.appendChild(text);
  parent.appendChild(warning);
}

// ---- Data Loading ----

async function loadChannels() {
  try {
    const response = await api("/channels");
    return response.data || [];
  } catch {
    return [];
  }
}

async function loadChannelMessages(channelName) {
  if (messageList == null || channelName == null) {
    return;
  }

  messageList.innerHTML = '<div class="flex-center p-4"><div class="spinner"></div></div>';

  try {
    const response = await api(`/channels/${encodeURIComponent(channelName)}/messages`);
    const data = response.data || {};
    messages = data.messages || [];
  } catch {
    messages = [];
  }

  renderMessages();
}

// ---- Lifecycle ----

export async function mount(mountContainer) {
  container = mountContainer;
  container.innerHTML = "";

  const title = document.createElement("h1");
  title.className = "section-title";
  title.textContent = "Channels";
  container.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.className = "section-subtitle";
  subtitle.textContent = "Read-only channel chat view";
  container.appendChild(subtitle);

  const channels = await loadChannels();

  if (channels.length === 0) {
    renderNoKeysWarning(container);
  }

  const chatCard = document.createElement("div");
  chatCard.className = "card";
  container.appendChild(chatCard);

  const select = renderChannelSelector(chatCard, channels);

  messageList = document.createElement("div");
  messageList.style.cssText = `
    max-height:28rem;overflow-y:auto;
    border:1px solid var(--color-border);border-radius:var(--radius-sm);
    padding:0.75rem;background:var(--bg);
  `;

  const emptyState = document.createElement("div");
  emptyState.style.cssText = "text-align:center;color:var(--text-secondary);padding:2rem;font-size:0.875rem;";
  emptyState.textContent = channels.length > 0
    ? "Select a channel to view messages"
    : "No channels available";
  messageList.appendChild(emptyState);

  chatCard.appendChild(messageList);

  // Auto-select first channel
  if (channels.length > 0) {
    activeChannel = channels[0].name || channels[0];
    select.value = activeChannel;
    loadChannelMessages(activeChannel);
  }

  // WebSocket subscription for real-time messages
  wsHandler = (msg) => {
    const data = msg.data || msg;
    if (data.channel === activeChannel) {
      messages = [...messages, data];
      renderMessages();
    }
  };
  ws.on("channel_message", wsHandler);
}

export function unmount() {
  if (wsHandler) {
    ws.off("channel_message", wsHandler);
    wsHandler = null;
  }
  container = null;
  messageList = null;
  activeChannel = null;
  messages = [];
}
