export const PALETTE = [
  { id: 'violet', label: 'Violet', hex: '#8b5cf6' },
  { id: 'cyan', label: 'Cyan', hex: '#22d3ee' },
  { id: 'emerald', label: 'Emerald', hex: '#34d399' },
  { id: 'amber', label: 'Amber', hex: '#fbbf24' },
  { id: 'rose', label: 'Rose', hex: '#fb7185' },
  { id: 'blue', label: 'Blue', hex: '#60a5fa' },
  { id: 'pink', label: 'Pink', hex: '#f472b6' },
  { id: 'lime', label: 'Lime', hex: '#a3e635' },
];

export const PALETTE_IDS = PALETTE.map((p) => p.id);

export function colorHex(id) {
  return (PALETTE.find((p) => p.id === id) || PALETTE[0]).hex;
}

export const EMOJIS = ['💼', '🏠', '💡', '🎯', '📚', '💪', '🛒', '✈️', '💰', '🎨', '🧘', '💻', '📞', '🎉', '🌱', '☕'];

export const STATUSES = [
  { id: 'todo', label: 'To do' },
  { id: 'doing', label: 'In progress' },
  { id: 'done', label: 'Done' },
];
export const STATUS_IDS = STATUSES.map((s) => s.id);

// Display order for the priority picker (lowest to highest).
export const PRIORITIES = [
  { id: 'none', label: 'None' },
  { id: 'low', label: 'Low' },
  { id: 'med', label: 'Medium' },
  { id: 'high', label: 'High' },
];
export const PRIORITY_IDS = PRIORITIES.map((p) => p.id);
export const PRIORITY_RANK = { high: 0, med: 1, low: 2, none: 3 };
export const PRIORITY_LABEL = Object.fromEntries(PRIORITIES.map((p) => [p.id, p.label]));

// Starter lists, created on first sign-in. Fixed IDs so two devices can't create duplicates.
export const SEED_CATEGORIES = [
  { id: 'work', name: 'Work', icon: '💼', color: 'violet', order: 0 },
  { id: 'personal', name: 'Personal', icon: '🏠', color: 'cyan', order: 1 },
  { id: 'ideas', name: 'Ideas', icon: '💡', color: 'amber', order: 2 },
];
