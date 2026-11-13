// App state + actions. Views only talk to this module; it talks to whichever backend is connected
// (Firestore when signed in, localStorage in preview mode).
import { PALETTE_IDS, PRIORITY_IDS, PRIORITY_RANK, SEED_CATEGORIES, STATUS_IDS } from './constants.js';
import { addDays, isISODate, startOfDayMs, startOfWeekMs, todayISO } from './utils/dates.js';
import { prefs, uid } from './utils/dom.js';

const state = {
  ready: false, // first data has arrived
  synced: false, // data confirmed by GitHub at least once (always true in preview mode)
  pending: false, // local changes not yet saved to GitHub
  offline: false,
  syncError: null, // message when sync is paused (e.g. token expired)
  syncErrorKind: null,
  lastSynced: 0,
  mode: null, // 'github' | 'local'
  user: null, // { uid, displayName, email, photoURL }
  error: null,
  tasks: [],
  categories: [],
};

let backend = null;
const listeners = new Set();
let writeErrorHandler = (err) => console.error(err);

export const getState = () => state;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn(state));
}

export function onWriteError(fn) {
  writeErrorHandler = fn;
}

function run(promise) {
  Promise.resolve(promise).catch((err) => writeErrorHandler(err));
}

/* ---------- connection ---------- */

export function connect(nextBackend, user = null) {
  disconnect();
  backend = nextBackend;
  state.mode = nextBackend.mode;
  state.user = user;
  backend.start(onData, onError);
  notify();
}

/** Stops listening and clears data. Does not notify (the caller decides what to show next). */
export function disconnect() {
  backend?.stop();
  backend = null;
  Object.assign(state, {
    ready: false,
    synced: false,
    pending: false,
    offline: false,
    syncError: null,
    syncErrorKind: null,
    lastSynced: 0,
    user: null,
    error: null,
    tasks: [],
    categories: [],
  });
}

/** Ask the backend to sync right away ("Sync now"). */
export function requestSync() {
  return backend?.syncNow?.() || Promise.resolve();
}

function onData({ tasks, categories, synced = true, pending = false, offline = false, syncError = null, syncErrorKind = null, lastSynced = 0 }) {
  state.tasks = tasks.map(normTask);
  state.categories = categories.map(normCat).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
  state.ready = true;
  state.synced = synced;
  state.pending = pending;
  state.offline = offline;
  state.syncError = syncError;
  state.syncErrorKind = syncErrorKind;
  state.lastSynced = lastSynced;
  state.error = null;
  maybeSeed();
  notify();
}

function onError(err) {
  console.error(err);
  state.error = err;
  notify();
}

/* ---------- normalising (data may come from older versions, imports or other devices) ---------- */

function normTask(t) {
  return {
    id: String(t.id),
    title: String(t.title ?? '').slice(0, 500),
    notes: String(t.notes ?? ''),
    categoryId: t.categoryId ? String(t.categoryId) : null,
    status: STATUS_IDS.includes(t.status) ? t.status : 'todo',
    priority: PRIORITY_IDS.includes(t.priority) ? t.priority : 'none',
    tags: Array.isArray(t.tags) ? t.tags.map(String) : [],
    dueDate: isISODate(t.dueDate) ? t.dueDate : null,
    focus: Boolean(t.focus), // starred: pinned to Today's focus until done or unstarred
    order: Number.isFinite(Number(t.order)) ? Number(t.order) : 0,
    createdAt: Number(t.createdAt) || 0,
    completedAt: Number(t.completedAt) || null,
  };
}

function normCat(c) {
  return {
    id: String(c.id),
    name: String(c.name ?? 'Untitled').slice(0, 60),
    icon: String(c.icon || '📁'),
    color: PALETTE_IDS.includes(c.color) ? c.color : 'violet',
    order: Number(c.order) || 0,
    createdAt: Number(c.createdAt) || 0,
  };
}

const withoutId = ({ id, ...rest }) => rest;
const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

/* ---------- first run ---------- */

function maybeSeed() {
  if (!state.synced || state.tasks.length || state.categories.length) return;
  const key = 'seeded.' + (state.user?.uid || 'local');
  if (prefs.get(key, false)) return;
  prefs.set(key, true);

  const now = Date.now();
  const today = todayISO();
  const ops = SEED_CATEGORIES.map((c) => ({ op: 'put', kind: 'categories', id: c.id, data: { ...withoutId(c), createdAt: now } }));
  const starter = [
    { categoryId: 'work', title: 'Open the Board view and drag me to “In progress”', dueDate: today, priority: 'med', tags: ['getting-started'] },
    { categoryId: 'personal', title: 'Star ☆ any task to pin it to Today’s focus', dueDate: null, priority: 'none', tags: ['getting-started'], focus: true },
    { categoryId: 'personal', title: 'Add this app to your phone’s home screen', dueDate: addDays(today, 1), priority: 'low', tags: ['getting-started'] },
    { categoryId: 'ideas', title: 'Try quick-add: “Book dentist +Personal !high @friday”', dueDate: null, priority: 'none', tags: [] },
  ];
  starter.forEach((t, i) => {
    ops.push({
      op: 'put',
      kind: 'tasks',
      id: uid(),
      data: { notes: '', status: 'todo', order: now + i, createdAt: now + i, completedAt: null, ...t },
    });
  });
  run(backend.batch(ops));
}

/* ---------- task actions ---------- */

export function addTask(data) {
  const id = uid();
  const now = Date.now();
  const task = normTask({ ...data, id, createdAt: now, order: data.order ?? now, completedAt: data.status === 'done' ? now : null });
  run(backend.put('tasks', id, withoutId(task)));
  return id;
}

export function updateTask(id, patch) {
  const cur = findTask(id);
  if (!cur) return;
  const p = clean({ ...patch });
  if (p.status && p.status !== cur.status) p.completedAt = p.status === 'done' ? Date.now() : null;
  if (!Object.keys(p).length) return;
  run(backend.patch('tasks', id, p));
}

/** Deletes a task and returns a copy for "Undo". */
export function deleteTask(id) {
  const t = findTask(id);
  if (!t) return null;
  run(backend.remove('tasks', id));
  return { ...t };
}

export function restoreTask(task) {
  run(backend.put('tasks', task.id, withoutId(task)));
}

/** Deletes several tasks at once and returns copies for "Undo". */
export function deleteTasks(ids) {
  const removed = ids.map(findTask).filter(Boolean).map((t) => ({ ...t }));
  if (removed.length) run(backend.batch(removed.map((t) => ({ op: 'remove', kind: 'tasks', id: t.id }))));
  return removed;
}

/** Deletes every list and task (on all devices, through sync). Returns a copy for "Undo". */
export function deleteEverything() {
  const snapshot = { tasks: state.tasks.map((t) => ({ ...t })), categories: state.categories.map((c) => ({ ...c })) };
  const ops = [
    ...snapshot.tasks.map((t) => ({ op: 'remove', kind: 'tasks', id: t.id })),
    ...snapshot.categories.map((c) => ({ op: 'remove', kind: 'categories', id: c.id })),
  ];
  if (ops.length) run(backend.batch(ops));
  return snapshot;
}

/** Puts lists and tasks back exactly as they were (used by "Undo"). */
export function restoreSnapshot({ tasks = [], categories = [] }) {
  const ops = [
    ...categories.map((c) => ({ op: 'put', kind: 'categories', id: c.id, data: withoutId(c) })),
    ...tasks.map((t) => ({ op: 'put', kind: 'tasks', id: t.id, data: withoutId(t) })),
  ];
  if (ops.length) run(backend.batch(ops));
}

export function toggleFocus(id) {
  const t = findTask(id);
  if (t) updateTask(id, { focus: !t.focus });
  return t ? !t.focus : false;
}

export function setDue(id, iso) {
  updateTask(id, { dueDate: iso || null });
}

export function startTask(id) {
  updateTask(id, { status: 'doing' });
}

/** Moves every overdue task to today. Returns the previous dates so "Undo" can put them back. */
export function moveOverdueToToday(today = todayISO()) {
  const list = overdue(today);
  if (list.length) run(backend.batch(list.map((t) => ({ op: 'patch', kind: 'tasks', id: t.id, data: { dueDate: today } }))));
  return list.map((t) => ({ id: t.id, dueDate: t.dueDate }));
}

export function restoreDueDates(previous) {
  const ops = previous.filter((p) => findTask(p.id)).map((p) => ({ op: 'patch', kind: 'tasks', id: p.id, data: { dueDate: p.dueDate } }));
  if (ops.length) run(backend.batch(ops));
}

/** After a board drag: give a column its new order (and status, for cards that moved column). */
export function reorderColumn(status, orderedIds) {
  const ops = [];
  orderedIds.forEach((id, i) => {
    const t = findTask(id);
    if (!t) return;
    const patch = {};
    const order = (i + 1) * 1000;
    if (t.order !== order) patch.order = order;
    if (t.status !== status) {
      patch.status = status;
      patch.completedAt = status === 'done' ? Date.now() : null;
    }
    if (Object.keys(patch).length) ops.push({ op: 'patch', kind: 'tasks', id, data: patch });
  });
  if (ops.length) run(backend.batch(ops));
}

/* ---------- list (category) actions ---------- */

export function addCategory({ name, icon, color }) {
  const id = uid();
  const order = state.categories.reduce((m, c) => Math.max(m, c.order), -1) + 1;
  run(backend.put('categories', id, { name, icon, color, order, createdAt: Date.now() }));
  return id;
}

export function updateCategory(id, patch) {
  run(backend.patch('categories', id, clean(patch)));
}

/** Deletes a list. Its tasks are moved to `moveTo`, or deleted when moveTo is null. */
export function deleteCategory(id, { moveTo = null } = {}) {
  const ops = state.tasks
    .filter((t) => t.categoryId === id)
    .map((t) => (moveTo ? { op: 'patch', kind: 'tasks', id: t.id, data: { categoryId: moveTo } } : { op: 'remove', kind: 'tasks', id: t.id }));
  ops.push({ op: 'remove', kind: 'categories', id });
  run(backend.batch(ops));
}

/* ---------- backup ---------- */

export function exportData() {
  return {
    app: 'taskboard',
    version: 1,
    exportedAt: new Date().toISOString(),
    categories: state.categories,
    tasks: state.tasks,
  };
}

/** Adds (or overwrites by ID) lists and tasks from a backup file. Returns the counts. */
export function importData(data) {
  const cats = (Array.isArray(data?.categories) ? data.categories : []).filter((c) => c && c.id).map(normCat);
  const tasks = (Array.isArray(data?.tasks) ? data.tasks : []).filter((t) => t && t.id && t.title).map(normTask);
  const ops = [
    ...cats.map((c) => ({ op: 'put', kind: 'categories', id: c.id, data: withoutId(c) })),
    ...tasks.map((t) => ({ op: 'put', kind: 'tasks', id: t.id, data: withoutId(t) })),
  ];
  if (ops.length) run(backend.batch(ops));
  return { categories: cats.length, tasks: tasks.length };
}

/* ---------- selectors ---------- */

export const findTask = (id) => state.tasks.find((t) => t.id === id);
export const findCategory = (id) => state.categories.find((c) => c.id === id);

const normName = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** "+work" in quick-add → the Work list. Exact name first, then the first list starting with it. */
export function findCategoryByPrefix(hint) {
  const h = normName(hint);
  if (!h) return null;
  return state.categories.find((c) => normName(c.name) === h) || state.categories.find((c) => normName(c.name).startsWith(h)) || null;
}

const isOpen = (t) => t.status !== 'done';

/** Dated tasks first (soonest first), then by priority, then manual order. */
export function sortTasks(list) {
  return [...list].sort(
    (a, b) =>
      (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99') ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      a.order - b.order,
  );
}

export const overdue = (today = todayISO()) => sortTasks(state.tasks.filter((t) => isOpen(t) && t.dueDate && t.dueDate < today));
export const dueToday = (today = todayISO()) => sortTasks(state.tasks.filter((t) => isOpen(t) && t.dueDate === today));
export const inProgress = () => sortTasks(state.tasks.filter((t) => t.status === 'doing'));
export const doneThisWeek = () => state.tasks.filter((t) => t.status === 'done' && t.completedAt >= startOfWeekMs());
export const doneToday = () =>
  state.tasks.filter((t) => t.status === 'done' && t.completedAt >= startOfDayMs()).sort((a, b) => b.completedAt - a.completedAt);

/**
 * Today's focus: overdue tasks, tasks due today, and starred tasks.
 * `upNext` is the single task to do next: one already in progress, otherwise the most important
 * (priority, then overdue before today, then oldest date, then starred).
 */
export function focusTasks(today = todayISO()) {
  const od = overdue(today);
  const forToday = state.tasks
    .filter((t) => isOpen(t) && !(t.dueDate && t.dueDate < today) && (t.focus || t.dueDate === today))
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || Number(b.focus) - Number(a.focus) || a.order - b.order);
  const all = [...od, ...forToday];
  const key = (t) => [
    t.status === 'doing' ? 0 : 1,
    PRIORITY_RANK[t.priority],
    t.dueDate && t.dueDate < today ? 0 : 1,
    t.dueDate || '9999-99-99',
    t.focus ? 0 : 1,
    t.order,
  ];
  const upNext =
    [...all].sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
      return 0;
    })[0] || null;
  return {
    upNext,
    overdue: od.filter((t) => t !== upNext),
    today: forToday.filter((t) => t !== upNext),
    total: all.length,
    overdueCount: od.length,
  };
}

export function upcomingBuckets(today = todayISO()) {
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, 7);
  const open = sortTasks(state.tasks.filter(isOpen));
  return {
    tomorrow: open.filter((t) => t.dueDate === tomorrow),
    week: open.filter((t) => t.dueDate && t.dueDate > tomorrow && t.dueDate <= weekEnd),
    later: open.filter((t) => t.dueDate && t.dueDate > weekEnd),
    noDate: open.filter((t) => !t.dueDate),
  };
}

export function categoryStats(id, today = todayISO()) {
  const ts = state.tasks.filter((t) => t.categoryId === id);
  const open = ts.filter(isOpen);
  return {
    total: ts.length,
    done: ts.length - open.length,
    open: open.length,
    doing: open.filter((t) => t.status === 'doing').length,
    overdue: open.filter((t) => t.dueDate && t.dueDate < today).length,
    dueToday: open.filter((t) => t.dueDate === today).length,
    next: sortTasks(open)[0] || null,
  };
}

/** All tags in use, most used first. */
export function allTags(tasks = state.tasks) {
  const counts = new Map();
  tasks.forEach((t) => t.tags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1)));
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function search(query) {
  const q = query.trim().toLowerCase();
  if (!q) return { tasks: [], categories: [], total: 0 };
  const byTag = q.startsWith('#');
  const term = byTag ? q.slice(1) : q;
  const categories = byTag ? [] : state.categories.filter((c) => c.name.toLowerCase().includes(term));
  const matches = state.tasks.filter((t) =>
    byTag
      ? t.tags.some((tag) => tag.startsWith(term))
      : t.title.toLowerCase().includes(term) || t.notes.toLowerCase().includes(term) || t.tags.some((tag) => tag.includes(term)),
  );
  const sorted = [...sortTasks(matches.filter(isOpen)), ...matches.filter((t) => !isOpen(t))];
  return { tasks: sorted.slice(0, 60), categories, total: matches.length };
}

export function syncStatus() {
  if (state.mode === 'local') return { cls: 'local', text: 'This browser only' };
  if (state.syncError) return { cls: 'error', text: 'Sync paused' };
  if (state.offline || !navigator.onLine) return { cls: 'offline', text: 'Offline · will sync later' };
  if (state.pending) return { cls: 'pending', text: 'Syncing…' };
  if (!state.synced) return { cls: 'pending', text: 'Connecting…' };
  return { cls: 'ok', text: 'Synced' };
}
