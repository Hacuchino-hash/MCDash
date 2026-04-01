// NodakMesh Dashboard - Chart.js Wrapper Component

const THEME_COLORS = [
  "#10b981",
  "#06b6d4",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
];

const DARK_DEFAULTS = {
  color: "#9ca3af",
  borderColor: "#1e293b",
  backgroundColor: "transparent",
};

/**
 * Creates a Chart.js chart with NodakMesh theme colors.
 * @param {HTMLElement} container
 * @param {{
 *   type: 'line'|'bar'|'pie'|'doughnut',
 *   labels: string[],
 *   datasets: Array<object>,
 *   options?: object
 * }} config
 * @returns {{ update: (labels: string[], datasets: Array) => void, destroy: () => void }}
 */
export function createChart(container, config) {
  const canvas = document.createElement("canvas");
  container.appendChild(canvas);

  function applyThemeToDatasets(datasets) {
    return datasets.map((ds, i) => ({
      borderColor: THEME_COLORS[i % THEME_COLORS.length],
      backgroundColor: config.type === "line"
        ? `${THEME_COLORS[i % THEME_COLORS.length]}20`
        : config.type === "bar"
          ? `${THEME_COLORS[i % THEME_COLORS.length]}80`
          : THEME_COLORS,
      pointBackgroundColor: THEME_COLORS[i % THEME_COLORS.length],
      tension: 0.3,
      ...ds,
    }));
  }

  function buildOptions(userOptions) {
    const base = {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          labels: { color: DARK_DEFAULTS.color },
        },
      },
      scales: {},
    };

    if (config.type === "line" || config.type === "bar") {
      base.scales = {
        x: {
          grid: { color: DARK_DEFAULTS.borderColor },
          ticks: { color: DARK_DEFAULTS.color },
        },
        y: {
          grid: { color: DARK_DEFAULTS.borderColor },
          ticks: { color: DARK_DEFAULTS.color },
          beginAtZero: true,
        },
      };
    }

    return deepMerge(base, userOptions || {});
  }

  const chartInstance = new Chart(canvas, {
    type: config.type,
    data: {
      labels: config.labels,
      datasets: applyThemeToDatasets(config.datasets),
    },
    options: buildOptions(config.options),
  });

  function update(labels, datasets) {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets = applyThemeToDatasets(datasets);
    chartInstance.update();
  }

  function destroy() {
    chartInstance.destroy();
    if (canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
  }

  return Object.freeze({ update, destroy });
}

/**
 * Deep merge two objects (non-mutating).
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}
