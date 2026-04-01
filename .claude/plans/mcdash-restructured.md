# MCDash — Restructured Implementation Plan

> **Project:** NodakMesh MeshCore Dashboard  
> **Source:** `NODAKMESH_DASHBOARD_BUILD_PLAN.md` (all features preserved)  
> **Changes:** Structural improvements to file organization, backend layering, frontend modularity, and testing

---

## What Changed vs. Original Plan

| Area | Original | Restructured | Why |
|------|----------|-------------|-----|
| Backend | Flat files (`server.js`, `db.js`, etc.) | Layered: `src/routes/`, `src/services/`, `src/stores/`, `src/mqtt/` | `server.js` would hit 1500+ lines; separation enables testing individual layers |
| Frontend | 15 global scripts loaded via `<script>` tags | ES modules with `type="module"`, component pattern | Eliminates global namespace pollution, enables lazy loading per route |
| Config | `config.json` loaded raw | Validated at startup with schema + env overlay | Fail fast on bad config instead of runtime crashes |
| Testing | `tools/e2e-test.js` (ad hoc) | `vitest` with unit/integration/e2e separation | Real test runner, coverage reporting, watch mode |
| Error handling | Not specified | Centralized error middleware + graceful shutdown | MQTT/WS/SQLite all need cleanup on exit |
| File structure | Everything in root | `src/` for backend, `public/` for frontend, `test/` for tests | Standard Node.js project layout |

---

## Restructured File Layout

```
nodakmesh-dashboard/
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .gitignore
├── config.example.json
├── config.json                     # (gitignored)
├── package.json
├── vitest.config.js
├── README.md
│
├── src/
│   ├── index.js                    # Entry point: boot sequence, graceful shutdown
│   ├── config.js                   # Load + validate config.json + env overrides
│   │
│   ├── mqtt/
│   │   ├── client.js               # MQTT connection, subscribe, reconnect logic
│   │   └── handler.js              # Route incoming MQTT messages to decoder -> store
│   │
│   ├── decoder/
│   │   ├── index.js                # Main decode(rawHex) dispatcher
│   │   ├── advert.js               # ADVERT packet parsing
│   │   ├── flood.js                # FLOOD packet parsing
│   │   ├── direct.js               # DIRECT packet parsing
│   │   ├── trace.js                # TRACE packet parsing
│   │   ├── channel.js              # CHANNEL decryption + parsing
│   │   └── constants.js            # Packet type enums, header offsets
│   │
│   ├── stores/
│   │   ├── packet-store.js         # In-memory ring buffer (read path)
│   │   ├── node-store.js           # In-memory node registry
│   │   └── observer-store.js       # In-memory observer state
│   │
│   ├── db/
│   │   ├── connection.js           # SQLite connection + WAL mode setup
│   │   ├── migrations.js           # Schema creation + versioned migrations
│   │   ├── packets.js              # Packet write queries
│   │   ├── nodes.js                # Node upsert queries
│   │   └── observers.js            # Observer upsert queries
│   │
│   ├── services/
│   │   ├── health-engine.js        # Composite health score calculation
│   │   ├── leaderboard-engine.js   # Distance (Haversine), activity, fun rankings
│   │   ├── coverage-sync.js        # MeshMapper API polling + local cache
│   │   ├── topology.js             # Network topology / route pattern analysis
│   │   └── search.js               # Server-side search across nodes/packets/channels
│   │
│   ├── routes/
│   │   ├── index.js                # Mount all route groups on Express app
│   │   ├── health.js               # GET /api/health
│   │   ├── stats.js                # GET /api/stats
│   │   ├── packets.js              # GET/POST /api/packets, /api/packets/:hash
│   │   ├── nodes.js                # GET /api/nodes, /api/nodes/:id, analytics, peers
│   │   ├── repeaters.js            # GET /api/repeaters, /api/repeaters/firmware
│   │   ├── observers.js            # GET /api/observers, /api/observers/:id
│   │   ├── channels.js             # GET /api/channels, /api/channels/:name/messages
│   │   ├── traces.js               # GET /api/traces/:hash
│   │   ├── leaderboards.js         # GET /api/leaderboards/:category
│   │   ├── coverage.js             # GET /api/coverage
│   │   └── topology.js             # GET /api/topology
│   │
│   ├── ws/
│   │   └── server.js               # WebSocket upgrade, client tracking, broadcast
│   │
│   ├── middleware/
│   │   ├── error-handler.js        # Centralized error response formatting
│   │   ├── validate.js             # Request query/param validation helpers
│   │   └── cors.js                 # CORS + X-Frame-Options config
│   │
│   └── utils/
│       ├── haversine.js            # Distance calculation
│       ├── hex.js                  # Hex encode/decode helpers
│       └── time-windows.js         # 24h/7d/30d/all-time window helpers
│
├── public/
│   ├── index.html                  # SPA shell: nav + <main id="app"> + module loader
│   ├── css/
│   │   ├── theme.css               # CSS custom properties (dark + light mode)
│   │   ├── layout.css              # Grid, nav, responsive breakpoints
│   │   └── components.css          # Cards, tables, badges, buttons, forms
│   │
│   ├── js/
│   │   ├── app.js                  # Router, WebSocket manager, state bus
│   │   ├── api.js                  # fetch() wrapper for all /api/* calls
│   │   ├── components/
│   │   │   ├── stats-bar.js        # Reusable hero stats bar
│   │   │   ├── data-table.js       # Sortable/filterable table component
│   │   │   ├── chart-wrapper.js    # Chart.js wrapper with theme colors
│   │   │   ├── map-base.js         # Leaflet map init + dark tiles
│   │   │   ├── search-modal.js     # Cmd+K search overlay
│   │   │   ├── health-gauge.js     # Circular health score gauge
│   │   │   └── packet-detail.js    # Expandable packet hex dump + decoded fields
│   │   │
│   │   └── pages/
│   │       ├── home.js             # Dashboard overview
│   │       ├── health.js           # Mesh health section
│   │       ├── repeaters.js        # Repeater directory
│   │       ├── repeater-detail.js  # Single repeater deep dive
│   │       ├── map.js              # Node map + coverage toggle
│   │       ├── packets.js          # Real-time packet feed
│   │       ├── channels.js         # Channel chat (read-only)
│   │       ├── leaderboards.js     # All leaderboard categories
│   │       ├── traces.js           # Packet tracing
│   │       ├── node-analytics.js   # Per-node 6-chart analytics
│   │       ├── observers.js        # Observer status list
│   │       └── observer-detail.js  # Single observer detail
│   │
│   └── assets/
│       └── favicon.svg
│
├── docker/
│   ├── supervisord.conf
│   ├── mosquitto.conf
│   ├── Caddyfile
│   └── entrypoint.sh
│
├── test/
│   ├── unit/
│   │   ├── decoder/
│   │   │   ├── advert.test.js
│   │   │   ├── flood.test.js
│   │   │   └── direct.test.js
│   │   ├── stores/
│   │   │   └── packet-store.test.js
│   │   ├── services/
│   │   │   ├── health-engine.test.js
│   │   │   └── leaderboard-engine.test.js
│   │   └── utils/
│   │       └── haversine.test.js
│   │
│   ├── integration/
│   │   ├── api/
│   │   │   ├── packets.test.js
│   │   │   ├── nodes.test.js
│   │   │   └── health.test.js
│   │   ├── mqtt-pipeline.test.js   # MQTT -> decode -> store -> WS end-to-end
│   │   └── helpers/
│   │       └── test-server.js      # Spin up Express app with in-memory SQLite
│   │
│   └── fixtures/
│       ├── packets.json            # Sample raw hex packets for decoder tests
│       └── nodes.json              # Sample node data
│
└── tools/
    ├── generate-packets.js         # Synthetic MQTT traffic generator
    └── seed-data.js                # Seed DB + leaderboards for local dev
```

---

## Key Structural Decisions

### 1. Backend Layering

```
MQTT Message In
  -> mqtt/handler.js (raw bytes)
  -> decoder/index.js (parsed packet object)
  -> stores/packet-store.js (in-memory ring buffer - READ path)
  -> db/packets.js (SQLite - WRITE path, fire-and-forget)
  -> ws/server.js (broadcast to browsers)
```

Each layer has a single responsibility. The handler doesn't know about SQLite. The store doesn't know about WebSocket. This makes each piece independently testable.

### 2. Frontend: ES Modules + Page Pattern

```html
<!-- index.html -->
<script type="module" src="/js/app.js"></script>
```

```javascript
// js/app.js - router
const routes = {
  '/':             () => import('./pages/home.js'),
  '/health':       () => import('./pages/health.js'),
  '/repeaters':    () => import('./pages/repeaters.js'),
  '/packets':      () => import('./pages/packets.js'),
  // ...
};

// Each page exports: { mount(container), unmount() }
```

Pages are lazy-loaded on navigation. Shared components (tables, charts, map) are imported by pages that need them. No globals, no script-tag ordering issues.

### 3. Graceful Shutdown (src/index.js)

```javascript
// Boot sequence
const db = initDatabase(config);
const stores = initStores();
const mqttClient = connectMqtt(config, stores, db);
const { app, server } = startHttp(config, stores, db);
const wss = startWebSocket(server, stores);

// Shutdown
async function shutdown() {
  mqttClient.end();
  wss.close();
  server.close();
  db.close();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

### 4. Config Validation (src/config.js)

Validate required fields at startup, merge env overrides. Fail immediately with clear message if config is invalid (e.g., missing MQTT broker URL, invalid port).

---

## Implementation Phases (Restructured)

### Phase 1: Foundation (Core Infrastructure)
**Goal:** MQTT packets flow in, get decoded, stored, and broadcast via WebSocket.

| Step | Files | Deliverable |
|------|-------|-------------|
| 1.1 | `package.json`, `vitest.config.js` | Project init with deps: express, ws, mqtt, better-sqlite3, vitest |
| 1.2 | `src/config.js`, `config.example.json` | Config loader with validation + env overrides |
| 1.3 | `src/db/connection.js`, `src/db/migrations.js` | SQLite setup with WAL mode, schema creation |
| 1.4 | `src/db/packets.js`, `src/db/nodes.js`, `src/db/observers.js` | Write-path queries |
| 1.5 | `src/stores/packet-store.js` | Ring buffer with indexed lookups (by hash, type, source, time) |
| 1.6 | `src/stores/node-store.js`, `src/stores/observer-store.js` | In-memory registries |
| 1.7 | `src/decoder/*` | Packet decoder: ADVERT, FLOOD, DIRECT first; TRACE, CHANNEL later |
| 1.8 | `src/utils/haversine.js`, `src/utils/hex.js` | Utility functions |
| 1.9 | `src/mqtt/client.js`, `src/mqtt/handler.js` | MQTT subscribe + decode + store pipeline |
| 1.10 | `src/ws/server.js` | WebSocket broadcast on new packets |
| 1.11 | `src/routes/*` (packets, nodes, observers, stats, health) | Core REST API endpoints |
| 1.12 | `src/middleware/*` | Error handler, validation, CORS |
| 1.13 | `src/index.js` | Boot sequence + graceful shutdown |
| 1.14 | `tools/generate-packets.js` | Synthetic packet generator for testing |
| 1.15 | `test/unit/decoder/*`, `test/unit/stores/*`, `test/unit/utils/*` | Unit tests for decoder, stores, haversine |
| 1.16 | `test/integration/api/*`, `test/integration/mqtt-pipeline.test.js` | Integration tests |
| 1.17 | `Dockerfile`, `docker/`, `docker-compose.yml` | Container setup |

### Phase 2: Frontend Shell + Core Views
**Goal:** SPA loads, navigates between pages, shows live data.

| Step | Files | Deliverable |
|------|-------|-------------|
| 2.1 | `public/index.html` | SPA shell with nav sidebar + `<main id="app">` |
| 2.2 | `public/css/theme.css`, `layout.css`, `components.css` | Full NodakMesh dark theme |
| 2.3 | `public/js/app.js` | Hash router + WebSocket manager + event bus |
| 2.4 | `public/js/api.js` | Fetch wrapper for all API calls |
| 2.5 | `public/js/components/stats-bar.js`, `data-table.js`, `chart-wrapper.js` | Reusable UI components |
| 2.6 | `public/js/pages/home.js` | Overview dashboard: stats bar, activity sparkline, recent feed |
| 2.7 | `public/js/pages/packets.js`, `public/js/components/packet-detail.js` | Real-time packet feed with filters + expandable detail |
| 2.8 | `public/js/components/map-base.js`, `public/js/pages/map.js` | Leaflet node map with dark tiles, markers, popups |
| 2.9 | Mobile responsiveness pass for Phase 2 pages | Touch targets, breakpoints, iOS safe areas |

### Phase 3: Health, Repeaters, Observers
**Goal:** Network health monitoring + repeater/observer management.

| Step | Files | Deliverable |
|------|-------|-------------|
| 3.1 | `src/services/health-engine.js`, `src/routes/health.js` | Health score: observer uptime, packet delivery, SNR, churn, repeater uptime |
| 3.2 | `public/js/components/health-gauge.js`, `public/js/pages/health.js` | Health dashboard: score, timeline, alerts, observer table, topology viz |
| 3.3 | `public/js/pages/repeaters.js`, `public/js/pages/repeater-detail.js` | Repeater directory + detail (activity timeline, SNR, peers, heatmap) |
| 3.4 | `public/js/pages/node-analytics.js` | 6 interactive charts per node |
| 3.5 | `public/js/pages/observers.js`, `public/js/pages/observer-detail.js` | Observer status + management |
| 3.6 | `src/services/topology.js`, `src/routes/topology.js` | Network topology data |
| 3.7 | `test/unit/services/health-engine.test.js` | Health engine tests |

### Phase 4: Leaderboards, Channels, Tracing, Search
**Goal:** The fun stuff + utility features.

| Step | Files | Deliverable |
|------|-------|-------------|
| 4.1 | `src/services/leaderboard-engine.js`, `src/routes/leaderboards.js` | Distance (Haversine), activity, fun leaderboards |
| 4.2 | `public/js/pages/leaderboards.js` | Leaderboard UI: tabs (24h/7d/30d/all), categories |
| 4.3 | `src/decoder/channel.js`, `src/routes/channels.js` | Channel message decryption + API |
| 4.4 | `public/js/pages/channels.js` | Channel chat view (read-only) |
| 4.5 | `src/routes/traces.js` | Packet trace API |
| 4.6 | `public/js/pages/traces.js` | Packet tracing with map visualization |
| 4.7 | `src/services/search.js` | Server-side search |
| 4.8 | `public/js/components/search-modal.js` | Cmd+K global search overlay |
| 4.9 | `test/unit/services/leaderboard-engine.test.js` | Leaderboard tests |

### Phase 5: Coverage, Polish, Deploy
**Goal:** MeshMapper integration, firmware inventory, production readiness.

| Step | Files | Deliverable |
|------|-------|-------------|
| 5.1 | `src/services/coverage-sync.js`, `src/routes/coverage.js` | MeshMapper API integration, hourly polling, caching |
| 5.2 | `public/js/pages/map.js` (extend) | Coverage heatmap toggle on Leaflet map |
| 5.3 | `src/routes/repeaters.js` (extend) | Firmware inventory from advert packets |
| 5.4 | `public/css/theme.css` (extend) | Light mode toggle |
| 5.5 | Full mobile responsiveness pass | All pages |
| 5.6 | Performance: response caching, pre-warming stores on boot | Sub-10ms reads |
| 5.7 | Azure Container Apps deployment config + CI/CD | Production deploy |

---

## Features Preserved (All from Original Plan)

Every feature from `NODAKMESH_DASHBOARD_BUILD_PLAN.md` is preserved:

- Home/Overview with hero stats, health gauge, sparkline, recent feed
- Mesh Health with composite score, timeline, observer table, alerts, topology
- Repeater directory with search/filter, detail pages, firmware inventory
- Node Map (Leaflet) + Coverage Map (MeshMapper)
- Real-time Packet Feed with filters, hex dumps, shareable links
- Channel Chat (read-only, with key-based decryption)
- Leaderboards (distance, activity, fun categories)
- Packet Tracing with map visualization
- Node Analytics (6 chart types per node)
- Observer Management with onboarding guide
- Global Search (Cmd+K / Ctrl+K)

All API endpoints, WebSocket events, data models, and SQLite schema are unchanged.

---

## Tech Stack (Unchanged)

- **Runtime:** Node.js 22+ (Express, ws, mqtt.js, better-sqlite3)
- **Frontend:** Vanilla JS SPA with ES modules, Leaflet, Chart.js
- **Database:** SQLite via better-sqlite3
- **MQTT:** Mosquitto (bundled in Docker)
- **Testing:** vitest (added)
- **Container:** Docker with supervisord
- **Deployment:** Azure Container Apps

---

## Task Type
- [x] Backend
- [x] Frontend
- [x] Fullstack

---

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| MeshCore packet format undocumented | Reference Kpa-clawbot decoder + `@letsmesh/meshcore-packet-decoder`; build test fixtures from real packet captures |
| MeshMapper API unavailable/changes | Graceful fallback UI ("coverage coming soon"); cache aggressively; adapter pattern for API client |
| Single-container SQLite under write load | WAL mode + write-only path; reads from memory store; SQLite handles this fine for regional scale |
| 15 frontend pages in vanilla JS | ES module lazy loading keeps initial load small; shared components prevent duplication |
| MQTT reconnection / observer flapping | Exponential backoff in mqtt/client.js; debounce observer status changes in observer-store.js |
