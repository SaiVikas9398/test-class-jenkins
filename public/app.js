// Converter Hub — frontend logic
// Fetches category/unit definitions and history from the Node.js API,
// and calls /api/convert on every input change.

let CATEGORIES = {};
let currentCategory = null;

const categoryRail = document.getElementById("category-rail");
const fromUnitSelect = document.getElementById("from-unit");
const toUnitSelect = document.getElementById("to-unit");
const fromValueInput = document.getElementById("from-value");
const resultValueEl = document.getElementById("result-value");
const conversionNote = document.getElementById("conversion-note");
const swapBtn = document.getElementById("swap-btn");
const historyList = document.getElementById("history-list");
const statusIndicator = document.getElementById("status-indicator");

async function init() {
  try {
    const res = await fetch("/api/categories");
    CATEGORIES = await res.json();
    buildCategoryRail();
    selectCategory(Object.keys(CATEGORIES)[0]);
    loadHistory();
  } catch (err) {
    statusIndicator.textContent = "● OFFLINE";
    statusIndicator.style.color = "#e05c5c";
    conversionNote.textContent = "Could not reach the Converter Hub API. Is the server running?";
  }
}

function buildCategoryRail() {
  categoryRail.innerHTML = "";
  Object.entries(CATEGORIES).forEach(([key, cat]) => {
    const btn = document.createElement("button");
    btn.className = "cat-toggle";
    btn.textContent = cat.label.toUpperCase();
    btn.dataset.key = key;
    btn.addEventListener("click", () => selectCategory(key));
    categoryRail.appendChild(btn);
  });
}

function selectCategory(key) {
  currentCategory = key;
  document.querySelectorAll(".cat-toggle").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.key === key);
  });

  const units = CATEGORIES[key].units;
  const unitKeys = Object.keys(units);

  [fromUnitSelect, toUnitSelect].forEach(select => {
    select.innerHTML = "";
    unitKeys.forEach(uKey => {
      const opt = document.createElement("option");
      opt.value = uKey;
      opt.textContent = units[uKey];
      select.appendChild(opt);
    });
  });

  // Default: from = first unit, to = second unit (or first if only one)
  fromUnitSelect.value = unitKeys[0];
  toUnitSelect.value = unitKeys[1] || unitKeys[0];

  runConversion();
}

async function runConversion() {
  const value = fromValueInput.value;
  if (value === "" || Number.isNaN(Number(value))) {
    resultValueEl.textContent = "—";
    return;
  }
  try {
    const res = await fetch("/api/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: currentCategory,
        from: fromUnitSelect.value,
        to: toUnitSelect.value,
        value: Number(value),
      }),
    });
    const data = await res.json();
    if (data.error) {
      conversionNote.textContent = data.error;
      resultValueEl.textContent = "—";
      return;
    }
    const rounded = roundSmart(data.result);
    resultValueEl.textContent = rounded;
    conversionNote.textContent =
      `${value} ${fromUnitSelect.value.toUpperCase()} = ${rounded} ${toUnitSelect.value.toUpperCase()}`;
    loadHistory();
  } catch (err) {
    conversionNote.textContent = "Conversion failed — check the server connection.";
  }
}

function roundSmart(num) {
  if (Math.abs(num) >= 1000) return Math.round(num).toLocaleString();
  return Math.round(num * 10000) / 10000;
}

async function loadHistory() {
  try {
    const res = await fetch("/api/history");
    const rows = await res.json();
    if (!rows.length) {
      historyList.innerHTML = '<p class="logbook-empty">No conversions logged yet — try one above.</p>';
      return;
    }
    historyList.innerHTML = rows.map(r => {
      const time = new Date(r.created_at + "Z").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return `<div class="log-row">
        <span>${r.input_value} ${r.from_unit.toUpperCase()} → ${roundSmart(r.result)} ${r.to_unit.toUpperCase()} <em style="color:var(--mist-dim); font-style:normal;">(${r.category})</em></span>
        <span class="log-time">${time}</span>
      </div>`;
    }).join("");
  } catch (err) {
    // silently ignore — history is a nice-to-have, not critical path
  }
}

fromValueInput.addEventListener("input", runConversion);
fromUnitSelect.addEventListener("change", runConversion);
toUnitSelect.addEventListener("change", runConversion);
swapBtn.addEventListener("click", () => {
  const f = fromUnitSelect.value;
  fromUnitSelect.value = toUnitSelect.value;
  toUnitSelect.value = f;
  runConversion();
});

init();
