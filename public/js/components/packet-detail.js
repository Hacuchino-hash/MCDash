// NodakMesh Dashboard - Packet Detail Component

/**
 * Formats a timestamp as a locale string.
 */
function formatTimestamp(ts) {
  if (!ts) {
    return "Unknown";
  }
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

/**
 * Converts raw hex string to formatted hex dump (16 bytes per row).
 * Returns array of { offset, hex, ascii } rows.
 */
function buildHexDump(hexString) {
  if (!hexString) {
    return [];
  }

  const clean = hexString.replace(/\s+/g, "");
  const bytes = [];

  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.substring(i, i + 2), 16));
  }

  const rows = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const chunk = bytes.slice(i, i + 16);
    const offset = i.toString(16).padStart(8, "0");

    const hex = chunk
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ")
      .padEnd(47, " "); // 16*3 - 1

    const ascii = chunk
      .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : "."))
      .join("");

    rows.push({ offset, hex, ascii });
  }

  return rows;
}

/**
 * Creates an expandable packet detail view.
 * @param {HTMLElement} container
 * @param {object} packet
 */
export function createPacketDetail(container, packet) {
  const wrapper = document.createElement("div");
  wrapper.className = "card";
  wrapper.style.marginTop = "0.5rem";

  // Header row with type badge and route
  const header = document.createElement("div");
  header.className = "flex-between";
  header.style.marginBottom = "1rem";

  const typeBadge = document.createElement("span");
  typeBadge.className = "badge badge-cyan";
  typeBadge.textContent = packet.type || "UNKNOWN";

  const route = document.createElement("span");
  route.style.cssText = "font-size:0.875rem;color:var(--text-secondary);";
  const src = packet.source || packet.from || "?";
  const dest = packet.destination || packet.to || "?";
  route.textContent = `${src} \u2192 ${dest}`;

  header.appendChild(typeBadge);
  header.appendChild(route);
  wrapper.appendChild(header);

  // Metadata grid
  const metaGrid = document.createElement("div");
  metaGrid.className = "grid-3";
  metaGrid.style.marginBottom = "1rem";

  const metaItems = [
    { label: "Hops", value: packet.hopCount ?? packet.hops ?? "-" },
    { label: "SNR", value: packet.snr != null ? `${packet.snr} dB` : "-" },
    { label: "RSSI", value: packet.rssi != null ? `${packet.rssi} dBm` : "-" },
    { label: "Timestamp", value: formatTimestamp(packet.timestamp || packet.receivedAt) },
  ];

  metaItems.forEach((item) => {
    const cell = document.createElement("div");
    cell.style.fontSize = "0.8125rem";

    const label = document.createElement("div");
    label.style.cssText = "color:var(--text-secondary);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;";
    label.textContent = item.label;

    const value = document.createElement("div");
    value.style.color = "var(--color-text-primary)";
    value.textContent = item.value;

    cell.appendChild(label);
    cell.appendChild(value);
    metaGrid.appendChild(cell);
  });

  wrapper.appendChild(metaGrid);

  // Decoded fields
  if (packet.decodedPayload && Object.keys(packet.decodedPayload).length > 0) {
    const decodedSection = document.createElement("div");
    decodedSection.style.marginBottom = "1rem";

    const decodedTitle = document.createElement("div");
    decodedTitle.style.cssText = "font-weight:600;font-size:0.875rem;margin-bottom:0.5rem;";
    decodedTitle.textContent = "Decoded Fields";
    decodedSection.appendChild(decodedTitle);

    const fieldList = document.createElement("div");
    fieldList.style.cssText = `
      background:var(--color-bg-tertiary);border-radius:var(--radius-sm);padding:0.75rem;
      font-size:0.8125rem;font-family:var(--font-mono);
    `;

    Object.entries(packet.decodedPayload).forEach(([key, val]) => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:0.75rem;padding:0.125rem 0;";
      row.innerHTML = `<span style="color:var(--color-accent-hover);">${escapeHtml(key)}:</span><span style="color:var(--color-text-primary);">${escapeHtml(String(val))}</span>`;
      fieldList.appendChild(row);
    });

    decodedSection.appendChild(fieldList);
    wrapper.appendChild(decodedSection);
  }

  // Hex dump (expandable)
  const rawHex = packet.rawHex || packet.raw || packet.payloadHex || "";

  if (rawHex) {
    const hexSection = document.createElement("div");

    const hexToggle = document.createElement("button");
    hexToggle.className = "btn btn-secondary";
    hexToggle.style.cssText = "font-size:0.75rem;padding:0.25rem 0.75rem;margin-bottom:0.5rem;";
    hexToggle.textContent = "Show Hex Dump";

    const hexContent = document.createElement("div");
    hexContent.style.display = "none";

    const hexPre = document.createElement("pre");
    hexPre.style.cssText = `
      background:var(--color-bg-tertiary);border-radius:var(--radius-sm);padding:0.75rem;
      font-size:0.75rem;font-family:var(--font-mono);overflow-x:auto;line-height:1.6;
      color:var(--color-text-primary);
    `;

    const dumpRows = buildHexDump(rawHex);
    hexPre.textContent = dumpRows
      .map((r) => `${r.offset}  ${r.hex}  |${r.ascii}|`)
      .join("\n");

    // Copy button
    const copyBtn = document.createElement("button");
    copyBtn.className = "btn btn-secondary";
    copyBtn.style.cssText = "font-size:0.75rem;padding:0.25rem 0.75rem;margin-top:0.5rem;";
    copyBtn.textContent = "Copy Raw Hex";
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(rawHex).then(
        () => { copyBtn.textContent = "Copied!"; setTimeout(() => { copyBtn.textContent = "Copy Raw Hex"; }, 1500); },
        () => { copyBtn.textContent = "Copy failed"; },
      );
    });

    hexContent.appendChild(hexPre);
    hexContent.appendChild(copyBtn);

    let expanded = false;
    hexToggle.addEventListener("click", () => {
      expanded = !expanded;
      hexContent.style.display = expanded ? "block" : "none";
      hexToggle.textContent = expanded ? "Hide Hex Dump" : "Show Hex Dump";
    });

    hexSection.appendChild(hexToggle);
    hexSection.appendChild(hexContent);
    wrapper.appendChild(hexSection);
  }

  container.appendChild(wrapper);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
