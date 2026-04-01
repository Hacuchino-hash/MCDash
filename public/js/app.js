// NodakMesh Dashboard - Client-Side Framework

// ---- Event Bus ----

function createEventBus() {
  const listeners = new Map();

  return Object.freeze({
    on(event, handler) {
      const handlers = listeners.get(event) || [];
      listeners.set(event, [...handlers, handler]);
    },

    off(event, handler) {
      const handlers = listeners.get(event) || [];
      listeners.set(
        event,
        handlers.filter((h) => h !== handler),
      );
    },

    emit(event, data) {
      const handlers = listeners.get(event) || [];
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (err) {
          console.error(`[EventBus] Error in handler for "${event}":`, err);
        }
      });
    },
  });
}

export const bus = createEventBus();

// ---- WebSocket Manager ----

function createWebSocketManager() {
  const eventBus = createEventBus();
  let socket = null;
  let reconnectAttempts = 0;
  let reconnectTimer = null;
  const MAX_RECONNECT_DELAY = 30000;
  const BASE_DELAY = 1000;

  function getWsUrl() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws`;
  }

  function connect() {
    if (socket && socket.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      socket = new WebSocket(getWsUrl());
    } catch (err) {
      console.error("[WS] Failed to create WebSocket:", err);
      scheduleReconnect();
      return;
    }

    socket.addEventListener("open", () => {
      console.log("[WS] Connected");
      reconnectAttempts = 0;
      eventBus.emit("_connected", null);
    });

    socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(event.data);
        const { event: eventName, data, timestamp } = message;
        if (eventName) {
          eventBus.emit(eventName, { data, timestamp });
        }
      } catch (err) {
        console.error("[WS] Failed to parse message:", err);
      }
    });

    socket.addEventListener("close", () => {
      console.log("[WS] Disconnected");
      eventBus.emit("_disconnected", null);
      scheduleReconnect();
    });

    socket.addEventListener("error", (err) => {
      console.error("[WS] Error:", err);
    });
  }

  function scheduleReconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }

    const delay = Math.min(
      BASE_DELAY * Math.pow(2, reconnectAttempts),
      MAX_RECONNECT_DELAY,
    );
    reconnectAttempts += 1;

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);

    reconnectTimer = setTimeout(() => {
      connect();
    }, delay);
  }

  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (socket) {
      socket.close();
      socket = null;
    }
  }

  return Object.freeze({
    connect,
    disconnect,
    on: eventBus.on,
    off: eventBus.off,
  });
}

export const ws = createWebSocketManager();

// ---- Router ----

const routes = {
  "/": () => import("./pages/home.js"),
  "/health": () => import("./pages/health.js"),
  "/repeaters": () => import("./pages/repeaters.js"),
  "/repeaters/:id": () => import("./pages/repeater-detail.js"),
  "/map": () => import("./pages/map.js"),
  "/packets": () => import("./pages/packets.js"),
  "/channels": () => import("./pages/channels.js"),
  "/leaderboards": () => import("./pages/leaderboards.js"),
  "/traces": () => import("./pages/traces.js"),
  "/nodes/:id": () => import("./pages/node-analytics.js"),
  "/observers": () => import("./pages/observers.js"),
  "/observers/:id": () => import("./pages/observer-detail.js"),
};

function matchRoute(path) {
  // Try exact match first
  if (routes[path]) {
    return { loader: routes[path], params: {} };
  }

  // Try parameterized routes
  for (const [pattern, loader] of Object.entries(routes)) {
    if (!pattern.includes(":")) {
      continue;
    }

    const patternParts = pattern.split("/");
    const pathParts = path.split("/");

    if (patternParts.length !== pathParts.length) {
      continue;
    }

    const params = {};
    let matched = true;

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(":")) {
        params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
      } else if (patternParts[i] !== pathParts[i]) {
        matched = false;
        break;
      }
    }

    if (matched) {
      return { loader, params };
    }
  }

  return null;
}

function getRoutePath() {
  const hash = window.location.hash || "#/";
  return hash.slice(1) || "/";
}

function getBaseRoute(path) {
  // Extract the base route for nav highlighting (e.g., /repeaters/abc -> /repeaters)
  const segments = path.split("/").filter(Boolean);
  return segments.length > 0 ? `/${segments[0]}` : "/";
}

let currentModule = null;

async function navigate() {
  const path = getRoutePath();
  const container = document.getElementById("app");

  if (!container) {
    console.error("[Router] #app container not found");
    return;
  }

  // Unmount current page
  if (currentModule && typeof currentModule.unmount === "function") {
    try {
      currentModule.unmount();
    } catch (err) {
      console.error("[Router] Error unmounting page:", err);
    }
  }

  // Update active nav link
  updateActiveNav(path);

  // Match route
  const match = matchRoute(path);

  if (!match) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-title">Page Not Found</div>
        <div class="empty-message">The page "${path}" does not exist.</div>
      </div>
    `;
    currentModule = null;
    return;
  }

  // Show loading spinner
  container.innerHTML = '<div class="flex-center p-4"><div class="spinner"></div></div>';

  try {
    const module = await match.loader();
    currentModule = module;

    container.innerHTML = "";

    if (typeof module.mount === "function") {
      module.mount(container, match.params);
    } else {
      console.error("[Router] Page module does not export mount()");
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-title">Error</div>
          <div class="empty-message">This page failed to load properly.</div>
        </div>
      `;
    }
  } catch (err) {
    console.error("[Router] Failed to load page:", err);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-title">Loading Error</div>
        <div class="empty-message">Failed to load this page. Please try again.</div>
      </div>
    `;
    currentModule = null;
  }
}

function updateActiveNav(path) {
  const baseRoute = path === "/" ? "/" : getBaseRoute(path);
  const links = document.querySelectorAll(".nav-link");

  links.forEach((link) => {
    const route = link.getAttribute("data-route");
    if (route === baseRoute || (route === "/" && baseRoute === "/")) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
}

// ---- Theme Toggle ----

function initTheme() {
  const saved = localStorage.getItem("nodakmesh-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";

  document.documentElement.classList.add("theme-transition");
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("nodakmesh-theme", next);

  setTimeout(() => {
    document.documentElement.classList.remove("theme-transition");
  }, 300);
}

// ---- Mobile Menu ----

function initMobileMenu() {
  const hamburger = document.getElementById("hamburger");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");

  if (!hamburger || !sidebar || !overlay) {
    return;
  }

  function openMenu() {
    sidebar.classList.add("open");
    overlay.classList.add("visible");
    hamburger.classList.add("open");
  }

  function closeMenu() {
    sidebar.classList.remove("open");
    overlay.classList.remove("visible");
    hamburger.classList.remove("open");
  }

  hamburger.addEventListener("click", () => {
    if (sidebar.classList.contains("open")) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  overlay.addEventListener("click", closeMenu);

  // Close menu when navigating on mobile
  sidebar.addEventListener("click", (e) => {
    if (e.target.closest(".nav-link") && window.innerWidth <= 768) {
      closeMenu();
    }
  });
}

// ---- Toast Notifications ----

let toastContainer = null;

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.className = "toast-container";
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function showToast(message, type = "success", duration = 4000) {
  const container = getToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-0.5rem)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
}

// ---- Initialize ----

function init() {
  initTheme();
  initMobileMenu();

  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", toggleTheme);
  }

  window.addEventListener("hashchange", navigate);
  navigate();

  ws.connect();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
