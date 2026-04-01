// NodakMesh Dashboard - API Client

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export async function api(path, options = {}) {
  const url = `/api${path}`;
  const config = {
    headers: { "Content-Type": "application/json" },
    ...options,
  };

  let response;
  try {
    response = await fetch(url, config);
  } catch (err) {
    throw new ApiError(
      `Network error: unable to reach ${url}`,
      0,
      null,
    );
  }

  let json;
  try {
    json = await response.json();
  } catch (err) {
    throw new ApiError(
      `Invalid JSON response from ${url}`,
      response.status,
      null,
    );
  }

  if (!response.ok || !json.success) {
    throw new ApiError(
      json.error || `API error (${response.status})`,
      response.status,
      json,
    );
  }

  return json;
}

// ---- Convenience Methods ----

export function getStats() {
  return api("/stats");
}

export function getPackets(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return api(qs ? `/packets?${qs}` : "/packets");
}

export function getPacketByHash(hash) {
  return api(`/packets/${encodeURIComponent(hash)}`);
}

export function getNodes(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return api(qs ? `/nodes?${qs}` : "/nodes");
}

export function getNodeById(id) {
  return api(`/nodes/${encodeURIComponent(id)}`);
}

export function getRepeaters(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return api(qs ? `/repeaters?${qs}` : "/repeaters");
}

export function getRepeaterById(id) {
  return api(`/repeaters/${encodeURIComponent(id)}`);
}

export function getObservers() {
  return api("/observers");
}

export function getObserverById(id) {
  return api(`/observers/${encodeURIComponent(id)}`);
}

export function getHealth() {
  return api("/health");
}

export function getLeaderboards(category) {
  return api(`/leaderboards/${encodeURIComponent(category)}`);
}

export function getCoverage() {
  return api("/coverage");
}

export function getChannels() {
  return api("/channels");
}

export function getTraces(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return api(qs ? `/traces?${qs}` : "/traces");
}
