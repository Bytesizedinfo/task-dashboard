import * as store from './store.js';
import { createGitHubBackend, loadGitHubConfig } from './backend/github.js';
import { consumeSetupLink, renderLogin } from './components/connect.js';
import { ui } from './ui-state.js';
import { colorHex } from './constants.js';
import { esc, prefs } from './utils/dom.js';
import { todayISO } from './utils/dates.js';
import { applyTheme } from './utils/theme.js';
import { icons, logo } from './components/icons.js';
import { avatarHtml } from './components/avatar.js';
import { toast } from './components/toast.js';
import { closeAllOverlays, hasOverlay } from './components/overlay.js';
import { openTaskEditor } from './components/taskEditor.js';
import { openCategoryEditor } from './components/categoryEditor.js';
import { openSearch } from './components/search.js';
import { openSettings } from './components/settings.js';
import { closeDateMenu, openDateMenu } from './components/dateMenu.js';
import { dashboardAction, mountDashboard, renderDashboard, stopCustomizing } from './views/dashboard.js';
import { categoryAction, categoryTitle, mountCategory, renderCategory } from './views/category.js';
import { renderToday, renderUpcoming } from './views/agenda.js';
import { mountFocus } from './views/focus.js';
import { renderBoot, renderMessage } from './views/auth.js';

const appEl = document.getElementById('app');

let signedIn = false;
let route = parseRoute();
let routeChanged = true;
let shell = null; // { sidebar, view, tabbar } once the main layout is on screen
let lastChrome = { sidebar: '', tabbar: '' };
let queued = false;
let viewCleanup = null;
let lastDay = todayISO();

ui.requestRender = scheduleRender;

/* ---------- routing ---------- */

function parseRoute() {
  const [a, b] = location.hash.replace(/^#\/?/, '').split('/');
  if (a === 'today') return { name: 'today' };
  if (a === 'upcoming') return { name: 'upcoming' };
  if (a === 'c' && b) return { name: 'category', id: decodeURIComponent(b) };
  return { name: 'dashboard' };
}

/* ---------- rendering ---------- */

function scheduleRender() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    render();
  });
}

// Sync problems that only a new token can fix send you back to the sign-in screen.
const SIGN_IN_AGAIN = {
  auth: 'Your access token has expired or was removed. Sign in again with a new token. Changes made on this device are kept and will sync.',
  forbidden: 'Your access token isn’t allowed to change this repository. Create a token with “Contents: Read and write” for it, then sign in again.',
  notfound: 'The repository can’t be found with this token. Check its name, or create a token that has access to it.',
};

function render() {
  if (!signedIn) return; // the sign-in screen is showing
  const st = store.getState();
  if (st.syncError && SIGN_IN_AGAIN[st.syncErrorKind]) {
    showSignIn({ notice: SIGN_IN_AGAIN[st.syncErrorKind] });
    return;
  }
  if (st.error) {
    teardownShell();
    renderError(st.error);
    return;
  }
  // First visit on this device: wait for the tasks to arrive from GitHub.
  const firstLoad = !st.synced && !st.tasks.length && !st.categories.length && !st.offline && !st.syncError;
  if (!st.ready || firstLoad) {
    if (!shell) renderBoot(appEl, firstLoad ? 'Loading your tasks from GitHub…' : '');
    return;
  }
  if (ui.dragging) return; // re-rendered when the drag ends
  if (!shell) mountShell();
  renderChrome(st);
  renderView();
}

function mountShell() {
  appEl.innerHTML = `
    <div class="shell">
      <aside class="sidebar" aria-label="Navigation"></aside>
      <main class="main" id="main" tabindex="-1"></main>
    </div>
    <nav class="tabbar" aria-label="Navigation"></nav>
    <button type="button" class="fab" data-action="new-task" aria-label="New task">${icons.plus}</button>`;
  shell = { sidebar: appEl.querySelector('.sidebar'), view: appEl.querySelector('.main'), tabbar: appEl.querySelector('.tabbar') };
  lastChrome = { sidebar: '', tabbar: '' };
  routeChanged = true;
}

function teardownShell() {
  viewCleanup?.();
  viewCleanup = null;
  shell = null;
}

function renderChrome(st) {
  const sidebar = sidebarHtml(st);
  if (sidebar !== lastChrome.sidebar) shell.sidebar.innerHTML = lastChrome.sidebar = sidebar;
  const tabbar = tabbarHtml();
  if (tabbar !== lastChrome.tabbar) shell.tabbar.innerHTML = lastChrome.tabbar = tabbar;
}

function sidebarHtml(st) {
  const today = todayISO();
  const focus = store.focusTasks(today);
  const od = focus.overdueCount;
  const todayCount = focus.total;
  const up = store.upcomingBuckets(today);
  const upCount = up.tomorrow.length + up.week.length;
  const active = (name, id) => (route.name === name && (!id || route.id === id) ? ' active' : '');
  const sync = store.syncStatus();

  const who = `${avatarHtml(st.user)}<span class="who"><strong>${esc(st.user?.displayName || 'GitHub')}</strong><small><span class="sync-dot ${sync.cls}"></span>${esc(sync.text)}</small></span>`;

  return `
    <a class="brand" href="#/">${logo('side')}<span>Taskboard</span></a>
    <button type="button" class="btn btn-primary block" data-action="new-task">${icons.plus}<span>New task</span><kbd>N</kbd></button>
    <button type="button" class="side-search" data-action="search">${icons.search}<span>Search</span><kbd>/</kbd></button>
    <nav class="side-nav">
      <a class="side-link${active('dashboard')}" href="#/">${icons.home}<span class="name">Dashboard</span></a>
      <a class="side-link${active('today')}" href="#/today">${icons.today}<span class="name">Today</span>${todayCount ? `<span class="badge${od ? ' badge-alert' : ''}">${todayCount}</span>` : ''}</a>
      <a class="side-link${active('upcoming')}" href="#/upcoming">${icons.upcoming}<span class="name">Upcoming</span>${upCount ? `<span class="badge">${upCount}</span>` : ''}</a>
    </nav>
    <div class="side-section"><span>Lists</span><button type="button" class="icon-btn sm" data-action="new-category" aria-label="New list" title="New list">${icons.plus}</button></div>
    <nav class="side-lists">${
      st.categories
        .map((c) => {
          const s = store.categoryStats(c.id, today);
          return `<a class="side-link${active('category', c.id)}" href="#/c/${encodeURIComponent(c.id)}" style="--accent:${colorHex(c.color)}"><span class="dot"></span><span class="emoji">${esc(c.icon)}</span><span class="name">${esc(c.name)}</span>${s.open ? `<span class="count">${s.open}</span>` : ''}</a>`;
        })
        .join('') || '<p class="side-empty">No lists yet</p>'
    }</nav>
    <div class="side-foot"><button type="button" class="side-user" data-action="settings" aria-label="Settings">${who}${icons.settings}</button></div>`;
}

function tabbarHtml() {
  const n = store.focusTasks(todayISO()).total;
  const isActive = (name) => route.name === name || (name === 'dashboard' && route.name === 'category');
  const tab = (name, href, icon, label, extra = '') =>
    `<a class="tab${isActive(name) ? ' active' : ''}" href="${href}"${isActive(name) ? ' aria-current="page"' : ''}>${icon}<span>${label}</span>${extra}</a>`;
  return (
    tab('dashboard', '#/', icons.home, 'Home') +
    tab('today', '#/today', icons.today, 'Today', n ? `<span class="tab-badge">${n}</span>` : '') +
    tab('upcoming', '#/upcoming', icons.upcoming, 'Upcoming') +
    `<button type="button" class="tab" data-action="search">${icons.search}<span>Search</span></button>`
  );
}

function renderView() {
  let html;
  let mount = null;
  let title = 'Dashboard';
  switch (route.name) {
    case 'today':
      html = renderToday();
      title = 'Today';
      mount = () => mountFocus(shell.view);
      break;
    case 'upcoming':
      html = renderUpcoming();
      title = 'Upcoming';
      break;
    case 'category':
      if (!store.findCategory(route.id)) {
        location.replace('#/');
        return;
      }
      html = renderCategory(route.id);
      title = categoryTitle(route.id);
      mount = () => mountCategory(shell.view, route.id);
      break;
    default:
      html = renderDashboard();
      mount = () => mountDashboard(shell.view);
  }

  const saved = routeChanged ? null : captureUi(shell.view);
  viewCleanup?.();
  viewCleanup = null;
  shell.view.innerHTML = html;
  document.title = `${title} · Taskboard`;

  if (routeChanged) {
    routeChanged = false;
    shell.view.classList.remove('view-enter');
    void shell.view.offsetWidth; // restart the entrance animation
    shell.view.classList.add('view-enter');
    window.scrollTo(0, 0);
  } else restoreUi(shell.view, saved);

  viewCleanup = mount ? mount() : null;
}

/** Keep focus, typed text and scroll positions when data changes under the user. */
function captureUi(root) {
  const out = { scroll: {}, focus: null };
  const a = document.activeElement;
  if (a && root.contains(a) && a.dataset.focusKey) {
    out.focus = { key: a.dataset.focusKey, value: a.value, start: a.selectionStart, end: a.selectionEnd };
  }
  root.querySelectorAll('[data-scroll-key]').forEach((el) => (out.scroll[el.dataset.scrollKey] = [el.scrollLeft, el.scrollTop]));
  return out;
}

function restoreUi(root, s) {
  if (!s) return;
  for (const [key, [left, top]] of Object.entries(s.scroll)) {
    const el = root.querySelector(`[data-scroll-key="${CSS.escape(key)}"]`);
    if (el) {
      el.scrollLeft = left;
      el.scrollTop = top;
    }
  }
  if (s.focus) {
    const el = root.querySelector(`[data-focus-key="${CSS.escape(s.focus.key)}"]`);
    if (!el) return;
    if (el.matches('input, textarea')) el.value = s.focus.value ?? '';
    el.focus({ preventScroll: true });
    try {
      if (el.matches('input, textarea')) el.setSelectionRange(s.focus.start, s.focus.end);
    } catch {
      /* not a text input */
    }
  }
}

function renderError(err) {
  renderMessage(appEl, {
    title: 'Couldn’t load your tasks',
    body: `${err?.message || 'Something went wrong.'} Try reloading the page.`,
    actions: [{ label: 'Reload', primary: true, onClick: () => location.reload() }],
  });
}

/* ---------- actions ---------- */

function newTask(el) {
  const defaults = {};
  const ds = el?.dataset || {};
  if (ds.cat) defaults.categoryId = ds.cat;
  else if (route.name === 'category') defaults.categoryId = route.id;
  if (ds.status) defaults.status = ds.status;
  if (ds.due === 'today' || (!ds.due && route.name === 'today')) defaults.dueDate = todayISO();
  openTaskEditor({ defaults });
}

const taskIdFor = (el) => el.closest('[data-task-id]')?.dataset.taskId;

function toggleTask(btn) {
  const card = btn.closest('[data-task-id]');
  const t = card && store.findTask(card.dataset.taskId);
  if (!t) return;
  if (t.status === 'done') {
    store.updateTask(t.id, { status: 'todo' });
    return;
  }
  const prev = t.status;
  // Show the tick first, then save, so the finish animation is visible.
  const check = card.querySelector('.check') || btn;
  card.classList.add('completing');
  check.classList.add('checked');
  check.setAttribute('aria-checked', 'true');
  setTimeout(() => {
    store.updateTask(t.id, { status: 'done' });
    toast('Task completed', { action: 'Undo', onAction: () => store.updateTask(t.id, { status: prev }) });
  }, 420);
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || !shell) return;
  const action = el.dataset.action;
  switch (action) {
    case 'toggle':
      e.stopPropagation();
      toggleTask(el);
      break;
    case 'open-task':
      if (Date.now() - ui.justDraggedAt < 350) return;
      openTaskEditor({ taskId: el.dataset.taskId });
      break;
    case 'star': {
      e.stopPropagation();
      const id = taskIdFor(el);
      if (!id) return;
      const on = store.toggleFocus(id);
      toast(on ? 'Added to Today’s focus' : 'Removed from Today’s focus', { action: 'Undo', onAction: () => store.toggleFocus(id) });
      break;
    }
    case 'due-menu': {
      e.stopPropagation();
      const id = taskIdFor(el);
      if (id) openDateMenu(el, id);
      break;
    }
    case 'delete-task': {
      e.stopPropagation();
      const id = taskIdFor(el);
      const removed = id && store.deleteTask(id);
      if (removed) toast('Task deleted', { action: 'Undo', onAction: () => store.restoreTask(removed) });
      break;
    }
    case 'start-task': {
      const id = taskIdFor(el);
      if (!id) return;
      store.startTask(id);
      toast('Started: marked as In progress');
      break;
    }
    case 'move-overdue': {
      const prev = store.moveOverdueToToday();
      if (prev.length) toast(`Moved ${prev.length} ${prev.length === 1 ? 'task' : 'tasks'} to today`, { action: 'Undo', onAction: () => store.restoreDueDates(prev) });
      break;
    }
    case 'new-task':
      newTask(el);
      break;
    case 'new-category':
      openCategoryEditor();
      break;
    case 'edit-category':
      openCategoryEditor({ categoryId: el.dataset.id });
      break;
    case 'search':
      openSearch();
      break;
    case 'settings':
      openSettings();
      break;
    case 'sync-now':
      store.requestSync();
      break;
    case 'toggle-section': {
      const key = el.dataset.key;
      if (ui.expanded.has(key)) ui.expanded.delete(key);
      else ui.expanded.add(key);
      scheduleRender();
      break;
    }
    default:
      if (route.name === 'category' && categoryAction(action, el, route.id)) scheduleRender();
      else if (route.name === 'dashboard' && dashboardAction(action, el)) scheduleRender();
  }
});

document.addEventListener('keydown', (e) => {
  if (!shell) return;
  const t = e.target;
  const typing = t.closest?.('input, textarea, select, [contenteditable="true"]');
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (!hasOverlay()) openSearch();
    return;
  }
  if (hasOverlay() || typing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === '/') {
    e.preventDefault();
    openSearch();
  } else if (e.key === 'n' || e.key === 'N') {
    e.preventDefault();
    newTask(null);
  } else if ((e.key === 'Enter' || e.key === ' ') && t.matches?.('.task, .un-body')) {
    e.preventDefault();
    openTaskEditor({ taskId: t.dataset.taskId });
  }
});

window.addEventListener('hashchange', () => {
  route = parseRoute();
  routeChanged = true;
  if (route.name !== 'dashboard') stopCustomizing();
  closeAllOverlays();
  closeDateMenu();
  scheduleRender();
});

window.addEventListener('online', scheduleRender);
window.addEventListener('offline', scheduleRender);

// Roll "Today" over at midnight, and after the phone wakes up.
function checkDay() {
  const d = todayISO();
  if (d !== lastDay) {
    lastDay = d;
    scheduleRender();
  }
}
setInterval(checkDay, 60 * 1000);
document.addEventListener('visibilitychange', () => !document.hidden && checkDay());

/* ---------- start-up ---------- */

store.onWriteError((err) => {
  console.error(err);
  toast('Couldn’t save that change.', { tone: 'error' });
});

/** Shows the sign-in screen (instead of the app) until this device has a working access token. */
function showSignIn(opts = {}) {
  signedIn = false;
  closeAllOverlays();
  store.disconnect(); // stop syncing; this device's copy of the tasks stays saved for after sign-in
  teardownShell();
  renderLogin(appEl, opts);
}

function boot() {
  applyTheme(prefs.get('theme', 'dark'));
  store.subscribe(scheduleRender);

  // A setup link from another device ("#connect=…", usually via QR code) pre-fills the sign-in form.
  const setup = consumeSetupLink();
  const gh = loadGitHubConfig();

  if (setup && !setup.invalid) {
    showSignIn({ token: setup.token, repo: `${setup.owner}/${setup.repo}`, fromLink: true });
    return;
  }
  if (!gh) {
    showSignIn({ notice: setup?.invalid ? 'That setup link is incomplete. Copy it again from your other device, or paste your token below.' : '' });
    return;
  }

  // Signed in: tasks load from this device's copy straight away and sync with GitHub in the background.
  signedIn = true;
  // Ask the browser to keep this site's data (sign-in + task copy) even when the device runs low on space.
  navigator.storage?.persisted?.().then((kept) => kept || navigator.storage.persist()).catch(() => {});
  store.connect(createGitHubBackend(gh), {
    uid: `gh:${gh.owner}/${gh.repo}`,
    displayName: gh.login || gh.owner,
    email: `${gh.owner}/${gh.repo}`,
    photoURL: gh.avatar || '',
  });
}

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service worker not registered', err));
}

boot();
