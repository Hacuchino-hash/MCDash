// NodakMesh Dashboard - Home Page

import { getStats, getHealth, getPackets } from "../api.js";
import { ws } from "../app.js";
import { createStatsBar } from "../components/stats-bar.js";
import { createHealthGauge } from "../components/health-gauge.js";
import { createChart } from "../components/chart-wrapper.js";

let statsBar = null;
let healthGauge = null;
let activityChart = null;
let feedContainer = null;
let wsHandler = null;
let recentPackets = [];

const MAX_FEED_ITEMS = 10;

function formatTime(ts) {
  if (!ts) {
    return "";
  }
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return "";
  }
}

function renderFeedItem(packet) {
  const item = document.createElement("div");
  item.style.cssText = `
    display:flex;align-items:center;gap:0.75rem;
    padding:0.625rem 0;border-bottom:1px solid var(--border);
    font-size:0.8125rem;
  `;

  const badge = document.createElement("span");
  badge.className = "badge badge-cyan";
  badge.textContent = packet.type || "PKT";
  badge.style.flexShrink = "0";

  const info = document.createElement("span");
  info.style.cssText = "flex:1;color:var(--text-primary);";
  const src = packet.source || packet.from || "?";
  const dest = packet.destination || packet.to || "?";
  info.textContent = `${src} \u2192 ${dest}`;

  const time = document.createElement("span");
  time.style.cssText = "color:var(--text-secondary);font-size:0.75rem;flex-shrink:0;";
  time.textContent = formatTime(packet.timestamp || packet.receivedAt);

  item.appendChild(badge);
  item.appendChild(info);
  item.appendChild(time);
  return item;
}

function renderFeed() {
  if (!feedContainer) {
    return;
  }
  feedContainer.innerHTML = "";

  if (recentPackets.length === 0) {
    const empty = document.createElement("div");
    empty.style.cssText = "text-align:center;color:var(--text-secondary);padding:1.5rem;font-size:0.875rem;";
    empty.textContent = "No recent activity";
    feedContainer.appendChild(empty);
    return;
  }

  recentPackets.forEach((pkt) => {
    feedContainer.appendChild(renderFeedItem(pkt));
  });
}

function buildSparklineData(packets) {
  // Group by hour for a 24h sparkline
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const counts = new Array(24).fill(0);

  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;

  packets.forEach((pkt) => {
    const ts = new Date(pkt.timestamp || pkt.receivedAt).getTime();
    if (ts >= dayAgo) {
      const hour = new Date(ts).getHours();
      counts[hour] = (counts[hour] || 0) + 1;
    }
  });

  return {
    labels: hours.map((h) => `${h}:00`),
    data: counts,
  };
}

export function mount(container) {
  container.innerHTML = "";

  // Page title
  const title = document.createElement("h1");
  title.className = "section-title";
  title.textContent = "Dashboard";
  container.appendChild(title);

  // Stats bar placeholder
  const statsContainer = document.createElement("div");
  statsContainer.className = "mb-4";
  container.appendChild(statsContainer);

  // Middle row: health gauge + activity chart
  const middleRow = document.createElement("div");
  middleRow.className = "grid-2 mb-4";
  container.appendChild(middleRow);

  const gaugeCard = document.createElement("div");
  gaugeCard.className = "card";
  gaugeCard.innerHTML = '<div style="font-weight:600;margin-bottom:0.75rem;">Network Health</div>';
  const gaugeMount = document.createElement("div");
  gaugeMount.className = "flex-center";
  gaugeCard.appendChild(gaugeMount);
  middleRow.appendChild(gaugeCard);

  const chartCard = document.createElement("div");
  chartCard.className = "card";
  chartCard.innerHTML = '<div style="font-weight:600;margin-bottom:0.75rem;">Activity (24h)</div>';
  const chartMount = document.createElement("div");
  chartCard.appendChild(chartMount);
  middleRow.appendChild(chartCard);

  // Bottom row: recent activity + quick links
  const bottomRow = document.createElement("div");
  bottomRow.className = "grid-2";
  container.appendChild(bottomRow);

  const feedCard = document.createElement("div");
  feedCard.className = "card";
  feedCard.innerHTML = '<div style="font-weight:600;margin-bottom:0.75rem;">Recent Activity</div>';
  feedContainer = document.createElement("div");
  feedCard.appendChild(feedContainer);
  bottomRow.appendChild(feedCard);

  const linksCard = document.createElement("div");
  linksCard.className = "card";
  linksCard.innerHTML = '<div style="font-weight:600;margin-bottom:0.75rem;">Quick Links</div>';
  const linksGrid = document.createElement("div");
  linksGrid.className = "grid-2 gap-2";

  const quickLinks = [
    { label: "Map", route: "#/map" },
    { label: "Packets", route: "#/packets" },
    { label: "Repeaters", route: "#/repeaters" },
    { label: "Health", route: "#/health" },
    { label: "Observers", route: "#/observers" },
    { label: "Channels", route: "#/channels" },
  ];

  quickLinks.forEach((link) => {
    const a = document.createElement("a");
    a.href = link.route;
    a.className = "btn btn-secondary";
    a.style.textAlign = "center";
    a.textContent = link.label;
    linksGrid.appendChild(a);
  });

  linksCard.appendChild(linksGrid);
  bottomRow.appendChild(linksCard);

  // Load data
  loadDashboardData(statsContainer, gaugeMount, chartMount);

  // WebSocket real-time updates
  wsHandler = (msg) => {
    const packet = msg.data || msg;
    recentPackets = [packet, ...recentPackets].slice(0, MAX_FEED_ITEMS);
    renderFeed();
  };
  ws.on("packet", wsHandler);
}

async function loadDashboardData(statsContainer, gaugeMount, chartMount) {
  // Load stats
  try {
    const statsResponse = await getStats();
    const data = statsResponse.data || {};
    const stats = [
      { label: "Total Nodes", value: data.totalNodes ?? 0 },
      { label: "Packets (24h)", value: data.packets24h ?? data.packetsToday ?? 0 },
      { label: "Active Observers", value: data.activeObservers ?? 0 },
      { label: "Active Repeaters", value: data.activeRepeaters ?? 0 },
    ];
    statsBar = createStatsBar(statsContainer, stats);
  } catch (err) {
    statsBar = createStatsBar(statsContainer, [
      { label: "Total Nodes", value: "-" },
      { label: "Packets (24h)", value: "-" },
      { label: "Active Observers", value: "-" },
      { label: "Active Repeaters", value: "-" },
    ]);
  }

  // Load health
  try {
    const healthResponse = await getHealth();
    const score = healthResponse.data?.score ?? healthResponse.data?.overall ?? 0;
    healthGauge = createHealthGauge(gaugeMount, score);
  } catch {
    healthGauge = createHealthGauge(gaugeMount, 0);
  }

  // Load recent packets + sparkline
  try {
    const packetsResponse = await getPackets({ limit: 50 });
    const packets = packetsResponse.data || [];

    recentPackets = packets.slice(0, MAX_FEED_ITEMS);
    renderFeed();

    const sparkData = buildSparklineData(packets);
    activityChart = createChart(chartMount, {
      type: "line",
      labels: sparkData.labels,
      datasets: [
        {
          label: "Packets",
          data: sparkData.data,
          fill: true,
        },
      ],
      options: {
        plugins: { legend: { display: false } },
        elements: { point: { radius: 0 } },
      },
    });
  } catch {
    renderFeed();
  }
}

export function unmount() {
  if (wsHandler) {
    ws.off("packet", wsHandler);
    wsHandler = null;
  }
  if (activityChart) {
    activityChart.destroy();
    activityChart = null;
  }
  statsBar = null;
  healthGauge = null;
  feedContainer = null;
  recentPackets = [];
}
