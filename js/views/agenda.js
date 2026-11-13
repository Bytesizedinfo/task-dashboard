// Today and Upcoming pages, plus the Upcoming panel on the dashboard.
// Upcoming can be grouped by Day, Week or Month, or show a custom date range; it follows the list filter.
import { upcomingTasks } from '../store.js';
import { addDays, diffDays, fromISO, longDate, shortDate, todayISO, weekStartISO, isISODate } from '../utils/dates.js';
import { esc, plural, prefs } from '../utils/dom.js';
import { icons } from '../components/icons.js';
import { taskList } from '../components/taskItem.js';
import { getListFilter, listFilterSelect } from '../components/listFilter.js';
import { ui } from '../ui-state.js';
import { focusPanel, focusSummary, goalMeter } from './focus.js';
import { focusTasks } from '../store.js';

/* ---------- Today ---------- */

/** Today page: the full Today's focus (no cap), with the list filter and daily goal in the header. */
export function renderToday() {
  const f = focusTasks(todayISO(), { categoryId: getListFilter() });
  return `
    <header class="page-head">
      <div><p class="eyebrow">${esc(longDate())}</p><h1>Today</h1>
        <p class="sub">${esc(focusSummary(f))}</p>
      </div>
      <div class="head-actions head-stack">${goalMeter()}${listFilterSelect()}</div>
    </header>
    <div class="focus-page">${focusPanel({ page: true })}</div>`;
}

/* ---------- Upcoming ---------- */

const GROUPS = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'custom', label: 'Custom' },
];

export function upcomingMode() {
  const m = prefs.get('upcomingGroup', 'day');
  return GROUPS.some((g) => g.id === m) ? m : 'day';
}

/** The custom range (defaults to the next two weeks). Always from ≤ to. */
export function customRange(today = todayISO()) {
  let from = prefs.get('upcomingFrom', '');
  let to = prefs.get('upcomingTo', '');
  if (!isISODate(from)) from = today;
  if (!isISODate(to)) to = addDays(today, 14);
  return from <= to ? { from, to } : { from: to, to: from };
}

/** Handles the Upcoming controls (Day/Week/Month/Custom). Returns true when a re-render is needed. */
export function upcomingAction(action, el) {
  if (action !== 'upcoming-group') return false;
  prefs.set('upcomingGroup', el.dataset.value);
  return true;
}

/** Date inputs of the custom range. */
export function upcomingRangeChange(el) {
  if (el.matches('[data-upcoming-from]')) prefs.set('upcomingFrom', el.value);
  else if (el.matches('[data-upcoming-to]')) prefs.set('upcomingTo', el.value);
  else return false;
  return true;
}

function groupKey(iso, mode) {
  if (mode === 'week') return weekStartISO(iso);
  if (mode === 'month') return iso.slice(0, 7);
  return iso; // day, custom
}

function groupLabel(key, mode, today) {
  if (mode === 'week') {
    const weeks = Math.round(diffDays(key, weekStartISO(today)) / 7);
    const title = weeks === 0 ? 'This week' : weeks === 1 ? 'Next week' : `Week of ${shortDate(key, today)}`;
    return { title, sub: `${shortDate(key, today)} – ${shortDate(addDays(key, 6), today)}` };
  }
  if (mode === 'month') {
    const d = fromISO(key + '-01');
    const thisMonth = today.slice(0, 7);
    const next = new Date(fromISO(today).getFullYear(), fromISO(today).getMonth() + 1, 1);
    const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    const name = d.toLocaleDateString(undefined, { month: 'long', year: d.getFullYear() === fromISO(today).getFullYear() ? undefined : 'numeric' });
    return { title: key === thisMonth ? 'This month' : key === nextKey ? 'Next month' : name, sub: key === thisMonth || key === nextKey ? name : '' };
  }
  const diff = diffDays(key, today);
  const weekday = fromISO(key).toLocaleDateString(undefined, { weekday: 'long' });
  return { title: diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : weekday, sub: diff <= 1 ? `${weekday}, ${shortDate(key, today)}` : shortDate(key, today) };
}

function groupsHtml(groups, limit) {
  let left = limit;
  let hidden = 0;
  const html = groups
    .map((g) => {
      if (left <= 0) {
        hidden += g.tasks.length;
        return '';
      }
      const shown = g.tasks.slice(0, left);
      hidden += g.tasks.length - shown.length;
      left -= shown.length;
      return `<section class="group up-group ${g.cls || ''}">
        <h3 class="group-title">${esc(g.title)}${g.sub ? `<span class="up-sub">${esc(g.sub)}</span>` : ''}<span class="count">${g.tasks.length}</span></h3>
        ${taskList(shown, { showCategory: true })}
      </section>`;
    })
    .join('');
  return { html, hidden };
}

function controlsHtml(mode, { compact = false } = {}) {
  const today = todayISO();
  const { from, to } = customRange(today);
  return `<div class="up-controls${compact ? ' compact' : ''}">
      <div class="seg" role="radiogroup" aria-label="Group upcoming tasks by">${GROUPS.map(
        (g) => `<button type="button" role="radio" aria-checked="${g.id === mode}" class="${g.id === mode ? 'on' : ''}" data-action="upcoming-group" data-value="${g.id}">${g.label}</button>`,
      ).join('')}</div>
      ${compact ? '' : listFilterSelect()}
    </div>
    ${
      mode === 'custom'
        ? `<div class="up-range">
            <label class="field"><span class="field-label">From</span><input type="date" class="input" value="${from}" data-upcoming-from aria-label="From date"></label>
            <label class="field"><span class="field-label">To</span><input type="date" class="input" value="${to}" data-upcoming-to aria-label="To date"></label>
          </div>`
        : ''
    }`;
}

/**
 * Upcoming tasks, grouped. Used by the Upcoming page and the dashboard panel.
 * @param {object} o panel: dashboard version (starts tomorrow, no overdue/undated, capped)
 */
function upcomingBody({ panel = false, cap = Infinity } = {}) {
  const today = todayISO();
  const mode = upcomingMode();
  const listId = getListFilter();
  const { overdue, dated, noDate } = upcomingTasks({ categoryId: listId, today });

  let pool = dated;
  if (mode === 'custom') {
    const { from, to } = customRange(today);
    pool = dated.filter((t) => t.dueDate >= from && t.dueDate <= to);
  } else if (panel) {
    pool = dated.filter((t) => t.dueDate > today); // Focus today already shows today
  }

  const map = new Map();
  pool.forEach((t) => {
    const k = groupKey(t.dueDate, mode);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(t);
  });
  const groups = [...map].map(([k, tasks]) => ({ ...groupLabel(k, mode, today), tasks }));
  if (!panel && mode !== 'custom' && overdue.length) groups.unshift({ title: 'Overdue', tasks: overdue, cls: 'group-overdue' });

  const { html, hidden } = groupsHtml(groups, cap);
  const where = listId ? ' in this list' : '';
  let empty = '';
  if (!groups.length) {
    const what = mode === 'custom' ? 'between these dates' : 'coming up';
    empty = `<div class="empty compact"><div class="big">🗓️</div><h3>Nothing ${what}${where}</h3><p>Tasks with due dates will appear here.</p></div>`;
  }

  let undated = '';
  if (!panel && mode !== 'custom' && noDate.length) {
    const open = ui.expanded.has('up-nodate');
    undated = `<section class="group group-nodate">
      <button type="button" class="group-title as-button" data-action="toggle-section" data-key="up-nodate" aria-expanded="${open}">${icons.chevron}No date<span class="count">${noDate.length}</span></button>
      ${open ? taskList(noDate, { showCategory: true }) : ''}
    </section>`;
  }

  return `${empty}${html}${hidden > 0 ? `<a class="more-link" href="#/upcoming">+${hidden} more</a>` : ''}${undated}`;
}

export function renderUpcoming() {
  const mode = upcomingMode();
  const { dated } = upcomingTasks({ categoryId: getListFilter() });
  const week = dated.filter((t) => t.dueDate <= addDays(todayISO(), 7)).length;
  return `
    <header class="page-head">
      <div><p class="eyebrow">Plan ahead</p><h1>Upcoming</h1>
        <p class="sub">${week} ${plural(week, 'task')} in the next 7 days</p>
      </div>
      <button type="button" class="btn btn-primary desktop-only" data-action="new-task">${icons.plus}<span>New task</span></button>
    </header>
    ${controlsHtml(mode)}
    <div class="up-body">${upcomingBody()}</div>`;
}

/** Dashboard panel. */
export function upcomingPanel() {
  const mode = upcomingMode();
  return `<div class="panel up-panel">
    <div class="section-head"><h2>${icons.upcoming}Upcoming</h2><a href="#/upcoming">See all</a></div>
    ${controlsHtml(mode, { compact: true })}
    ${upcomingBody({ panel: true, cap: 8 })}
  </div>`;
}
