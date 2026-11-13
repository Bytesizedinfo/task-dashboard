import { allTags, search, subscribe } from '../store.js';
import { colorHex } from '../constants.js';
import { esc, plural } from '../utils/dom.js';
import { icons } from './icons.js';
import { openOverlay } from './overlay.js';
import { openTaskEditor } from './taskEditor.js';
import { taskList } from './taskItem.js';

export function openSearch() {
  let unsubscribe = () => {};
  const o = openOverlay({
    label: 'Search',
    className: 'top sheet-search',
    onClose: () => unsubscribe(),
    html: `<div class="sheet-grabber" aria-hidden="true"></div>
      <div class="search-bar">${icons.search}
        <input type="search" placeholder="Search tasks, tags and lists…" aria-label="Search" enterkeyhint="search" autocomplete="off">
        <button type="button" class="btn btn-ghost sm" data-close>Close</button>
      </div>
      <div class="search-results"></div>`,
  });

  const input = o.el.querySelector('input');
  const results = o.el.querySelector('.search-results');
  const draw = () => (results.innerHTML = renderResults(input.value));

  input.addEventListener('input', draw);
  results.addEventListener('click', (e) => {
    const tagBtn = e.target.closest('[data-tag]');
    if (tagBtn) {
      input.value = '#' + tagBtn.dataset.tag;
      draw();
      input.focus();
      return;
    }
    const card = e.target.closest('[data-action="open-task"]');
    if (card && !e.target.closest('[data-action="toggle"]')) {
      e.stopPropagation();
      o.close(true);
      openTaskEditor({ taskId: card.dataset.taskId });
    }
  });

  unsubscribe = subscribe(draw);
  draw();
  setTimeout(() => input.focus(), 60);
}

function renderResults(query) {
  const q = query.trim();
  if (!q) {
    const tags = allTags().slice(0, 24);
    return `<p class="hint">Search titles, notes, tags and lists. Start with <code>#</code> to search by tag.</p>
      ${
        tags.length
          ? `<div class="field"><span class="field-label">Your tags</span><div class="tag-cloud">${tags
              .map((t) => `<button type="button" class="chip-btn" data-tag="${esc(t.tag)}">#${esc(t.tag)} <span class="muted">${t.count}</span></button>`)
              .join('')}</div></div>`
          : ''
      }`;
  }
  const { tasks, categories, total } = search(q);
  if (!tasks.length && !categories.length) return `<p class="hint">Nothing matches “${esc(q)}”.</p>`;
  return `${
    categories.length
      ? `<div class="field"><span class="field-label">Lists</span><div class="search-lists">${categories
          .map((c) => `<a class="list-pill" href="#/c/${encodeURIComponent(c.id)}" style="--accent:${colorHex(c.color)}">${esc(c.icon)} ${esc(c.name)}</a>`)
          .join('')}</div></div>`
      : ''
  }${
    tasks.length
      ? `<div class="field"><span class="field-label">${total} ${plural(total, 'task')}</span>${taskList(tasks, { showCategory: true })}</div>`
      : ''
  }`;
}
