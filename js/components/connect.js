// Connecting a browser to GitHub sync, adding another device (QR / setup link), and disconnecting.
import { getState } from '../store.js';
import {
  clearGitHubConfig,
  DEFAULT_REPO,
  loadGitHubConfig,
  localPreviewCounts,
  migrateLocalData,
  parseSetupLink,
  saveGitHubConfig,
  setupLinkFor,
  verifyGitHub,
} from '../backend/github.js';
import { esc, plural } from '../utils/dom.js';
import { githubMark, icons } from './icons.js';
import { confirmDialog, openOverlay } from './overlay.js';
import { toast } from './toast.js';

const QR_URL = 'https://cdn.jsdelivr.net/npm/qrcode-generator@2.0.4/dist/qrcode.mjs';

/** Replaced in tests. After connecting/disconnecting, the app restarts with the new settings. */
export const connectEnv = {
  reload() {
    location.hash = '#/';
    location.reload();
  },
};

/** Reads a "#connect=…" setup link (from a QR code), clears it from the address bar, returns its details. */
export function consumeSetupLink() {
  if (!/#connect=/.test(location.hash)) return null;
  const link = parseSetupLink(location.hash);
  history.replaceState(null, '', location.pathname + location.search + '#/');
  return link || { invalid: true };
}

export function openConnect({ token = '', repo = '', fromLink = false } = {}) {
  const current = loadGitHubConfig();
  const preview = getState().mode === 'local' ? localPreviewCounts() : { tasks: 0, categories: 0 };
  const repoValue = repo || (current ? `${current.owner}/${current.repo}` : DEFAULT_REPO);

  const o = openOverlay({
    label: 'Connect GitHub',
    html: `<form class="editor connect-form" novalidate autocomplete="off">
      <div class="sheet-grabber" aria-hidden="true"></div>
      <header class="sheet-head"><h2 class="with-icon">${githubMark}<span>${current ? 'Reconnect GitHub' : 'Connect GitHub'}</span></h2>
        <button type="button" class="icon-btn" data-close aria-label="Close">${icons.x}</button></header>
      <div class="sheet-body">
        ${
          fromLink
            ? `<p class="callout ok">${icons.link}<span>Setup link opened. Check the details and tap <strong>Connect</strong>.</span></p>`
            : `<p class="muted">Sync your tasks through a <strong>private</strong> repository on your GitHub account, so every browser and device shows the same tasks. Each browser connects once.</p>
              <details class="steps"${current ? '' : ' open'}>
                <summary>First time? Set it up in 2 minutes</summary>
                <ol>
                  <li><strong>Create a private repository</strong> called <code>${DEFAULT_REPO}</code> at
                    <a href="https://github.com/new" target="_blank" rel="noopener">github.com/new</a>, choosing <em>Private</em>.</li>
                  <li><strong>Create an access token</strong> at
                    <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → Fine-grained tokens</a>:
                    <ul>
                      <li>Repository access: <em>Only select repositories</em> → <code>${DEFAULT_REPO}</code></li>
                      <li>Repository permissions → <em>Contents</em>: <em>Read and write</em></li>
                      <li>Expiration: as long as you’re comfortable with. When it expires, you just reconnect.</li>
                    </ul></li>
                  <li><strong>Copy the token</strong> (it starts with <code>github_pat_</code>) and paste it below.</li>
                </ol>
              </details>`
        }
        <label class="field"><span class="field-label">Access token</span>
          <input class="input mono" type="password" name="token" value="${esc(token)}" placeholder="github_pat_…" autocomplete="off" spellcheck="false" autocapitalize="off"></label>
        <label class="field"><span class="field-label">Private repository</span>
          <input class="input mono" name="repo" value="${esc(repoValue)}" placeholder="${DEFAULT_REPO}" autocomplete="off" spellcheck="false" autocapitalize="off"></label>
        <p class="callout error" role="alert" hidden></p>
        <div class="connect-ok" hidden></div>
        <p class="muted small with-icon">${icons.lock}<span>The token is saved only in this browser, and it can only reach that one repository.</span></p>
      </div>
      <footer class="sheet-foot"><span class="spacer"></span>
        <button type="button" class="btn btn-ghost" data-close>Cancel</button>
        <button type="submit" class="btn btn-primary" data-act="connect">Connect</button>
      </footer>
    </form>`,
  });

  const form = o.el.querySelector('form');
  const errEl = form.querySelector('.callout.error');
  const okEl = form.querySelector('.connect-ok');
  const submit = form.querySelector('[data-act="connect"]');
  let verified = null;

  function finish(v, migrate) {
    const sameRepo = current && current.owner === v.owner && current.repo === v.repo;
    if (!sameRepo) clearGitHubConfig(); // a different repo starts from a clean copy
    if (migrate) migrateLocalData();
    saveGitHubConfig({ owner: v.owner, repo: v.repo, token: v.token, login: v.login, avatar: v.avatar });
    o.close(true);
    connectEnv.reload();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (verified) {
      finish(verified, Boolean(form.elements.migrate?.checked));
      return;
    }
    errEl.hidden = true;
    submit.disabled = true;
    submit.textContent = 'Checking…';
    try {
      const v = await verifyGitHub({ token: form.elements.token.value, repo: form.elements.repo.value });
      v.token = form.elements.token.value.trim();
      if (preview.tasks > 0) {
        // This browser has tasks from preview mode: ask whether to bring them along.
        verified = v;
        okEl.hidden = false;
        okEl.innerHTML = `<p class="callout ok">${icons.checkCircle}<span>Connected to <strong>${esc(v.owner)}/${esc(v.repo)}</strong>. ${
          v.remoteTasks ? `It already has ${v.remoteTasks} ${plural(v.remoteTasks, 'task')}.` : 'It’s empty and ready for your tasks.'
        }</span></p>
          <label class="check-row"><input type="checkbox" name="migrate"${v.remoteTasks ? '' : ' checked'}>
            <span>Bring over the ${preview.tasks} ${plural(preview.tasks, 'task')} already in this browser</span></label>`;
        form.elements.token.readOnly = true;
        form.elements.repo.readOnly = true;
      } else {
        finish(v, false);
        return;
      }
    } catch (err) {
      errEl.textContent = err?.message || 'Couldn’t connect. Please try again.';
      errEl.hidden = false;
    } finally {
      submit.disabled = false;
      submit.textContent = verified ? 'Finish' : 'Connect';
    }
  });

  setTimeout(() => (token ? submit : form.elements.token).focus(), 60);
}

/** Shows a QR code + setup link that connects another device to the same repository. */
export async function openAddDevice() {
  const cfg = loadGitHubConfig();
  if (!cfg) {
    openConnect();
    return;
  }
  const url = setupLinkFor(cfg);
  const localAddress = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/.test(location.hostname);

  const o = openOverlay({
    label: 'Add another device',
    className: 'sheet-sm',
    html: `<div class="sheet-grabber" aria-hidden="true"></div>
      <header class="sheet-head"><h2>Add another device</h2><button type="button" class="icon-btn" data-close aria-label="Close">${icons.x}</button></header>
      <div class="sheet-body add-device">
        <ol class="mini-steps">
          <li>On your phone (or another computer), point the camera at this code, or open the setup link.</li>
          <li>Tap <strong>Connect</strong>. Your tasks appear in a few seconds.</li>
        </ol>
        <div class="qr-box" role="img" aria-label="QR code containing your setup link"><div class="spinner"></div></div>
        <button type="button" class="btn block" data-act="copy">${icons.link}<span>Copy setup link</span></button>
        ${
          localAddress
            ? `<p class="callout warn">${icons.alert}<span>This is a local preview address (${esc(location.host)}), so other devices can’t open it. Open this from your GitHub Pages site instead.</span></p>`
            : ''
        }
        <p class="callout warn">${icons.lock}<span>The code contains your access token. Only scan it on your own devices, and don’t share screenshots of it.</span></p>
      </div>`,
  });

  o.el.querySelector('[data-act="copy"]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Setup link copied. Open it on your other device.');
    } catch {
      toast('Couldn’t copy automatically. Scan the QR code instead.', { tone: 'error' });
    }
  });

  const box = o.el.querySelector('.qr-box');
  try {
    const { default: qrcode } = await import(QR_URL);
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  } catch (err) {
    console.warn(err);
    box.innerHTML = '<p class="muted small">Couldn’t draw the QR code (are you offline?). Use “Copy setup link” instead.</p>';
  }
}

export async function disconnectGitHub() {
  const cfg = loadGitHubConfig();
  if (!cfg) return;
  const unsynced = getState().pending;
  const res = await confirmDialog({
    title: 'Disconnect this browser?',
    message: `Your tasks stay safe in ${cfg.owner}/${cfg.repo} on GitHub. This browser forgets the token and its copy of your tasks.${
      unsynced ? ' Some recent changes haven’t synced yet and would be lost.' : ''
    }`,
    confirmLabel: 'Disconnect',
    danger: true,
  });
  if (!res) return;
  clearGitHubConfig();
  connectEnv.reload();
}
