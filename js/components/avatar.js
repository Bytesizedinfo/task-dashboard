import { esc } from '../utils/dom.js';

export function avatarHtml(user, cls = 'avatar') {
  if (user?.photoURL) return `<img class="${cls}" src="${esc(user.photoURL)}" alt="" referrerpolicy="no-referrer">`;
  const initial = (user?.displayName || user?.email || '?').trim().charAt(0).toUpperCase() || '?';
  return `<span class="${cls}">${esc(initial)}</span>`;
}
