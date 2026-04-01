// NodakMesh Dashboard - Packet Tracing Page

import { api } from "../api.js";
import { createMap } from "../components/map-base.js";

let container = null;
let mapInstance = null;
let resultsArea = null;

// ---- Rendering ----

function formatTimestamp(ts) {
  if (!ts) {
    return "-";
  }
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "-";
  }
}

function renderSearchBar(parent) {
  const wrapper = document.createElement("div");
  wrapper.className = "card mb-4";
  wrapper.style.cssText = "display:flex;gap:0.75rem;align-items:center;";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "input";
  input.placeholder = "Enter packet hash to trace";
  input.style.cssText = "flex:1;";
  input.id = "trace-hash-input";

  const btn = document.createElement("button");
  btn.className = "btn btn-primary";
  btn.textContent = "Trace";

  const handleSearch = () => {
    const hash = input.value.trim();
    if (hash.length > 0) {
      searchTrace(hash);
    }
  };

  btn.addEventListener("click", handleSearch);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  });

  wrapper.appendChild(input);
  wrapper.appendChild(btn);
  parent.appendChild(wrapper);

  return input;
}

function renderTimeline(parent, hops) {
  const card = document.createElement("div");
  card.className = "card mb-4";

  const title = document.createElement("div");
  title.style.cssText = "font-weight:600;margin-bottom:1rem;";
  title.textContent = "Packet Timeline";
  card.appendChild(title);

  if (!hops || hops.length === 0) {
    const empty = document.createElement("div");
    empty.style.cssText = "text-align:center;color:var(--text-secondary);padding:1rem;font-size:0.875rem;";
    empty.textContent = "No hop data available";
    card.appendChild(empty);
    parent.appendChild(card);
    return;
  }

  for (let i = 0; i < hops.length; i++) {
    const hop = hops[i];
    const row = document.createElement("div");
    row.style.cssText = `
      display:flex;align-items:center;gap:0.75rem;
      padding:0.625rem 0;border-bottom:1px solid var(--border);
      font-size:0.8125rem;
    `;

    // Timeline connector
    const connector = document.createElement("div");
    connector.style.cssText = `
      display:flex;flex-direction:column;align-items:center;flex-shrink:0;width:1.5rem;
    `;

    const dot = document.createElement("div");
    dot.style.cssText = `
      width:10px;height:10px;border-radius:50%;
      background:${i === 0 ? "#10b981" : "var(--accent)"};
    `;
    connector.appendChild(dot);

    const info = document.createElement("div");
    info.style.cssText = "flex:1;";

    const observerName = document.createElement("div");
    observerName.style.cssText = "font-weight:500;color:var(--text-primary);";
    observerName.textContent = hop.observer || hop.observerId || `Hop ${i + 1}`;

    const details = document.createElement("div");
    details.style.cssText = "color:var(--text-secondary);font-size:0.75rem;margin-top:0.125rem;";

    const detailParts = [];
    if (hop.snr != null) {
      detailParts.push(`SNR: ${hop.snr} dB`);
    }
    if (hop.rssi != null) {
      detailParts.push(`RSSI: ${hop.rssi} dBm`);
    }
    details.textContent = detailParts.join(" | ") || "No signal data";

    info.appendChild(observerName);
    info.appendChild(details);

    const time = document.createElement("span");
    time.style.cssText = "color:var(--text-secondary);font-size:0.75rem;flex-shrink:0;";
    time.textContent = formatTimestamp(hop.timestamp);

    row.appendChild(connector);
    row.appendChild(info);
    row.appendChild(time);
    card.appendChild(row);
  }

  parent.appendChild(card);
}

function renderMapVisualization(parent, hops) {
  const card = document.createElement("div");
  card.className = "card mb-4";

  const title = document.createElement("div");
  title.style.cssText = "font-weight:600;margin-bottom:0.75rem;";
  title.textContent = "Packet Path";
  card.appendChild(title);

  const mapContainer = document.createElement("div");
  mapContainer.style.cssText = "height:400px;border-radius:var(--radius);overflow:hidden;";
  card.appendChild(mapContainer);
  parent.appendChild(card);

  // Only render map if we have GPS data
  const gpsHops = (hops || []).filter(
    (h) => h.latitude != null && h.longitude != null,
  );

  if (gpsHops.length === 0) {
    mapContainer.style.cssText = "text-align:center;color:var(--text-secondary);padding:2rem;font-size:0.875rem;";
    mapContainer.textContent = "No GPS data available for this packet path";
    return;
  }

  try {
    mapInstance = createMap(mapContainer);

    for (let i = 0; i < gpsHops.length; i++) {
      const hop = gpsHops[i];
      const isFirst = i === 0;
      const isLast = i === gpsHops.length - 1;

      mapInstance.addMarker(hop.latitude, hop.longitude, {
        color: isFirst ? "#10b981" : isLast ? "#ef4444" : "#06b6d4",
        popup: `<b>${hop.observer || `Hop ${i + 1}`}</b><br>SNR: ${hop.snr ?? "-"} dB<br>RSSI: ${hop.rssi ?? "-"} dBm`,
      });
    }

    // Draw line between hops
    if (gpsHops.length >= 2) {
      const points = gpsHops.map((h) => [h.latitude, h.longitude]);
      mapInstance.addLine(points, { color: "#06b6d4", weight: 3 });
    }

    mapInstance.fitBounds();
  } catch {
    mapContainer.style.cssText = "text-align:center;color:var(--text-secondary);padding:2rem;font-size:0.875rem;";
    mapContainer.textContent = "Unable to load map";
  }
}

function renderNotFound(parent, hash) {
  const card = document.createElement("div");
  card.className = "card";
  card.style.cssText = "text-align:center;padding:2rem;";

  const icon = document.createElement("div");
  icon.style.cssText = "font-size:2rem;margin-bottom:0.75rem;";
  icon.textContent = "\uD83D\uDD0D";

  const text = document.createElement("div");
  text.style.cssText = "color:var(--text-secondary);font-size:0.875rem;";
  text.textContent = "Packet not found";

  const hashDisplay = document.createElement("div");
  hashDisplay.style.cssText = "color:var(--text-secondary);font-size:0.75rem;margin-top:0.5rem;font-family:monospace;";
  hashDisplay.textContent = hash;

  card.appendChild(icon);
  card.appendChild(text);
  card.appendChild(hashDisplay);
  parent.appendChild(card);
}

// ---- Data Loading ----

async function searchTrace(hash) {
  if (resultsArea == null) {
    return;
  }

  // Clean up previous map
  if (mapInstance) {
    mapInstance.destroy();
    mapInstance = null;
  }

  resultsArea.innerHTML = '<div class="flex-center p-4"><div class="spinner"></div></div>';

  try {
    const response = await api(`/traces/${encodeURIComponent(hash)}`);
    const data = response.data || {};
    const hops = data.hops || [];

    resultsArea.innerHTML = "";

    if (hops.length === 0) {
      renderNotFound(resultsArea, hash);
      return;
    }

    renderTimeline(resultsArea, hops);
    renderMapVisualization(resultsArea, hops);
  } catch {
    resultsArea.innerHTML = "";
    renderNotFound(resultsArea, hash);
  }
}

function getHashFromUrl() {
  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  return params.get("hash") || null;
}

// ---- Lifecycle ----

export function mount(mountContainer) {
  container = mountContainer;
  container.innerHTML = "";

  const title = document.createElement("h1");
  title.className = "section-title";
  title.textContent = "Packet Trace";
  container.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.className = "section-subtitle";
  subtitle.textContent = "Trace a packet's path through the mesh network";
  container.appendChild(subtitle);

  const input = renderSearchBar(container);

  resultsArea = document.createElement("div");
  container.appendChild(resultsArea);

  // Auto-search if hash param in URL
  const urlHash = getHashFromUrl();
  if (urlHash) {
    input.value = urlHash;
    searchTrace(urlHash);
  }
}

export function unmount() {
  if (mapInstance) {
    mapInstance.destroy();
    mapInstance = null;
  }
  container = null;
  resultsArea = null;
}
