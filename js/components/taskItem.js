import { findCategory } from '../store.js';
import { colorHex, PRIORITY_LABEL } from '../constants.js';
import { dueLabel, dueTone, todayISO } from '../utils/dates.js';
import { esc } from '../utils/dom.js';
import { icons } from './icons.js';

/**
 * One task row/card. Clicking it opens the editor; the round button ticks it off.
 * @param {object} opts showCategory: show the list chip · board: card inside a Kanban column
 */
export function taskItem(t, { showCategory = false, board = false } = {}) {
  const today = todayISO();
  const done = t.status === 'done';
  const meta = [];

  if (showCategory) {
    const cat = findCategory(t.categoryId);
    if (cat) meta.push(`<span class="chip chip-cat" style="--accent:${colorHex(cat.color)}"><span class="dot"></span>${esc(cat.icon)} ${esc(cat.name)}</span>`);
  }
  if (!board && t.status === 'doing') meta.push(`<span class="chip chip-doing">${icons.progress}In progress</span>`);
  if (t.dueDate) {
    const tone = done ? 'later' : dueTone(t.dueDate, today);
    meta.push(`<span class="chip due due-${tone}">${icons.calendar}${esc(dueLabel(t.dueDate, today))}</span>`);
  }
  if (t.priority !== 'none') {
    meta.push(`<span class="prio" data-prio="${t.priority}" title="${PRIORITY_LABEL[t.priority]} priority">${icons.flag}${PRIORITY_LABEL[t.priority]}</span>`);
  }
  t.tags.forEach((tag) => meta.push(`<span class="tag">#${esc(tag)}</span>`));
  if (t.notes) meta.push(`<span class="has-notes" title="Has notes">${icons.note}</span>`);

  return `<div class="task${done ? ' is-done' : ''}" data-task-id="${esc(t.id)}" data-prio="${t.priority}" data-action="open-task" data-focus-key="task-${esc(t.id)}" tabindex="0" role="button" aria-label="${esc(t.title)}">
    <button type="button" class="check${done ? ' checked' : ''}" data-action="toggle" role="checkbox" aria-checked="${done}" aria-label="${done ? 'Mark as not done' : 'Mark as done'}">${icons.check}</button>
    <div class="task-body">
      <div class="task-title">${esc(t.title)}</div>
      ${meta.length ? `<div class="task-meta">${meta.join('')}</div>` : ''}
    </div>
    ${done ? '' : taskActions(t)}
  </div>`;
}

/** Star (pin to Today's focus) and quick date. Shown on hover/focus on desktop; a set star always shows. */
export function taskActions(t) {
  const starLabel = t.focus ? 'Remove from Today’s focus' : 'Add to Today’s focus';
  return `<div class="task-actions">
    <button type="button" class="t-act t-star${t.focus ? ' on' : ''}" data-action="star" aria-pressed="${t.focus}" aria-label="${starLabel}" title="${starLabel}">${icons.star}</button>
    <button type="button" class="t-act" data-action="due-menu" aria-label="Change due date" title="Change due date">${icons.calendar}</button>
  </div>`;
}

export function taskList(tasks, opts) {
  return `<div class="task-list">${tasks.map((t) => taskItem(t, opts)).join('')}</div>`;
}
