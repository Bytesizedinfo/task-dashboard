import { deleteEverything, deleteTasks, exportData, findCategory, getState, importData, requestSync, restoreSnapshot, subscribe, syncStatus } from '../store.js';
import { colorHex } from '../constants.js';
import { confirmDeleteCategory } from './categoryEditor.js';
import { loadGitHubConfig } from '../backend/github.js';
import { openAddDevice, signOut } from './connect.js';
import { openGoogleImport } from './googleImport.js';
import { todayISO } from '../utils/dates.js';
import { esc, plural, prefs } from '../utils/dom.js';
import { applyTheme, currentTheme } from '../utils/theme.js';
import { ui } from '../ui-state.js';
import { dailyGoal } from '../views/focus.js';
import { avatarHtml } from './avatar.js';
import { icons } from './icons.js';
import { confirmDialog, openOverlay } from './overlay.js';
import { toast } from './toast.js';

function timeAgo(ms) {
  if (!ms) return 'not yet';
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function syncLine() {
  const st = getState();
  const sync = syncStatus();
  if (st.syncError) return `<span class="sync-dot error"></span><span class="txt-error">${esc(st.syncError)}</span>`;
  return `<span class="sync-dot ${sync.cls}"></span>${esc(sync.text)} · last synced ${esc(timeAgo(st.lastSynced))}`;
}

export function openSettings() {
  const st = getState();
  const theme = currentTheme();
  const gh = loadGitHubConfig();

  const syncSection = gh
    ? `<div class="account-row">${avatarHtml(st.user)}
          <div class="who"><strong>${esc(gh.owner)}/${esc(gh.repo)}</strong>
            <small class="sync-line">${syncLine()}</small></div>
          <a class="icon-btn" href="https://github.com/${encodeURIComponent(gh.owner)}/${encodeURIComponent(gh.repo)}/commits" target="_blank" rel="noopener" aria-label="Open history on GitHub" title="Open history on GitHub">${icons.external}</a>
        </div>
        <p class="muted small">Changes sync automatically within a few seconds. Updates from your other devices appear within about 30 seconds, or straight away when you come back to the app.</p>
        <p class="muted small">${
          gh.signedInAt ? `Signed in on this device since ${esc(new Date(gh.signedInAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }))}. ` : ''
        }You stay signed in until you sign out, clear this browser’s data for the site, or your token expires.</p>
        <div class="row-actions">
          <button type="button" class="btn" data-act="sync-now">${icons.refresh}<span>Sync now</span></button>
          <button type="button" class="btn" data-act="add-device">${icons.qr}<span>Add another device</span></button>
          <button type="button" class="btn btn-ghost danger-text" data-act="sign-out">${icons.logout}<span>Sign out</span></button>
        </div>`
    : '';

  let unsubscribe = () => {};
  const o = openOverlay({
    label: 'Settings',
    onClose: () => unsubscribe(),
    html: `<div class="sheet-grabber" aria-hidden="true"></div>
      <header class="sheet-head"><h2>Settings</h2><button type="button" class="icon-btn" data-close aria-label="Close">${icons.x}</button></header>
      <div class="sheet-body">
        <section class="settings-section"><h3 class="field-label">Account &amp; sync</h3>${syncSection}</section>
        <section class="settings-section"><h3 class="field-label">Appearance</h3>
          <div class="seg full" data-group="theme" role="radiogroup" aria-label="Theme">
            <button type="button" role="radio" data-value="dark" aria-checked="${theme === 'dark'}" class="${theme === 'dark' ? 'on' : ''}">${icons.moon}Dark</button>
            <button type="button" role="radio" data-value="light" aria-checked="${theme === 'light'}" class="${theme === 'light' ? 'on' : ''}">${icons.sun}Light</button>
          </div>
        </section>
        <section class="settings-section"><h3 class="field-label">Daily goal</h3>
          <div class="stepper" role="group" aria-label="Daily goal">
            <button type="button" class="icon-btn" data-act="goal-dec" aria-label="Lower the goal">${icons.minus}</button>
            <output class="goal-val">${dailyGoal()}</output>
            <button type="button" class="icon-btn" data-act="goal-inc" aria-label="Raise the goal">${icons.plus}</button>
            <span class="muted small">tasks a day: fills the ring on the Today page</span>
          </div>
        </section>
        <section class="settings-section"><h3 class="field-label">Lists &amp; tasks</h3>
          <div class="manage"></div>
        </section>
        <section class="settings-section"><h3 class="field-label">Backup</h3>
          <p class="muted small">You have ${st.categories.length} ${plural(st.categories.length, 'list')} and ${st.tasks.length} ${plural(st.tasks.length, 'task')}.</p>
          <div class="row-actions">
            <button type="button" class="btn" data-act="export">${icons.download}<span>Export</span></button>
            <button type="button" class="btn" data-act="import">${icons.upload}<span>Import</span></button>
            <input type="file" accept="application/json,.json" hidden>
          </div>
          <button type="button" class="btn" data-act="google-import">${icons.upload}<span>Import from Google Tasks</span></button>
        </section>
        <section class="settings-section desktop-only"><h3 class="field-label">Keyboard shortcuts</h3>
          <div class="kbd-list"><kbd>N</kbd><span>New task</span><kbd>/</kbd><span>Search</span><kbd>Ctrl K</kbd><span>Search from anywhere</span><kbd>Ctrl Enter</kbd><span>Save a task</span><kbd>Esc</kbd><span>Close</span></div>
        </section>
      </div>`,
  });

  const el = o.el;
  el.querySelector('[data-group="theme"]').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-value]');
    if (!b) return;
    applyTheme(b.dataset.value, true);
    el.querySelectorAll('[data-group="theme"] button').forEach((x) => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-checked', String(x === b));
    });
  });

  const goalOut = el.querySelector('.goal-val');
  const stepGoal = (delta) => {
    const next = Math.min(50, Math.max(1, dailyGoal() + delta));
    prefs.set('goal', next);
    goalOut.textContent = next;
    ui.requestRender();
  };
  el.querySelector('[data-act="goal-dec"]').addEventListener('click', () => stepGoal(-1));
  el.querySelector('[data-act="goal-inc"]').addEventListener('click', () => stepGoal(1));

  // Lists & tasks: delete a list, completed tasks, or everything (each with Undo). Redrawn as data changes.
  const manage = el.querySelector('.manage');
  const drawManage = () => {
    const s = getState();
    const done = s.tasks.filter((t) => t.status === 'done').length;
    manage.innerHTML = `
      ${
        s.categories.length
          ? `<ul class="manage-lists">${s.categories
              .map((c) => {
                const n = s.tasks.filter((t) => t.categoryId === c.id);
                const open = n.filter((t) => t.status !== 'done').length;
                return `<li style="--accent:${colorHex(c.color)}"><span class="dot"></span><span class="ml-name">${esc(c.icon)} ${esc(c.name)}</span>
                  <span class="ml-count">${open} open${n.length - open ? ` · ${n.length - open} done` : ''}</span>
                  <button type="button" class="icon-btn sm" data-del-list="${esc(c.id)}" aria-label="Delete list ${esc(c.name)}" title="Delete list">${icons.trash}</button></li>`;
              })
              .join('')}</ul>`
          : '<p class="muted small">You have no lists.</p>'
      }
      <div class="row-actions">
        <button type="button" class="btn" data-act="del-done"${done ? '' : ' disabled'}>${icons.checkCircle}<span>Delete ${done} completed ${plural(done, 'task')}</span></button>
        <button type="button" class="btn btn-ghost danger-text" data-act="del-all"${s.tasks.length || s.categories.length ? '' : ' disabled'}>${icons.trash}<span>Delete everything</span></button>
      </div>
      <p class="muted small">To delete one task, open it and tap <strong>Delete</strong> (on a computer you can also hover over it and click ${icons.trash}). Every delete can be undone straight after, and GitHub keeps earlier versions in its history.</p>`;
  };
  drawManage();
  manage.addEventListener('click', async (e) => {
    const listBtn = e.target.closest('[data-del-list]');
    if (listBtn) {
      const cat = findCategory(listBtn.dataset.delList);
      if (cat) confirmDeleteCategory(cat);
      return;
    }
    if (e.target.closest('[data-act="del-done"]')) {
      const ids = getState().tasks.filter((t) => t.status === 'done').map((t) => t.id);
      const ok = await confirmDialog({
        title: `Delete ${ids.length} completed ${plural(ids.length, 'task')}?`,
        message: 'They’re removed from every list and on all your devices.',
        confirmLabel: 'Delete',
        danger: true,
      });
      if (!ok) return;
      const removed = deleteTasks(ids);
      toast(`Deleted ${removed.length} completed ${plural(removed.length, 'task')}`, { action: 'Undo', timeout: 7000, onAction: () => restoreSnapshot({ tasks: removed }) });
      return;
    }
    if (e.target.closest('[data-act="del-all"]')) {
      const s = getState();
      const ok = await confirmDialog({
        title: 'Delete everything?',
        message: `This deletes all ${s.categories.length} ${plural(s.categories.length, 'list')} and ${s.tasks.length} ${plural(s.tasks.length, 'task')} on all your devices. You can undo it straight after, and GitHub keeps earlier versions in its history.`,
        confirmLabel: 'Delete everything',
        danger: true,
      });
      if (!ok) return;
      const snapshot = deleteEverything();
      toast('Deleted all lists and tasks', { action: 'Undo', timeout: 10000, onAction: () => restoreSnapshot(snapshot) });
    }
  });

  // Sync controls (and keep the sections above up to date while Settings is open)
  const line = el.querySelector('.sync-line');
  unsubscribe = subscribe(() => {
    if (line) line.innerHTML = syncLine();
    drawManage();
  });
  el.querySelector('[data-act="sync-now"]')?.addEventListener('click', async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    await requestSync();
    b.disabled = false;
    const s = getState();
    toast(s.syncError ? 'Sync is paused. See the message above.' : s.offline ? 'Offline. Will sync when you’re back online.' : 'Synced with GitHub', {
      tone: s.syncError ? 'error' : '',
    });
  });
  el.querySelector('[data-act="google-import"]').addEventListener('click', () => {
    o.close(true);
    openGoogleImport();
  });
  el.querySelector('[data-act="add-device"]')?.addEventListener('click', () => {
    o.close(true);
    openAddDevice();
  });
  el.querySelector('[data-act="sign-out"]')?.addEventListener('click', () => {
    o.close(true);
    signOut();
  });

  el.querySelector('[data-act="export"]').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `taskboard-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  const fileInput = el.querySelector('input[type="file"]');
  el.querySelector('[data-act="import"]').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    let data;
    try {
      data = JSON.parse(await file.text());
      if (!Array.isArray(data?.tasks) && !Array.isArray(data?.categories)) throw new Error('not a backup');
    } catch {
      toast("That file isn't a Taskboard backup.", { tone: 'error' });
      return;
    }
    const nc = data.categories?.length || 0;
    const nt = data.tasks?.length || 0;
    o.close(true);
    const ok = await confirmDialog({
      title: 'Import backup?',
      message: `This adds ${nc} ${plural(nc, 'list')} and ${nt} ${plural(nt, 'task')}. Items that already exist here are replaced by the copy in the file.`,
      confirmLabel: 'Import',
    });
    if (!ok) return;
    const res = importData(data);
    toast(`Imported ${res.categories} ${plural(res.categories, 'list')} and ${res.tasks} ${plural(res.tasks, 'task')}`);
  });
}
