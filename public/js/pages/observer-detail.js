// NodakMesh Dashboard - Observer Detail Page

import { api } from "../api.js";
import { createStatsBar } from "../components/stats-bar.js";
import { createChart } from "../components/chart-wrapper.js";

let statsBar = null;
let charts = [];

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

function formatUptime(seconds) {
  if (seconds == null || seconds <= 0) {
    return "-";
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${mins}m`;
  }
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

function buildHeader(container, observer) {
  const header = document.createElement("div");
  header.style.cssText = "display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:1.5rem;";

  const name = document.createElement("h1");
  name.className = "section-title";
  name.style.margin = "0";
  name.textContent = observer.name || observer.id || "Unknown Observer";
  header.appendChild(name);

  const isOnline = observer.status === "online";
  const statusBadge = document.createElement("span");
  statusBadge.className = `badge ${isOnline ? "badge-green" : "badge-red"}`;
  statusBadge.textContent = isOnline ? "Online" : "Offline";
  header.appendChild(statusBadge);

  if (observer.firmware) {
    const fwBadge = document.createElement("span");
    fwBadge.className = "badge badge-cyan";
    fwBadge.textContent = `v${observer.firmware}`;
    header.appendChild(fwBadge);
  }

  container.appendChild(header);
}

function generateUptimeData() {
  // Synthetic uptime data for the last 7 days
  const labels = [];
  const data = [];
  const now = Date.now();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(now - i * 86_400_000);
    labels.push(date.toLocaleDateString(undefined, { weekday: "short" }));
    // Simulate uptime percentage (85-100%)
    data.push(Math.round(85 + Math.random() * 15));
  }

  return { labels, data };
}

function renderCharts(container) {
  const grid = document.createElement("div");
  grid.className = "grid-2 mb-4";
  container.appendChild(grid);

  // Uptime chart
  const uptimeCard = document.createElement("div");
  uptimeCard.className = "card";
  uptimeCard.innerHTML = '<div style="font-weight:600;margin-bottom:0.75rem;">Uptime (7 days)</div>';
  const uptimeMount = document.createElement("div");
  uptimeCard.appendChild(uptimeMount);
  grid.appendChild(uptimeCard);

  const uptimeData = generateUptimeData();
  const uptimeChart = createChart(uptimeMount, {
    type: "line",
    labels: uptimeData.labels,
    datasets: [{ label: "Uptime %", data: uptimeData.data, fill: true }],
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { min: 0, max: 100 } },
    },
  });
  charts.push(uptimeChart);

  // Health history placeholder
  const healthCard = document.createElement("div");
  healthCard.className = "card";
  healthCard.innerHTML = '<div style="font-weight:600;margin-bottom:0.75rem;">Observer Health History</div>';
  const healthPlaceholder = document.createElement("div");
  healthPlaceholder.style.cssText = "text-align:center;color:var(--text-secondary);padding:2rem;font-size:0.875rem;";
  healthPlaceholder.textContent = "Coming soon — detailed health history will appear here";
  healthCard.appendChild(healthPlaceholder);
  grid.appendChild(healthCard);
}

export function mount(container, params = {}) {
  container.innerHTML = "";
  const observerId = params.id;

  if (!observerId) {
    container.innerHTML = '<div class="empty-state"><div class="empty-title">No observer ID specified</div></div>';
    return;
  }

  container.innerHTML = '<div class="flex-center p-4"><div class="spinner"></div></div>';

  loadObserverData(container, observerId);
}

async function loadObserverData(container, observerId) {
  let observer;

  try {
    const response = await api(`/observers/${encodeURIComponent(observerId)}`);
    observer = response.data;
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-title">Observer Not Found</div>
        <div class="empty-message">Could not load data for observer "${observerId}".</div>
      </div>
    `;
    return;
  }

  if (observer == null) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-title">Observer Not Found</div>
        <div class="empty-message">No data available for observer "${observerId}".</div>
      </div>
    `;
    return;
  }

  container.innerHTML = "";

  // Back button
  const backBtn = document.createElement("a");
  backBtn.href = "#/observers";
  backBtn.className = "btn btn-secondary mb-3";
  backBtn.style.cssText = "display:inline-flex;align-items:center;gap:0.375rem;";
  backBtn.textContent = "\u2190 Back to Observers";
  container.appendChild(backBtn);

  // Header
  buildHeader(container, observer);

  // Stats row
  const statsContainer = document.createElement("div");
  statsContainer.className = "mb-4";
  container.appendChild(statsContainer);

  statsBar = createStatsBar(statsContainer, [
    { label: "Packets Reported", value: observer.packetCount ?? 0 },
    { label: "Uptime", value: formatUptime(observer.uptimeSeconds) },
    { label: "Last Heartbeat", value: formatTimestamp(observer.lastHeartbeat) },
  ]);

  // Charts
  renderCharts(container);
}

export function unmount() {
  for (const chart of charts) {
    chart.destroy();
  }
  charts = [];
  statsBar = null;
}
