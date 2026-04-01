// NodakMesh Dashboard - Stats Bar Component

/**
 * Creates a horizontal stats bar with stat cards.
 * @param {HTMLElement} container - Parent element to render into
 * @param {Array<{label: string, value: string|number, icon?: string, trend?: {direction: 'up'|'down', value: string}}>} stats
 * @returns {{ update: (stats: Array) => void }}
 */
export function createStatsBar(container, stats) {
  const wrapper = document.createElement("div");
  wrapper.className = "grid-4";
  container.appendChild(wrapper);

  function renderCards(statsList) {
    wrapper.innerHTML = "";

    statsList.forEach((stat) => {
      const card = document.createElement("div");
      card.className = "stat-card";

      const valueEl = document.createElement("div");
      valueEl.className = "stat-value";
      valueEl.textContent = stat.value;

      const labelEl = document.createElement("div");
      labelEl.className = "stat-label";
      labelEl.textContent = stat.label;

      card.appendChild(valueEl);
      card.appendChild(labelEl);

      if (stat.trend) {
        const changeEl = document.createElement("div");
        const isPositive = stat.trend.direction === "up";
        changeEl.className = `stat-change ${isPositive ? "positive" : "negative"}`;
        const arrow = isPositive ? "\u2191" : "\u2193";
        changeEl.textContent = `${arrow} ${stat.trend.value}`;
        card.appendChild(changeEl);
      }
    });
  }

  function update(newStats) {
    const cards = wrapper.querySelectorAll(".stat-card");

    newStats.forEach((stat, i) => {
      if (cards[i]) {
        const valueEl = cards[i].querySelector(".stat-value");
        const labelEl = cards[i].querySelector(".stat-label");

        if (valueEl) {
          valueEl.textContent = stat.value;
        }
        if (labelEl) {
          labelEl.textContent = stat.label;
        }

        const existingChange = cards[i].querySelector(".stat-change");
        if (stat.trend) {
          const isPositive = stat.trend.direction === "up";
          const arrow = isPositive ? "\u2191" : "\u2193";
          if (existingChange) {
            existingChange.className = `stat-change ${isPositive ? "positive" : "negative"}`;
            existingChange.textContent = `${arrow} ${stat.trend.value}`;
          } else {
            const changeEl = document.createElement("div");
            changeEl.className = `stat-change ${isPositive ? "positive" : "negative"}`;
            changeEl.textContent = `${arrow} ${stat.trend.value}`;
            cards[i].appendChild(changeEl);
          }
        } else if (existingChange) {
          existingChange.remove();
        }
      }
    });

    // If count changed, re-render entirely
    if (cards.length !== newStats.length) {
      renderCards(newStats);
    }
  }

  renderCards(stats);

  return Object.freeze({ update });
}
