import { db, FS, ensureAnonAuth } from "./firebase.js";

const listeners = new Set();
const state = {
  mode: "firebase",
  backendReadBlocked: false,
  signals: [],
  resources: [],
  outreachLogs: [],
  sessionSubmits: [],
  penalties: new Map()
};

const mock = { signals: [], resources: [], outreachLogs: [] };

function emit() { listeners.forEach((cb) => cb(structuredClone(state))); }
export function subscribe(cb) { listeners.add(cb); cb(structuredClone(state)); return () => listeners.delete(cb); }

function normalizeDoc(d) {
  const data = d.data();
  return {
    id: d.id,
    ...data,
    created_at: data.created_at?.toDate ? data.created_at.toDate() : data.created_at,
    updated_at: data.updated_at?.toDate ? data.updated_at.toDate() : data.updated_at
  };
}

function offlineLike(err) {
  return ["unavailable", "deadline-exceeded", "failed-precondition"].includes(err?.code);
}

async function attachCollection(name) {
  const col = FS.collection(db, name);
  return FS.onSnapshot(col, (snap) => {
    state[name] = snap.docs.map(normalizeDoc);
    emit();
  }, (err) => {
    if (err?.code === "permission-denied") {
      state.backendReadBlocked = true;
      emit();
      return;
    }
    if (offlineLike(err)) {
      state.mode = "demo";
      state[name] = mock[name];
      emit();
    }
  });
}

export async function initStore() {
  await ensureAnonAuth();
  await Promise.all([attachCollection("signals"), attachCollection("resources"), attachCollection("outreachLogs")]);
}

function withPenalty(gridId) {
  const now = Date.now();
  state.sessionSubmits = state.sessionSubmits.filter((t) => now - t < 30_000);
  state.sessionSubmits.push(now);
  let beta = 1;
  if (state.sessionSubmits.length > 4) beta = 0.5;
  const inGrid5m = state.signals.filter((s) => s.grid_id === gridId && (now - new Date(s.created_at).getTime() < 5 * 60_000)).length;
  if (inGrid5m >= 6) beta = Math.min(beta, 0.6);
  state.penalties.set(gridId, beta);
  return beta;
}

export async function submitSignal({ source_type, category, grid_id }) {
  await ensureAnonAuth();
  const beta = withPenalty(grid_id);
  const payload = { created_at: FS.serverTimestamp(), source_type, category, grid_id, status: "open", weight: beta };
  const ref = await FS.addDoc(FS.collection(db, "signals"), payload);
  console.log("[FS WRITE OK] signals", ref.id);
}

export async function saveResource({ grid_id, capacity_score }) {
  await ensureAnonAuth();
  const payload = {
    resource_id: grid_id,
    resource_type: "capacity",
    availability_state: "manual",
    updated_at: FS.serverTimestamp(),
    capacity_score
  };
  const ref = await FS.addDoc(FS.collection(db, "resources"), payload);
  console.log("[FS WRITE OK] resources", ref.id);
}

export async function saveOutreachLog({ grid_id, action, outcome, mode }) {
  await ensureAnonAuth();
  const payload = { created_at: FS.serverTimestamp(), mode, grid_id, action, outcome };
  const ref = await FS.addDoc(FS.collection(db, "outreachLogs"), payload);
  console.log("[FS WRITE OK] outreachLogs", ref.id);
}
