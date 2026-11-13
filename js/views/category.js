import { allTags, categoryStats, findCategory, getState, reorderColumn, sortTasks } from '../store.js';
import { colorHex, PRIORITIES, STATUSES } from '../constants.js';
import { esc, prefs } from '../utils/dom.js';
import { loadSortable } from '../utils/sortable.js';
import { icons } from '../components/icons.js';
import { mountQuickAdd, quickAddHtml } from '../components/quickAdd.js';
import { taskItem, taskList } from '../components/taskItem.js';
import { toast } from '../components/toast.js';
import { ui } from '../ui-state.js';

// Filters reset when you leave the app; List/Board choice is remembered per list on this device.
const filters = new Map();
function getFilters(id) {
  if (!filters.has(id)) filters.set(id, { prio: 'all', tag: null });
  return filters.get(id);
}
const getMode = (id) => (prefs.get('view.' + id, 'list') === 'board' ? 'board' : 'list');

/** Handles this view's buttons. Returns true when something changed and a re-render is needed. */
export function categoryAction(action, el, id) {
  const f = getFilters(id);
  switch (action) {
    case 'set-view':
      prefs.set('view.' + id, el.dataset.value);
      return true;
    case 'filter-prio':
      f.prio = el.dataset.value;
      return true;
    case 'filter-tag':
      f.tag = f.tag === el.dataset.value ? null : el.dataset.value;
      return true;
    case 'clear-filters':
      f.prio = 'all';
      f.tag = null;
      return true;
    default:
      return false;
  }
}

export function renderCategory(id) {
  const st = getState();
  const cat = findCategory(id);
  const accent = colorHex(cat.color);
  const f = getFilters(id);
  const mode = getMode(id);
  const all = st.tasks.filter((t) => t.categoryId === id);
  const s = categoryStats(id);
  const tags = allTags(all);
  if (f.tag && !tags.some((t) => t.tag === f.tag)) f.tag = null;
  const filtering = f.prio !== 'all' || !!f.tag;
  const shown = all.filter((t) => (f.prio === 'all' || t.priority === f.prio) && (!f.tag || t.tags.includes(f.tag)));
  const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;

  const subParts = [`${s.open} open`, `${s.done} done`];
  if (s.overdue) subParts.push(`<span class="txt-overdue">${s.overdue} overdue</span>`);

  const prioChips = [{ id: 'all', label: 'All' }, ...PRIORITIES.filter((p) => p.id !== 'none').reverse()]
    .map((p) => `<button type="button" class="fchip${f.prio === p.id ? ' on' : ''}" data-action="filter-prio" data-value="${p.id}">${p.id === 'all' ? '' : icons.flag}${p.label}</button>`)
    .join('');
  const tagChips = tags
    .slice(0, 12)
    .map((t) => `<button type="button" class="fchip${f.tag === t.tag ? ' on' : ''}" data-action="filter-tag" data-value="${esc(t.tag)}">#${esc(t.tag)}</button>`)
    .join('');

  let body;
  if (!all.length) {
    body = `<div class="empty"><div class="big">${esc(cat.icon)}</div><h3>No tasks in ${esc(cat.name)} yet</h3><p>Add your first one above.</p></div>`;
  } else if (!shown.length) {
    body = `<div class="empty"><div class="big">🔍</div><h3>No tasks match these filters</h3><p>Try a different priority or tag.</p>
      <button type="button" class="btn sm" data-action="clear-filters">Clear filters</button></div>`;
  } else body = mode === 'board' ? boardBody(shown, id) : listBody(shown, id);

  return `<div class="cat-view" style="--accent:${accent}">
    <a class="back-link" href="#/">${icons.arrowLeft}Dashboard</a>
    <header class="cat-hero">
      <span class="cat-emoji">${esc(cat.icon)}</span>
      <div class="hero-text">
        <h1>${esc(cat.name)}</h1>
        <p class="sub">${subParts.join(' · ')}</p>
        <div class="hero-progress" title="${pct}% done"><span style="width:${pct}%"></span></div>
      </div>
      <button type="button" class="icon-btn" data-action="edit-category" data-id="${esc(id)}" aria-label="Edit list" title="Edit list">${icons.pencil}</button>
    </header>

    ${quickAddHtml({ mode: 'list', categoryId: id, placeholder: `Add a task to ${cat.name}…` })}

    <div class="toolbar">
      <div class="seg" role="radiogroup" aria-label="View">
        <button type="button" role="radio" aria-checked="${mode === 'list'}" class="${mode === 'list' ? 'on' : ''}" data-action="set-view" data-value="list">${icons.list}List</button>
        <button type="button" role="radio" aria-checked="${mode === 'board'}" class="${mode === 'board' ? 'on' : ''}" data-action="set-view" data-value="board">${icons.board}Board</button>
      </div>
      <div class="filters" role="group" aria-label="Filters">${prioChips}${tagChips ? '<span class="filter-sep"></span>' + tagChips : ''}${
        filtering ? `<button type="button" class="fchip clear" data-action="clear-filters">${icons.x}Clear</button>` : ''
      }</div>
    </div>

    ${body}
  </div>`;
}

function listBody(tasks, id) {
  const doing = sortTasks(tasks.filter((t) => t.status === 'doing'));
  const todo = sortTasks(tasks.filter((t) => t.status === 'todo'));
  const done = tasks.filter((t) => t.status === 'done').sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
  const key = 'done-' + id;
  const showDone = ui.expanded.has(key);
  const group = (title, list, cls = '') =>
    `<section class="group ${cls}"><h3 class="group-title">${title}<span class="count">${list.length}</span></h3>${taskList(list)}</section>`;

  return `
    ${doing.length ? group('In progress', doing, 'group-doing') : ''}
    ${todo.length ? group('To do', todo) : ''}
    ${!doing.length && !todo.length ? '<div class="empty compact"><div class="big">🎉</div><h3>Everything here is done</h3></div>' : ''}
    ${
      done.length
        ? `<section class="group group-done">
            <button type="button" class="group-title as-button" data-action="toggle-section" data-key="${esc(key)}" aria-expanded="${showDone}">${icons.chevron}Done<span class="count">${done.length}</span></button>
            ${showDone ? taskList(done) : ''}
          </section>`
        : ''
    }`;
}

function boardBody(tasks, id) {
  return `<div class="board" data-scroll-key="board-${esc(id)}">${STATUSES.map((s) => {
    const col = tasks.filter((t) => t.status === s.id).sort((a, b) => a.order - b.order);
    return `<section class="column col-${s.id}" aria-label="${s.label}">
      <header class="col-head"><span class="col-dot"></span><span class="col-name">${s.label}</span><span class="count">${col.length}</span>
        <button type="button" class="icon-btn sm" data-action="new-task" data-status="${s.id}" data-cat="${esc(id)}" aria-label="Add task to ${s.label}" title="Add task">${icons.plus}</button>
      </header>
      <div class="col-list" data-status="${s.id}">${col.map((t) => taskItem(t, { board: true })).join('')}</div>
    </section>`;
  }).join('')}</div>`;
}

/** Wires up the quick-add box and (in board mode) drag-and-drop. Returns a cleanup function. */
export function mountCategory(root, id) {
  mountQuickAdd(root, { mode: 'list', categoryId: id });

  if (getMode(id) !== 'board' || !root.querySelector('.col-list')) return null;

  let instances = [];
  let dead = false;
  loadSortable()
    .then((Sortable) => {
      if (dead) return;
      root.querySelectorAll('.col-list').forEach((list) => {
        instances.push(
          Sortable.create(list, {
            group: 'board',
            animation: 180,
            easing: 'cubic-bezier(.2,.8,.2,1)',
            delay: 160,
            delayOnTouchOnly: true, // lets you scroll on phones; press-and-hold to drag
            touchStartThreshold: 5,
            filter: '.check, .t-act',
            preventOnFilter: false,
            ghostClass: 'drag-ghost',
            chosenClass: 'drag-chosen',
            dragClass: 'drag-active',
            onStart() {
              ui.dragging = true;
              document.body.classList.add('is-dragging');
            },
            onEnd(evt) {
              ui.dragging = false;
              ui.justDraggedAt = Date.now();
              document.body.classList.remove('is-dragging');
              if (evt.from !== evt.to || evt.oldIndex !== evt.newIndex) {
                const ids = [...evt.to.querySelectorAll('[data-task-id]')].map((n) => n.dataset.taskId);
                reorderColumn(evt.to.dataset.status, ids);
              }
              ui.requestRender();
            },
          }),
        );
      });
    })
    .catch((err) => {
      console.warn(err);
      toast("Couldn't load drag-and-drop. Check your connection.", { tone: 'error' });
    });

  return () => {
    dead = true;
    instances.forEach((s) => s.destroy());
    instances = [];
  };
}

export function categoryTitle(id) {
  const c = findCategory(id);
  return c ? c.name : 'List';
}
