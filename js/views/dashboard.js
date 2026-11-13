// Home dashboard: customisable panels in a bento grid.
// Today's focus (what to do now) leads; At a glance and Your lists follow.
import { categoryStats, doneThisWeek, doneToday, dueToday, getState, inProgress, overdue, upcomingBuckets } from '../store.js';
import { colorHex } from '../constants.js';
import { dueLabel, dueTone, greeting, longDate, todayISO } from '../utils/dates.js';
import { esc, plural, prefs } from '../utils/dom.js';
import { loadSortable } from '../utils/sortable.js';
import { githubMark, icons } from '../components/icons.js';
import { ring } from '../components/ring.js';
import { toast } from '../components/toast.js';
import { ui } from '../ui-state.js';
import { focusPanel, mountFocus } from './focus.js';

// Desktop: Focus fills two columns (and two rows); At a glance and Your lists stack in the third column.
const PANELS = {
  focus: { title: 'Today’s focus', span: 'wide', render: () => `<div class="panel focus-panel">${focusPanel({ cap: 6 })}</div>` },
  glance: { title: 'At a glance', span: 'narrow', render: glancePanel },
  lists: { title: 'Your lists', span: 'narrow', render: listsPanel },
};

/** One line under the greeting, complementing (not repeating) the focus panel. */
function headerLine() {
  const done = doneToday().length;
  const b = upcomingBuckets();
  const soon = b.tomorrow.length + b.week.length;
  const parts = [];
  if (done) parts.push(`${done} ${plural(done, 'task')} done today`);
  if (soon) parts.push(`${soon} coming up in the next 7 days`);
  return parts.length ? parts.join(' · ') : 'A fresh start. Plan your day below.';
}
const DEFAULT_LAYOUT = Object.keys(PANELS).map((id) => ({ id, hidden: false }));

let editing = false;

/** Saved panel order + visibility (per device). Unknown panels are dropped, new ones appended. */
export function getLayout() {
  const saved = prefs.get('dash.layout', null);
  const out = [];
  if (Array.isArray(saved)) {
    saved.forEach((p) => {
      if (p && PANELS[p.id] && !out.some((o) => o.id === p.id)) out.push({ id: p.id, hidden: Boolean(p.hidden) });
    });
  }
  DEFAULT_LAYOUT.forEach((d) => !out.some((o) => o.id === d.id) && out.push({ ...d }));
  return out;
}

function saveLayout(layout) {
  prefs.set('dash.layout', layout);
}

/** Reorder panels (what a drag in Customise mode does). */
export function setPanelOrder(ids) {
  const layout = getLayout();
  const ordered = ids.map((id) => layout.find((p) => p.id === id)).filter(Boolean);
  layout.forEach((p) => !ordered.includes(p) && ordered.push(p));
  saveLayout(ordered);
}

export const isCustomizing = () => editing;
export function stopCustomizing() {
  editing = false;
}

/** Handles this view's buttons. Returns true when a re-render is needed. */
export function dashboardAction(action, el) {
  switch (action) {
    case 'customize':
      editing = true;
      return true;
    case 'customize-done':
      editing = false;
      return true;
    case 'toggle-panel': {
      const layout = getLayout();
      const p = layout.find((x) => x.id === el.dataset.panel);
      if (p) p.hidden = !p.hidden;
      saveLayout(layout);
      return true;
    }
    case 'reset-layout':
      saveLayout(DEFAULT_LAYOUT);
      return true;
    default:
      return false;
  }
}

export function renderDashboard() {
  const st = getState();
  const firstName = (st.user?.displayName || '').trim().split(/\s+/)[0];
  const layout = getLayout();
  const visible = layout.filter((p) => !p.hidden);

  return `
    ${syncBanner(st)}
    <header class="page-head">
      <div>
        <p class="eyebrow">${esc(longDate())}</p>
        <h1>${esc(greeting())}${firstName ? `, ${esc(firstName)}` : ''}</h1>
        <p class="sub">${esc(headerLine())}</p>
      </div>
      <div class="head-actions">
        ${editing ? '' : `<button type="button" class="btn btn-ghost sm" data-action="customize" title="Rearrange or hide panels">${icons.layout}<span class="hide-sm">Customise</span></button>`}
        <button type="button" class="icon-btn mobile-only" data-action="settings" aria-label="Settings">${icons.settings}</button>
      </div>
    </header>

    ${
      editing
        ? `<div class="customize-bar" role="region" aria-label="Customise dashboard">
            ${icons.layout}<span><strong>Customise</strong><span class="muted hide-sm"> · drag ${icons.grip} to reorder, tap the eye to show or hide</span></span>
            <span class="spacer"></span>
            <button type="button" class="btn btn-ghost sm" data-action="reset-layout">Reset</button>
            <button type="button" class="btn btn-primary sm" data-action="customize-done">Done</button>
          </div>`
        : ''
    }

    ${
      !editing && !visible.length
        ? `<div class="empty"><div class="big">🧩</div><h3>All panels are hidden</h3><p>Bring some back to build your dashboard.</p>
            <button type="button" class="btn sm" data-action="customize">${icons.layout}<span>Customise</span></button></div>`
        : `<div class="dash-bento${editing ? ' editing' : ''}">${layout.map(panelHtml).join('')}</div>`
    }`;
}

/** Preview mode → invite to connect GitHub. Sync problems → say what's wrong and how to fix it. */
function syncBanner(st) {
  if (st.mode === 'local') {
    return `<div class="banner">${icons.cloud}<span><strong>Saved in this browser only.</strong> Connect GitHub to see the same tasks on all your devices.</span>
      <button type="button" class="btn btn-primary sm banner-btn" data-action="connect-github">${githubMark}<span>Connect GitHub</span></button></div>`;
  }
  if (st.syncError) {
    const reconnect = ['auth', 'forbidden', 'notfound'].includes(st.syncErrorKind);
    return `<div class="banner banner-error" role="alert">${icons.alert}<span><strong>Sync paused.</strong> ${esc(st.syncError)} Your changes are safe in this browser.</span>
      <button type="button" class="btn sm banner-btn" data-action="${reconnect ? 'connect-github' : 'sync-now'}">${reconnect ? 'Reconnect' : 'Try again'}</button></div>`;
  }
  return '';
}

function panelHtml(p) {
  const def = PANELS[p.id];
  if (p.hidden && !editing) return '';
  const bar = editing
    ? `<div class="dp-edit">
        <span class="dp-handle" title="Drag to reorder" aria-label="Drag to reorder ${def.title}">${icons.grip}</span>
        <span class="dp-name">${def.title}</span>
        <button type="button" class="icon-btn sm" data-action="toggle-panel" data-panel="${p.id}" aria-pressed="${!p.hidden}" aria-label="${p.hidden ? 'Show' : 'Hide'} ${def.title}" title="${p.hidden ? 'Show' : 'Hide'}">${p.hidden ? icons.eyeOff : icons.eye}</button>
      </div>`
    : '';
  const body = p.hidden ? '<div class="dp-placeholder">Hidden</div>' : `<div class="dp-body">${def.render()}</div>`;
  return `<section class="dpanel span-${def.span}${p.hidden ? ' is-hidden' : ''}" data-panel="${p.id}" aria-label="${def.title}">${bar}${body}</section>`;
}

/* ---------- At a glance ---------- */

function glancePanel() {
  const today = todayISO();
  const od = overdue(today).length;
  const dt = dueToday(today).length;
  return `<div class="glance">
    <div class="section-head"><h2>${icons.pulse}At a glance</h2></div>
    <div class="stats">
      ${stat('overdue', od, 'Overdue', icons.alert, '#/today')}
      ${stat('today', dt, 'Due today', icons.target, '#/today')}
      ${stat('doing', inProgress().length, 'In progress', icons.progress)}
      ${stat('done', doneThisWeek().length, 'Done this week', icons.checkCircle)}
    </div>
  </div>`;
}

function stat(tone, n, label, icon, href) {
  const cls = `stat tone-${tone}${n === 0 ? ' zero' : ''}`;
  const inner = `<span class="stat-icon">${icon}</span><span class="stat-num">${n}</span><span class="stat-label">${label}</span>`;
  return href ? `<a class="${cls}" href="${href}">${inner}</a>` : `<div class="${cls}">${inner}</div>`;
}

/* ---------- Your lists ---------- */

function listsPanel() {
  const st = getState();
  const today = todayISO();
  return `<div class="lists-panel">
    <div class="section-head">
      <h2>${icons.list}Your lists</h2>
      <button type="button" class="btn btn-ghost sm" data-action="new-category">${icons.plus}<span>New list</span></button>
    </div>
    <div class="cat-grid">
      ${st.categories.map((c) => catCard(c, today)).join('')}
      <button type="button" class="add-card" data-action="new-category">${icons.plus}<span>New list</span></button>
    </div>
  </div>`;
}

function catCard(c, today) {
  const s = categoryStats(c.id, today);
  const pct = s.total ? s.done / s.total : 0;
  const parts = [`${s.open} open`];
  if (s.overdue) parts.push(`<span class="txt-overdue">${s.overdue} overdue</span>`);
  else if (s.dueToday) parts.push(`${s.dueToday} due today`);

  let next;
  if (s.next) {
    next = `<div class="cat-next"><span class="lbl">Next</span><span class="t">${esc(s.next.title)}</span>${
      s.next.dueDate ? `<span class="chip due due-${dueTone(s.next.dueDate, today)}">${esc(dueLabel(s.next.dueDate, today))}</span>` : ''
    }</div>`;
  } else if (s.total) next = '<div class="cat-next"><span class="t muted">All done 🎉</span></div>';
  else next = '<div class="cat-next"><span class="t muted">No tasks yet</span></div>';

  return `<a class="cat-card" href="#/c/${encodeURIComponent(c.id)}" style="--accent:${colorHex(c.color)}">
    <div class="cat-top"><span class="cat-emoji">${esc(c.icon)}</span>${ring(pct, { title: `${Math.round(pct * 100)}% done` })}</div>
    <h3>${esc(c.name)}</h3>
    <p class="cat-sub">${parts.join(' · ')}</p>
    ${next}
  </a>`;
}

/* ---------- behaviour ---------- */

export function mountDashboard(root) {
  if (!editing) {
    mountFocus(root);
    return null;
  }
  let instance = null;
  let dead = false;
  loadSortable()
    .then((Sortable) => {
      const grid = root.querySelector('.dash-bento');
      if (dead || !grid) return;
      instance = Sortable.create(grid, {
        handle: '.dp-handle',
        draggable: '.dpanel',
        animation: 200,
        easing: 'cubic-bezier(.2,.8,.2,1)',
        delay: 120,
        delayOnTouchOnly: true,
        ghostClass: 'drag-ghost',
        chosenClass: 'drag-chosen',
        onStart() {
          ui.dragging = true;
        },
        onEnd() {
          ui.dragging = false;
          setPanelOrder([...grid.querySelectorAll('.dpanel')].map((n) => n.dataset.panel));
          ui.requestRender();
        },
      });
    })
    .catch(() => toast("Couldn't load drag-and-drop. Check your connection.", { tone: 'error' }));
  return () => {
    dead = true;
    instance?.destroy();
  };
}
