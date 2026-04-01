// NodakMesh Dashboard - Leaflet Map Base Component

const TILE_URL =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

const TILE_ATTRIBUTION =
  '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>';

const DEFAULT_CENTER = [46.8772, -96.7898]; // Fargo, ND
const DEFAULT_ZOOM = 10;

const MARKER_COLORS = {
  repeater: "#10b981",
  room_server: "#06b6d4",
  companion: "#8b5cf6",
  offline: "#6b7280",
};

/**
 * Creates a Leaflet map with dark tiles.
 * @param {HTMLElement} container
 * @param {{ center?: [number, number], zoom?: number }} config
 * @returns map controller object
 */
export function createMap(container, config = {}) {
  const mapDiv = document.createElement("div");
  mapDiv.style.width = "100%";
  mapDiv.style.height = "100%";
  mapDiv.style.minHeight = "400px";
  mapDiv.style.borderRadius = "var(--radius)";
  container.appendChild(mapDiv);

  const map = L.map(mapDiv, {
    center: config.center || DEFAULT_CENTER,
    zoom: config.zoom || DEFAULT_ZOOM,
    zoomControl: true,
  });

  L.tileLayer(TILE_URL, {
    attribution: TILE_ATTRIBUTION,
    maxZoom: 19,
  }).addTo(map);

  const markers = [];
  const lines = [];

  function addMarker(lat, lng, options = {}) {
    const color = options.color || MARKER_COLORS.offline;
    const marker = L.circleMarker([lat, lng], {
      radius: 8,
      fillColor: color,
      color: color,
      weight: 2,
      opacity: 0.9,
      fillOpacity: 0.7,
    }).addTo(map);

    if (options.popup) {
      marker.bindPopup(options.popup);
    }

    if (options.onClick) {
      marker.on("click", () => options.onClick(marker));
    }

    markers.push(marker);
    return marker;
  }

  function addLine(points, options = {}) {
    const polyline = L.polyline(points, {
      color: options.color || "#06b6d4",
      weight: options.weight || 2,
      opacity: 0.6,
    }).addTo(map);

    lines.push(polyline);
    return polyline;
  }

  function clearMarkers() {
    markers.forEach((m) => map.removeLayer(m));
    markers.length = 0;
  }

  function clearLines() {
    lines.forEach((l) => map.removeLayer(l));
    lines.length = 0;
  }

  function fitBounds() {
    if (markers.length === 0) {
      return;
    }

    const group = L.featureGroup(markers);
    map.fitBounds(group.getBounds().pad(0.1));
  }

  function destroy() {
    map.remove();
    if (mapDiv.parentNode) {
      mapDiv.parentNode.removeChild(mapDiv);
    }
  }

  function getMarkerColor(role) {
    return MARKER_COLORS[role] || MARKER_COLORS.offline;
  }

  return Object.freeze({
    addMarker,
    addLine,
    clearMarkers,
    clearLines,
    fitBounds,
    destroy,
    getMarkerColor,
    getMap: () => map,
  });
}
