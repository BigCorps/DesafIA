const PUBLIC_APP_ID = '8c98389d-9805-467a-977a-7ea66a153d01';
const LOCAL_KEY = 'desafia-push-consent-v1';
let sdkPromise;

function supportsPush() {
  return globalThis.isSecureContext && 'Notification' in globalThis && 'serviceWorker' in navigator && 'PushManager' in globalThis;
}
function loadSDK(appId) {
  if (!sdkPromise) sdkPromise = new Promise((resolve) => {
    if (!supportsPush()) { resolve(null); return; }
    let finished = false;
    const finish = (sdk) => { if (!finished) { finished = true; clearTimeout(timer); resolve(sdk); } };
    const timer = setTimeout(() => finish(null), 12000);
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (sdk) => {
      if (finished) return;
      try {
        await initializeNotificationsSDK(sdk, appId);
        finish(sdk);
      } catch { finish(null); }
    });
    const script = document.createElement('script');
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    script.async = true; script.onerror = () => finish(null);
    document.head.appendChild(script);
  });
  return sdkPromise;
}

// v16's 'typical' integration can override JS options with dashboard values.
// Public privacy APIs keep init suspended until the merged config is inspected.
export async function initializeNotificationsSDK(sdk, appId) {
  await sdk.setConsentRequired(true);
  await sdk.setConsentGiven(false);
  await sdk.init({ appId, requiresUserPrivacyConsent: true, autoResubscribe: false,
    serviceWorkerPath: '/onesignal/OneSignalSDKWorker.js', serviceWorkerParam: { scope: '/onesignal/' },
    serviceWorkerOverrideForTypical: true, notifyButton: { enable: false },
    promptOptions: { autoPrompt: false, native: { enabled: false, autoPrompt: false }, slidedown: { prompts: [{ type: 'push', autoPrompt: false }] } } });
  // Read-only check of v16's exposed merged configuration; never patch SDK internals.
  // If its contract changes or dashboard enables prompts, fail closed before consent.
  const config = sdk.config?.userConfig;
  if (!config || config.autoResubscribe !== false || config.promptOptions?.autoPrompt !== false
    || config.promptOptions?.native?.autoPrompt || config.promptOptions?.slidedown?.prompts?.some((p) => p.autoPrompt)
    || config.notifyButton?.enable !== false || config.serviceWorkerPath !== '/onesignal/OneSignalSDKWorker.js'
    || config.serviceWorkerParam?.scope !== '/onesignal/') throw new Error('unsafe_push_configuration');
}

// Dependency injection keeps browser consent behavior independently testable.
export function createNotifications({ load = loadSDK, storage = globalThis.localStorage, now = Date.now,
  appId = import.meta.env?.VITE_ONESIGNAL_APP_ID || PUBLIC_APP_ID } = {}) {
  let sdk = null;
  const capabilities = new WeakMap();
  const remembered = () => { try { return JSON.parse(storage.getItem(LOCAL_KEY) || 'null'); } catch { return null; } };
  const remember = (identity) => storage.setItem(LOCAL_KEY, JSON.stringify(identity));
  const state = () => ({ supported: Boolean(sdk), permission: sdk?.Notifications.permissionNative || globalThis.Notification?.permission || 'default',
    active: Boolean(sdk?.Notifications.permission && sdk?.User.PushSubscription.optedIn && sdk?.User.PushSubscription.id) });
  async function optOut() {
    try {
      if (!sdk && remembered()) sdk = await load(appId);
      if (sdk) { await sdk.User.PushSubscription.optOut(); await sdk.logout(); await sdk.setConsentGiven(false); }
    } catch { /* Vendor/CSP/unavailable browser must not affect the app. */ }
    finally {
      try { storage.removeItem(LOCAL_KEY); } catch { /* unavailable storage */ }
      // If CSP/vendor failure prevented SDK opt-out, unsubscribe only its own
      // registration. Never touch the PWA registration at scope '/'.
      try {
        const registration = await globalThis.navigator?.serviceWorker?.getRegistration('/onesignal/');
        if (registration && new URL(registration.scope).pathname === '/onesignal/') {
          const subscription = await registration.pushManager.getSubscription();
          await subscription?.unsubscribe();
        }
      } catch { /* Native push may also be unavailable/offline. */ }
    }
  }
  return {
    state, remembered,
    async available(sb) {
      if (!sb) return false;
      const cached = capabilities.get(sb);
      if (cached && now() < cached.expires) return cached.promise;
      const promise = (async () => {
        try { const { data, error } = await sb.functions.invoke('desafia-notifications', { body: { action: 'status' } }); return !error && data?.configured === true; }
        catch { return false; }
      })();
      capabilities.set(sb, { promise, expires: now() + 5 * 60 * 1000 });
      return promise;
    },
    async activate(externalId, kind, { consent, enabled, interaction } = {}) {
      if (consent !== true || enabled !== true || interaction !== true || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(externalId || '')) return false;
      try {
        sdk = await load(appId); if (!sdk || !sdk.Notifications.isPushSupported()) return false;
        await sdk.setConsentGiven(true);
        const allowed = sdk.Notifications.permission || await sdk.Notifications.requestPermission();
        if (!allowed) { await optOut(); return false; }
        await sdk.login(externalId);
        await sdk.User.PushSubscription.optIn();
        // v16 subscription ID may arrive asynchronously. Do not claim active yet.
        for (let attempt = 0; attempt < 20 && !state().active; attempt++) await new Promise((r) => setTimeout(r, 100));
        if (!state().active) { await optOut(); return false; }
        remember({ externalId, kind });
        return true;
      } catch { await optOut(); return false; }
    },
    async restore(externalId, kind) {
      const previous = remembered();
      if (previous?.externalId !== externalId || previous.kind !== kind) { if (previous) await optOut(); return false; }
      try { sdk = await load(appId); if (!sdk) return false; await sdk.setConsentGiven(true); return state().active; } catch { return false; }
    },
    optOut, logout: optOut
  };
}

export const notifications = createNotifications();
