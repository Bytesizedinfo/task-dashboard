import { addCategory, deleteCategory, findCategory, getState, updateCategory } from '../store.js';
import { colorHex, EMOJIS, PALETTE } from '../constants.js';
import { esc, plural } from '../utils/dom.js';
import { icons } from './icons.js';
import { confirmDialog, openOverlay } from './overlay.js';
import { toast } from './toast.js';

/** Create a list (no categoryId) or edit one. */
export function openCategoryEditor({ categoryId = null } = {}) {
  const st = getState();
  const existing = categoryId ? findCategory(categoryId) : null;
  if (categoryId && !existing) return;
  const n = st.categories.length;
  const d = existing ? { ...existing } : { name: '', icon: EMOJIS[n % EMOJIS.length], color: PALETTE[n % PALETTE.length].id };

  const o = openOverlay({
    label: existing ? 'Edit list' : 'New list',
    html: `<form class="editor" novalidate autocomplete="off">
      <div class="sheet-grabber" aria-hidden="true"></div>
      <header class="sheet-head">
        <h2>${existing ? 'Edit list' : 'New list'}</h2>
        <button type="button" class="icon-btn" data-close aria-label="Close">${icons.x}</button>
      </header>
      <div class="sheet-body">
        <div class="cat-preview" style="--accent:${colorHex(d.color)}">
          <span class="cat-emoji">${esc(d.icon)}</span>
          <div class="pv-text"><strong class="pv-name">${esc(d.name || 'New list')}</strong><small>Preview</small></div>
        </div>
        <label class="field"><span class="field-label">Name</span>
          <input class="input" name="name" value="${esc(d.name)}" maxlength="40" placeholder="e.g. Work, Home, Side project" enterkeyhint="done">
        </label>
        <div class="field"><span class="field-label">Icon</span>
          <div class="emoji-grid" role="radiogroup" aria-label="Icon">${EMOJIS.map(
            (e) => `<button type="button" class="emoji-opt${e === d.icon ? ' on' : ''}" data-emoji="${e}" role="radio" aria-checked="${e === d.icon}">${e}</button>`,
          ).join('')}</div>
          <input class="input emoji-custom" name="icon" value="${esc(d.icon)}" maxlength="8" placeholder="…or type any emoji" aria-label="Custom emoji">
        </div>
        <div class="field"><span class="field-label">Colour</span>
          <div class="swatches" role="radiogroup" aria-label="Colour">${PALETTE.map(
            (p) =>
              `<button type="button" class="swatch${p.id === d.color ? ' on' : ''}" data-color="${p.id}" style="--c:${p.hex}" role="radio" aria-checked="${p.id === d.color}" aria-label="${p.label}" title="${p.label}">${icons.check}</button>`,
          ).join('')}</div>
        </div>
      </div>
      <footer class="sheet-foot">
        ${existing ? `<button type="button" class="btn btn-ghost danger-text" data-act="delete">${icons.trash}<span>Delete</span></button>` : ''}
        <span class="spacer"></span>
        <button type="button" class="btn btn-ghost" data-close>Cancel</button>
        <button type="submit" class="btn btn-primary">${existing ? 'Save' : 'Create list'}</button>
      </footer>
    </form>`,
  });

  const form = o.el.querySelector('form');
  const preview = form.querySelector('.cat-preview');
  const nameInput = form.elements.name;
  const iconInput = form.elements.icon;

  const drawPreview = () => {
    preview.style.setProperty('--accent', colorHex(d.color));
    preview.querySelector('.cat-emoji').textContent = d.icon || '📁';
    preview.querySelector('.pv-name').textContent = nameInput.value.trim() || 'New list';
    form.querySelectorAll('.emoji-opt').forEach((b) => {
      b.classList.toggle('on', b.dataset.emoji === d.icon);
      b.setAttribute('aria-checked', String(b.dataset.emoji === d.icon));
    });
    form.querySelectorAll('.swatch').forEach((b) => {
      b.classList.toggle('on', b.dataset.color === d.color);
      b.setAttribute('aria-checked', String(b.dataset.color === d.color));
    });
  };

  nameInput.addEventListener('input', drawPreview);
  iconInput.addEventListener('input', () => {
    d.icon = iconInput.value.trim();
    drawPreview();
  });
  form.querySelector('.emoji-grid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-emoji]');
    if (!b) return;
    d.icon = b.dataset.emoji;
    iconInput.value = d.icon;
    drawPreview();
  });
  form.querySelector('.swatches').addEventListener('click', (e) => {
    const b = e.target.closest('[data-color]');
    if (!b) return;
    d.color = b.dataset.color;
    drawPreview();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.classList.remove('shake');
      void nameInput.offsetWidth;
      nameInput.classList.add('shake');
      nameInput.focus();
      return;
    }
    const data = { name, icon: d.icon || '📁', color: d.color };
    o.close(true);
    if (existing) updateCategory(existing.id, data);
    else {
      const id = addCategory(data);
      location.hash = '#/c/' + encodeURIComponent(id);
    }
  });

  form.querySelector('[data-act="delete"]')?.addEventListener('click', () => {
    o.close(true);
    confirmDeleteCategory(existing);
  });

  setTimeout(() => nameInput.focus(), 60);
}

async function confirmDeleteCategory(cat) {
  const st = getState();
  const count = st.tasks.filter((t) => t.categoryId === cat.id).length;
  const others = st.categories.filter((c) => c.id !== cat.id);
  const them = count === 1 ? 'it' : 'them';

  let body = '';
  if (count) {
    body = `<p class="muted">“${esc(cat.name)}” has ${count} ${plural(count, 'task')}. What should happen to ${them}?</p>`;
    if (others.length) {
      body += `<label class="radio-row"><input type="radio" name="fate" value="move" checked><span>Move ${them} to</span>
        <select class="input" name="moveTo">${others.map((c) => `<option value="${esc(c.id)}">${esc(c.icon)}  ${esc(c.name)}</option>`).join('')}</select></label>`;
    }
    body += `<label class="radio-row"><input type="radio" name="fate" value="delete"${others.length ? '' : ' checked'}><span>Delete ${them} too</span></label>`;
  }

  const res = await confirmDialog({
    title: `Delete “${cat.name}”?`,
    message: count ? '' : 'This list is empty.',
    body,
    confirmLabel: 'Delete list',
    danger: true,
  });
  if (!res) return;
  const moveTo = count && res.values.fate === 'move' ? res.values.moveTo : null;
  deleteCategory(cat.id, { moveTo });
  if (location.hash === '#/c/' + encodeURIComponent(cat.id)) location.hash = '#/';
  toast(`Deleted “${cat.name}”`);
}
