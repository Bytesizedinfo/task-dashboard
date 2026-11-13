import { todayISO, addDays, nextWeekday, isISODate } from './dates.js';

/** Tags are stored lowercase, without '#', spaces turned into dashes. */
export function normTag(s) {
  return String(s)
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .slice(0, 30);
}

const PRIO = { high: 'high', h: 'high', 1: 'high', urgent: 'high', med: 'med', medium: 'med', m: 'med', 2: 'med', low: 'low', l: 'low', 3: 'low' };
const DAYS = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6 };

/**
 * Parse quick-add text such as "Call supplier +Work #suppliers !high @friday".
 *   +List             → puts it in that list (needs `resolveList`, which returns a list id or null)
 *   #tag              → adds a tag
 *   !high !med !low   → priority
 *   @today @tomorrow @mon…@sun @nextweek @2026-12-01 → due date
 * Anything not recognised stays in the title.
 */
export function parseQuickAdd(text, today = todayISO(), resolveList = null) {
  const tags = [];
  let priority = 'none';
  let dueDate = null;
  let categoryId = null;
  const rest = [];

  for (const word of String(text).trim().split(/\s+/).filter(Boolean)) {
    const lw = word.toLowerCase();
    if (resolveList && /^\+[^\s+]+$/.test(word)) {
      const id = resolveList(word.slice(1));
      if (id) {
        categoryId = id;
        continue;
      }
    }
    if (/^#[^#\s]+$/.test(word)) {
      const t = normTag(word);
      if (t && !tags.includes(t)) tags.push(t);
      continue;
    }
    if (lw.startsWith('!') && PRIO[lw.slice(1)]) {
      priority = PRIO[lw.slice(1)];
      continue;
    }
    if (lw.startsWith('@') && lw.length > 1) {
      const k = lw.slice(1);
      let d = null;
      if (k === 'today') d = today;
      else if (k === 'tomorrow' || k === 'tmr' || k === 'tom') d = addDays(today, 1);
      else if (k === 'nextweek') d = nextWeekday(1, today);
      else if (k in DAYS) d = nextWeekday(DAYS[k], today);
      else if (isISODate(k)) d = k;
      if (d) {
        dueDate = d;
        continue;
      }
    }
    rest.push(word);
  }
  return { title: rest.join(' '), tags, priority, dueDate, categoryId };
}
