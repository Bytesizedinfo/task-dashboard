import { dueToday, overdue, upcomingBuckets } from '../store.js';
import { longDate, todayISO } from '../utils/dates.js';
import { esc, plural } from '../utils/dom.js';
import { icons } from '../components/icons.js';
import { taskList } from '../components/taskItem.js';
import { focusPanel, focusSummary, goalMeter } from './focus.js';

const section = (title, tasks, cls = '') =>
  tasks.length
    ? `<section class="group ${cls}"><h3 class="group-title">${title}<span class="count">${tasks.length}</span></h3>${taskList(tasks, { showCategory: true })}</section>`
    : '';

/** Today page: the full Today's focus (no cap), with the daily goal in the header. */
export function renderToday() {
  return `
    <header class="page-head">
      <div><p class="eyebrow">${esc(longDate())}</p><h1>Today</h1>
        <p class="sub">${esc(focusSummary())}</p>
      </div>
      ${goalMeter()}
    </header>
    <div class="focus-page">${focusPanel({ page: true })}</div>`;
}

export function renderUpcoming() {
  const today = todayISO();
  const b = upcomingBuckets(today);
  const od = overdue(today).length + dueToday(today).length;
  const any = b.tomorrow.length + b.week.length + b.later.length + b.noDate.length;

  return `
    <header class="page-head">
      <div><p class="eyebrow">Plan ahead</p><h1>Upcoming</h1>
        <p class="sub">${b.tomorrow.length + b.week.length} ${plural(b.tomorrow.length + b.week.length, 'task')} in the next 7 days</p>
      </div>
      <button type="button" class="btn btn-primary desktop-only" data-action="new-task">${icons.plus}<span>New task</span></button>
    </header>
    ${od ? `<a class="banner banner-link" href="#/today">${icons.today}<span>${od} ${plural(od, 'task')} due today or overdue</span><span class="banner-go">Open Today →</span></a>` : ''}
    ${!any ? '<div class="empty"><div class="big">🗓️</div><h3>Nothing coming up</h3><p>Tasks with future dates will appear here.</p></div>' : ''}
    ${section('Tomorrow', b.tomorrow)}
    ${section('Next 7 days', b.week)}
    ${section('Later', b.later)}
    ${section('No date', b.noDate, 'group-nodate')}`;
}
