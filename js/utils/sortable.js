// Loads SortableJS (drag-and-drop with touch support) once, on first use.
const SORTABLE_URL = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.7/modular/sortable.esm.js';
let loading = null;

export function loadSortable() {
  if (!loading) {
    loading = import(SORTABLE_URL)
      .then((m) => m.default)
      .catch((err) => {
        loading = null; // allow a retry later (e.g. when back online)
        throw err;
      });
  }
  return loading;
}
