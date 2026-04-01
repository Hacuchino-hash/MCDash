// NodakMesh Dashboard - Leaderboards Page

import { getLeaderboards } from "../api.js";

let activeWindow = "all";
let container = null;
let contentArea = null;

const TIME_WINDOWS = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "all", label: "All Time" },
];

const SECTION_CONFIG = [
  {
    category: "distance",
    title: "Distance Records",
    icon: "\uD83C\uDFC6",
    valueFormatter: formatDistanceValue,
  },
  {
    category: "activity",
    title: "Activity Rankings",
    icon: "\uD83D\uDCCA",
    valueFormatter: formatActivityValue,
  },
  {
    category: "fun",
    title: "Fun Awards",
    icon: "\uD83C\uDF89",
    valueFormatter: formatFunValue,
  },
];

const RANK_STYLES = {
  1: { emoji: "\uD83E\uDD47", color: "#FFD700" },
  2: { emoji: "\uD83E\uDD48", color: "#C0C0C0" },
  3: { emoji: "\uD83E\uDD49", color: "#CD7F32" },
};

// ---- Formatters ----

function formatDistanceValue(entry) {
  if (entry.distanceKm != null) {
    return `${entry.distanceKm} km (${entry.distanceMi} mi)`;
  }
  return "-";
}

function formatActivityValue(entry) {
  if (entry.packetCount != null) {
    return `${entry.packetCount} packets`;
  }
  if (entry.reliabilityRatio != null) {
    return `${Math.round(entry.reliabilityRatio * 100)}% (${entry.reliableCount}/${entry.totalCount})`;
  }
  if (entry.avgSnr != null) {
    return `${entry.avgSnr} dB`;
  }
  if (entry.peerCount != null) {
    return `${entry.peerCount} peers`;
  }
  return "-";
}

function formatFunValue(entry) {
  if (entry.packetCount != null) {
    return `${entry.packetCount} packets`;
  }
  if (entry.streakHours != null) {
    return `${entry.streakHours}h streak`;
  }
  if (entry.firstSeen != null) {
    return `Since ${formatDate(entry.firstSeen)}`;
  }
  return "-";
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

function getNodeNames(entry) {
  if (entry.nodeA && entry.nodeB) {
    return `${entry.nodeA.name} \u2194 ${entry.nodeB.name}`;
  }
  if (entry.node) {
    return entry.node.name;
  }
  return "Unknown";
}

// ---- Rendering ----

function renderTabBar(parent) {
  const tabBar = document.createElement("div");
  tabBar.style.cssText = `
    display:flex;gap:0.5rem;margin-bottom:1.5rem;
    background:var(--surface);border-radius:var(--radius);padding:0.25rem;
  `;

  for (const tw of TIME_WINDOWS) {
    const btn = document.createElement("button");
    btn.className =
      tw.key === activeWindow ? "btn btn-primary" : "btn btn-secondary";
    btn.textContent = tw.label;
    btn.style.cssText = "flex:1;";
    btn.addEventListener("click", () => {
      activeWindow = tw.key;
      loadAllLeaderboards();
      // Re-render tab active states
      const buttons = tabBar.querySelectorAll("button");
      buttons.forEach((b, i) => {
        b.className =
          TIME_WINDOWS[i].key === activeWindow
            ? "btn btn-primary"
            : "btn btn-secondary";
      });
    });
    tabBar.appendChild(btn);
  }

  parent.appendChild(tabBar);
}

function renderSection(parent, title, icon, leaderboards, valueFormatter) {
  const section = document.createElement("div");
  section.className = "card mb-4";

  const header = document.createElement("div");
  header.style.cssText = `
    display:flex;align-items:center;justify-content:space-between;
    cursor:pointer;user-select:none;
  `;

  const headerText = document.createElement("div");
  headerText.style.cssText = "font-weight:600;font-size:1.1rem;";
  headerText.textContent = `${icon} ${title}`;

  const toggle = document.createElement("span");
  toggle.textContent = "\u25BC";
  toggle.style.cssText =
    "font-size:0.75rem;color:var(--text-secondary);transition:transform 0.2s;";

  header.appendChild(headerText);
  header.appendChild(toggle);
  section.appendChild(header);

  const body = document.createElement("div");
  body.style.cssText = "margin-top:1rem;";

  let isCollapsed = false;

  header.addEventListener("click", () => {
    isCollapsed = !isCollapsed;
    body.style.display = isCollapsed ? "none" : "block";
    toggle.style.transform = isCollapsed ? "rotate(-90deg)" : "rotate(0)";
  });

  if (leaderboards == null || Object.keys(leaderboards).length === 0) {
    const empty = document.createElement("div");
    empty.style.cssText =
      "text-align:center;color:var(--text-secondary);padding:1.5rem;font-size:0.875rem;";
    empty.textContent = "No records yet \u2014 start meshing!";
    body.appendChild(empty);
  } else {
    for (const [boardName, entries] of Object.entries(leaderboards)) {
      renderLeaderboardTable(body, boardName, entries, valueFormatter);
    }
  }

  section.appendChild(body);
  parent.appendChild(section);
}

function renderLeaderboardTable(parent, boardName, entries, valueFormatter) {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "margin-bottom:1.25rem;";

  const title = document.createElement("div");
  title.style.cssText =
    "font-weight:500;font-size:0.9rem;margin-bottom:0.5rem;color:var(--text-secondary);";
  title.textContent = boardName;
  wrapper.appendChild(title);

  if (!entries || entries.length === 0) {
    const empty = document.createElement("div");
    empty.style.cssText =
      "color:var(--text-secondary);font-size:0.8125rem;padding:0.5rem 0;";
    empty.textContent = "No entries yet";
    wrapper.appendChild(empty);
    parent.appendChild(wrapper);
    return;
  }

  for (const entry of entries) {
    const row = document.createElement("div");
    row.style.cssText = `
      display:flex;align-items:center;gap:0.75rem;
      padding:0.5rem 0;border-bottom:1px solid var(--border);
      font-size:0.8125rem;
    `;

    const rankStyle = RANK_STYLES[entry.rank];

    const rank = document.createElement("span");
    rank.style.cssText = `
      width:2rem;text-align:center;font-weight:700;flex-shrink:0;
      ${rankStyle ? `color:${rankStyle.color};` : "color:var(--text-secondary);"}
    `;
    rank.textContent = rankStyle ? rankStyle.emoji : `#${entry.rank}`;

    const name = document.createElement("span");
    name.style.cssText = "flex:1;color:var(--text-primary);font-weight:500;";
    name.textContent = getNodeNames(entry);

    const value = document.createElement("span");
    value.style.cssText = "color:var(--accent);font-weight:600;flex-shrink:0;";
    value.textContent = valueFormatter(entry);

    const date = document.createElement("span");
    date.style.cssText =
      "color:var(--text-secondary);font-size:0.75rem;flex-shrink:0;min-width:5rem;text-align:right;";
    date.textContent = formatDate(entry.date);

    row.appendChild(rank);
    row.appendChild(name);
    row.appendChild(value);
    row.appendChild(date);
    wrapper.appendChild(row);
  }

  parent.appendChild(wrapper);
}

async function loadAllLeaderboards() {
  if (contentArea == null) {
    return;
  }

  contentArea.innerHTML =
    '<div class="flex-center p-4"><div class="spinner"></div></div>';

  const results = {};

  try {
    const responses = await Promise.allSettled(
      SECTION_CONFIG.map((section) =>
        getLeaderboards(section.category, activeWindow).then((resp) => ({
          category: section.category,
          data: resp.data,
        })),
      ),
    );

    for (const result of responses) {
      if (result.status === "fulfilled") {
        results[result.value.category] = result.value.data?.leaderboards ?? {};
      }
    }
  } catch {
    // Individual failures handled by allSettled
  }

  contentArea.innerHTML = "";

  for (const section of SECTION_CONFIG) {
    const leaderboards = results[section.category] ?? {};
    const hasData = Object.values(leaderboards).some(
      (entries) => Array.isArray(entries) && entries.length > 0,
    );

    renderSection(
      contentArea,
      section.title,
      section.icon,
      hasData ? leaderboards : null,
      section.valueFormatter,
    );
  }
}

// ---- Lifecycle ----

export function mount(mountContainer) {
  container = mountContainer;
  container.innerHTML = "";

  const title = document.createElement("h1");
  title.className = "section-title";
  title.textContent = "Leaderboards";
  container.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.className = "section-subtitle";
  subtitle.textContent = "Top performers across the mesh network";
  container.appendChild(subtitle);

  renderTabBar(container);

  contentArea = document.createElement("div");
  container.appendChild(contentArea);

  loadAllLeaderboards();
}

export function unmount() {
  container = null;
  contentArea = null;
  activeWindow = "all";
}
