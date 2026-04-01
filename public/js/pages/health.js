// NodakMesh Dashboard - Health Dashboard Page

import { getHealth, getObservers } from "../api.js";
import { createHealthGauge } from "../components/health-gauge.js";
import { createStatsBar } from "../components/stats-bar.js";
import { createDataTable } from "../components/data-table.js";
import { createChart } from "../components/chart-wrapper.js";

let healthGauge = null;
let statsBar = null;
let observerTable = null;
let componentCharts = [];

const COMPONENT_LABELS = {
  observerAvailability: "Observer Availability",
  packetDeliveryRate: "Packet Delivery Rate",
  averageSnr: "Average SNR",
  nodeChurnRate: "Node Stability",
  repeaterUptime: "Repeater Uptime",
};

const SEVERITY_STYLES = {
  error: { color: "#ef4444", icon: "\u26D4" },
  warning: { color: "#f59e0b", icon: "\u26A0" },
  info: { color: "#06b6d4", icon: "\u2139" },
};

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

function renderComponentBars(container, components) {
  const wrapper = document.createElement("div");
  wrapper.className = "card mb-4";

  const title = document.createElement("div");
  title.style.cssText = "font-weight:600;margin-bottom:1rem;";
  title.textContent = "Health Components";
  wrapper.appendChild(title);

  const entries = Object.entries(components || {});

  for (const [key, value] of entries) {
    const row = document.createElement("div");
    row.style.cssText = "margin-bottom:0.75rem;";

    const labelRow = document.createElement("div");
    labelRow.style.cssText = "display:flex;justify-content:space-between;margin-bottom:0.25rem;font-size:0.8125rem;";

    const label = document.createElement("span");
    label.textContent = COMPONENT_LABELS[key] || key;
    label.style.color = "var(--text-secondary)";

    const valueSpan = document.createElement("span");
    valueSpan.textContent = `${value}%`;
    valueSpan.style.fontWeight = "600";

    labelRow.appendChild(label);
    labelRow.appendChild(valueSpan);
    row.appendChild(labelRow);

    const barBg = document.createElement("div");
    barBg.style.cssText = "height:8px;border-radius:4px;background:var(--color-border);overflow:hidden;";

    const barFill = document.createElement("div");
    const color = value >= 80 ? "#10b981" : value >= 50 ? "#f59e0b" : "#ef4444";
    barFill.style.cssText = `height:100%;border-radius:4px;background:${color};width:${value}%;transition:width 0.5s ease;`;

    barBg.appendChild(barFill);
    row.appendChild(barBg);
    wrapper.appendChild(row);
  }

  container.appendChild(wrapper);
}

function renderAlerts(container, alerts) {
  const card = document.createElement("div");
  card.className = "card mb-4";

  const title = document.createElement("div");
  title.style.cssText = "font-weight:600;margin-bottom:0.75rem;";
  title.textContent = "Active Alerts";
  card.appendChild(title);

  if (!alerts || alerts.length === 0) {
    const empty = document.createElement("div");
    empty.style.cssText = "text-align:center;color:var(--text-secondary);padding:1rem;font-size:0.875rem;";
    empty.textContent = "No active alerts";
    card.appendChild(empty);
    container.appendChild(card);
    return;
  }

  for (const alert of alerts) {
    const row = document.createElement("div");
    row.style.cssText = `
      display:flex;align-items:flex-start;gap:0.75rem;
      padding:0.625rem 0;border-bottom:1px solid var(--color-border);
      font-size:0.8125rem;
    `;

    const severity = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info;

    const icon = document.createElement("span");
    icon.textContent = severity.icon;
    icon.style.cssText = `flex-shrink:0;font-size:1rem;color:${severity.color};`;

    const message = document.createElement("span");
    message.textContent = alert.message;
    message.style.cssText = "flex:1;color:var(--color-text-primary);";

    const time = document.createElement("span");
    time.textContent = formatTimestamp(alert.timestamp);
    time.style.cssText = "flex-shrink:0;color:var(--text-secondary);font-size:0.75rem;";

    row.appendChild(icon);
    row.appendChild(message);
    row.appendChild(time);
    card.appendChild(row);
  }

  container.appendChild(card);
}

function renderHealthTimeline(container) {
  const card = document.createElement("div");
  card.className = "card mb-4";

  const title = document.createElement("div");
  title.style.cssText = "font-weight:600;margin-bottom:0.75rem;";
  title.textContent = "Health Timeline (7 days)";
  card.appendChild(title);

  const placeholder = document.createElement("div");
  placeholder.style.cssText = "text-align:center;color:var(--text-secondary);padding:2rem;font-size:0.875rem;";
  placeholder.textContent = "Coming soon — health history snapshots will appear here";
  card.appendChild(placeholder);

  container.appendChild(card);
}

function renderTopologyPlaceholder(container) {
  const card = document.createElement("div");
  card.className = "card mb-4";

  const title = document.createElement("div");
  title.style.cssText = "font-weight:600;margin-bottom:0.75rem;";
  title.textContent = "Network Topology";
  card.appendChild(title);

  const placeholder = document.createElement("div");
  placeholder.style.cssText = "text-align:center;color:var(--text-secondary);padding:2rem;font-size:0.875rem;";
  placeholder.textContent = "Coming soon — network topology visualization will appear here";
  card.appendChild(placeholder);

  container.appendChild(card);
}

const OBSERVER_COLUMNS = [
  {
    key: "name",
    label: "Name",
    sortable: true,
    render: (val, row) => val || row.id || "Unknown",
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    render: (val) => {
      const isOnline = val === "online";
      const color = isOnline ? "#10b981" : "#ef4444";
      const label = isOnline ? "Online" : "Offline";
      return `<span style="display:inline-flex;align-items:center;gap:0.375rem;">
        <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;"></span>
        ${label}
      </span>`;
    },
  },
  {
    key: "firmware",
    label: "Firmware",
    sortable: true,
    render: (val) => val || "-",
  },
  {
    key: "lastHeartbeat",
    label: "Last Seen",
    sortable: true,
    render: (val) => formatTimestamp(val),
  },
  {
    key: "packetCount",
    label: "Packets (24h)",
    sortable: true,
    render: (val) => val ?? "-",
  },
];

export function mount(container) {
  container.innerHTML = "";

  const title = document.createElement("h1");
  title.className = "section-title";
  title.textContent = "Network Health";
  container.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.className = "section-subtitle";
  subtitle.textContent = "Composite health score and mesh diagnostics";
  container.appendChild(subtitle);

  // Top row: gauge + components
  const topRow = document.createElement("div");
  topRow.className = "grid-2 mb-4";
  container.appendChild(topRow);

  const gaugeCard = document.createElement("div");
  gaugeCard.className = "card";
  gaugeCard.innerHTML = '<div style="font-weight:600;margin-bottom:0.75rem;">Health Score</div>';
  const gaugeMount = document.createElement("div");
  gaugeMount.className = "flex-center";
  gaugeCard.appendChild(gaugeMount);
  topRow.appendChild(gaugeCard);

  const componentContainer = document.createElement("div");
  topRow.appendChild(componentContainer);

  // Alert panel
  const alertContainer = document.createElement("div");
  container.appendChild(alertContainer);

  // Health timeline
  renderHealthTimeline(container);

  // Observer table
  const observerCard = document.createElement("div");
  observerCard.className = "card mb-4";
  observerCard.innerHTML = '<div style="font-weight:600;margin-bottom:0.75rem;">Observer Status</div>';
  const tableMount = document.createElement("div");
  observerCard.appendChild(tableMount);
  container.appendChild(observerCard);

  // Topology placeholder
  renderTopologyPlaceholder(container);

  // Load data
  loadHealthData(gaugeMount, componentContainer, alertContainer, tableMount);
}

async function loadHealthData(gaugeMount, componentContainer, alertContainer, tableMount) {
  try {
    const healthResponse = await getHealth();
    const data = healthResponse.data || {};

    const score = data.score ?? 0;
    healthGauge = createHealthGauge(gaugeMount, score);

    if (data.components) {
      renderComponentBars(componentContainer, data.components);
    }

    renderAlerts(alertContainer, data.alerts || []);
  } catch {
    healthGauge = createHealthGauge(gaugeMount, 0);

    const errorMsg = document.createElement("div");
    errorMsg.className = "card";
    errorMsg.style.cssText = "text-align:center;color:var(--text-secondary);padding:1rem;";
    errorMsg.textContent = "Unable to load health data";
    componentContainer.appendChild(errorMsg);
  }

  try {
    const observerResponse = await getObservers();
    const observers = observerResponse.data || [];

    observerTable = createDataTable(tableMount, {
      columns: OBSERVER_COLUMNS,
      data: observers,
      emptyMessage: "No observers registered",
    });
  } catch {
    observerTable = createDataTable(tableMount, {
      columns: OBSERVER_COLUMNS,
      data: [],
      emptyMessage: "Unable to load observer data",
    });
  }
}

export function unmount() {
  healthGauge = null;
  statsBar = null;
  observerTable = null;
  componentCharts = [];
}
