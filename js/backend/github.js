// GitHub sync. Your tasks live in this browser (instant, works offline) and are synced in the background
// to one file, taskboard.json, in a PRIVATE GitHub repository you own. Every sync is a commit, so GitHub
// also keeps the full history. Each browser connects once with a fine-grained access token that can only
// read and write that one repository.
//
// Sync model: every record carries `updatedAt`; deletions are kept as tombstones for 30 days so they
// reach your other browsers. Merging takes the newest version of each record ("last write wins").
import { prefs } from '../utils/dom.js';

const API = 'https://api.github.com';
export const DATA_FILE = 'taskboard.json';
export const DEFAULT_REPO = 'task-dashboard-data';
const CACHE_KEY = 'td.gh.cache.v1';
const CONFIG_PREF = 'github'; // localStorage "td.github" (never committed anywhere)
const TOMBSTONE_TTL = 30 * 86400000;

/* ---------- connection settings (this browser only) ---------- */

export function loadGitHubConfig() {
  const c = prefs.get(CONFIG_PREF, null);
  return c && c.owner && c.repo && c.token ? c : null;
}

export function saveGitHubConfig(config) {
  prefs.set(CONFIG_PREF, config);
}

export function clearGitHubConfig() {
  try {
    localStorage.removeItem('td.' + CONFIG_PREF);
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* storage unavailable */
  }
}

/* ---------- helpers ---------- */

/** UTF-8 safe base64 (GitHub's contents API uses base64). */
export function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function fromBase64(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const emptyData = () => ({ tasks: {}, categories: {} });

function deviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac OS X/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  return 'browser';
}

export class SyncError extends Error {
  /** kind: offline | auth | forbidden | ratelimit | notfound | public | conflict | other */
  constructor(message, kind = 'other') {
    super(message);
    this.kind = kind;
  }
}

/* ---------- merging ---------- */

function mergeCollection(remote, local, now) {
  const out = {};
  let localNewer = false;
  let pruned = false;
  for (const id of new Set([...Object.keys(remote), ...Object.keys(local)])) {
    const r = remote[id];
    const l = local[id];
    let pick;
    if (!l) pick = r;
    else if (!r || (l.updatedAt || 0) > (r.updatedAt || 0)) {
      pick = l;
      localNewer = true;
    } else pick = r;
    if (pick.deleted && now - (pick.updatedAt || 0) > TOMBSTONE_TTL) {
      pruned = true;
      continue;
    }
    out[id] = pick;
  }
  return { out, localNewer, pruned };
}

/** Newest version of each record wins. `localNewer`: the local side has something the remote lacks. */
export function mergeData(remote, local, now = Date.now()) {
  const t = mergeCollection(obj(remote.tasks), obj(local.tasks), now);
  const c = mergeCollection(obj(remote.categories), obj(local.categories), now);
  return { data: { tasks: t.out, categories: c.out }, localNewer: t.localNewer || c.localNewer, pruned: t.pruned || c.pruned };
}

/* ---------- GitHub API ---------- */

function client({ owner, repo, token }, fetchImpl) {
  async function call(method, path, { body, accept } = {}) {
    let res;
    try {
      res = await fetchImpl(API + path, {
        method,
        cache: 'no-store',
        headers: {
          Accept: accept || 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new SyncError('You’re offline. Changes are saved here and will sync when you’re back online.', 'offline');
    }
    if (res.status === 401) throw new SyncError('GitHub rejected the access token. It may have expired, been deleted, or been copied incompletely.', 'auth');
    if (res.status === 429 || (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0')) {
      throw new SyncError('GitHub is limiting requests for a moment. Sync will retry shortly.', 'ratelimit');
    }
    if (res.status === 403) throw new SyncError('The access token isn’t allowed to change this repository. It needs “Contents: Read and write” for it.', 'forbidden');
    return res;
  }

  const filePath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${DATA_FILE}`;

  return {
    call,
    async readFile() {
      const res = await call('GET', filePath);
      if (res.status === 404) return { data: emptyData(), sha: null, exists: false };
      if (!res.ok) throw new SyncError(`GitHub error ${res.status} while reading your tasks.`);
      const json = await res.json();
      let text;
      if (json.content && json.encoding === 'base64') text = fromBase64(json.content);
      else {
        // Files over 1 MB come without inline content.
        const raw = await call('GET', filePath, { accept: 'application/vnd.github.raw+json' });
        if (!raw.ok) throw new SyncError(`GitHub error ${raw.status} while reading your tasks.`);
        text = await raw.text();
      }
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new SyncError(`${DATA_FILE} in ${owner}/${repo} isn’t valid JSON. Restore an earlier version from its history on GitHub.`);
      }
      return { data: { tasks: obj(parsed.tasks), categories: obj(parsed.categories) }, sha: json.sha, exists: true };
    },
    /** Returns the new sha, or null when someone else wrote first (re-read and try again). */
    async writeFile(data, sha) {
      const file = { app: 'taskboard', version: 1, savedAt: new Date().toISOString(), categories: data.categories, tasks: data.tasks };
      const res = await call('PUT', filePath, {
        body: { message: `Taskboard sync from ${deviceName()}`, content: toBase64(JSON.stringify(file, null, 1) + '\n'), ...(sha ? { sha } : {}) },
      });
      if (res.status === 409 || res.status === 422) return null;
      if (res.status === 404) throw new SyncError(`Can’t find the repository ${owner}/${repo}, or the token doesn’t have access to it.`, 'notfound');
      if (!res.ok) throw new SyncError(`GitHub error ${res.status} while saving your tasks.`);
      return (await res.json()).content.sha;
    },
  };
}

/**
 * Checks a token + repository before connecting. `repo` may be "name" or "owner/name".
 * Resolves to { owner, repo, login, avatar, remoteTasks }.
 */
export async function verifyGitHub({ token, repo }, fetchImpl = (...a) => fetch(...a)) {
  token = String(token || '').trim();
  let name = String(repo || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/, '').replace(/\/+$/, '');
  if (!token) throw new SyncError('Paste your access token first.');
  if (!name) throw new SyncError('Enter the name of your private repository.');

  const probe = client({ owner: '', repo: '', token }, fetchImpl);
  let login = '';
  let avatar = '';
  const ures = await probe.call('GET', '/user');
  if (ures.ok) {
    const u = await ures.json();
    login = u.login || '';
    avatar = u.avatar_url || '';
  }
  let owner = login;
  if (name.includes('/')) [owner, name] = name.split('/').map((s) => s.trim());
  if (!owner) throw new SyncError('Enter the repository as owner/name (for example yourname/task-dashboard-data).');

  const c = client({ owner, repo: name, token }, fetchImpl);
  const rres = await c.call('GET', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`);
  if (rres.status === 404) {
    throw new SyncError(`Can’t find ${owner}/${name}. Check the name, and that the token was given access to this repository.`, 'notfound');
  }
  if (!rres.ok) throw new SyncError(`GitHub error ${rres.status} while checking the repository.`);
  const info = await rres.json();
  if (!info.private) {
    throw new SyncError(
      `${owner}/${name} is public, so anyone could read your tasks. Make it private on GitHub (repository Settings → Change visibility) or use a new private repository.`,
      'public',
    );
  }
  const file = await c.readFile();
  const remoteTasks = Object.values(file.data.tasks).filter((t) => !t.deleted).length;
  return { owner, repo: name, login: login || owner, avatar, remoteTasks };
}

/* ---------- moving preview-mode tasks into the GitHub cache ---------- */

/** How many tasks/lists this browser has from preview mode (before connecting). */
export function localPreviewCounts() {
  try {
    const d = JSON.parse(localStorage.getItem('td.local.v1') || 'null');
    return { tasks: Object.keys(obj(d?.tasks)).length, categories: Object.keys(obj(d?.categories)).length };
  } catch {
    return { tasks: 0, categories: 0 };
  }
}

/**
 * Copies preview-mode data into the sync cache so the first sync uploads it.
 * Records get updatedAt = 1 (the oldest possible), so anything already in GitHub with the same id wins.
 */
export function migrateLocalData(cacheKey = CACHE_KEY) {
  try {
    const d = JSON.parse(localStorage.getItem('td.local.v1') || 'null');
    if (!d) return 0;
    const cache = JSON.parse(localStorage.getItem(cacheKey) || 'null') || {};
    let n = 0;
    for (const kind of ['tasks', 'categories']) {
      cache[kind] = obj(cache[kind]);
      for (const [id, rec] of Object.entries(obj(d[kind]))) {
        if (!cache[kind][id]) {
          cache[kind][id] = { ...rec, id, updatedAt: 1 };
          if (kind === 'tasks') n++;
        }
      }
    }
    cache.dirty = true;
    localStorage.setItem(cacheKey, JSON.stringify(cache));
    localStorage.removeItem('td.local.v1'); // moved; don't show it again in preview mode later
    return n;
  } catch (err) {
    console.warn('Could not move preview tasks', err);
    return 0;
  }
}

/* ---------- setup link / QR for adding another device ---------- */

const b64url = (s) => toBase64(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => fromBase64(s.replace(/-/g, '+').replace(/_/g, '/'));

export function setupLinkFor({ owner, repo, token }, base = location.origin + location.pathname) {
  return `${base}#connect=${b64url(JSON.stringify({ o: owner, r: repo, t: token }))}`;
}

export function parseSetupLink(hash) {
  const m = /#connect=([A-Za-z0-9_-]+)/.exec(hash || '');
  if (!m) return null;
  try {
    const v = JSON.parse(unb64url(m[1]));
    return v && v.o && v.r && v.t ? { owner: String(v.o), repo: String(v.r), token: String(v.t) } : null;
  } catch {
    return null;
  }
}

/* ---------- the backend ---------- */

/**
 * Same interface as the local backend (start/stop/put/patch/remove/batch) plus syncNow().
 * opts.fetchImpl / cacheKey / debounceMs / pollMs / autoTriggers exist for testing.
 */
export function createGitHubBackend(config, opts = {}) {
  const { fetchImpl = (...a) => fetch(...a), cacheKey = CACHE_KEY, debounceMs = 1500, pollMs = 60000, autoTriggers = true } = opts;
  const gh = client(config, fetchImpl);

  let cache = loadCache();
  let onData = null;
  let syncing = null; // promise of the running sync
  let again = false;
  let timer = null;
  let poll = null;
  let lastAttempt = 0;
  let syncError = null;
  let offline = false;
  let emitQueued = false;

  function loadCache() {
    try {
      const c = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      return { tasks: obj(c?.tasks), categories: obj(c?.categories), sha: c?.sha || null, lastSynced: Number(c?.lastSynced) || 0, dirty: Boolean(c?.dirty) };
    } catch {
      return { ...emptyData(), sha: null, lastSynced: 0, dirty: false };
    }
  }

  function save() {
    try {
      localStorage.setItem(cacheKey, JSON.stringify(cache));
    } catch (err) {
      console.warn('Could not save to this browser', err);
    }
  }

  const live = (coll) => Object.values(coll).filter((r) => !r.deleted);

  function emit() {
    if (emitQueued) return;
    emitQueued = true;
    queueMicrotask(() => {
      emitQueued = false;
      onData?.({
        tasks: live(cache.tasks),
        categories: live(cache.categories),
        synced: cache.lastSynced > 0,
        pending: cache.dirty || Boolean(syncing),
        syncError: syncError ? syncError.message : null,
        syncErrorKind: syncError ? syncError.kind : null,
        offline,
        lastSynced: cache.lastSynced,
      });
    });
  }

  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(() => sync(), ms);
  }

  function commit(ops) {
    try {
      for (const o of ops) {
        if (o.op === 'patch' && (!cache[o.kind][o.id] || cache[o.kind][o.id].deleted)) {
          throw Object.assign(new Error('That item no longer exists.'), { code: 'not-found' });
        }
      }
      const now = Date.now();
      for (const o of ops) {
        const coll = cache[o.kind];
        if (o.op === 'put') coll[o.id] = { ...o.data, id: o.id, updatedAt: now };
        else if (o.op === 'patch') coll[o.id] = { ...coll[o.id], ...o.data, updatedAt: now };
        else coll[o.id] = { id: o.id, deleted: true, updatedAt: now };
      }
      cache.dirty = true;
      save();
      emit();
      schedule(debounceMs);
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async function runSync() {
    lastAttempt = Date.now();
    emit();
    try {
      let done = false;
      for (let attempt = 0; attempt < 4 && !done; attempt++) {
        const remote = await gh.readFile();
        const m = mergeData(remote.data, cache);
        let sha = remote.sha;
        if (m.localNewer || m.pruned) {
          const newSha = await gh.writeFile(m.data, remote.sha);
          if (!newSha) continue; // another browser saved first: read again and re-merge
          sha = newSha;
        }
        // Keep anything edited while we were talking to GitHub; it goes up in a follow-up sync.
        const after = mergeData(m.data, cache);
        cache.tasks = after.data.tasks;
        cache.categories = after.data.categories;
        cache.sha = sha;
        cache.lastSynced = Date.now();
        cache.dirty = after.localNewer;
        if (after.localNewer) again = true;
        done = true;
      }
      if (!done) throw new SyncError('Couldn’t save after several tries because another device kept saving. Retrying shortly.', 'conflict');
      syncError = null;
      offline = false;
    } catch (err) {
      if (err instanceof SyncError && err.kind === 'offline') offline = true;
      else {
        syncError = err instanceof SyncError ? err : new SyncError(err?.message || 'Sync failed.');
        console.warn('Sync failed:', err);
        if (syncError.kind === 'ratelimit' || syncError.kind === 'conflict') schedule(30000);
      }
    } finally {
      save();
    }
  }

  /** Runs one sync at a time; a request during a sync triggers one more afterwards. */
  function sync({ force = false } = {}) {
    if (syncing) {
      again = true;
      return syncing;
    }
    // With a rejected token, don't keep hammering GitHub; wait for "Sync now" or a reconnect.
    if (!force && syncError && ['auth', 'forbidden', 'notfound'].includes(syncError.kind)) return Promise.resolve();
    syncing = runSync().finally(() => {
      syncing = null;
      emit();
      if (again) {
        again = false;
        schedule(300);
      }
    });
    return syncing;
  }

  // Another tab of this app saved: merge its copy in (newest wins), so neither tab loses edits.
  const onStorage = (e) => {
    if (e.key !== cacheKey || !e.newValue) return;
    const other = loadCache();
    const m = mergeData(other, cache);
    cache.tasks = m.data.tasks;
    cache.categories = m.data.categories;
    if (other.lastSynced > cache.lastSynced) {
      cache.lastSynced = other.lastSynced;
      cache.sha = other.sha;
    }
    emit();
  };
  const onVisibility = () => {
    if (document.hidden) {
      if (cache.dirty) sync();
    } else if (cache.dirty || Date.now() - lastAttempt > 5000) sync();
  };
  const onOnline = () => sync();

  return {
    mode: 'github',
    start(cb) {
      onData = cb;
      emit();
      sync();
      if (autoTriggers) {
        poll = setInterval(() => !document.hidden && sync(), pollMs);
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('focus', onVisibility);
        window.addEventListener('online', onOnline);
        window.addEventListener('storage', onStorage);
      }
    },
    stop() {
      onData = null;
      clearTimeout(timer);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('storage', onStorage);
    },
    syncNow: () => sync({ force: true }),
    put: (kind, id, data) => commit([{ op: 'put', kind, id, data }]),
    patch: (kind, id, data) => commit([{ op: 'patch', kind, id, data }]),
    remove: (kind, id) => commit([{ op: 'remove', kind, id }]),
    batch: (ops) => commit(ops),
  };
}
