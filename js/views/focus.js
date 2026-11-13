// "Today's focus": what to do now. Shared by the dashboard panel and the Today page.
// Up next (one task, big) → Overdue (with "Move all to today") → Today (due today + starred) → Completed today.
import { doneToday, findCategory, focusTasks } from '../store.js';
import { colorHex, PRIORITY_LABEL } from '../constants.js';
import { dueLabel, dueTone, todayISO } from '../utils/dates.js';
import { esc, plural, prefs } from '../utils/dom.js';
import { icons } from '../components/icons.js';
import { ring } from '../components/ring.js';
import { taskActions, taskList } from '../components/taskItem.js';
import { mountQuickAdd, quickAddHtml } from '../components/quickAdd.js';
import { ui } from '../ui-state.js';

export function dailyGoal() {
  const g = Math.round(Number(prefs.get('goal', 5)));
  return Number.isFinite(g) ? Math.min(50, Math.max(1, g)) : 5;
}

/** Daily goal meter: completed today against the goal. Reaching it is shown with an icon + words, not colour alone. */
export function goalMeter() {
  const n = doneToday().length;
  const g = dailyGoal();
  const met = n >= g;
  return `<div class="goal${met ? ' met' : ''}" role="img" aria-label="${n} of ${g} tasks done today${met ? ', goal reached' : ''}">
    ${ring(n / g, { label: `${n}/${g}`, cls: 'lg' })}
    <div class="goal-text">
      <strong>${met ? `${icons.checkCircle}Goal reached` : `${g - n} to go`}</strong>
      <span>Daily goal</span>
    </div>
  </div>`;
}

export function focusSummary(f = focusTasks()) {
  if (!f.total) return 'Nothing planned for today yet.';
  const forToday = f.total - f.overdueCount;
  const parts = [];
  if (f.overdueCount) parts.push(`${f.overdueCount} overdue`);
  if (forToday) parts.push(`${forToday} for today`);
  return parts.join(' · ');
}

function upNextCard(t) {
  const cat = findCategory(t.categoryId);
  const today = todayISO();
  const meta = [];
  if (cat) meta.push(`<span class="chip chip-cat" style="--accent:${colorHex(cat.color)}"><span class="dot"></span>${esc(cat.icon)} ${esc(cat.name)}</span>`);
  if (t.dueDate) meta.push(`<span class="chip due due-${dueTone(t.dueDate, today)}">${icons.calendar}${esc(dueLabel(t.dueDate, today))}</span>`);
  if (t.priority !== 'none') meta.push(`<span class="prio" data-prio="${t.priority}">${icons.flag}${PRIORITY_LABEL[t.priority]}</span>`);
  t.tags.forEach((tag) => meta.push(`<span class="tag">#${esc(tag)}</span>`));
  const doing = t.status === 'doing';

  return `<article class="up-next" data-task-id="${esc(t.id)}" style="--accent:${colorHex(cat?.color)}" aria-label="Up next: ${esc(t.title)}">
    <div class="un-top">
      <span class="un-label"><span class="un-dot"></span>${doing ? 'In progress' : 'Up next'}</span>
      ${taskActions(t)}
    </div>
    <div class="un-main">
      <button type="button" class="check" data-action="toggle" role="checkbox" aria-checked="false" aria-label="Mark as done">${icons.check}</button>
      <div class="un-body" data-action="open-task" data-task-id="${esc(t.id)}" role="button" tabindex="0">
        <div class="un-title">${esc(t.title)}</div>
        ${meta.length ? `<div class="task-meta">${meta.join('')}</div>` : ''}
      </div>
    </div>
    <div class="un-actions">
      ${doing ? '' : `<button type="button" class="btn sm" data-action="start-task">${icons.play}<span>Start</span></button>`}
      <button type="button" class="btn btn-primary sm" data-action="toggle">${icons.check}<span>Done</span></button>
    </div>
  </article>`;
}

/**
 * @param {object} o  cap: max rows under "Up next" (rest link to Today) · page: rendering on the Today page ·
 *                    variant 'side': the compact "Focus today" side panel on the dashboard (no goal ring)
 */
export function focusPanel({ cap = Infinity, page = false, variant = '' } = {}) {
  const side = variant === 'side';
  const f = focusTasks();
  const done = doneToday();
  const showDone = ui.expanded.has('done-today');

  let left = cap;
  const od = f.overdue.slice(0, left);
  left -= od.length;
  const td = f.today.slice(0, Math.max(0, left));
  const hidden = f.overdue.length + f.today.length - od.length - td.length;

  let head = '';
  if (side) {
    head = `<div class="section-head"><h2>${icons.target}Focus today</h2>${f.total ? '<a href="#/today">See all</a>' : ''}</div>`;
  } else if (!page) {
    head = `<header class="panel-head focus-head">
        <div><h2>${icons.target}Today’s focus</h2><p class="muted small">${esc(focusSummary(f))}</p></div>
        ${goalMeter()}
      </header>`;
  }

  let body;
  if (!f.total && side) {
    body = `<div class="empty compact"><div class="big">✨</div><h3>All clear</h3><p>Nothing due or overdue today. Star ${icons.star} a task to pin it here.</p></div>`;
  } else if (!f.total) {
    body = done.length
      ? `<div class="empty compact"><div class="big">🎉</div><h3>All done for today</h3><p>You finished ${done.length} ${plural(done.length, 'task')}. Enjoy the rest of your day.</p></div>`
      : `<div class="empty compact"><div class="big">✨</div><h3>Nothing planned yet</h3><p>Star ${icons.star} a task in any list to pin it here, or add one above.</p></div>`;
  } else {
    body = `
      ${f.upNext ? upNextCard(f.upNext) : ''}
      ${
        od.length
          ? `<section class="group group-overdue">
              <div class="group-head"><h3 class="group-title">Overdue<span class="count">${f.overdue.length}</span></h3>
                <button type="button" class="btn btn-ghost sm" data-action="move-overdue" title="Move all overdue tasks to today">${icons.arrowRight}<span>${side ? 'Move to today' : 'Move all to today'}</span></button></div>
              ${taskList(od, { showCategory: true })}
            </section>`
          : ''
      }
      ${td.length ? `<section class="group"><h3 class="group-title">Today<span class="count">${f.today.length}</span></h3>${taskList(td, { showCategory: true })}</section>` : ''}
      ${hidden > 0 ? `<a class="more-link" href="#/today">${side ? `+${hidden} more` : `See all ${f.total} in Today ${icons.arrowRight}`}</a>` : ''}`;
  }

  return `${head}
    ${quickAddHtml({ mode: 'focus', placeholder: 'Add a task for today…' })}
    ${body}
    ${
      done.length && !side
        ? `<section class="group group-done">
            <button type="button" class="group-title as-button" data-action="toggle-section" data-key="done-today" aria-expanded="${showDone}">${icons.chevron}Completed today<span class="count">${done.length}</span></button>
            ${showDone ? taskList(done, { showCategory: true }) : ''}
          </section>`
        : ''
    }`;
}

export function mountFocus(root) {
  mountQuickAdd(root, { mode: 'focus' });
  return null;
}
