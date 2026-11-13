// "Import from Google Tasks": pick the Google Takeout export, preview what's in it, import.
import { getState, importData } from '../store.js';
import { esc, plural } from '../utils/dom.js';
import { convertGoogleTasks, ImportError, readGoogleTasksFile } from '../utils/googleTasks.js';
import { icons } from './icons.js';
import { openOverlay } from './overlay.js';
import { toast } from './toast.js';

const TAKEOUT_URL = 'https://takeout.google.com/settings/takeout/custom/tasks';

export function openGoogleImport() {
  const o = openOverlay({
    label: 'Import from Google Tasks',
    html: `<div class="sheet-grabber" aria-hidden="true"></div>
      <header class="sheet-head"><h2 class="with-icon">${icons.upload}<span>Import from Google Tasks</span></h2>
        <button type="button" class="icon-btn" data-close aria-label="Close">${icons.x}</button></header>
      <div class="sheet-body gimport">
        <div class="gi-step1">
          <p class="muted">Bring all your Google Tasks lists into Taskboard in one go. The file is read here in your browser and isn’t uploaded anywhere.</p>
          <ol class="steps-list">
            <li>Open <a href="${TAKEOUT_URL}" target="_blank" rel="noopener">Google Takeout</a>. If other products are ticked, click <strong>Deselect all</strong> and tick only <strong>Tasks</strong>.</li>
            <li>Click <strong>Next step</strong>, then <strong>Create export</strong>. Google emails you a download link, usually within a few minutes.</li>
            <li>Download the <strong>.zip</strong> and choose it below. The <code>Tasks.json</code> file inside it works too.</li>
          </ol>
          <label class="btn btn-primary block file-btn">${icons.upload}<span>Choose file…</span>
            <input type="file" accept=".zip,.json,application/zip,application/json" hidden></label>
          <p class="callout error" role="alert" hidden></p>
          <p class="muted small">Using a work or school Google account? If Takeout doesn’t list Tasks, your administrator has turned it off.</p>
        </div>
        <div class="gi-step2" hidden></div>
      </div>
      <footer class="sheet-foot" hidden>
        <button type="button" class="btn btn-ghost" data-act="back">${icons.arrowLeft}<span>Choose another file</span></button>
        <span class="spacer"></span>
        <button type="button" class="btn btn-primary" data-act="import">Import</button>
      </footer>`,
  });

  const el = o.el;
  const step1 = el.querySelector('.gi-step1');
  const step2 = el.querySelector('.gi-step2');
  const foot = el.querySelector('.sheet-foot');
  const errEl = step1.querySelector('.callout.error');
  const input = step1.querySelector('input[type="file"]');
  const importBtn = el.querySelector('[data-act="import"]');
  let exportJson = null;

  const convert = (includeCompleted) => {
    const st = getState();
    const existingIds = new Set([...st.tasks.map((t) => t.id), ...st.categories.map((c) => c.id)]);
    return convertGoogleTasks(exportJson, { includeCompleted, existingIds, existingListCount: st.categories.length });
  };

  function updateButton() {
    const includeCompleted = step2.querySelector('input[name="completed"]')?.checked ?? true;
    const n = convert(includeCompleted).summary.tasks;
    importBtn.disabled = n === 0;
    importBtn.textContent = n ? `Import ${n} ${plural(n, 'task')}` : 'Nothing new to import';
  }

  function showPreview(fileName) {
    const { summary } = convert(true);
    const listRows = summary.lists
      .map(
        (l) => `<li><span class="gi-name">${esc(l.name)}</span>
          <span class="gi-count">${l.open} open${l.done ? ` · ${l.done} done` : ''}</span>
          ${l.exists ? '<span class="chip">already here</span>' : ''}</li>`,
      )
      .join('');
    step2.innerHTML = `
      <p class="callout ok">${icons.checkCircle}<span>Found ${summary.lists.length} ${plural(summary.lists.length, 'list')} in <strong>${esc(fileName)}</strong>.</span></p>
      ${summary.lists.length ? `<ul class="gi-lists">${listRows}</ul>` : '<p class="muted">The export has no task lists.</p>'}
      ${
        summary.completedAvailable
          ? `<label class="check-row"><input type="checkbox" name="completed" checked>
              <span>Include completed tasks (${summary.completedAvailable}). They go in each list’s folded “Done” section.</span></label>`
          : ''
      }
      ${
        summary.skippedExisting
          ? `<p class="muted small">${summary.skippedExisting} ${plural(summary.skippedExisting, 'task was', 'tasks were')} imported before and will be left as ${summary.skippedExisting === 1 ? 'it is' : 'they are'}.</p>`
          : ''
      }`;
    step1.hidden = true;
    step2.hidden = false;
    foot.hidden = false;
    step2.querySelector('input[name="completed"]')?.addEventListener('change', updateButton);
    updateButton();
    importBtn.focus();
  }

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    errEl.hidden = true;
    try {
      exportJson = await readGoogleTasksFile(file);
      showPreview(file.name);
    } catch (err) {
      console.warn(err);
      errEl.textContent = err instanceof ImportError ? err.message : 'Couldn’t read that file. Choose the .zip from Google Takeout.';
      errEl.hidden = false;
    }
  });

  el.querySelector('[data-act="back"]').addEventListener('click', () => {
    exportJson = null;
    step1.hidden = false;
    step2.hidden = true;
    foot.hidden = true;
  });

  importBtn.addEventListener('click', () => {
    const includeCompleted = step2.querySelector('input[name="completed"]')?.checked ?? true;
    const { categories, tasks } = convert(includeCompleted);
    if (!tasks.length && !categories.length) return;
    importData({ categories, tasks });
    const listCount = new Set([...tasks.map((t) => t.categoryId), ...categories.map((c) => c.id)]).size;
    o.close(true);
    toast(`Imported ${tasks.length} ${plural(tasks.length, 'task')} into ${listCount} ${plural(listCount, 'list')}`);
    location.hash = '#/';
  });
}
