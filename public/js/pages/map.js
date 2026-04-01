// NodakMesh Dashboard - Node Map Page

import { getNodes, getCoverage } from "../api.js";
import { createMap } from "../components/map-base.js";

let mapInstance = null;
let nodes = [];
let coverageMarkers = [];
let coverageVisible = false;

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

const COVERAGE_COLORS = {
  BIDIR: "#10b981",
  DISC: "#3b82f6",
  TRACE: "#eab308",
  TX: "#f97316",
  RX: "#a855f7",
  DEAD: "#6b7280",
  DROP: "#ef4444",
};

function getRoleColor(role) {
  return ROLE_COLORS[role] || "#6b7280";
}

function getRoleLabel(role) {
  return ROLE_LABELS[role] || role || "Unknown";
}

function getCoverageColor(classification) {
  return COVERAGE_COLORS[classification] || "#6b7280";
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

function buildToggleButtons(
  container,
  onToggleLabels,
  onToggleRoutes,
  onToggleCoverage,
) {
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

  const coverageBtn = document.createElement("button");
  coverageBtn.className = "btn btn-secondary";
  coverageBtn.textContent = "Show Coverage";

  coverageBtn.addEventListener("click", () => {
    coverageVisible = !coverageVisible;
    coverageBtn.textContent = coverageVisible
      ? "Hide Coverage"
      : "Show Coverage";
    onToggleCoverage(coverageVisible);
  });

  bar.appendChild(labelBtn);
  bar.appendChild(routeBtn);
  bar.appendChild(coverageBtn);
  container.appendChild(bar);
}

function clearCoverageMarkers() {
  if (mapInstance == null) {
    return;
  }
  const map = mapInstance.getMap();
  coverageMarkers.forEach((m) => map.removeLayer(m));
  coverageMarkers = [];
}

/**
 * Extract coverage grid squares from MeshMapper API response.
 * Response shape: { grid_squares: [{ grid_id, bounds, coverage_type, fill_color, snr }] }
 */
function extractCoveragePoints(data) {
  if (data == null) return [];
  if (Array.isArray(data.grid_squares)) return data.grid_squares;
  if (Array.isArray(data)) return data;
  return [];
}

async function showCoverageOverlay() {
  if (mapInstance == null) {
    return;
  }

  clearCoverageMarkers();

  try {
    const response = await getCoverage();
    const coverageData = response.data;
    const points = extractCoveragePoints(coverageData);

    if (points.length === 0) {
      const map = mapInstance.getMap();
      const center = map.getCenter();

      const popup = L.popup()
        .setLatLng([center.lat, center.lng])
        .setContent(
          '<div style="font-size:0.8125rem;text-align:center;padding:0.5rem;">' +
            "Coverage data coming soon &mdash; start wardriving with the MeshMapper app!" +
            "</div>",
        )
        .openOn(map);

      coverageMarkers.push(popup);
      return;
    }

    const map = mapInstance.getMap();

    for (const square of points) {
      // MeshMapper grid squares use bounds: { south, west, north, east }
      const bounds = square.bounds;
      let lat, lng;

      if (bounds && bounds.south != null && bounds.west != null) {
        lat = (bounds.south + bounds.north) / 2;
        lng = (bounds.west + bounds.east) / 2;
      } else {
        lat = square.latitude ?? square.lat;
        lng = square.longitude ?? square.lng ?? square.lon;
      }

      if (lat == null || lng == null) continue;

      const coverageType = square.coverage_type ?? square.type ?? "TX";
      const color = square.fill_color ?? getCoverageColor(coverageType);

      // Render as rectangle if bounds available, circle otherwise
      let marker;
      if (bounds) {
        marker = L.rectangle(
          [
            [bounds.south, bounds.west],
            [bounds.north, bounds.east],
          ],
          {
            fillColor: color,
            color: square.border_color ?? color,
            weight: 1,
            opacity: 0.7,
            fillOpacity: 0.4,
          },
        ).addTo(map);
      } else {
        marker = L.circleMarker([lat, lng], {
          radius: 5,
          fillColor: color,
          color,
          weight: 1,
          opacity: 0.7,
          fillOpacity: 0.5,
        }).addTo(map);
      }

      const popupContent = [
        `<div style="font-size:0.75rem;">`,
        `<div>Type: ${escapeHtml(coverageType)}</div>`,
        square.snr != null ? `<div>SNR: ${square.snr} dB</div>` : "",
        square.grid_id ? `<div>Grid: ${escapeHtml(square.grid_id)}</div>` : "",
        `</div>`,
      ].join("");
      marker.bindPopup(popupContent);

      coverageMarkers.push(marker);
    }
  } catch {
    // Coverage fetch failed — silently ignore
  }
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
    (show) => {
      // Toggle coverage overlay
      if (show) {
        showCoverageOverlay();
      } else {
        clearCoverageMarkers();
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

  const coverageLegendItems = [
    { color: COVERAGE_COLORS.BIDIR, label: "BIDIR" },
    { color: COVERAGE_COLORS.DISC, label: "DISC" },
    { color: COVERAGE_COLORS.TRACE, label: "TRACE" },
    { color: COVERAGE_COLORS.TX, label: "TX" },
  ];

  const allLegendItems = [...legendItems, ...coverageLegendItems];

  allLegendItems.forEach((item) => {
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
  mapCard.style.cssText =
    "padding:0;overflow:hidden;height:60vh;min-height:400px;";
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
  clearCoverageMarkers();
  if (mapInstance) {
    mapInstance.destroy();
    mapInstance = null;
  }
  nodes = [];
  coverageVisible = false;
}
