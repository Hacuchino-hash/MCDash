// NodakMesh Dashboard - Health Gauge Component (SVG circular gauge)

const SIZE = 120;
const STROKE_WIDTH = 10;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ANIMATION_DURATION_MS = 800;

/**
 * Returns color based on health score.
 */
function getScoreColor(score) {
  if (score >= 80) {
    return "#10b981"; // green
  }
  if (score >= 50) {
    return "#f59e0b"; // amber
  }
  return "#ef4444"; // red
}

/**
 * Creates a circular health score gauge (0-100).
 * @param {HTMLElement} container
 * @param {number} score - 0 to 100
 * @returns {{ update: (newScore: number) => void }}
 */
export function createHealthGauge(container, score) {
  const clampedScore = Math.max(0, Math.min(100, score));

  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:inline-flex;align-items:center;justify-content:center;";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", SIZE);
  svg.setAttribute("height", SIZE);
  svg.setAttribute("viewBox", `0 0 ${SIZE} ${SIZE}`);

  // Background circle
  const bgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  bgCircle.setAttribute("cx", SIZE / 2);
  bgCircle.setAttribute("cy", SIZE / 2);
  bgCircle.setAttribute("r", RADIUS);
  bgCircle.setAttribute("fill", "none");
  bgCircle.setAttribute("stroke", "#1e293b");
  bgCircle.setAttribute("stroke-width", STROKE_WIDTH);

  // Foreground arc
  const fgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  fgCircle.setAttribute("cx", SIZE / 2);
  fgCircle.setAttribute("cy", SIZE / 2);
  fgCircle.setAttribute("r", RADIUS);
  fgCircle.setAttribute("fill", "none");
  fgCircle.setAttribute("stroke", getScoreColor(clampedScore));
  fgCircle.setAttribute("stroke-width", STROKE_WIDTH);
  fgCircle.setAttribute("stroke-linecap", "round");
  fgCircle.setAttribute("stroke-dasharray", CIRCUMFERENCE);
  fgCircle.setAttribute("stroke-dashoffset", CIRCUMFERENCE);
  fgCircle.setAttribute("transform", `rotate(-90 ${SIZE / 2} ${SIZE / 2})`);
  fgCircle.style.transition = `stroke-dashoffset ${ANIMATION_DURATION_MS}ms ease, stroke ${ANIMATION_DURATION_MS}ms ease`;

  // Center text
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", SIZE / 2);
  text.setAttribute("y", SIZE / 2);
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("dominant-baseline", "central");
  text.setAttribute("fill", "#e5e7eb");
  text.setAttribute("font-size", "1.75rem");
  text.setAttribute("font-weight", "700");
  text.textContent = clampedScore;

  svg.appendChild(bgCircle);
  svg.appendChild(fgCircle);
  svg.appendChild(text);
  wrapper.appendChild(svg);
  container.appendChild(wrapper);

  // Animate in after DOM attach
  requestAnimationFrame(() => {
    const offset = CIRCUMFERENCE - (clampedScore / 100) * CIRCUMFERENCE;
    fgCircle.setAttribute("stroke-dashoffset", offset);
  });

  function update(newScore) {
    const clamped = Math.max(0, Math.min(100, newScore));
    const offset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE;

    fgCircle.setAttribute("stroke-dashoffset", offset);
    fgCircle.setAttribute("stroke", getScoreColor(clamped));
    text.textContent = clamped;
  }

  return Object.freeze({ update });
}
