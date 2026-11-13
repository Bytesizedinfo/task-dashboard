// Quick "when?" menu for a task: Today / Tomorrow / This weekend / Next week / pick a date / no date.
// Desktop: a small popover beside the button. Phones: a bottom sheet.
import { findTask, setDue } from '../store.js';
import { addDays, fromISO, nextWeekday, todayISO } from '../utils/dates.js';
import { esc } from '../utils/dom.js';
import { icons } from './icons.js';
import { openOverlay } from './overlay.js';
import { toast } from './toast.js';

let closeCurrent = null;

export function closeDateMenu() {
  closeCurrent?.();
}

function options(today) {
  const day = fromISO(today).getDay();
  const weekend = day === 6 || day === 0 ? today : nextWeekday(6, today);
  const short = (iso) => fromISO(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  return [
    { label: 'Today', value: today, hint: short(today), icon: icons.today },
    { label: 'Tomorrow', value: addDays(today, 1), hint: short(addDays(today, 1)), icon: icons.sun },
    { label: 'This weekend', value: weekend, hint: short(weekend), icon: icons.calendar },
    { label: 'Next week', value: nextWeekday(1, today), hint: short(nextWeekday(1, today)), icon: icons.arrowRight },
    { label: 'No date', value: '', hint: '', icon: icons.x },
  ];
}

function menuHtml(task) {
  const today = todayISO();
  return `<div class="date-menu" role="menu" aria-label="Change due date">
    ${options(today)
      .map(
        (o) => `<button type="button" class="menu-item${(task.dueDate || '') === o.value ? ' on' : ''}" role="menuitem" data-date="${o.value}">
          ${o.icon}<span>${o.label}</span><span class="mi-hint">${esc(o.hint)}</span></button>`,
      )
      .join('')}
    <div class="menu-sep"></div>
    <label class="menu-date"><span>Pick a date</span><input type="date" class="input" value="${task.dueDate || ''}" aria-label="Pick a date"></label>
  </div>`;
}

export function openDateMenu(anchor, taskId) {
  closeDateMenu();
  const task = findTask(taskId);
  if (!task) return;
  const before = task.dueDate;

  const choose = (value, close) => {
    close();
    const next = value || null;
    if (next === before) return;
    setDue(taskId, next);
    const label = next ? options(todayISO()).find((o) => o.value === next)?.label || fromISO(next).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : 'no date';
    toast(next ? `Moved to ${label}` : 'Due date removed', { action: 'Undo', onAction: () => setDue(taskId, before) });
  };

  const wire = (el, close) => {
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-date]');
      if (b) choose(b.dataset.date, close);
    });
    el.querySelector('input[type="date"]').addEventListener('change', (e) => e.target.value && choose(e.target.value, close));
  };

  // Phones (and anything without hover): bottom sheet.
  if (window.matchMedia('(max-width: 640px), (hover: none)').matches) {
    const o = openOverlay({
      label: 'Change due date',
      className: 'sheet-sm',
      html: `<div class="sheet-grabber" aria-hidden="true"></div>
        <header class="sheet-head"><h2>When?</h2><button type="button" class="icon-btn" data-close aria-label="Close">${icons.x}</button></header>
        <div class="sheet-body">${menuHtml(task)}</div>`,
    });
    wire(o.el, () => o.close());
    return;
  }

  // Desktop: popover anchored to the button.
  const pop = document.createElement('div');
  pop.className = 'popover';
  pop.innerHTML = menuHtml(task);
  document.getElementById('overlay-root').appendChild(pop);
  const r = anchor.getBoundingClientRect();
  const w = pop.offsetWidth;
  const h = pop.offsetHeight;
  const left = Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8);
  const below = r.bottom + 6;
  const top = below + h > window.innerHeight - 8 ? Math.max(8, Math.min(r.top - h - 6, window.innerHeight - h - 8)) : below;
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';

  const onDoc = (e) => {
    if (!pop.contains(e.target) && !anchor.contains(e.target)) close();
  };
  const onKey = (e) => e.key === 'Escape' && close();
  function close() {
    pop.remove();
    document.removeEventListener('pointerdown', onDoc, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', close);
    window.removeEventListener('scroll', close, true);
    closeCurrent = null;
  }
  closeCurrent = close;
  document.addEventListener('pointerdown', onDoc, true);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', close);
  window.addEventListener('scroll', close, true);
  wire(pop, close);
  pop.querySelector('.menu-item')?.focus();
}
