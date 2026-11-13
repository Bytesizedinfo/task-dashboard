// "All lists ▾" filter, shared by Focus today, Today, Upcoming and search.
// Picking a list shows only its tasks (and new tasks added there go into it). Remembered on this device.
import { findCategory, getState } from '../store.js';
import { colorHex } from '../constants.js';
import { esc, prefs } from '../utils/dom.js';
import { ui } from '../ui-state.js';
import { icons } from './icons.js';

/** The list being shown, or '' for all lists. */
export function getListFilter() {
  const id = prefs.get('listFilter', '');
  return id && findCategory(id) ? id : '';
}

export function setListFilter(id) {
  prefs.set('listFilter', id || '');
  window.dispatchEvent(new Event('listfilterchange'));
  ui.requestRender();
}

export function listFilterSelect({ label = 'Show tasks from' } = {}) {
  const current = getListFilter();
  const cat = current ? findCategory(current) : null;
  return `<label class="list-filter${current ? ' on' : ''}" style="--accent:${cat ? colorHex(cat.color) : 'var(--text-3)'}" title="${esc(label)}">
    <span class="dot"></span>
    <select data-list-filter aria-label="${esc(label)}">
      <option value="">All lists</option>
      ${getState()
        .categories.map((c) => `<option value="${esc(c.id)}"${c.id === current ? ' selected' : ''}>${esc(c.icon)} ${esc(c.name)}</option>`)
        .join('')}
    </select>${icons.chevron}
  </label>`;
}
