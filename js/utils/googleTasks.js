// Reads a Google Tasks export from Google Takeout (the .zip, or the Tasks.json inside it) and converts it
// into Taskboard lists and tasks. Everything happens in the browser; the file is never uploaded.
//
// Export format: { kind: "tasks#taskLists", items: [ { id, title, items: [ task… ] } ] }
// Task fields used: id, title, notes, status ("needsAction" | "completed"), due, completed, created,
// deleted, parent (subtasks), position (order), links.
import { EMOJIS, PALETTE } from '../constants.js';
import { toISO } from './dates.js';

const FFLATE_URL = 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js';

export class ImportError extends Error {}

/** Returns the parsed export, or throws ImportError with a message for the user. */
export async function readGoogleTasksFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b; // "PK"
  let text;

  if (isZip) {
    let fflate;
    try {
      fflate = await import(FFLATE_URL);
    } catch {
      throw new ImportError('Couldn’t open the .zip (are you offline?). Unzip it yourself and choose the Tasks.json file inside instead.');
    }
    let found;
    try {
      found = fflate.unzipSync(bytes, { filter: (f) => /(^|\/)tasks\.json$/i.test(f.name) });
    } catch {
      throw new ImportError('This .zip couldn’t be opened. Try downloading it from Google Takeout again.');
    }
    const name = Object.keys(found)[0];
    if (!name) throw new ImportError('This .zip has no Tasks.json in it. In Google Takeout, make sure “Tasks” is ticked, then export again.');
    text = fflate.strFromU8(found[name]);
  } else {
    text = new TextDecoder().decode(bytes);
  }

  let json;
  try {
    json = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    throw new ImportError('This file isn’t a Google Tasks export. Choose the .zip from Google Takeout, or the Tasks.json inside it.');
  }
  if (!json || !Array.isArray(json.items) || (json.kind && json.kind !== 'tasks#taskLists')) {
    throw new ImportError('This file isn’t a Google Tasks export. Choose the .zip from Google Takeout, or the Tasks.json inside it.');
  }
  return json;
}

/**
 * Google stores due dates either as the date at 00:00 UTC (API style) or as local midnight in UTC
 * (seen in Takeout, e.g. 2020-01-24T23:00:00Z for 25 January in UTC+1). Both come out as the right day.
 */
export function dueToISO(due) {
  if (!due || typeof due !== 'string') return null;
  const m = /^(\d{4}-\d{2}-\d{2})(?:T00:00:00(?:\.0+)?Z)?$/.exec(due.trim());
  if (m) return m[1];
  const d = new Date(due);
  return Number.isNaN(d.getTime()) ? null : toISO(d);
}

const time = (v) => {
  const n = Date.parse(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Converts the export into Taskboard records.
 * existingIds: ids already in Taskboard. Those lists and tasks are left untouched, so importing the same
 * export again only adds what's new and never overwrites edits made in Taskboard.
 */
export function convertGoogleTasks(json, { includeCompleted = true, existingIds = new Set(), existingListCount = 0, now = Date.now() } = {}) {
  const categories = [];
  const tasks = [];
  const lists = [];
  let skippedExisting = 0;
  let completedAvailable = 0;
  let newLists = 0;

  json.items
    .filter((l) => l && typeof l === 'object')
    .forEach((list, li) => {
      const catId = 'gt-' + (list.id || `list-${li}`);
      const name = String(list.title || '').trim().slice(0, 60) || 'Google Tasks';
      const raw = Array.isArray(list.items) ? list.items : [];
      const live = raw.filter((t) => t && typeof t === 'object' && !t.deleted && String(t.title || '').trim());

      // Order by Google's position; subtasks go right after their parent.
      const ids = new Set(live.map((t) => t.id));
      const byPosition = (a, b) => String(a.position || '').localeCompare(String(b.position || ''));
      const children = new Map();
      live.filter((t) => t.parent && ids.has(t.parent)).forEach((t) => children.set(t.parent, [...(children.get(t.parent) || []), t]));
      const ordered = [];
      live
        .filter((t) => !t.parent || !ids.has(t.parent))
        .sort(byPosition)
        .forEach((t) => {
          ordered.push(t);
          (children.get(t.id) || []).sort(byPosition).forEach((c) => ordered.push(c));
        });
      const titleById = new Map(live.map((t) => [t.id, String(t.title).trim()]));

      const open = ordered.filter((t) => t.status !== 'completed').length;
      lists.push({ id: catId, name, open, done: ordered.length - open, exists: existingIds.has(catId) });

      if (!existingIds.has(catId)) {
        const idx = existingListCount + newLists++;
        categories.push({ id: catId, name, icon: EMOJIS[idx % EMOJIS.length], color: PALETTE[idx % PALETTE.length].id, order: idx, createdAt: now });
      }

      ordered.forEach((t, i) => {
        const id = 'gt-' + (t.id || `${li}-${i}`);
        const done = t.status === 'completed';
        if (existingIds.has(id)) {
          skippedExisting++;
          return;
        }
        if (done) completedAvailable++;
        if (done && !includeCompleted) return;

        const notes = [];
        if (t.parent && titleById.has(t.parent)) notes.push(`Subtask of: ${titleById.get(t.parent)}`);
        if (t.notes) notes.push(String(t.notes).trim());
        if (Array.isArray(t.links)) {
          t.links.forEach((l) => l && l.link && notes.push(`${l.description || 'Link'}: ${l.link}`));
        }
        tasks.push({
          id,
          title: String(t.title).trim().slice(0, 500),
          notes: notes.filter(Boolean).join('\n\n'),
          categoryId: catId,
          status: done ? 'done' : 'todo',
          priority: 'none',
          tags: [],
          dueDate: dueToISO(t.due),
          focus: false,
          order: (i + 1) * 1000,
          createdAt: time(t.created) || now,
          completedAt: done ? time(t.completed) || time(t.updated) || now : null,
        });
      });
    });

  // Add a new list if it gets tasks, or if it's empty in Google too (so empty lists still come over).
  // A list whose tasks are all completed is left out when completed tasks aren't being imported.
  const used = new Set(tasks.map((t) => t.categoryId));
  const keptCategories = categories.filter((c) => {
    const l = lists.find((x) => x.id === c.id);
    return used.has(c.id) || l.open + l.done === 0;
  });

  return {
    categories: keptCategories,
    tasks,
    summary: {
      lists,
      tasks: tasks.length,
      open: tasks.filter((t) => t.status !== 'done').length,
      completed: tasks.filter((t) => t.status === 'done').length,
      completedAvailable,
      skippedExisting,
    },
  };
}
