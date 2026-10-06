export function isQAEnabled(allowed, search) {
  return allowed === true && new URLSearchParams(search).get('qa') === '1';
}

export function scopedQAStorage(storage) {
  const prefix = 'desafia-qa-v1:';
  return {
    getItem: (key) => storage.getItem(prefix + key),
    setItem: (key, value) => storage.setItem(prefix + key, value),
    removeItem: (key) => storage.removeItem(prefix + key),
    clear() {
      for (let i = storage.length - 1; i >= 0; i -= 1) {
        const key = storage.key(i);
        if (key?.startsWith(prefix)) storage.removeItem(key);
      }
    }
  };
}

export const qaEnabled = typeof __DESAFIA_QA_ALLOWED__ !== 'undefined'
  && isQAEnabled(__DESAFIA_QA_ALLOWED__, globalThis.location?.search || '');
export const uiStorage = qaEnabled ? scopedQAStorage(sessionStorage) : globalThis.localStorage;
