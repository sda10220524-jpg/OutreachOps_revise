export const ui = {
  banner: document.getElementById("banner"),
  backlog: document.getElementById("kpiBacklog"),
  response: document.getElementById("kpiResponse"),
  priorityList: document.getElementById("priorityList"),
  selectedGrid: document.getElementById("selectedGrid"),
  capacityInput: document.getElementById("capacityInput"),
  requestGrid: document.getElementById("requestGrid"),
  categoryButtons: document.getElementById("categoryButtons"),
  toast: document.getElementById("toast"),
  logModal: document.getElementById("logModal")
};

export function showToast(msg) {
  ui.toast.textContent = msg;
  ui.toast.classList.remove("hidden");
  setTimeout(() => ui.toast.classList.add("hidden"), 1400);
}

export function setBanner(msg) {
  if (!msg) { ui.banner.classList.add("hidden"); return; }
  ui.banner.classList.remove("hidden");
  ui.banner.textContent = msg;
}

export function setupTabs() {
  document.querySelectorAll(".tab[data-tab]").forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll(".tab[data-tab]").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`${btn.dataset.tab}Tab`).classList.add("active");
    };
  });
}

export function switchScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}
