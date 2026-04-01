// NodakMesh Dashboard - Node Map Page

import { getNodes } from "../api.js";
import { createMap } from "../components/map-base.js";

let mapInstance = null;
let nodes = [];

const ROLE_COLORS = {
  repeater: "#10b981",
  room_server: "#06b6d4",
  companion: "#8b5cf6",
};

const ROLE_LABELS = {
  repeater: "Repeater",
  room_server: "Room Server",
  companion: "Companion",
};

function getRoleColor(role) {
  return ROLE_COLORS[role] || "#6b7280";
}

function getRoleLabel(role) {
  return ROLE_LABELS[role] || role || "Unknown";
}

function formatLastSeen(ts) {
  if (!ts) {
    return "Unknown";
  }
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "Unknown";
  }
}

function hasGps(node) {
  return (
    node.latitude != null &&
    node.longitude != null &&
    node.latitude !== 0 &&
    node.longitude !== 0
  );
}

function buildPopup(node) {
  const name = node.name || node.shortName || node.nodeId || "Unknown";
  const role = getRoleLabel(node.role);
  const lastSeen = formatLastSeen(node.lastSeen || node.lastHeard);
  const packetCount = node.packetCount ?? "-";
  const nodeId = node.id || node.nodeId || "";

  return `
    <div style="font-size:0.8125rem;min-width:160px;">
      <div style="font-weight:600;margin-bottom:0.25rem;">${escapeHtml(name)}</div>
      <div style="color:#9ca3af;margin-bottom:0.125rem;">Role: ${escapeHtml(role)}</div>
      <div style="color:#9ca3af;margin-bottom:0.125rem;">Last seen: ${escapeHtml(lastSeen)}</div>
      <div style="color:#9ca3af;margin-bottom:0.5rem;">Packets: ${escapeHtml(String(packetCount))}</div>
      <a href="#/nodes/${encodeURIComponent(nodeId)}" style="color:#06b6d4;font-size:0.75rem;">View Details</a>
    </div>
  `;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function buildToggleButtons(container, onToggleLabels, onToggleRoutes) {
  const bar = document.createElement("div");
  bar.className = "flex gap-2 mb-3";

  const labelBtn = document.createElement("button");
  labelBtn.className = "btn btn-secondary";
  labelBtn.textContent = "Show Labels";
  let labelsVisible = false;

  labelBtn.addEventListener("click", () => {
    labelsVisible = !labelsVisible;
    labelBtn.textContent = labelsVisible ? "Hide Labels" : "Show Labels";
    onToggleLabels(labelsVisible);
  });

  const routeBtn = document.createElement("button");
  routeBtn.className = "btn btn-secondary";
  routeBtn.textContent = "Show Routes";
  let routesVisible = false;

  routeBtn.addEventListener("click", () => {
    routesVisible = !routesVisible;
    routeBtn.textContent = routesVisible ? "Hide Routes" : "Show Routes";
    onToggleRoutes(routesVisible);
  });

  bar.appendChild(labelBtn);
  bar.appendChild(routeBtn);
  container.appendChild(bar);
}

export function mount(container) {
  container.innerHTML = "";

  const title = document.createElement("h1");
  title.className = "section-title";
  title.textContent = "Node Map";
  container.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.className = "section-subtitle";
  subtitle.textContent = "Geographic view of mesh network nodes";
  container.appendChild(subtitle);

  let labelTooltips = [];

  buildToggleButtons(
    container,
    (show) => {
      // Toggle labels
      if (show) {
        labelTooltips = [];
        nodes.filter(hasGps).forEach((node) => {
          const name = node.name || node.shortName || node.nodeId || "";
          if (name && mapInstance) {
            const tooltip = L.tooltip({
              permanent: true,
              direction: "top",
              className: "node-label-tooltip",
              offset: [0, -10],
            })
              .setLatLng([node.latitude, node.longitude])
              .setContent(name);
            tooltip.addTo(mapInstance.getMap());
            labelTooltips.push(tooltip);
          }
        });
      } else {
        labelTooltips.forEach((t) => mapInstance.getMap().removeLayer(t));
        labelTooltips = [];
      }
    },
    (show) => {
      // Toggle routes - placeholder: connect nodes sequentially
      if (show && mapInstance) {
        const gpsNodes = nodes.filter(hasGps);
        for (let i = 0; i < gpsNodes.length - 1; i++) {
          mapInstance.addLine(
            [
              [gpsNodes[i].latitude, gpsNodes[i].longitude],
              [gpsNodes[i + 1].latitude, gpsNodes[i + 1].longitude],
            ],
            { color: "#06b6d4", weight: 1 },
          );
        }
      } else if (mapInstance) {
        mapInstance.clearLines();
      }
    },
  );

  // Legend
  const legend = document.createElement("div");
  legend.className = "flex gap-3 mb-3";
  legend.style.fontSize = "0.75rem";

  const legendItems = [
    { color: "#10b981", label: "Repeater" },
    { color: "#06b6d4", label: "Room Server" },
    { color: "#8b5cf6", label: "Companion" },
    { color: "#6b7280", label: "Offline" },
  ];

  legendItems.forEach((item) => {
    const el = document.createElement("span");
    el.className = "flex gap-1";
    el.style.alignItems = "center";
    el.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${item.color};"></span> ${item.label}`;
    legend.appendChild(el);
  });

  container.appendChild(legend);

  // Map container
  const mapCard = document.createElement("div");
  mapCard.className = "card";
  mapCard.style.cssText = "padding:0;overflow:hidden;height:60vh;min-height:400px;";
  container.appendChild(mapCard);

  // Load data and initialize map
  loadMapData(mapCard);
}

async function loadMapData(mapCard) {
  try {
    const response = await getNodes();
    nodes = response.data || [];
  } catch {
    nodes = [];
  }

  const gpsNodes = nodes.filter(hasGps);

  if (gpsNodes.length === 0) {
    mapCard.style.display = "flex";
    mapCard.style.alignItems = "center";
    mapCard.style.justifyContent = "center";
    mapCard.style.height = "300px";
    mapCard.innerHTML = `
      <div class="empty-state">
        <div class="empty-title">No GPS Data Available</div>
        <div class="empty-message">None of the known nodes have GPS coordinates.</div>
      </div>
    `;
    return;
  }

  mapInstance = createMap(mapCard);

  gpsNodes.forEach((node) => {
    const isOffline = node.status === "offline" || node.online === false;
    const color = isOffline ? "#6b7280" : getRoleColor(node.role);

    mapInstance.addMarker(node.latitude, node.longitude, {
      color,
      popup: buildPopup(node),
    });
  });

  mapInstance.fitBounds();
}

export function unmount() {
  if (mapInstance) {
    mapInstance.destroy();
    mapInstance = null;
  }
  nodes = [];
}
