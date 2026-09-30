const DISTRIBUTION_KEY = 'desafia-distribution-v1';
const ALLOWED = new Set(['web', 'play']);

function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage indisponível */ }
}

export function initDistribution() {
  let current = safeGet(DISTRIBUTION_KEY);
  try {
    const incoming = new URLSearchParams(location.search).get('store');
    if (incoming && ALLOWED.has(incoming)) {
      current = incoming;
      safeSet(DISTRIBUTION_KEY, incoming);
    }
  } catch { /* URL indisponível */ }
  return ALLOWED.has(current) ? current : 'web';
}

export function distributionChannel() {
  return initDistribution();
}

export function isPlayDistribution() {
  return distributionChannel() === 'play';
}
