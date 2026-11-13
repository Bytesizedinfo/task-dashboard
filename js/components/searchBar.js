// Always-visible "Search all tasks…" bar at the top of every page. Results appear as you type and stay
// up to date; ticking or opening a task works right from the results. Follows the list filter.
import { search, subscribe } from '../store.js';
import { colorHex } from '../constants.js';
import { esc, plural } from '../utils/dom.js';
import { icons } from './icons.js';
import { taskList } from './taskItem.js';
import { getListFilter, listFilterSelect } from './listFilter.js';

export function searchBarHtml() {
  return `<div class="topbar">
    <div class="searchbar" role="search">
      ${icons.search}
      <input type="search" class="sb-input" placeholder="Search all tasks…" aria-label="Search all tasks" autocomplete="off" enterkeyhint="search" spellcheck="false">
      <kbd class="desktop-only">/</kbd>
    </div>
    <div class="search-pop" role="region" aria-label="Search results" hidden></div>
  </div>`;
}

export function mountSearchBar(root) {
  const bar = root.querySelector('.topbar');
  const input = bar.querySelector('.sb-input');
  const pop = bar.querySelector('.search-pop');
  let unsubscribe = null;

  function close() {
    pop.hidden = true;
    pop.innerHTML = '';
    unsubscribe?.();
    unsubscribe = null;
  }

  function draw() {
    const q = input.value.trim();
    if (!q) {
      close();
      return;
    }
    const { tasks, categories, total } = search(q, { categoryId: getListFilter() });
    pop.innerHTML = `
      <div class="sp-head">
        <span class="muted small">${total ? `${total} ${plural(total, 'task')}` : 'No tasks match'} for “${esc(q)}”</span>
        ${listFilterSelect({ label: 'Search in' })}
      </div>
      ${
        categories.length
          ? `<div class="search-lists">${categories
              .map((c) => `<a class="list-pill" href="#/c/${encodeURIComponent(c.id)}" style="--accent:${colorHex(c.color)}">${esc(c.icon)} ${esc(c.name)}</a>`)
              .join('')}</div>`
          : ''
      }
      ${tasks.length ? taskList(tasks, { showCategory: true }) : ''}
      ${total > tasks.length ? `<p class="muted small">Showing the first ${tasks.length}. Keep typing to narrow it down.</p>` : ''}`;
    if (pop.hidden) {
      pop.hidden = false;
      unsubscribe = subscribe(() => !pop.hidden && draw());
    }
  }

  input.addEventListener('input', draw);
  input.addEventListener('focus', () => input.value.trim() && draw());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      close();
      input.blur();
    }
  });
  window.addEventListener('listfilterchange', () => !pop.hidden && draw());
  // Click outside (but not inside a dialog opened from the results) closes the results.
  document.addEventListener('pointerdown', (e) => {
    if (!pop.hidden && !bar.contains(e.target) && !e.target.closest('.overlay, .popover, .toast')) close();
  });
  // Opening a task or a list from the results closes them; ticking a task keeps them open.
  pop.addEventListener('click', (e) => {
    if (e.target.closest('.list-pill')) {
      input.value = '';
      close();
    } else if (e.target.closest('[data-action="open-task"]') && !e.target.closest('.check, .t-act')) {
      setTimeout(close, 0);
    }
  });

  return {
    focus() {
      window.scrollTo({ top: 0 });
      input.focus();
      input.select();
    },
  };
}
