// NodakMesh Dashboard - Packets Page (Real-Time Packet Feed)

import { getPackets, getPacketByHash } from "../api.js";
import { ws } from "../app.js";
import { createDataTable } from "../components/data-table.js";
import { createPacketDetail } from "../components/packet-detail.js";

let dataTable = null;
let wsHandler = null;
let allPackets = [];
let expandedHash = null;
let detailContainer = null;
let loadMoreBtn = null;
let currentOffset = 0;
const PAGE_SIZE = 50;

const PACKET_COLUMNS = [
  {
    key: "type",
    label: "Type",
    sortable: true,
    render: (val) => `<span class="badge badge-cyan">${val || "?"}</span>`,
  },
  {
    key: "source",
    label: "Source",
    sortable: true,
    render: (val, row) => val || row.from || "?",
  },
  {
    key: "destination",
    label: "Destination",
    sortable: true,
    render: (val, row) => val || row.to || "?",
  },
  {
    key: "snr",
    label: "SNR",
    sortable: true,
    render: (val) => (val != null ? `${val} dB` : "-"),
  },
  {
    key: "rssi",
    label: "RSSI",
    sortable: true,
    render: (val) => (val != null ? `${val} dBm` : "-"),
  },
  {
    key: "timestamp",
    label: "Time",
    sortable: true,
    render: (val, row) => {
      const ts = val || row.receivedAt;
      if (!ts) {
        return "-";
      }
      try {
        return new Date(ts).toLocaleTimeString();
      } catch {
        return "-";
      }
    },
  },
];

function buildFilterBar(container) {
  const bar = document.createElement("div");
  bar.className = "flex flex-wrap gap-3 mb-4";

  // Packet type dropdown
  const typeSelect = document.createElement("select");
  typeSelect.className = "select";
  typeSelect.style.width = "auto";
  typeSelect.innerHTML = `
    <option value="">All Types</option>
    <option value="TEXT_MESSAGE_APP">Text Message</option>
    <option value="POSITION_APP">Position</option>
    <option value="NODEINFO_APP">Node Info</option>
    <option value="TELEMETRY_APP">Telemetry</option>
    <option value="ROUTING_APP">Routing</option>
    <option value="TRACEROUTE_APP">Traceroute</option>
  `;
  typeSelect.addEventListener("change", () => {
    if (dataTable) {
      dataTable.setFilter("type", typeSelect.value);
    }
  });

  // Source input
  const sourceInput = document.createElement("input");
  sourceInput.className = "input";
  sourceInput.style.width = "160px";
  sourceInput.placeholder = "Source node...";
  sourceInput.addEventListener("input", () => {
    if (dataTable) {
      dataTable.setFilter("source", sourceInput.value);
    }
  });

  bar.appendChild(typeSelect);
  bar.appendChild(sourceInput);
  container.appendChild(bar);
}

function handleRowClick(row) {
  const hash = row.hash || row.id;

  if (!detailContainer) {
    return;
  }

  if (expandedHash === hash) {
    // Collapse
    detailContainer.innerHTML = "";
    expandedHash = null;
    return;
  }

  expandedHash = hash;
  detailContainer.innerHTML = "";
  createPacketDetail(detailContainer, row);
}

async function loadMore() {
  if (loadMoreBtn) {
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = "Loading...";
  }

  try {
    const response = await getPackets({
      limit: PAGE_SIZE,
      offset: currentOffset + PAGE_SIZE,
    });
    const newPackets = response.data || [];

    if (newPackets.length > 0) {
      currentOffset += PAGE_SIZE;
      allPackets = [...allPackets, ...newPackets];
      if (dataTable) {
        dataTable.update(allPackets);
      }
    }

    if (loadMoreBtn) {
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent =
        newPackets.length < PAGE_SIZE ? "No more packets" : "Load More";
      if (newPackets.length < PAGE_SIZE) {
        loadMoreBtn.disabled = true;
      }
    }
  } catch (err) {
    if (loadMoreBtn) {
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent = "Load More (retry)";
    }
  }
}

export function mount(container) {
  container.innerHTML = "";

  const title = document.createElement("h1");
  title.className = "section-title";
  title.textContent = "Packets";
  container.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.className = "section-subtitle";
  subtitle.textContent = "Real-time mesh network packet feed";
  container.appendChild(subtitle);

  // Filter bar
  buildFilterBar(container);

  // Table container
  const tableContainer = document.createElement("div");
  tableContainer.className = "card mb-3";
  container.appendChild(tableContainer);

  // Detail container (below table)
  detailContainer = document.createElement("div");
  container.appendChild(detailContainer);

  // Load more button
  loadMoreBtn = document.createElement("button");
  loadMoreBtn.className = "btn btn-secondary";
  loadMoreBtn.style.cssText = "display:block;margin:1rem auto;";
  loadMoreBtn.textContent = "Load More";
  loadMoreBtn.addEventListener("click", loadMore);
  container.appendChild(loadMoreBtn);

  // Initial load
  loadInitialData(tableContainer);

  // Check for deep link
  const urlParams = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const deepLinkHash = urlParams.get("hash");
  if (deepLinkHash) {
    openPacketByHash(deepLinkHash);
  }

  // WebSocket real-time updates
  wsHandler = (msg) => {
    const packet = msg.data || msg;
    allPackets = [packet, ...allPackets];
    if (dataTable) {
      dataTable.update(allPackets);
    }
  };
  ws.on("packet", wsHandler);
}

async function loadInitialData(tableContainer) {
  try {
    const response = await getPackets({ limit: PAGE_SIZE });
    allPackets = response.data || [];
    currentOffset = 0;
  } catch {
    allPackets = [];
  }

  dataTable = createDataTable(tableContainer, {
    columns: PACKET_COLUMNS,
    data: allPackets,
    onRowClick: handleRowClick,
    emptyMessage: "No packets received yet",
  });
}

async function openPacketByHash(hash) {
  try {
    const response = await getPacketByHash(hash);
    const packet = response.data;
    if (packet && detailContainer) {
      expandedHash = hash;
      detailContainer.innerHTML = "";
      createPacketDetail(detailContainer, packet);
    }
  } catch {
    // Deep link packet not found, no action needed
  }
}

export function unmount() {
  if (wsHandler) {
    ws.off("packet", wsHandler);
    wsHandler = null;
  }
  dataTable = null;
  detailContainer = null;
  loadMoreBtn = null;
  allPackets = [];
  expandedHash = null;
  currentOffset = 0;
}
