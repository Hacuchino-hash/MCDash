// NodakMesh Dashboard - Search Modal Component (Cmd+K / Ctrl+K)

import { getNodes } from "../api.js";

const DEBOUNCE_MS = 250;

/**
 * Initializes the global search modal. Call once at app startup.
 */
export function initSearchModal() {
  let overlay = null;
  let debounceTimer = null;
  let currentResults = [];

  function createOverlay() {
    const el = document.createElement("div");
    el.className = "search-overlay";
    el.style.cssText = `
      position: fixed; inset: 0; z-index: 999;
      background: rgba(0, 0, 0, 0.6);
      display: flex; justify-content: center;
      padding-top: 15vh;
    `;

    const modal = document.createElement("div");
    modal.style.cssText = `
      width: 100%; max-width: 520px; max-height: 60vh;
      background: var(--bg-surface); border: 1px solid var(--border);
      border-radius: var(--radius); overflow: hidden;
      display: flex; flex-direction: column;
      box-shadow: 0 16px 48px rgba(0,0,0,0.4);
    `;

    const input = document.createElement("input");
    input.className = "input";
    input.placeholder = "Search nodes...";
    input.style.cssText = `
      border: none; border-bottom: 1px solid var(--border);
      border-radius: 0; padding: 1rem;
      font-size: 1rem; background: transparent;
    `;

    const resultsContainer = document.createElement("div");
    resultsContainer.style.cssText = `
      overflow-y: auto; flex: 1; padding: 0.5rem;
    `;

    modal.appendChild(input);
    modal.appendChild(resultsContainer);
    el.appendChild(modal);

    // Close on backdrop click
    el.addEventListener("click", (e) => {
      if (e.target === el) {
        close();
      }
    });

    // Search on input
    input.addEventListener("input", () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        performSearch(input.value.trim(), resultsContainer);
      }, DEBOUNCE_MS);
    });

    // Keyboard navigation
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        close();
      }
    });

    return { el, input, resultsContainer };
  }

  async function performSearch(query, resultsContainer) {
    resultsContainer.innerHTML = "";
    currentResults = [];

    if (!query) {
      resultsContainer.innerHTML = `
        <div style="text-align:center;color:var(--text-secondary);padding:1.5rem;font-size:0.875rem;">
          Type to search nodes...
        </div>`;
      return;
    }

    try {
      const response = await getNodes({ search: query });
      const nodes = response.data || [];

      if (nodes.length === 0) {
        resultsContainer.innerHTML = `
          <div style="text-align:center;color:var(--text-secondary);padding:1.5rem;font-size:0.875rem;">
            No results for "${query}"
          </div>`;
        return;
      }

      currentResults = nodes;

      // Group by category
      const grouped = groupByCategory(nodes);

      for (const [category, items] of Object.entries(grouped)) {
        const header = document.createElement("div");
        header.style.cssText = `
          font-size:0.7rem; text-transform:uppercase; letter-spacing:0.05em;
          color:var(--text-secondary); padding:0.5rem 0.75rem; font-weight:600;
        `;
        header.textContent = category;
        resultsContainer.appendChild(header);

        items.forEach((item) => {
          const row = document.createElement("a");
          row.href = `#/nodes/${encodeURIComponent(item.id || item.nodeId || "")}`;
          row.style.cssText = `
            display:block; padding:0.625rem 0.75rem; border-radius:var(--radius);
            color:var(--text-primary); font-size:0.875rem; text-decoration:none;
          `;
          row.textContent = item.name || item.shortName || item.nodeId || "Unknown";

          row.addEventListener("mouseenter", () => {
            row.style.backgroundColor = "var(--bg-elevated)";
          });
          row.addEventListener("mouseleave", () => {
            row.style.backgroundColor = "transparent";
          });
          row.addEventListener("click", () => close());

          resultsContainer.appendChild(row);
        });
      }
    } catch (err) {
      resultsContainer.innerHTML = `
        <div style="text-align:center;color:var(--accent-red);padding:1.5rem;font-size:0.875rem;">
          Search failed. Please try again.
        </div>`;
    }
  }

  function groupByCategory(nodes) {
    const groups = {};
    nodes.forEach((node) => {
      const category = node.role || "Nodes";
      const list = groups[category] || [];
      groups[category] = [...list, node];
    });
    return groups;
  }

  function open() {
    if (overlay) {
      return;
    }

    const parts = createOverlay();
    overlay = parts;
    document.body.appendChild(parts.el);

    // Auto-focus after append
    requestAnimationFrame(() => {
      parts.input.focus();
    });
  }

  function close() {
    if (!overlay) {
      return;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    if (overlay.el.parentNode) {
      overlay.el.parentNode.removeChild(overlay.el);
    }
    overlay = null;
    currentResults = [];
  }

  // Global keyboard listener
  document.addEventListener("keydown", (e) => {
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const modifier = isMac ? e.metaKey : e.ctrlKey;

    if (modifier && e.key === "k") {
      e.preventDefault();
      if (overlay) {
        close();
      } else {
        open();
      }
    }

    if (e.key === "Escape" && overlay) {
      close();
    }
  });
}
