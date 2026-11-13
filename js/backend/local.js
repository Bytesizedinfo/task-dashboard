// Preview-mode backend: keeps everything in this browser's localStorage.
// Same interface as the Firestore backend, so the rest of the app doesn't care which one is used.
const KEY = 'td.local.v1';

export function createLocalBackend() {
  let data = load();
  let onData = null;
  let queued = false;

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      return { tasks: d?.tasks || {}, categories: d?.categories || {} };
    } catch {
      return { tasks: {}, categories: {} };
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (err) {
      console.warn('Could not save to this browser', err);
    }
  }

  function emit() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      onData?.({ tasks: Object.values(data.tasks), categories: Object.values(data.categories), synced: true, pending: false });
    });
  }

  function apply(o) {
    const coll = data[o.kind];
    if (o.op === 'put') coll[o.id] = { ...o.data, id: o.id };
    else if (o.op === 'patch') {
      if (!coll[o.id]) throw Object.assign(new Error('That item no longer exists.'), { code: 'not-found' });
      coll[o.id] = { ...coll[o.id], ...o.data };
    } else delete coll[o.id];
  }

  function commit(ops) {
    try {
      ops.forEach(apply);
      save();
      emit();
      return Promise.resolve();
    } catch (err) {
      data = load();
      emit();
      return Promise.reject(err);
    }
  }

  // Keep other open tabs in sync.
  const onStorage = (e) => {
    if (e.key === KEY) {
      data = load();
      emit();
    }
  };

  return {
    mode: 'local',
    start(cb) {
      onData = cb;
      window.addEventListener('storage', onStorage);
      emit();
    },
    stop() {
      onData = null;
      window.removeEventListener('storage', onStorage);
    },
    put: (kind, id, d) => commit([{ op: 'put', kind, id, data: d }]),
    patch: (kind, id, d) => commit([{ op: 'patch', kind, id, data: d }]),
    remove: (kind, id) => commit([{ op: 'remove', kind, id }]),
    batch: (ops) => commit(ops),
  };
}
