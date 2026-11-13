const svg = (paths) =>
  `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;

const cal = '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M16 2.5v4M8 2.5v4M3 9.5h18"/>';

export const icons = {
  home: svg('<path d="M3 10.2 12 3l9 7.2"/><path d="M5.5 8.6V20a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V8.6"/>'),
  today: svg(cal + '<circle cx="12" cy="15.2" r="2.2" fill="currentColor" stroke="none"/>'),
  upcoming: svg(cal + '<path d="M7.5 13.5h.01M12 13.5h.01M16.5 13.5h.01M7.5 17.5h.01M12 17.5h.01"/>'),
  calendar: svg(cal),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.2-4.2"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  settings: svg('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
  check: svg('<path d="M5 12.5 10 17.5 19 7"/>'),
  x: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  pencil: svg('<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/><path d="m14.5 5.5 3 3"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2l1-12M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/>'),
  list: svg('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>'),
  board: svg('<rect x="3" y="3.5" width="5" height="17" rx="1.5"/><rect x="9.5" y="3.5" width="5" height="11" rx="1.5"/><rect x="16" y="3.5" width="5" height="14" rx="1.5"/>'),
  flag: svg('<path d="M5 21V4"/><path d="M5 4h12.5l-2.5 4.5 2.5 4.5H5"/>'),
  note: svg('<path d="M4 6h16M4 12h16M4 18h10"/>'),
  arrowLeft: svg('<path d="M19 12H5M11 18l-6-6 6-6"/>'),
  logout: svg('<path d="M9 21H5.5A2.5 2.5 0 0 1 3 18.5v-13A2.5 2.5 0 0 1 5.5 3H9M16 17l5-5-5-5M21 12H9"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>'),
  moon: svg('<path d="M20.5 13.5A8.5 8.5 0 1 1 10.5 3.5a6.6 6.6 0 0 0 10 10Z"/>'),
  download: svg('<path d="M12 3.5v12M7 11l5 5 5-5M4.5 20.5h15"/>'),
  upload: svg('<path d="M12 16V4M7 8.5l5-5 5 5M4.5 20.5h15"/>'),
  alert: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5M12 16.2v.01"/>'),
  target: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>'),
  progress: svg('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 9 9h-9Z" fill="currentColor" stroke="none"/>'),
  checkCircle: svg('<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16.5 9.5"/>'),
  chevron: svg('<path d="m6 9 6 6 6-6"/>'),
  sparkle: svg('<path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.5l-1.9-5.7-5.6-1.9L10.1 9Z"/><path d="M19 3v3M17.5 4.5h3"/>'),
  cloud: svg('<path d="M7 18.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 17.8 8.6 4.5 4.5 0 0 1 17 18.5Z"/>'),
  star: svg('<path d="M12 3.5l2.6 5.3 5.8.85-4.2 4.1 1 5.8L12 16.8l-5.2 2.75 1-5.8-4.2-4.1 5.8-.85Z"/>'),
  play: svg('<path d="M7.5 4.8v14.4L19 12Z"/>'),
  arrowRight: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  grip: svg('<circle cx="9" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.4" fill="currentColor" stroke="none"/>'),
  eye: svg('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>'),
  eyeOff: svg('<path d="m3 3 18 18M10.6 5.6c.46-.07.93-.1 1.4-.1 6 0 9.5 6.5 9.5 6.5a16.6 16.6 0 0 1-3 3.8M6.6 6.6C3.9 8.4 2.5 12 2.5 12S6 18.5 12 18.5c1.5 0 2.9-.37 4.1-.96M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
  layout: svg('<rect x="3" y="3" width="7.5" height="9" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="5" rx="1.5"/><rect x="13.5" y="11" width="7.5" height="10" rx="1.5"/><rect x="3" y="15" width="7.5" height="6" rx="1.5"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  pulse: svg('<path d="M3 12h4l2.5-6 5 12 2.5-6h4"/>'),
  qr: svg('<rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><path d="M14 14h3v3h-3zM18.5 18.5h2.5V21M14 20.5h.01M20.5 14h.01"/>'),
  refresh: svg('<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4"/>'),
  link: svg('<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>'),
  external: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  lock: svg('<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>'),
};

/** GitHub mark (Octicons, MIT), for the "Connect GitHub" buttons. */
export const githubMark = `<svg class="i" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>`;

/** App logo. `key` keeps gradient IDs unique when the logo appears more than once. */
export function logo(key = 'a', cls = 'logo') {
  const id = 'lg-' + key;
  return `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs><rect width="64" height="64" rx="18" fill="url(#${id})"/><path d="M19 33.5 28 42.5 45.5 23" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

