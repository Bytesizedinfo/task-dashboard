import { esc } from '../utils/dom.js';

/** Small message at the bottom of the screen, with an optional action such as "Undo". */
export function toast(message, { action, onAction, timeout = 4500, tone = '' } = {}) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast' + (tone ? ' toast-' + tone : '');
  el.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button type="button" class="toast-action">${esc(action)}</button>` : ''}`;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));

  const remove = () => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  };
  const timer = setTimeout(remove, timeout);
  el.querySelector('.toast-action')?.addEventListener('click', () => {
    clearTimeout(timer);
    onAction?.();
    remove();
  });

  while (root.children.length > 3) root.firstElementChild.remove();
}
