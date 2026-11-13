const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape text for safe use inside HTML strings and attributes. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}

export function plural(n, word, pluralWord = word + 's') {
  return n === 1 ? word : pluralWord;
}

export function uid() {
  const raw = globalThis.crypto?.randomUUID
    ? crypto.randomUUID().replace(/-/g, '')
    : Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return raw.slice(0, 20);
}

/** Per-device preferences in localStorage. Never throws (private mode, blocked storage). */
export const prefs = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem('td.' + key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem('td.' + key, JSON.stringify(value));
    } catch {
      /* storage unavailable: preference just won't persist */
    }
  },
};
