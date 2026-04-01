// NodakMesh Dashboard - Data Table Component

/**
 * Creates a sortable, filterable data table.
 * @param {HTMLElement} container
 * @param {{
 *   columns: Array<{key: string, label: string, sortable?: boolean, render?: (value: any, row: object) => string}>,
 *   data: Array<object>,
 *   onRowClick?: (row: object) => void,
 *   emptyMessage?: string
 * }} config
 * @returns {{ update: (data: Array) => void, setFilter: (key: string, value: string) => void }}
 */
export function createDataTable(container, config) {
  const { columns, onRowClick, emptyMessage = "No data available" } = config;

  let currentData = [...config.data];
  let sortKey = null;
  let sortAsc = true;
  let filters = {};

  const tableWrapper = document.createElement("div");
  tableWrapper.style.overflowX = "auto";
  container.appendChild(tableWrapper);

  const table = document.createElement("table");
  table.className = "table";
  tableWrapper.appendChild(table);

  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");
  table.appendChild(thead);
  table.appendChild(tbody);

  function renderHeader() {
    thead.innerHTML = "";
    const tr = document.createElement("tr");

    columns.forEach((col) => {
      const th = document.createElement("th");
      th.textContent = col.label;

      if (col.sortable) {
        th.style.cursor = "pointer";
        th.style.userSelect = "none";

        if (sortKey === col.key) {
          th.textContent += sortAsc ? " \u25B2" : " \u25BC";
        }

        th.addEventListener("click", () => {
          if (sortKey === col.key) {
            sortAsc = !sortAsc;
          } else {
            sortKey = col.key;
            sortAsc = true;
          }
          renderHeader();
          renderBody();
        });
      }

      tr.appendChild(th);
    });

    thead.appendChild(tr);
  }

  function getFilteredAndSorted() {
    let rows = [...currentData];

    // Apply filters
    for (const [key, value] of Object.entries(filters)) {
      if (value === "" || value === null || value === undefined) {
        continue;
      }
      const lowerValue = String(value).toLowerCase();
      rows = rows.filter((row) => {
        const cellValue = row[key];
        if (cellValue === null || cellValue === undefined) {
          return false;
        }
        return String(cellValue).toLowerCase().includes(lowerValue);
      });
    }

    // Apply sort
    if (sortKey) {
      rows = rows.toSorted((a, b) => {
        const valA = a[sortKey] ?? "";
        const valB = b[sortKey] ?? "";

        if (typeof valA === "number" && typeof valB === "number") {
          return sortAsc ? valA - valB : valB - valA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        const cmp = strA.localeCompare(strB);
        return sortAsc ? cmp : -cmp;
      });
    }

    return rows;
  }

  function renderBody() {
    tbody.innerHTML = "";
    const rows = getFilteredAndSorted();

    if (rows.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = columns.length;
      td.style.textAlign = "center";
      td.style.color = "var(--text-secondary)";
      td.style.padding = "2rem";
      td.textContent = emptyMessage;
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    rows.forEach((row) => {
      const tr = document.createElement("tr");

      if (onRowClick) {
        tr.style.cursor = "pointer";
        tr.addEventListener("click", () => onRowClick(row));
      }

      columns.forEach((col) => {
        const td = document.createElement("td");
        if (col.render) {
          td.innerHTML = col.render(row[col.key], row);
        } else {
          td.textContent = row[col.key] ?? "";
        }
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  }

  function update(newData) {
    currentData = [...newData];
    renderBody();
  }

  function setFilter(key, value) {
    filters = { ...filters, [key]: value };
    renderBody();
  }

  renderHeader();
  renderBody();

  return Object.freeze({ update, setFilter });
}
