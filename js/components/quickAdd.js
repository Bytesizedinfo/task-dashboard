// Quick-add box with live chips showing what was understood (list, date, priority, tags, ★ focus).
// Two flavours: 'focus' (dashboard / Today: starred by default, pick any list) and 'list' (inside one list).
import { addTask, findCategory, findCategoryByPrefix, getState } from '../store.js';
import { colorHex, PRIORITY_LABEL } from '../constants.js';
import { dueLabel, dueTone, todayISO } from '../utils/dates.js';
import { esc, prefs } from '../utils/dom.js';
import { parseQuickAdd } from '../utils/quickadd.js';
import { openCategoryEditor } from './categoryEditor.js';
import { getListFilter } from './listFilter.js';
import { icons } from './icons.js';
import { toast } from './toast.js';

// Remembers a manual ★ choice while typing, across re-renders.
const memory = { focus: { touched: false, star: true }, list: { touched: false, star: false } };

const resolveList = (hint) => findCategoryByPrefix(hint)?.id || null;

function defaultList() {
  const id = prefs.get('lastList', null);
  return findCategory(id) ? id : getState().categories[0]?.id || null;
}

export function quickAddHtml({ mode, categoryId = '', placeholder }) {
  return `<form class="quick-add" data-qa="${mode}">
      <span class="qa-icon">${icons.plus}</span>
      <input name="q" placeholder="${esc(placeholder)}" aria-label="Add a task" autocomplete="off" enterkeyhint="done" maxlength="300" data-focus-key="qa-${mode}-${esc(categoryId)}">
      <button type="submit" class="btn btn-primary sm">Add</button>
    </form>
    <div class="qa-meta" aria-live="polite"></div>`;
}

export function mountQuickAdd(root, { mode, categoryId = null }) {
  const form = root.querySelector(`.quick-add[data-qa="${mode}"]`);
  if (!form) return;
  const meta = form.nextElementSibling;
  const input = form.elements.q;
  const mem = memory[mode];
  // When the "All lists" filter is set to one list, new tasks go into that list.
  const fixed = mode === 'focus' ? getListFilter() : '';
  let listId = mode === 'focus' ? fixed || defaultList() : categoryId;

  const parse = () => parseQuickAdd(input.value, todayISO(), resolveList);
  // Starred by default in focus mode, unless a later date is typed (it's not for today then).
  const starFor = (p) => (mem.touched ? mem.star : mode === 'focus' && (!p.dueDate || p.dueDate <= todayISO()));

  function draw() {
    const p = parse();
    const star = starFor(p);
    const target = p.categoryId || listId;
    const today = todayISO();
    const chips = [
      `<button type="button" class="qa-chip qa-star${star ? ' on' : ''}" data-qa-star aria-pressed="${star}" title="${star ? 'Will be added to Today’s focus' : 'Add to Today’s focus'}">${icons.star}<span>${star ? 'Today’s focus' : 'Focus'}</span></button>`,
    ];
    if (mode === 'focus' && fixed && !p.categoryId) {
      const c = findCategory(target);
      chips.push(`<span class="chip chip-cat" style="--accent:${colorHex(c?.color)}"><span class="dot"></span>Adds to ${esc(c?.icon || '')} ${esc(c?.name || '')}</span>`);
    } else if (mode === 'focus') {
      const cats = getState().categories;
      chips.push(
        `<label class="qa-chip qa-list" style="--accent:${colorHex(findCategory(target)?.color)}"><span class="dot"></span><select aria-label="List">${cats
          .map((c) => `<option value="${esc(c.id)}"${c.id === target ? ' selected' : ''}>${esc(c.icon)} ${esc(c.name)}</option>`)
          .join('')}</select>${icons.chevron}</label>`,
      );
    } else if (p.categoryId && p.categoryId !== categoryId) {
      const c = findCategory(p.categoryId);
      chips.push(`<span class="chip chip-cat" style="--accent:${colorHex(c.color)}">${icons.arrowRight}${esc(c.icon)} ${esc(c.name)}</span>`);
    }
    if (p.dueDate) chips.push(`<span class="chip due due-${dueTone(p.dueDate, today)}">${icons.calendar}${esc(dueLabel(p.dueDate, today))}</span>`);
    if (p.priority !== 'none') chips.push(`<span class="prio" data-prio="${p.priority}">${icons.flag}${PRIORITY_LABEL[p.priority]}</span>`);
    p.tags.forEach((t) => chips.push(`<span class="tag">#${esc(t)}</span>`));
    if (!input.value.trim()) chips.push(`<span class="qa-hint">Try <code>+list</code> <code>#tag</code> <code>!high</code> <code>@tomorrow</code></span>`);
    meta.innerHTML = chips.join('');
  }

  meta.addEventListener('click', (e) => {
    if (!e.target.closest('[data-qa-star]')) return;
    mem.star = !starFor(parse());
    mem.touched = true;
    draw();
    input.focus();
  });
  meta.addEventListener('change', (e) => {
    if (!e.target.matches('select')) return;
    listId = e.target.value;
    prefs.set('lastList', listId);
    draw();
  });
  input.addEventListener('input', draw);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const p = parse();
    if (!p.title) {
      input.focus();
      return;
    }
    const target = p.categoryId || listId;
    const cat = findCategory(target);
    if (!cat) {
      toast('Create a list first, then add tasks to it.');
      openCategoryEditor();
      return;
    }
    addTask({ title: p.title, tags: p.tags, priority: p.priority, dueDate: p.dueDate, categoryId: target, status: 'todo', focus: starFor(p) });
    if (mode === 'focus' || target !== categoryId) toast(`Added to ${cat.name}`);
    mem.touched = false;
    mem.star = mode === 'focus';
    input.value = '';
    draw();
    input.focus();
  });

  draw();
}
