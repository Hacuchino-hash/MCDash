// NodakMesh Dashboard - Topology Service
// Network topology analysis for force-directed graph visualization

/**
 * Creates a topology service for building network graph data.
 *
 * @param {{ packetStore: object, nodeStore: object }} deps
 * @returns {{ getTopology: () => { nodes: Array, links: Array } }}
 */
export function createTopologyService({ packetStore, nodeStore }) {
  if (packetStore == null) {
    throw new Error("packetStore is required");
  }
  if (nodeStore == null) {
    throw new Error("nodeStore is required");
  }

  function getTopology() {
    const allNodes = nodeStore.getAll({ limit: 1000 });
    const allPackets = packetStore.getAll({ limit: 10000 });

    // Build node list
    const nodeMap = new Map();
    const packetCounts = new Map();

    for (const node of allNodes) {
      nodeMap.set(node.id, {
        id: node.id,
        name: node.name || node.id,
        role: node.role || "unknown",
        packetCount: 0,
      });
    }

    // Build link weights from packet source/dest pairs
    const linkMap = new Map();

    for (const packet of allPackets) {
      const source = packet.sourceId || packet.source || packet.from;
      const dest = packet.destinationId || packet.destination || packet.to;

      if (source == null || dest == null) {
        continue;
      }

      // Count packets per node
      packetCounts.set(source, (packetCounts.get(source) || 0) + 1);
      packetCounts.set(dest, (packetCounts.get(dest) || 0) + 1);

      // Ensure both nodes exist in the map
      if (!nodeMap.has(source)) {
        nodeMap.set(source, {
          id: source,
          name: source,
          role: "unknown",
          packetCount: 0,
        });
      }
      if (!nodeMap.has(dest)) {
        nodeMap.set(dest, {
          id: dest,
          name: dest,
          role: "unknown",
          packetCount: 0,
        });
      }

      // Create undirected link key (alphabetical sort for consistency)
      const linkKey = [source, dest].sort().join(":");
      const existing = linkMap.get(linkKey);

      if (existing != null) {
        linkMap.set(linkKey, {
          ...existing,
          weight: existing.weight + 1,
        });
      } else {
        linkMap.set(linkKey, {
          source,
          target: dest,
          weight: 1,
        });
      }
    }

    // Apply packet counts to nodes
    const nodes = Array.from(nodeMap.values()).map((node) => ({
      ...node,
      packetCount: packetCounts.get(node.id) || 0,
    }));

    const links = Array.from(linkMap.values());

    return Object.freeze({
      nodes: Object.freeze(nodes.map((n) => Object.freeze(n))),
      links: Object.freeze(links.map((l) => Object.freeze(l))),
    });
  }

  return Object.freeze({
    getTopology,
  });
}
