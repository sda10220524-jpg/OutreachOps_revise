import { initStore, subscribe, submitSignal, saveResource, saveOutreachLog } from "./store.js";
import { chooseGridZ, gridIdFromLatLng, visibleGridIds, classifyCells } from "./grid.js";
import { createMap, renderGrid } from "./map.js";
import { ui, showToast, setBanner, setupTabs, switchScreen } from "./ui.js";

const categories = ["food", "shelter", "medical", "hygiene"];
let selectedGridId = "";
let requestCategory = categories[0];
let derivedRows = [];
let latestState = null;

function getCurrentGridZ(map) { return chooseGridZ(map.getZoom()); }
function hoursAgo(date) { return (Date.now() - new Date(date).getTime()) / 3600000; }

function computeDashboard(state, map) {
  const W_MS = 7 * 24 * 3600000;
  const k = 10;
  const now = Date.now();
  const z = getCurrentGridZ(map);
  const ids = visibleGridIds(map.getBounds(), z);
  const signals = state.signals.filter((s) => s.created_at && now - new Date(s.created_at).getTime() <= W_MS && String(s.grid_id).startsWith(`z${z}_`));

  const demandByCell = Object.fromEntries(ids.map((id) => [id, 0]));
  const U = Object.fromEntries(ids.map((id) => [id, 0]));

  for (const s of signals) {
    const base = s.source_type === "org" ? 1.0 : s.source_type === "provider" || s.source_type === "partner" ? 0.7 : 0.2;
    const decay = Math.exp(-hoursAgo(s.created_at) / 24);
    const beta = Math.max(0.5, Math.min(1, Number(s.weight || 1)));
    if (s.grid_id in demandByCell) {
      demandByCell[s.grid_id] += base * decay * beta;
      U[s.grid_id] += 1;
    }
  }

  const capByCell = Object.fromEntries(ids.map((id) => [id, 1]));
  for (const r of state.resources) {
    if (r.resource_type === "capacity" && r.resource_id in capByCell) capByCell[r.resource_id] = Number(r.capacity_score ?? 1);
  }

  const publishable = ids.filter((id) => U[id] >= k);
  const classes = classifyCells(publishable, demandByCell);

  const rows = ids.map((id) => {
    const insufficient = U[id] < k;
    const Demand = demandByCell[id] || 0;
    const Capacity = capByCell[id] ?? 1;
    const P = Demand / (Capacity + 0.1);
    const c = insufficient ? "INSUFFICIENT" : classes[id] || "MED";
    const label = insufficient ? "데이터 부족" : c;
    return { grid_id: id, U: U[id], Demand, Capacity, P, classification: c, label };
  });

  const priority = rows.filter((r) => r.classification !== "INSUFFICIENT").sort((a, b) => b.P - a.P).slice(0, 12);

  const logsByGrid = new Set(state.outreachLogs.map((l) => l.grid_id));
  const backlog = state.signals.filter((s) => s.status === "open" && !logsByGrid.has(s.grid_id)).length;

  const firstLogByGrid = {};
  for (const l of state.outreachLogs) {
    const t = new Date(l.created_at).getTime();
    if (!firstLogByGrid[l.grid_id] || t < firstLogByGrid[l.grid_id]) firstLogByGrid[l.grid_id] = t;
  }
  const diffs = state.signals.map((s) => {
    const st = new Date(s.created_at).getTime();
    const lt = firstLogByGrid[s.grid_id];
    return lt && lt > st ? (lt - st) / 60000 : null;
  }).filter(Boolean);
  const avg = diffs.length ? `${Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length)} min` : "—";

  return { rows, priority, backlog, avg };
}

function renderPriority(priority) {
  ui.priorityList.innerHTML = "";
  for (const p of priority) {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${p.grid_id}</strong><br/>P=${p.P.toFixed(2)} | Demand=${p.Demand.toFixed(2)} | Capacity=${p.Capacity.toFixed(1)}`;
    li.onclick = () => {
      selectedGridId = p.grid_id;
      ui.selectedGrid.textContent = `Selected: ${selectedGridId}`;
      ui.requestGrid.textContent = `Selected: ${selectedGridId}`;
      li.classList.add("highlight");
      setTimeout(() => li.classList.remove("highlight"), 500);
    };
    ui.priorityList.appendChild(li);
  }
}

function setupCategoryButtons() {
  categories.forEach((c, i) => {
    const b = document.createElement("button");
    b.textContent = c;
    if (i === 0) b.classList.add("active");
    b.onclick = () => {
      requestCategory = c;
      [...ui.categoryButtons.children].forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
    };
    ui.categoryButtons.appendChild(b);
  });
}

async function main() {
  setupTabs();
  setupCategoryButtons();

  const map = createMap(({ lat, lng, gridZ }) => {
    selectedGridId = gridIdFromLatLng(lat, lng, gridZ);
    ui.selectedGrid.textContent = `Selected: ${selectedGridId}`;
    ui.requestGrid.textContent = `Selected: ${selectedGridId}`;
  });

  document.getElementById("openRequest").onclick = () => switchScreen("requestScreen");
  document.getElementById("cancelRequest").onclick = () => switchScreen("dashboardScreen");
  document.getElementById("openSafety").onclick = () => switchScreen("safetyScreen");
  document.getElementById("backDashboard").onclick = () => switchScreen("dashboardScreen");
  document.getElementById("openLog").onclick = () => {
    document.getElementById("logGrid").value = selectedGridId;
    ui.logModal.showModal();
  };
  document.getElementById("refreshBtn").onclick = () => map.triggerRepaint();

  document.getElementById("submitRequest").onclick = async () => {
    const ok = document.getElementById("requestSafety").checked;
    if (!ok || !selectedGridId) return showToast("Select grid + safety check required");
    await submitSignal({ source_type: "public", category: requestCategory, grid_id: selectedGridId });
    showToast("Submitted → Dashboard updated");
    switchScreen("dashboardScreen");
  };

  document.getElementById("saveCapacity").onclick = async () => {
    if (!selectedGridId) return showToast("Select a grid first");
    await saveResource({ grid_id: selectedGridId, capacity_score: Number(ui.capacityInput.value) });
    showToast("Capacity saved, priority recalculated");
  };

  document.getElementById("saveLog").onclick = async (e) => {
    e.preventDefault();
    if (!document.getElementById("logSafety").checked) return showToast("Safety check required");
    await saveOutreachLog({
      grid_id: document.getElementById("logGrid").value,
      action: document.getElementById("logAction").value,
      outcome: document.getElementById("logOutcome").value,
      mode: "org"
    });
    ui.logModal.close();
    showToast("Metrics updated");
  };

  await initStore();
  subscribe((s) => {
    latestState = s;
    setBanner(s.backendReadBlocked ? "Backend read blocked" : s.mode === "demo" ? "DEMO MODE: backend unavailable" : "");
    if (!map.loaded()) return;
    const computed = computeDashboard(s, map);
    derivedRows = computed.rows;
    ui.backlog.textContent = computed.backlog;
    ui.response.textContent = computed.avg;
    renderPriority(computed.priority);
    renderGrid(map, computed.rows);
  });

  map.on("moveend", () => {
    if (!latestState) return;
    const computed = computeDashboard(latestState, map);
    derivedRows = computed.rows;
    renderPriority(computed.priority);
    renderGrid(map, computed.rows);
  });
}

main();
