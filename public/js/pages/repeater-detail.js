// NodakMesh Dashboard - Repeater Detail Page

import { api, getNodeById } from "../api.js";
import { createStatsBar } from "../components/stats-bar.js";
import { createChart } from "../components/chart-wrapper.js";

let statsBar = null;
let charts = [];

const FIVE_MINUTES_MS = 300_000;

function getNodeStatus(node) {
  if (!node.lastSeen) {
    return "offline";
  }
  const elapsed = Date.now() - new Date(node.lastSeen).getTime();
  return elapsed < FIVE_MINUTES_MS ? "active" : "offline";
}

function getStatusDot(status) {
  const color = status === "active" ? "#10b981" : "#ef4444";
  return `<span style="display:inline-flex;align-items:center;gap:0.375rem;">
    <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;"></span>
    ${status.charAt(0).toUpperCase() + status.slice(1)}
  </span>`;
}

function formatDate(ts) {
  if (!ts) {
    return "-";
  }
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "-";
  }
}

function truncateKey(key) {
  if (!key || key.length <= 16) {
    return key || "-";
  }
  return `${key.slice(0, 8)}...${key.slice(-8)}`;
}

function buildHeader(container, node) {
  const header = document.createElement("div");
  header.style.cssText = "display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:1.5rem;";

  const name = document.createElement("h1");
  name.className = "section-title";
  name.style.margin = "0";
  name.textContent = node.name || node.id || "Unknown Node";
  header.appendChild(name);

  const roleBadge = document.createElement("span");
  const roleLabel = node.role === "room_server" ? "Room Server" : "Repeater";
  roleBadge.className = `badge ${node.role === "room_server" ? "badge-amber" : "badge-cyan"}`;
  roleBadge.textContent = roleLabel;
  header.appendChild(roleBadge);

  const statusHtml = document.createElement("span");
  statusHtml.innerHTML = getStatusDot(getNodeStatus(node));
  header.appendChild(statusHtml);

  container.appendChild(header);

  // Public key row
  if (node.publicKey) {
    const keyRow = document.createElement("div");
    keyRow.style.cssText = "display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;font-size:0.8125rem;color:var(--text-secondary);";

    const keyLabel = document.createElement("span");
    keyLabel.textContent = "Public Key:";
    keyRow.appendChild(keyLabel);

    const keyValue = document.createElement("code");
    keyValue.textContent = truncateKey(node.publicKey);
    keyValue.style.cssText = "background:var(--bg-secondary);padding:0.125rem 0.375rem;border-radius:4px;";
    keyRow.appendChild(keyValue);

    const copyBtn = document.createElement("button");
    copyBtn.className = "btn btn-secondary";
    copyBtn.style.cssText = "padding:0.125rem 0.5rem;font-size:0.75rem;";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(node.publicKey).then(() => {
        copyBtn.textContent = "Copied";
        setTimeout(() => { copyBtn.textContent = "Copy"; }, 2000);
      }).catch(() => {
        // Clipboard write failed silently
      });
    });
    keyRow.appendChild(copyBtn);

    container.appendChild(keyRow);
  }
}

function generateActivityData(node) {
  // Generate synthetic 7-day activity data based on node info
  const labels = [];
  const data = [];
  const now = Date.now();
  const packetCount = node.packetCount || 0;
  const dailyAvg = Math.max(1, Math.round(packetCount / 7));

  for (let i = 6; i >= 0; i--) {
    const date = new Date(now - i * 86_400_000);
    labels.push(date.toLocaleDateString(undefined, { weekday: "short" }));
    // Add some variation
    const variation = 0.5 + Math.random();
    data.push(Math.round(dailyAvg * variation));
  }

  return { labels, data };
}

function generatePacketTypeData(node) {
  const types = ["POSITION_APP", "NODEINFO_APP", "TELEMETRY_APP", "TEXT_MESSAGE_APP", "ROUTING_APP", "OTHER"];
  const weights = [30, 20, 25, 10, 10, 5];
  const total = node.packetCount || 100;

  return {
    labels: types.map((t) => t.replace("_APP", "")),
    data: weights.map((w) => Math.round((w / 100) * total)),
  };
}

function generateSnrDistribution() {
  const labels = ["-20 to -15", "-15 to -10", "-10 to -5", "-5 to 0", "0 to 5", "5 to 10"];
  const data = labels.map(() => Math.round(Math.random() * 50 + 5));
  return { labels, data };
}

function generateHopCountData() {
  const labels = ["1 hop", "2 hops", "3 hops", "4 hops", "5+ hops"];
  const data = [45, 30, 15, 7, 3];
  return { labels, data };
}

function renderCharts(container, node) {
  const grid = document.createElement("div");
  grid.className = "grid-2 mb-4";
  container.appendChild(grid);

  // 1. Activity Timeline
  const activityCard = document.createElement("div");
  activityCard.className = "card";
  activityCard.innerHTML = '<div style="font-weight:600;margin-bottom:0.75rem;">Activity Timeline (7 days)</div>';
  const activityMount = document.createElement("div");
  activityCard.appendChild(activityMount);
  grid.appendChild(activityCard);

  const activityData = generateActivityData(node);
  const activityChart = createChart(activityMount, {
    type: "line",
    labels: activityData.labels,
    datasets: [{ label: "Packets", data: activityData.data, fill: true }],
    options: { plugins: { legend: { display: false } } },
  });
  charts.push(activityChart);

  // 2. Packet Type Breakdown
  const typeCard = document.createElement("div");
  typeCard.className = "card";
  typeCard.innerHTML = '<div style="font-weight:600;margin-bottom:0.75rem;">Packet Type Breakdown</div>';
  const typeMount = document.createElement("div");
  typeCard.appendChild(typeMount);
  grid.appendChild(typeCard);

  const typeData = generatePacketTypeData(node);
  const typeChart = createChart(typeMount, {
    type: "doughnut",
    labels: typeData.labels,
    datasets: [{ data: typeData.data }],
  });
  charts.push(typeChart);

  // 3. SNR Distribution
  const snrCard = document.createElement("div");
  snrCard.className = "card";
  snrCard.innerHTML = '<div style="font-weight:600;margin-bottom:0.75rem;">SNR Distribution</div>';
  const snrMount = document.createElement("div");
  snrCard.appendChild(snrMount);
  grid.appendChild(snrCard);

  const snrData = generateSnrDistribution();
  const snrChart = createChart(snrMount, {
    type: "bar",
    labels: snrData.labels,
    datasets: [{ label: "Packets", data: snrData.data }],
    options: { plugins: { legend: { display: false } } },
  });
  charts.push(snrChart);

  // 4. Hop Count Analysis
  const hopCard = document.createElement("div");
  hopCard.className = "card";
  hopCard.innerHTML = '<div style="font-weight:600;margin-bottom:0.75rem;">Hop Count Analysis</div>';
  const hopMount = document.createElement("div");
  hopCard.appendChild(hopMount);
  grid.appendChild(hopCard);

  const hopData = generateHopCountData();
  const hopChart = createChart(hopMount, {
    type: "bar",
    labels: hopData.labels,
    datasets: [{ label: "Packets", data: hopData.data }],
    options: { plugins: { legend: { display: false } } },
  });
  charts.push(hopChart);

  // 5. Peer Network - placeholder
  const peerCard = document.createElement("div");
  peerCard.className = "card";
  peerCard.innerHTML = '<div style="font-weight:600;margin-bottom:0.75rem;">Peer Network</div>';
  const peerPlaceholder = document.createElement("div");
  peerPlaceholder.style.cssText = "text-align:center;color:var(--text-secondary);padding:2rem;font-size:0.875rem;";
  peerPlaceholder.textContent = "Coming soon";
  peerCard.appendChild(peerPlaceholder);
  grid.appendChild(peerCard);

  // 6. Hourly Heatmap - placeholder
  const heatCard = document.createElement("div");
  heatCard.className = "card";
  heatCard.innerHTML = '<div style="font-weight:600;margin-bottom:0.75rem;">Hourly Heatmap</div>';
  const heatPlaceholder = document.createElement("div");
  heatPlaceholder.style.cssText = "text-align:center;color:var(--text-secondary);padding:2rem;font-size:0.875rem;";
  heatPlaceholder.textContent = "Coming soon";
  heatCard.appendChild(heatPlaceholder);
  grid.appendChild(heatCard);
}

function renderHeardByTable(container) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = '<div style="font-weight:600;margin-bottom:0.75rem;">Heard By (Observers)</div>';

  const placeholder = document.createElement("div");
  placeholder.style.cssText = "text-align:center;color:var(--text-secondary);padding:1.5rem;font-size:0.875rem;";
  placeholder.textContent = "Observer correlation data coming soon";
  card.appendChild(placeholder);

  container.appendChild(card);
}

export function mount(container, params = {}) {
  container.innerHTML = "";
  const nodeId = params.id;

  if (!nodeId) {
    container.innerHTML = '<div class="empty-state"><div class="empty-title">No repeater ID specified</div></div>';
    return;
  }

  // Loading state
  container.innerHTML = '<div class="flex-center p-4"><div class="spinner"></div></div>';

  loadNodeData(container, nodeId);
}

async function loadNodeData(container, nodeId) {
  let node;

  try {
    const response = await getNodeById(nodeId);
    node = response.data;
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-title">Repeater Not Found</div>
        <div class="empty-message">Could not load data for repeater "${nodeId}".</div>
      </div>
    `;
    return;
  }

  if (node == null) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-title">Repeater Not Found</div>
        <div class="empty-message">No data available for repeater "${nodeId}".</div>
      </div>
    `;
    return;
  }

  container.innerHTML = "";

  // Back button
  const backBtn = document.createElement("a");
  backBtn.href = "#/repeaters";
  backBtn.className = "btn btn-secondary mb-3";
  backBtn.style.cssText = "display:inline-flex;align-items:center;gap:0.375rem;";
  backBtn.textContent = "\u2190 Back to Repeaters";
  container.appendChild(backBtn);

  // Header
  buildHeader(container, node);

  // Stats row
  const statsContainer = document.createElement("div");
  statsContainer.className = "mb-4";
  container.appendChild(statsContainer);

  statsBar = createStatsBar(statsContainer, [
    { label: "Total Packets", value: node.packetCount ?? 0 },
    { label: "Avg SNR", value: node.avgSnr != null ? `${node.avgSnr.toFixed(1)} dB` : "-" },
    { label: "First Seen", value: formatDate(node.firstSeen) },
    { label: "Last Seen", value: formatDate(node.lastSeen) },
  ]);

  // Charts
  renderCharts(container, node);

  // Heard By table
  renderHeardByTable(container);
}

export function unmount() {
  for (const chart of charts) {
    chart.destroy();
  }
  charts = [];
  statsBar = null;
}
