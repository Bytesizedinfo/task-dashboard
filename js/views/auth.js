import { esc } from '../utils/dom.js';
import { logo } from '../components/icons.js';

export function renderBoot(root, message = '') {
  root.innerHTML = `<div class="boot"><div class="boot-inner"><div class="spinner" role="status" aria-label="Loading"></div>${
    message ? `<p class="muted">${esc(message)}</p>` : ''
  }</div></div>`;
}

/** Full-screen message with buttons, used if the app can't start. */
export function renderMessage(root, { title, body, actions = [] }) {
  root.innerHTML = `<div class="auth-wrap"><div class="auth-card">
    ${logo('msg')}
    <h1>${esc(title)}</h1>
    <p>${esc(body)}</p>
    <div class="row-actions center">${actions
      .map((a, i) => `<button type="button" class="btn ${a.primary ? 'btn-primary' : ''}" data-i="${i}">${esc(a.label)}</button>`)
      .join('')}</div>
  </div></div>`;
  root.querySelectorAll('button[data-i]').forEach((b) => b.addEventListener('click', () => actions[Number(b.dataset.i)].onClick()));
}
