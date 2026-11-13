import { addTask, allTags, deleteTask, findCategory, findTask, getState, restoreTask, updateTask } from '../store.js';
import { PRIORITIES, STATUSES } from '../constants.js';
import { addDays, nextWeekday, todayISO } from '../utils/dates.js';
import { esc } from '../utils/dom.js';
import { normTag } from '../utils/quickadd.js';
import { openCategoryEditor } from './categoryEditor.js';
import { icons } from './icons.js';
import { openOverlay } from './overlay.js';
import { toast } from './toast.js';

const segBtn = (value, label, current) =>
  `<button type="button" role="radio" aria-checked="${value === current}" data-value="${value}"${value === current ? ' class="on"' : ''}>${label}</button>`;

/** Create a task (no taskId) or edit an existing one. `defaults` pre-fills a new task. */
export function openTaskEditor({ taskId = null, defaults = {} } = {}) {
  const st = getState();
  const existing = taskId ? findTask(taskId) : null;
  if (taskId && !existing) return;
  if (!st.categories.length) {
    toast('Create a list first, then add tasks to it.');
    openCategoryEditor();
    return;
  }

  const today = todayISO();
  const d = existing
    ? { ...existing, tags: [...existing.tags] }
    : {
        title: '',
        notes: '',
        categoryId: findCategory(defaults.categoryId) ? defaults.categoryId : st.categories[0].id,
        status: defaults.status || 'todo',
        priority: defaults.priority || 'none',
        tags: [],
        dueDate: defaults.dueDate || null,
        focus: Boolean(defaults.focus),
      };
  const quickDates = [
    ['Today', today],
    ['Tomorrow', addDays(today, 1)],
    ['Next week', nextWeekday(1, today)],
    ['No date', ''],
  ];

  const o = openOverlay({
    label: existing ? 'Edit task' : 'New task',
    html: `<form class="editor" novalidate autocomplete="off">
      <div class="sheet-grabber" aria-hidden="true"></div>
      <header class="sheet-head">
        <h2>${existing ? 'Edit task' : 'New task'}</h2>
        <button type="button" class="icon-btn" data-close aria-label="Close">${icons.x}</button>
      </header>
      <div class="sheet-body">
        <input class="input input-title" name="title" placeholder="What needs doing?" value="${esc(d.title)}" maxlength="300" enterkeyhint="done" aria-label="Task title">
        <textarea class="input" name="notes" rows="2" placeholder="Notes (optional)" aria-label="Notes">${esc(d.notes)}</textarea>
        <button type="button" class="focus-toggle${d.focus ? ' on' : ''}" data-act="focus" aria-pressed="${d.focus}">${icons.star}<span>${d.focus ? 'In Today’s focus' : 'Add to Today’s focus'}</span></button>
        <div class="field-grid">
          <label class="field"><span class="field-label">List</span>
            <select class="input" name="categoryId">${st.categories
              .map((c) => `<option value="${esc(c.id)}"${c.id === d.categoryId ? ' selected' : ''}>${esc(c.icon)}  ${esc(c.name)}</option>`)
              .join('')}</select>
          </label>
          <div class="field"><span class="field-label">Status</span>
            <div class="seg full" data-group="status" role="radiogroup" aria-label="Status">${STATUSES.map((s) => segBtn(s.id, s.label, d.status)).join('')}</div>
          </div>
        </div>
        <div class="field"><span class="field-label">Due date</span>
          <div class="due-row">
            <input type="date" class="input" name="dueDate" value="${d.dueDate || ''}" aria-label="Due date">
            <div class="quick-dates">${quickDates
              .map(([label, v]) => `<button type="button" class="chip-btn${(d.dueDate || '') === v ? ' on' : ''}" data-date="${v}">${label}</button>`)
              .join('')}</div>
          </div>
        </div>
        <div class="field"><span class="field-label">Priority</span>
          <div class="seg full seg-prio" data-group="priority" role="radiogroup" aria-label="Priority">${PRIORITIES.map((p) => segBtn(p.id, p.label, d.priority)).join('')}</div>
        </div>
        <div class="field"><span class="field-label">Tags</span>
          <div class="tag-input"><span class="tag-pills"></span><input name="tagEntry" list="ed-tag-list" placeholder="Add a tag…" aria-label="Add a tag"></div>
          <datalist id="ed-tag-list">${allTags()
            .map((t) => `<option value="${esc(t.tag)}"></option>`)
            .join('')}</datalist>
        </div>
      </div>
      <footer class="sheet-foot">
        ${existing ? `<button type="button" class="btn btn-ghost danger-text" data-act="delete">${icons.trash}<span>Delete</span></button>` : ''}
        <span class="spacer"></span>
        <button type="button" class="btn btn-ghost" data-close>Cancel</button>
        <button type="submit" class="btn btn-primary">${existing ? 'Save' : 'Add task'}</button>
      </footer>
    </form>`,
  });

  const form = o.el.querySelector('form');
  const titleInput = form.elements.title;
  const dateInput = form.elements.dueDate;
  const tagEntry = form.elements.tagEntry;
  const pills = form.querySelector('.tag-pills');

  // Segmented pickers (status, priority)
  form.querySelectorAll('.seg[data-group]').forEach((seg) =>
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-value]');
      if (!b) return;
      d[seg.dataset.group] = b.dataset.value;
      seg.querySelectorAll('button').forEach((x) => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-checked', String(x === b));
      });
    }),
  );

  // ★ Today's focus
  const focusBtn = form.querySelector('[data-act="focus"]');
  focusBtn.addEventListener('click', () => {
    d.focus = !d.focus;
    focusBtn.classList.toggle('on', d.focus);
    focusBtn.setAttribute('aria-pressed', String(d.focus));
    focusBtn.querySelector('span').textContent = d.focus ? 'In Today’s focus' : 'Add to Today’s focus';
  });

  // Due date shortcuts
  const syncQuick = () => form.querySelectorAll('.quick-dates .chip-btn').forEach((b) => b.classList.toggle('on', b.dataset.date === dateInput.value));
  form.querySelector('.quick-dates').addEventListener('click', (e) => {
    const b = e.target.closest('[data-date]');
    if (!b) return;
    dateInput.value = b.dataset.date;
    syncQuick();
  });
  dateInput.addEventListener('input', syncQuick);
  dateInput.addEventListener('change', syncQuick);

  // Tags
  const drawTags = () => {
    pills.innerHTML = d.tags
      .map((t, i) => `<span class="tag-pill">#${esc(t)}<button type="button" data-i="${i}" aria-label="Remove tag ${esc(t)}">${icons.x}</button></span>`)
      .join('');
  };
  const addTags = (raw) => {
    raw.split(',').forEach((part) => {
      const t = normTag(part);
      if (t && !d.tags.includes(t)) d.tags.push(t);
    });
    tagEntry.value = '';
    drawTags();
  };
  pills.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    d.tags.splice(Number(b.dataset.i), 1);
    drawTags();
    tagEntry.focus();
  });
  tagEntry.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ',') && tagEntry.value.trim()) {
      e.preventDefault();
      addTags(tagEntry.value);
    } else if (e.key === 'Backspace' && !tagEntry.value && d.tags.length) {
      d.tags.pop();
      drawTags();
    }
  });
  // Picking a suggestion from the list adds it straight away.
  tagEntry.addEventListener('input', (e) => {
    if (!e.inputType || e.inputType === 'insertReplacementText') addTags(tagEntry.value);
  });
  tagEntry.addEventListener('blur', () => tagEntry.value.trim() && addTags(tagEntry.value));
  drawTags();

  // Ctrl/Cmd + Enter saves from anywhere in the form
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (tagEntry.value.trim()) addTags(tagEntry.value);
    const title = titleInput.value.trim();
    if (!title) {
      titleInput.classList.remove('shake');
      void titleInput.offsetWidth;
      titleInput.classList.add('shake');
      titleInput.focus();
      return;
    }
    const data = {
      title,
      notes: form.elements.notes.value.trim(),
      categoryId: form.elements.categoryId.value,
      status: d.status,
      priority: d.priority,
      tags: d.tags,
      dueDate: dateInput.value || null,
      focus: d.focus,
    };
    o.close();
    if (existing) {
      const patch = {};
      for (const k of Object.keys(data)) if (JSON.stringify(data[k]) !== JSON.stringify(existing[k])) patch[k] = data[k];
      updateTask(existing.id, patch);
    } else {
      addTask(data);
      const cat = findCategory(data.categoryId);
      toast(`Added to ${cat ? cat.name : 'your list'}`);
    }
  });

  o.el.querySelector('[data-act="delete"]')?.addEventListener('click', () => {
    o.close();
    const removed = deleteTask(existing.id);
    if (removed) toast('Task deleted', { action: 'Undo', onAction: () => restoreTask(removed) });
  });

  if (!existing) setTimeout(() => titleInput.focus(), 60);
}
