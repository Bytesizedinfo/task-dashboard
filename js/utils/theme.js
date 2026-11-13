import { prefs } from './dom.js';

const THEME_COLORS = { dark: '#0b0d12', light: '#f3f4f8' };

export function currentTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme, save = false) {
  const t = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[t]);
  if (save) prefs.set('theme', t);
}
