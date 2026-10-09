const DISTRIBUTION_KEY = 'desafia-distribution-v1';
const ALLOWED = new Set(['web', 'play']);

function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage indisponível */ }
}

// Once tagged as Play, a URL parameter cannot downgrade it to web checkout.
// Defense in depth only; JavaScript cannot attest a native TWA install.
export function selectDistribution(current, incoming) {
  if (current === 'play' || incoming === 'play') return 'play';
  if (ALLOWED.has(incoming)) return incoming;
  return ALLOWED.has(current) ? current : 'web';
}

export function initDistribution() {
  const current = safeGet(DISTRIBUTION_KEY);
  let incoming = null;
  try { incoming = new URLSearchParams(location.search).get('store'); }
  catch { /* URL indisponível */ }
  const selected = selectDistribution(current, incoming);
  if (selected !== current) safeSet(DISTRIBUTION_KEY, selected);
  return selected;
}

export function distributionChannel() {
  return initDistribution();
}

export function isPlayDistribution() {
  return distributionChannel() === 'play';
}
