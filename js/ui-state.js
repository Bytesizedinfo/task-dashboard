// Small bits of UI state shared between modules (kept out of app.js to avoid circular imports).
export const ui = {
  dragging: false,
  justDraggedAt: 0,
  expanded: new Set(), // keys of collapsible sections the user has opened
  requestRender: () => {},
};
