// NodakMesh Dashboard - Repeaters Page

import { getRepeaters } from "../api.js";
import { createDataTable } from "../components/data-table.js";

let dataTable = null;
let allRepeaters = [];
let activeFilter = "all";

const FIVE_MINUTES_MS = 300_000;
const ONE_DAY_MS = 86_400_000;

function getNodeStatus(node) {
  if (!node.lastSeen) {
    return "offline";
  }
  const elapsed = Date.now() - new Date(node.lastSeen).getTime();
  if (elapsed < FIVE_MINUTES_MS) {
    return "active";
  }
  if (elapsed < ONE_DAY_MS) {
    return "stale";
  }
  return "offline";
}

function getStatusDot(status) {
  const colors = {
    active: "#10b981",
    stale: "#f59e0b",
    offline: "#ef4444",
  };
  const color = colors[status] || colors.offline;
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return `<span style="display:inline-flex;align-items:center;gap:0.375rem;">
    <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;"></span>
    ${label}
  </span>`;
}

function formatDate(ts) {
  if (!ts) {
    return "-";
  }
  try {
    return new Date(ts).toLocaleDateString();
  } catch {
    return "-";
  }
}

function formatDateTime(ts) {
  if (!ts) {
    return "-";
  }
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "-";
  }
}

const REPEATER_COLUMNS = [
  {
    key: "name",
    label: "Name",
    sortable: true,
    render: (val, row) => val || row.id || "Unknown",
  },
  {
    key: "role",
    label: "Role",
    sortable: true,
    render: (val) => {
      const label = val === "room_server" ? "Room Server" : "Repeater";
      const badge = val === "room_server" ? "badge-amber" : "badge-cyan";
      return `<span class="badge ${badge}">${label}</span>`;
    },
  },
  {
    key: "firstSeen",
    label: "First Seen",
    sortable: true,
    render: (val) => formatDate(val),
  },
  {
    key: "lastSeen",
    label: "Last Seen",
    sortable: true,
    render: (val) => formatDateTime(val),
  },
  {
    key: "packetCount",
    label: "Packets",
    sortable: true,
    render: (val) => val ?? 0,
  },
  {
    key: "avgSnr",
    label: "Avg SNR",
    sortable: true,
    render: (val) => val != null ? `${val.toFixed(1)} dB` : "-",
  },
  {
    key: "_status",
    label: "Status",
    sortable: false,
    render: (_val, row) => getStatusDot(getNodeStatus(row)),
  },
];

function filterRepeaters(repeaters, filter) {
  switch (filter) {
    case "repeaters":
      return repeaters.filter((r) => r.role === "repeater");
    case "room_servers":
      return repeaters.filter((r) => r.role === "room_server");
    case "offline":
      return repeaters.filter((r) => getNodeStatus(r) === "offline");
    default:
      return repeaters;
  }
}

function buildFilterTabs(container, onFilterChange) {
  const tabs = document.createElement("div");
  tabs.style.cssText = "display:flex;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap;";

  const filters = [
    { key: "all", label: "All" },
    { key: "repeaters", label: "Repeaters" },
    { key: "room_servers", label: "Room Servers" },
    { key: "offline", label: "Offline" },
  ];

  const buttons = [];

  for (const filter of filters) {
    const btn = document.createElement("button");
    btn.className = filter.key === activeFilter ? "btn btn-primary" : "btn btn-secondary";
    btn.textContent = filter.label;
    btn.addEventListener("click", () => {
      activeFilter = filter.key;
      for (const b of buttons) {
        b.className = "btn btn-secondary";
      }
      btn.className = "btn btn-primary";
      onFilterChange(filter.key);
    });
    buttons.push(btn);
    tabs.appendChild(btn);
  }

  container.appendChild(tabs);
}

function buildSearchInput(container, onSearch) {
  const input = document.createElement("input");
  input.className = "input";
  input.style.cssText = "width:250px;margin-bottom:1rem;";
  input.placeholder = "Search by name...";
  input.addEventListener("input", () => {
    onSearch(input.value);
  });
  container.appendChild(input);
}

function handleRowClick(row) {
  const id = row.id;
  if (id) {
    window.location.hash = `#/repeaters/${encodeURIComponent(id)}`;
  }
}

export function mount(container) {
  container.innerHTML = "";
  activeFilter = "all";

  const title = document.createElement("h1");
  title.className = "section-title";
  title.textContent = "Repeaters";
  container.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.className = "section-subtitle";
  subtitle.textContent = "Repeater and room server directory";
  container.appendChild(subtitle);

  // Filter tabs
  buildFilterTabs(container, (filter) => {
    const filtered = filterRepeaters(allRepeaters, filter);
    if (dataTable) {
      dataTable.update(filtered);
    }
  });

  // Search input
  buildSearchInput(container, (query) => {
    if (dataTable) {
      dataTable.setFilter("name", query);
    }
  });

  // Table
  const tableCard = document.createElement("div");
  tableCard.className = "card";
  container.appendChild(tableCard);

  loadRepeaters(tableCard);
}

async function loadRepeaters(tableCard) {
  try {
    const response = await getRepeaters();
    allRepeaters = response.data || [];
  } catch {
    allRepeaters = [];
  }

  dataTable = createDataTable(tableCard, {
    columns: REPEATER_COLUMNS,
    data: allRepeaters,
    onRowClick: handleRowClick,
    emptyMessage: "No repeaters found",
  });
}

export function unmount() {
  dataTable = null;
  allRepeaters = [];
  activeFilter = "all";
}
