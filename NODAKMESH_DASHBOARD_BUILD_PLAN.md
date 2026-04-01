# NodakMesh MeshCore Dashboard — Build Plan for Claude Code

> **Project:** Self-hosted MeshCore network dashboard for NodakMesh.org (Fargo, ND region — IATA: `FAR`)  
> **Hosting:** Azure Container Apps (Docker)  
> **Integration:** Embedded into existing NodakMesh.org Astro/Tailwind site at `/meshcore/analyzer`  
> **Owner:** Josh / NodakMesh.org  

---

## 1. Project Overview

Build a comprehensive, self-hosted MeshCore mesh network dashboard that replaces the current outbound links to `analyzer.letsmesh.net` with an in-house solution. The dashboard will be a standalone Node.js application running in a Docker container on Azure, served via iframe or subdomain (e.g., `dashboard.nodakmesh.org`) and visually integrated with the NodakMesh.org theme.

This is **not** a fork of Kpa-clawbot/meshcore-analyzer — it is a **new build** inspired by both `analyzer.letsmesh.net` (Michael Hart's closed-source analyzer) and the open-source `Kpa-clawbot/meshcore-analyzer`, with NodakMesh-specific features like coverage integration from MeshMapper, leaderboards, and a mesh health section.

### Key Design Goals
- **Comprehensive:** A user should open this dashboard and immediately understand how the NodakMesh network is doing — health, coverage, activity, fun stats, all in one place.
- **Themed:** Match NodakMesh.org's existing dark-mode aesthetic (Astro + Tailwind, dark backgrounds, clean sans-serif typography, green/teal accent colors).
- **Performant:** In-memory packet store with SQLite write-through (same pattern as Kpa-clawbot analyzer). Sub-10ms reads on all dashboard endpoints.
- **Dockerized:** Single-container deployment with Node.js app + Mosquitto MQTT broker + optional Caddy reverse proxy.
- **Mobile-first responsive:** Full touch support, iOS safe areas, compact layouts on small screens.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Azure Container App                       │
│                                                                   │
│  ┌───────────┐    ┌──────────────────────┐    ┌──────────────┐  │
│  │ Mosquitto  │───▶│  Node.js Server      │───▶│  SQLite DB   │  │
│  │ MQTT Broker│    │  (Express + WS)      │    │  (write-only)│  │
│  │ :1883      │    │  :3000               │    └──────────────┘  │
│  └───────────┘    │                      │                       │
│                    │  ┌────────────────┐  │    ┌──────────────┐  │
│                    │  │ In-Memory Store│  │    │ REST API     │  │
│                    │  │ (ring buffer)  │  │    │ + WebSocket  │  │
│                    │  └────────────────┘  │    └──────────────┘  │
│                    └──────────────────────┘                       │
│                                                                   │
│  ┌───────────┐    (optional)                                     │
│  │ Caddy      │    Reverse proxy + auto TLS                     │
│  │ :80/:443   │                                                  │
│  └───────────┘                                                   │
└─────────────────────────────────────────────────────────────────┘
         ▲                           ▲
         │ MQTT packets              │ Coverage data (HTTP polling)
         │                           │
┌────────┴─────────┐     ┌──────────┴──────────┐
│ Observer Nodes    │     │ MeshMapper API      │
│ (meshcoretomqtt   │     │ far.meshmapper.net  │
│  or WiFi firmware)│     │ /coverage.php       │
└──────────────────┘     └─────────────────────┘
```

### Data Flow
1. **Observer nodes** (MeshCore repeaters with packet logging) publish raw packets to the MQTT broker on topic `meshcore/FAR/+/packets` and status on `meshcore/FAR/+/status`.
2. **The server** subscribes to MQTT, decodes packets using a MeshCore packet decoder, stores them in both an in-memory ring buffer (for fast reads) and SQLite (for persistence/history).
3. **WebSocket** pushes real-time packet events to connected browsers.
4. **REST API** serves historical queries, analytics, health data.
5. **Coverage data** is periodically fetched from MeshMapper's API (`far.meshmapper.net`) and cached locally for the coverage/map overlay.

### Tech Stack
- **Runtime:** Node.js 22+ (Express, ws, mqtt.js, better-sqlite3)
- **Frontend:** Vanilla JS SPA (single `index.html` shell with client-side routing) — keeps it lightweight and Docker-friendly. Leaflet for maps. Chart.js or lightweight charting for analytics.
- **Database:** SQLite via better-sqlite3 (write-only in production; reads from in-memory store)
- **MQTT:** Mosquitto (bundled in Docker container)
- **Container:** Single Dockerfile — Node.js + Mosquitto + Caddy (supervisor)
- **Deployment:** Azure Container Apps (or Azure Container Instances)

---

## 3. Observer Node Setup (Reference — Not Part of This Codebase)

The dashboard requires at least one observer node feeding MQTT data. Document these two methods for NodakMesh users:

### Method A: Standalone WiFi Firmware (Recommended — No Pi Required)
- **Hardware:** Heltec V3 or V4, Station G2
- **Firmware:** Custom MeshCore build from `agessaman/MeshCore` (mqtt-bridge-implementation branch) with built-in WiFi, NTP, and JWT-authenticated MQTT packet logging
- **Firmware version:** 1.11.0+ (or latest from the mqtt-bridge branch)
- **Setup commands (via MeshCore Flasher console):**
  ```
  set prv.key <PRIVATE-KEY>
  set name FAR_<LocationName>
  set mqtt.iata FAR
  set repeat off              # (if observe-only; skip if full repeater)
  set wifi.ssid <SSID>
  set wifi.pwd <PASSWORD>
  set timezone America/Chicago
  set radio 910.525,62.5,7,5  # US/CAN standard
  set lat <LATITUDE>
  set lon <LONGITUDE>
  password <ADMIN_PW>
  reboot
  ```
- The device connects to WiFi and publishes directly to the dashboard's MQTT broker.

### Method B: USB + Raspberry Pi + meshcoretomqtt
- **Hardware:** Any MeshCore repeater + Raspberry Pi (Zero/2/3/4/5)
- **Firmware:** Standard MeshCore repeater firmware compiled with `MESH_PACKET_LOGGING=1` build flag
- **Bridge software:** [Cisien/meshcoretomqtt](https://github.com/Cisien/meshcoretomqtt)
  ```bash
  curl -fsSL https://raw.githubusercontent.com/Cisien/meshcoretomqtt/main/install.sh | sudo bash
  ```
- Configure `config.toml` with IATA code `FAR` and the dashboard's MQTT broker address.
- MQTT topics: `meshcore/FAR/<PUBKEY>/packets`, `meshcore/FAR/<PUBKEY>/status`, `meshcore/FAR/<PUBKEY>/debug`

### Method C: Remote MQTT Source (Subscribe to letsmesh.net)
- The dashboard can also connect as an MQTT client to an external broker (e.g., letsmesh.net's broker) to pull FAR-region packets.
- Configure via `mqttSources` in `config.json` with optional `iataFilter: ["FAR"]`.

---

## 4. Dashboard Sections & Features

### 4.1 Home / Overview Dashboard
The landing page. At-a-glance mesh health.

- **Hero stats bar:** Total active nodes, total packets (24h), active observers, active repeaters, active channels, uptime percentage
- **Network health gauge:** Overall mesh health score (0–100) based on: observer uptime, packet delivery rates, node churn, SNR averages
- **Activity sparkline:** 24h packet volume mini-chart
- **Recent activity feed:** Last 10 packets (scrolling, real-time via WebSocket)
- **Quick links:** Jump to Health, Repeaters, Map, Leaderboards, Packets

### 4.2 Mesh Health Section
**Goal:** "A user opens this and knows exactly how the mesh is doing."

- **Health Score:** Composite score with breakdown:
  - Observer availability (% of observers online in last hour)
  - Packet delivery rate (successful routes vs. floods)
  - Average SNR across all observers
  - Node churn rate (new nodes vs. disappeared nodes, 7-day rolling)
  - Repeater uptime (% of known repeaters seen in last 24h)
- **Health timeline:** Line chart showing health score over last 7/30 days
- **Observer status table:** Each observer with: name, firmware version, online/offline status, last seen, packet count (24h), uptime %, connected brokers
- **Alert panel:** Warnings for: observers offline >1hr, SNR degradation, unusual packet volume spikes, repeater disappearances
- **Network topology visualization:** Force-directed graph or Sankey showing packet flow between observers and repeaters (which repeaters relay the most traffic)

### 4.3 Repeater Section
- **Repeater directory:** Searchable/filterable table of all known repeaters
  - Columns: Name, Public Key (truncated), Role (repeater/room server), First Seen, Last Seen, Packet Count, Avg SNR, Status (active/stale/offline)
  - Filter tabs: All | Repeaters | Room Servers | Offline
- **Repeater detail page** (click any repeater):
  - Activity timeline (packets over time)
  - Packet type breakdown (pie chart: flood, direct, advert, trace)
  - SNR distribution histogram
  - Hop count analysis
  - Peer network (which other nodes this repeater talks to)
  - Hourly heatmap (activity by hour-of-day)
  - "Heard By" table — which observers hear this repeater, with SNR/RSSI
  - Firmware version (if detectable from advert packets)
- **Repeater firmware inventory** (best-effort/passive):
  - If advert packets contain firmware version info, aggregate and display
  - Table: Firmware Version | Node Count | Nodes Running It
  - Flag outdated firmware with a warning badge
  - Note: This is passive detection only — can only see what observers report

### 4.4 Map Section
Two map views:

#### 4.4.1 Node Map (Leaflet)
- All known nodes plotted by GPS coordinates (from advert packets)
- Color-coded markers: Repeaters (green), Room Servers (blue), Companions (purple), Offline (grey)
- Click marker → popup with node details, link to detail page
- Draw lines for observed packet routes (optional toggle)
- Dark-mode tile layer (CARTO Dark Matter) matching NodakMesh theme
- Toggle: Show/hide node labels, show/hide route lines

#### 4.4.2 Coverage Map (MeshMapper Integration)
- Fetch coverage data from `far.meshmapper.net` via their coverage API
- **API integration:**
  - `COVERAGE_API_URL=https://meshmapper.net`
  - `COVERAGE_API_KEY=<optional key from MeshMapper>`
  - Poll interval: hourly (configurable via `COVERAGE_SYNC_INTERVAL_SECONDS`)
  - Cache locally as JSON file
- Overlay coverage heatmap on the Leaflet map
- Coverage classification legend: BIDIR (green), DISC (blue), TRACE (yellow), TX (orange)
- Toggle between Node Map and Coverage Map views
- **If MeshMapper API is unavailable or returns no data for FAR region:** Show a friendly "Coverage data coming soon — start wardriving with the MeshMapper app!" message with links to iOS/Android apps

### 4.5 Packet Feed
- Real-time scrolling packet feed (WebSocket)
- Columns: Timestamp, Type, Source, Destination, Hops, SNR, RSSI, Size (bytes), Observer
- Expandable detail pane: full hex dump, decoded fields, byte-level breakdown
- Filters: by packet type, by node, by observer, by time range
- "My Nodes" toggle (if user has claimed/starred nodes)
- Search by hash or node name
- Shareable deep links to individual packets (`/packets?hash=<HASH>`)

### 4.6 Channel Chat
- Decoded group channel messages (requires channel keys in config)
- Display: sender name, message text, timestamp, channel name
- Support hashtag channels (auto-derived keys via SHA256)
- Configure known channels in `config.json`:
  ```json
  {
    "channelKeys": {
      "public": "8b3387e9c5cdea6ac9e5edbaa115cd72",
      "#nodakmesh": "<auto-derived>"
    }
  }
  ```
- Read-only — no sending from the dashboard

### 4.7 Leaderboards 🏆
**The fun section.** All leaderboards display the **node name** that achieved each record.

#### Distance Leaderboards
- **Longest Single Hop:** Greatest distance between two nodes in a single packet relay. Show: Rank, Node A Name, Node B Name, Distance (mi/km), Date, SNR
- **Longest Multi-Hop Path:** Greatest total path distance for a single packet. Show: Rank, Path (Node A → B → C → D), Total Distance, Hops, Date
- **Longest Direct Message:** Farthest confirmed direct (non-flood) message delivery

#### Activity Leaderboards
- **Most Active Repeater (24h / 7d / 30d):** Packets relayed
- **Most Reliable Repeater:** Highest packet delivery rate
- **Best SNR Champion:** Repeater with highest average SNR
- **Most Connected Node:** Node with the most unique peers
- **Busiest Observer:** Observer reporting the most packets

#### Fun / Community Leaderboards
- **Night Owl:** Most active node between midnight–5am
- **Early Bird:** Most active node between 5am–8am
- **Marathon Runner:** Node with longest continuous uptime streak
- **New Kid on the Block:** Newest node to join the mesh (and its stats so far)

#### Leaderboard Data Sources
- Distance calculations: Use Haversine formula on GPS coordinates from advert packets
- All leaderboards computed server-side from packet data in the in-memory store
- Update interval: Every 5 minutes (or on-demand via API)
- Time windows: 24h, 7d, 30d, All-Time tabs

### 4.8 Packet Tracing
- Follow an individual packet's journey across the mesh
- Input: packet hash
- Output: timeline showing each observer that heard the packet, with timestamps, SNR, RSSI
- Visualize on map with animated route

### 4.9 Node Analytics (Per-Node Deep Dive)
Accessible from the repeater directory or by clicking any node anywhere in the UI.

- 6 interactive charts (inspired by Kpa-clawbot analyzer):
  1. **Activity Timeline** — packets over time (line chart)
  2. **Packet Type Breakdown** — pie/donut chart
  3. **SNR Distribution** — histogram
  4. **Hop Count Analysis** — bar chart
  5. **Peer Network** — force-directed graph of connected nodes
  6. **Hourly Heatmap** — 24×7 grid showing activity patterns

### 4.10 Observer Management
- Observer status page: online/offline, last heartbeat, firmware version, packet count, connected brokers
- Observer onboarding guide (static content page explaining Methods A/B/C from Section 3)
- Observer health history (uptime chart per observer)

### 4.11 Global Search (Ctrl+K / Cmd+K)
- Quick search across: nodes, packets (by hash), channels, observers
- Keyboard shortcut activation
- Results grouped by category

---

## 5. Theme & Visual Design

### Match NodakMesh.org Aesthetic
The existing NodakMesh.org site uses:
- **Dark background:** Near-black (#0a0a0a to #111827 range)
- **Accent colors:** Green/teal (#10b981, #34d399) for primary actions and highlights
- **Typography:** Clean sans-serif (likely system or Tailwind defaults)
- **Cards:** Dark cards with subtle borders, rounded corners
- **Style:** Technical but approachable, not overly flashy

### Dashboard-Specific Design
- **Color palette:**
  - Background: `#0a0f1a` (dark navy-black)
  - Surface/Cards: `#111827` with `1px solid #1e293b` borders
  - Primary accent: `#10b981` (emerald green — matches mesh/network theme)
  - Secondary accent: `#06b6d4` (cyan — for secondary actions)
  - Warning: `#f59e0b` (amber)
  - Error/Offline: `#ef4444` (red)
  - Text: `#e5e7eb` (light grey on dark)
  - Muted text: `#9ca3af`
- **Map tiles:** CARTO Dark Matter (matches dark theme)
- **Charts:** Use the accent palette; avoid garish colors
- **Status indicators:** Green dot = online, red dot = offline, yellow dot = degraded
- **Animations:** Subtle — pulse on live data updates, smooth transitions between views, no gratuitous motion
- **Mobile:** Proper responsive breakpoints, touch-friendly tap targets, iOS safe area padding

### CSS Implementation
Use CSS custom properties for the entire theme:
```css
:root {
  --bg-primary: #0a0f1a;
  --bg-surface: #111827;
  --bg-elevated: #1e293b;
  --border: #1e293b;
  --text-primary: #e5e7eb;
  --text-secondary: #9ca3af;
  --accent-green: #10b981;
  --accent-cyan: #06b6d4;
  --accent-amber: #f59e0b;
  --accent-red: #ef4444;
  --radius: 8px;
}
```

Support a light-mode toggle (optional, lower priority) that inverts to light backgrounds with dark text.

---

## 6. Configuration

### config.json
```json
{
  "port": 3000,
  "siteName": "NodakMesh Dashboard",
  "region": "FAR",
  "regionName": "Fargo, ND",
  "mqtt": {
    "broker": "mqtt://localhost:1883",
    "topic": "meshcore/FAR/+/packets",
    "statusTopic": "meshcore/FAR/+/status"
  },
  "mqttSources": [
    {
      "name": "letsmesh-far",
      "broker": "mqtts://mqtt.letsmesh.net:8883",
      "topics": ["meshcore/FAR/+/packets", "meshcore/FAR/+/status"],
      "iataFilter": ["FAR"],
      "username": "",
      "password": ""
    }
  ],
  "channelKeys": {
    "public": "8b3387e9c5cdea6ac9e5edbaa115cd72"
  },
  "coverage": {
    "enabled": true,
    "apiUrl": "https://meshmapper.net",
    "apiKey": "",
    "region": "far",
    "syncIntervalSeconds": 3600,
    "maxAgeDays": 30,
    "cacheFile": "data/coverage-cache.json"
  },
  "leaderboards": {
    "updateIntervalMinutes": 5,
    "timeWindows": ["24h", "7d", "30d", "all"]
  },
  "health": {
    "observerOfflineThresholdMinutes": 60,
    "repeaterStaleThresholdHours": 24,
    "snrDegradationThreshold": -15
  },
  "defaultMapCenter": [46.8772, -96.7898],
  "defaultMapZoom": 10
}
```

### Environment Variables (override config)
| Variable | Description |
|---|---|
| `PORT` | HTTP server port |
| `DB_PATH` | SQLite database path (default: `data/meshcore.db`) |
| `MQTT_BROKER` | Override local MQTT broker URL |
| `COVERAGE_API_URL` | MeshMapper base URL |
| `COVERAGE_API_KEY` | MeshMapper API key |
| `NODE_ENV` | `production` / `development` |

---

## 7. Docker Configuration

### Dockerfile
Single-container with supervisord managing three processes:
1. **Mosquitto** MQTT broker (port 1883)
2. **Node.js** application (port 3000)
3. **Caddy** reverse proxy (ports 80/443, optional auto-TLS)

Base image: `node:22-slim`

Install: `mosquitto`, `caddy`, `supervisor`

### docker-compose.yml (for local dev)
```yaml
version: '3.8'
services:
  dashboard:
    build: .
    ports:
      - "80:80"
      - "443:443"
      - "1883:1883"
    volumes:
      - meshcore-data:/app/data
      - caddy-certs:/data/caddy
    environment:
      - NODE_ENV=production
    restart: unless-stopped

volumes:
  meshcore-data:
  caddy-certs:
```

### Azure Deployment
- Deploy as an Azure Container App (or Azure Container Instance)
- Expose ports 80/443 (HTTP/HTTPS) and 1883 (MQTT — for observer nodes to connect)
- Use Azure-managed domain or custom domain `dashboard.nodakmesh.org`
- Persistent volume for `/app/data` (SQLite DB + coverage cache)
- Resource allocation: 1 vCPU, 2GB RAM minimum (sufficient for a regional mesh)

---

## 8. API Endpoints

### REST API
| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Dashboard health check + mesh health score |
| GET | `/api/stats` | Overview stats (node counts, packet volume, uptime) |
| GET | `/api/packets` | Paginated packet list with filters |
| GET | `/api/packets/:hash` | Single packet detail |
| GET | `/api/nodes` | All known nodes with summary stats |
| GET | `/api/nodes/:id` | Node detail + analytics |
| GET | `/api/nodes/:id/analytics` | Per-node chart data |
| GET | `/api/nodes/:id/peers` | Node's peer network |
| GET | `/api/repeaters` | Repeaters only, with health data |
| GET | `/api/repeaters/firmware` | Firmware version inventory |
| GET | `/api/observers` | Observer status list |
| GET | `/api/observers/:id` | Observer detail + analytics |
| GET | `/api/channels` | Active channels with message counts |
| GET | `/api/channels/:name/messages` | Decoded channel messages |
| GET | `/api/traces/:hash` | Packet trace across observers |
| GET | `/api/leaderboards/:category` | Leaderboard data (distance, activity, fun) |
| GET | `/api/coverage` | Cached MeshMapper coverage data |
| GET | `/api/topology` | Network topology / route patterns |
| POST | `/api/packets` | Manual packet injection (for testing) |

### WebSocket
- Connect to `ws://host:3000/ws`
- Events pushed to clients:
  - `packet` — new packet decoded
  - `node_update` — node status change
  - `observer_status` — observer online/offline
  - `health_update` — health score changed
  - `leaderboard_update` — leaderboard recalculated

---

## 9. Data Models

### SQLite Schema
```sql
CREATE TABLE packets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hash TEXT NOT NULL,
  raw_hex TEXT NOT NULL,
  type TEXT,                    -- flood, direct, advert, trace, ack, etc.
  source_id TEXT,
  dest_id TEXT,
  observer_id TEXT,
  observer_iata TEXT DEFAULT 'FAR',
  hops INTEGER,
  hop_path TEXT,                -- JSON array of hop IDs
  snr REAL,
  rssi INTEGER,
  size INTEGER,
  channel TEXT,
  decoded_payload TEXT,         -- JSON of decoded fields
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE nodes (
  id TEXT PRIMARY KEY,          -- public key or prefix
  name TEXT,
  role TEXT,                    -- repeater, room_server, companion
  latitude REAL,
  longitude REAL,
  firmware_version TEXT,
  first_seen DATETIME,
  last_seen DATETIME,
  packet_count INTEGER DEFAULT 0,
  avg_snr REAL,
  metadata TEXT                 -- JSON for extra fields
);

CREATE TABLE observers (
  id TEXT PRIMARY KEY,          -- public key
  name TEXT,
  firmware_version TEXT,
  iata TEXT DEFAULT 'FAR',
  status TEXT DEFAULT 'offline',
  last_heartbeat DATETIME,
  packet_count INTEGER DEFAULT 0,
  connected_brokers INTEGER DEFAULT 0,
  metadata TEXT
);

CREATE TABLE leaderboard_cache (
  category TEXT NOT NULL,
  time_window TEXT NOT NULL,
  data TEXT NOT NULL,           -- JSON
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (category, time_window)
);

CREATE TABLE coverage_cache (
  region TEXT PRIMARY KEY,
  data TEXT NOT NULL,           -- JSON from MeshMapper
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes
```sql
CREATE INDEX idx_packets_timestamp ON packets(timestamp);
CREATE INDEX idx_packets_hash ON packets(hash);
CREATE INDEX idx_packets_type ON packets(type);
CREATE INDEX idx_packets_source ON packets(source_id);
CREATE INDEX idx_packets_observer ON packets(observer_id);
CREATE INDEX idx_nodes_role ON nodes(role);
CREATE INDEX idx_nodes_last_seen ON nodes(last_seen);
```

---

## 10. MeshCore Packet Decoder

The packet decoder is the core of the system. Reference implementations:
- **TypeScript:** `@letsmesh/meshcore-packet-decoder` (mentioned on analyzer.letsmesh.net about page)
- **JavaScript:** `decoder.js` in Kpa-clawbot/meshcore-analyzer

### Key packet types to decode:
| Type | Description |
|---|---|
| `ADVERT` | Node advertisement — contains name, public key, GPS coords, role, firmware |
| `FLOOD` | Broadcast/flood packet — group messages, channel traffic |
| `DIRECT` | Point-to-point routed message |
| `TRACE` | Trace request/response for path discovery |
| `ACK` | Acknowledgment |
| `PATH_REQ` / `PATH_RESP` | Path discovery |
| `CHANNEL` | Encrypted channel message (requires key to decode) |

### Decoding strategy:
1. Receive raw hex payload from MQTT
2. Parse fixed header fields (type, source prefix, dest prefix, hop count, etc.)
3. For ADVERT packets: extract name, GPS, role, firmware version
4. For CHANNEL packets: attempt decryption with configured channel keys
5. For all packets: compute Haversine distance if source/dest GPS known
6. Store both raw hex and decoded JSON

---

## 11. Project File Structure

```
nodakmesh-dashboard/
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .gitignore
├── config.example.json
├── config.json                  # (gitignored)
├── package.json
├── package-lock.json
├── README.md
│
├── server.js                    # Express + WebSocket + MQTT + REST API
├── decoder.js                   # MeshCore packet decoder
├── db.js                       # SQLite schema + queries
├── packet-store.js              # In-memory ring buffer with indexes
├── coverage-sync.js             # MeshMapper coverage data fetcher
├── leaderboard-engine.js        # Leaderboard calculation logic
├── health-engine.js             # Mesh health score computation
│
├── docker/
│   ├── supervisord.conf
│   ├── mosquitto.conf
│   ├── Caddyfile
│   └── entrypoint.sh
│
├── public/
│   ├── index.html               # SPA shell with nav + router
│   ├── style.css                # Full theme (dark mode primary, light toggle)
│   ├── app.js                   # Client-side router, WebSocket, utilities
│   ├── home.js                  # Dashboard home / overview
│   ├── health.js                # Mesh health section
│   ├── repeaters.js             # Repeater directory + detail
│   ├── map.js                   # Leaflet node map
│   ├── coverage.js              # MeshMapper coverage overlay
│   ├── packets.js               # Packet feed + detail + byte breakdown
│   ├── channels.js              # Channel chat view
│   ├── leaderboards.js          # All leaderboard views
│   ├── traces.js                # Packet tracing
│   ├── node-analytics.js        # Per-node analytics charts
│   ├── observers.js             # Observer status + management
│   ├── observer-detail.js       # Observer detail page
│   └── search.js                # Global search (Cmd+K)
│
├── tools/
│   ├── generate-packets.js      # Synthetic test data generator
│   ├── e2e-test.js              # End-to-end API tests
│   └── seed-leaderboards.js     # Seed fake leaderboard data for dev
│
└── data/
    ├── meshcore.db              # Auto-created SQLite database
    └── coverage-cache.json      # Cached MeshMapper coverage data
```

---

## 12. Implementation Phases

### Phase 1: Foundation (Core Infrastructure)
1. Set up Node.js project with Express, better-sqlite3, mqtt.js, ws
2. Implement `db.js` — SQLite schema, migrations, basic queries
3. Implement `packet-store.js` — in-memory ring buffer with indexed lookups
4. Implement `decoder.js` — MeshCore packet decoder (start with ADVERT, FLOOD, DIRECT)
5. Implement `server.js` — MQTT subscription, packet ingestion, WebSocket broadcast
6. Build REST API endpoints for packets, nodes, observers
7. Dockerfile + supervisord + Mosquitto config
8. Test with `tools/generate-packets.js`

### Phase 2: Frontend Shell & Core Views
1. `index.html` SPA shell with navigation sidebar
2. `style.css` — full NodakMesh-themed dark mode
3. `app.js` — client-side hash router, WebSocket connection, utility functions
4. `home.js` — overview dashboard with stats bar and activity feed
5. `packets.js` — real-time packet feed with filters and detail pane
6. `map.js` — Leaflet node map with markers and popups

### Phase 3: Health & Repeaters
1. `health-engine.js` — server-side health score computation
2. `health.js` — health dashboard with score, timeline, alerts, observer table
3. `repeaters.js` — repeater directory with search/filter, detail pages
4. `node-analytics.js` — per-node charts (6 chart types)
5. `observers.js` + `observer-detail.js` — observer management

### Phase 4: Leaderboards & Fun Features
1. `leaderboard-engine.js` — distance calculations (Haversine), activity ranking, fun category logic
2. `leaderboards.js` — frontend for all leaderboard categories
3. `channels.js` — channel chat with decryption
4. `traces.js` — packet tracing with map visualization
5. `search.js` — global search (Cmd+K)

### Phase 5: Coverage Integration & Polish
1. `coverage-sync.js` — MeshMapper API integration, hourly polling, local caching
2. `coverage.js` — coverage heatmap overlay on Leaflet map
3. Repeater firmware inventory (passive detection from adverts)
4. Light mode toggle
5. Mobile responsiveness pass
6. Performance optimization (response caching, pre-warming)
7. Azure deployment configuration + CI/CD

---

## 13. Integration with NodakMesh.org

The existing NodakMesh.org site (Astro + Tailwind) currently has a page at `/meshcore/analyzer` that links out to `analyzer.letsmesh.net`. Replace this with:

### Option A: Subdomain iframe embed
- Deploy dashboard at `dashboard.nodakmesh.org`
- Update the `/meshcore/analyzer` Astro page to embed via iframe:
  ```html
  <iframe src="https://dashboard.nodakmesh.org" class="w-full h-screen border-0" />
  ```
- Set `X-Frame-Options: ALLOW-FROM https://nodakmesh.org` on the dashboard

### Option B: Subdomain with direct navigation
- Deploy at `dashboard.nodakmesh.org`
- Update nav links on NodakMesh.org to point to the subdomain
- The dashboard has its own full-page layout (no iframe needed)

**Recommended: Option B** — avoids iframe quirks, allows full-page experience with proper routing and deep links.

---

## 14. Testing Strategy

- **Unit tests:** Packet decoder edge cases, Haversine distance calculations, health score algorithm
- **E2E tests:** API endpoint responses with seeded data
- **Frontend smoke tests:** Verify all routes render without errors
- **Load test:** Benchmark with synthetic packet generator (target: 1000 packets/sec ingestion, <10ms API response)
- **Integration test:** Verify MQTT → decode → store → WebSocket → browser pipeline

---

## 15. Future Enhancements (Post-MVP)

- **Claimed nodes:** User authentication (via Discord OAuth or simple token) to "star" your nodes
- **Push notifications:** Alert when your node goes offline
- **Historical analytics:** Longer retention with data aggregation (hourly/daily rollups)
- **Multi-region support:** Add Bismarck, Grand Forks, etc. with region selector
- **Export:** CSV/JSON export of packet data, leaderboard snapshots
- **Autonomous blog integration:** Auto-generate weekly mesh health reports for NodakMesh.org blog
- **Comparison views:** Compare two observers' packet visibility side-by-side
- **RF propagation modeling:** Integrate terrain data for predicted vs. actual coverage comparison
