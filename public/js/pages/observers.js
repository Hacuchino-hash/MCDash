// NodakMesh Dashboard - Observers Page

import { getObservers } from "../api.js";
import { createStatsBar } from "../components/stats-bar.js";
import { createDataTable } from "../components/data-table.js";

let statsBar = null;
let dataTable = null;

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
    label: "Last Heartbeat",
    sortable: true,
    render: (val) => formatTimestamp(val),
  },
  {
    key: "packetCount",
    label: "Packets",
    sortable: true,
    render: (val) => val ?? "-",
  },
  {
    key: "connectedBrokers",
    label: "Connected Brokers",
    sortable: false,
    render: (val) => {
      if (Array.isArray(val)) {
        return val.length > 0 ? val.join(", ") : "-";
      }
      return val || "-";
    },
  },
];

function handleRowClick(row) {
  const id = row.id;
  if (id) {
    window.location.hash = `#/observers/${encodeURIComponent(id)}`;
  }
}

export function mount(container) {
  container.innerHTML = "";

  const title = document.createElement("h1");
  title.className = "section-title";
  title.textContent = "Observers";
  container.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.className = "section-subtitle";
  subtitle.textContent = "MQTT observer node status and monitoring";
  container.appendChild(subtitle);

  // Stats row
  const statsContainer = document.createElement("div");
  statsContainer.className = "mb-4";
  container.appendChild(statsContainer);

  // Table
  const tableCard = document.createElement("div");
  tableCard.className = "card";
  container.appendChild(tableCard);

  loadObservers(statsContainer, tableCard);
}

async function loadObservers(statsContainer, tableCard) {
  let observers = [];

  try {
    const response = await getObservers();
    observers = response.data || [];
  } catch {
    observers = [];
  }

  const totalCount = observers.length;
  const onlineCount = observers.filter((o) => o.status === "online").length;
  const offlineCount = totalCount - onlineCount;

  statsBar = createStatsBar(statsContainer, [
    { label: "Total Observers", value: totalCount },
    { label: "Online", value: onlineCount },
    { label: "Offline", value: offlineCount },
  ]);

  dataTable = createDataTable(tableCard, {
    columns: OBSERVER_COLUMNS,
    data: observers,
    onRowClick: handleRowClick,
    emptyMessage: "No observers registered",
  });
}

export function unmount() {
  statsBar = null;
  dataTable = null;
}
