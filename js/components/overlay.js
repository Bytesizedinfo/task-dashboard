import { esc } from '../utils/dom.js';

// Modal dialogs: centred on desktop, bottom sheets on phones (see .overlay / .sheet in CSS).
const stack = [];

export const hasOverlay = () => stack.length > 0;

export function closeAllOverlays() {
  [...stack].forEach((o) => o.close(true));
}

export function openOverlay({ html, className = '', label = '', onClose } = {}) {
  const root = document.getElementById('overlay-root');
  const wrap = document.createElement('div');
  wrap.className = 'overlay';
  wrap.innerHTML = `<div class="overlay-backdrop" data-close></div><div class="sheet ${className}" role="dialog" aria-modal="true" aria-label="${esc(label)}" tabindex="-1">${html}</div>`;
  root.appendChild(wrap);

  const sheet = wrap.querySelector('.sheet');
  const prevFocus = document.activeElement;
  let closed = false;
  const api = { el: sheet, close };
  stack.push(api);
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => wrap.classList.add('open'));

  wrap.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) {
      e.preventDefault();
      close();
    }
  });
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') trapFocus(e, sheet);
  });
  setTimeout(() => {
    if (!sheet.contains(document.activeElement)) sheet.focus({ preventScroll: true });
  }, 30);

  function close(immediate = false) {
    if (closed) return;
    closed = true;
    stack.splice(stack.indexOf(api), 1);
    if (!stack.length) document.body.classList.remove('no-scroll');
    wrap.classList.remove('open');
    const finish = () => {
      wrap.remove();
      onClose?.();
    };
    if (immediate) finish();
    else setTimeout(finish, 220);
    if (!immediate && prevFocus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
  }

  return api;
}

function trapFocus(e, root) {
  const items = [...root.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
    (el) => el.offsetParent !== null,
  );
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/**
 * Confirmation dialog. Resolves to null when cancelled, otherwise to { values }
 * holding the named inputs placed in `body` (checked radios only).
 */
export function confirmDialog({ title, message = '', body = '', confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let result = null;
    const o = openOverlay({
      label: title,
      className: 'sheet-sm',
      onClose: () => resolve(result),
      html: `<div class="sheet-grabber" aria-hidden="true"></div>
        <header class="sheet-head"><h2>${esc(title)}</h2></header>
        <div class="sheet-body">${message ? `<p class="muted">${esc(message)}</p>` : ''}${body}</div>
        <footer class="sheet-foot"><span class="spacer"></span>
          <button type="button" class="btn btn-ghost" data-close>Cancel</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="ok">${esc(confirmLabel)}</button>
        </footer>`,
    });
    const ok = o.el.querySelector('[data-act="ok"]');
    ok.addEventListener('click', () => {
      const values = {};
      o.el.querySelectorAll('input[name], select[name]').forEach((el) => {
        if (el.type === 'radio' || el.type === 'checkbox') {
          if (el.checked) values[el.name] = el.value;
        } else values[el.name] = el.value;
      });
      result = { values };
      o.close();
    });
    setTimeout(() => ok.focus(), 40);
  });
}
