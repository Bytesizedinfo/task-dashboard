/**
 * Circular meter: one ratio against a limit (list progress, daily goal).
 * The track is a lighter step of the same colour (--accent), so the state reads around the whole ring.
 */
export function ring(pct, { label = `${Math.round(pct * 100)}%`, cls = '', title = '' } = {}) {
  const p = Math.max(0, Math.min(1, pct || 0));
  const r = 18;
  const c = 2 * Math.PI * r;
  return `<span class="ring-wrap ${cls}"${title ? ` title="${title}"` : ''} aria-hidden="true">
    <svg class="ring" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r="${r}" class="ring-track"/>
      <circle cx="22" cy="22" r="${r}" class="ring-fill" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - p)).toFixed(2)}"${p === 0 ? ' opacity="0"' : ''}/>
    </svg>
    <span class="ring-label">${label}</span>
  </span>`;
}
