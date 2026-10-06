import test from 'node:test';
import assert from 'node:assert/strict';
import { createNotifications, initializeNotificationsSDK } from '../src/shared/notifications.js';
import { createNotificationHandler, notificationContent } from '../supabase/functions/desafia-notifications/delivery.js';

const opaque = '8b16c29d-15e1-48ab-9d19-a82e43cd3caf';
const item = { id: 'ce775cfb-7df0-4bbe-8cb4-0fe36450ccbb', claim_token: opaque, external_id: opaque, event_type: 'mission_waiting_approval', mission_count: 3 };
function browser({ granted = true, supported = true } = {}) {
  const calls = [], values = new Map();
  const subscription = { optedIn: false, id: null,
    async optIn() { calls.push('optIn'); this.optedIn = true; this.id = opaque; },
    async optOut() { calls.push('optOut'); this.optedIn = false; this.id = null; } };
  const sdk = { Notifications: { permission: false, permissionNative: 'default', isPushSupported: () => supported,
    async requestPermission() { calls.push('permission'); this.permission = granted; this.permissionNative = granted ? 'granted' : 'denied'; return granted; } },
    User: { PushSubscription: subscription }, async setConsentGiven(v) { calls.push(['consent', v]); },
    async login(v) { calls.push(['login', v]); }, async logout() { calls.push('logout'); } };
  const api = createNotifications({ load: async () => { calls.push('load'); return sdk; },
    storage: { getItem: (k) => values.get(k), setItem: (k, v) => values.set(k, v), removeItem: (k) => values.delete(k) } });
  return { api, calls, sdk };
}
const explicit = { consent: true, enabled: true, interaction: true };
test('SDK never loads or prompts without enabled, consent AND explicit interaction', async () => {
  const { api, calls } = browser();
  for (const missing of ['enabled', 'consent', 'interaction']) assert.equal(await api.activate(opaque, 'child_device', { ...explicit, [missing]: false }), false);
  assert.equal(await api.activate('child-name', 'child_device', explicit), false);
  assert.equal(await api.restore(opaque, 'child_device'), false);
  assert.deepEqual(calls, []);
});
test('explicit consent precedes permission, opaque login and opt-in; restore never prompts', async () => {
  const { api, calls } = browser();
  assert.equal(await api.activate(opaque, 'child_device', explicit), true);
  assert.deepEqual(calls, ['load', ['consent', true], 'permission', ['login', opaque], 'optIn']);
  calls.length = 0;
  assert.equal(await api.restore(opaque, 'child_device'), true);
  assert.deepEqual(calls, ['load', ['consent', true]]);
  await api.logout();
  assert.deepEqual(calls.slice(-3), ['optOut', 'logout', ['consent', false]]);
  assert.equal(api.remembered(), null);
});
test('denied or unsupported push never logs in or reports an active subscription', async () => {
  for (const config of [{ granted: false }, { supported: false }]) {
    const { api, calls } = browser(config);
    assert.equal(await api.activate(opaque, 'parent', explicit), false);
    assert.equal(api.state().active, false);
    assert.equal(api.remembered(), null);
    assert.equal(calls.some((c) => Array.isArray(c) && c[0] === 'login'), false);
  }
});
test('unavailable SDK and capability fail closed without breaking the app', async () => {
  const api = createNotifications({ load: async () => { throw new Error('CSP'); } });
  assert.equal(await api.activate(opaque, 'child_device', explicit), false);
  assert.equal(await api.available({ functions: { invoke: async () => { throw new Error('offline'); } } }), false);
  assert.equal(await api.available({ functions: { invoke: async () => ({ data: { enabled: 'true' } }) } }), false);
});
test('a different device/parent identity clears old local consent without prompting', async () => {
  const { api, calls } = browser();
  await api.activate(opaque, 'child_device', explicit); calls.length = 0;
  assert.equal(await api.restore('9b16c29d-15e1-48ab-9d19-a82e43cd3caf', 'parent'), false);
  assert.equal(calls.includes('permission'), false);
  assert.equal(api.remembered(), null);
});

function backend(overrides = {}) {
  const calls = [], requests = [];
  const settings = { DESAFIA_PUSH_ENABLED: 'true', DESAFIA_ONESIGNAL_APP_ID: opaque,
    DESAFIA_ONESIGNAL_REST_API_KEY: 'test-only-key', SUPABASE_SERVICE_ROLE_KEY: 'test-only-service', ...overrides };
  const handler = createNotificationHandler({ env: (k) => settings[k],
    rpc: async (name, args) => { calls.push({ name, args }); return name === 'notification_claim' ? [item] : name === 'notification_validate_claim' ? true : null; },
    request: async (url, options) => { requests.push({ url, options }); return Response.json({ id: 'vendor-message' }); } });
  return { handler, calls, requests };
}
const req = (action = 'process', auth = 'test-only-service') => new Request('https://local.invalid/', { method: 'POST', headers: { authorization: `Bearer ${auth}` }, body: JSON.stringify({ action }) });
test('disabled values never access the database/vendor and never mark sent', async () => {
  for (const disabled of [undefined, '', 'false', 'TRUE', '1']) {
    const { handler, calls, requests } = backend({ DESAFIA_PUSH_ENABLED: disabled });
    assert.equal((await (await handler(req())).json()).status, 'push_disabled');
    assert.equal((await (await handler(req('status', 'public'))).json()).enabled, false);
    assert.deepEqual(calls, []); assert.deepEqual(requests, []);
  }
});
test('processing requires internal service credential; public status has no credentials', async () => {
  const { handler, calls, requests } = backend();
  assert.equal((await handler(req('process', 'anon'))).status, 401);
  assert.deepEqual(await (await handler(req('status', 'public'))).json(), { enabled: true, status: 'available' });
  assert.deepEqual(calls, []); assert.deepEqual(requests, []);
  const missing = backend({ DESAFIA_ONESIGNAL_REST_API_KEY: '' });
  assert.equal((await (await missing.handler(req('status'))).json()).enabled, false);
  assert.equal((await missing.handler(req())).status, 503);
  assert.deepEqual(missing.requests, []);
});
test('delivery targets only opaque aliases, uses stable idempotency and positive aggregated text', async () => {
  const { handler, calls, requests } = backend();
  assert.equal((await (await handler(req())).json()).sent, 1);
  const { url, options } = requests[0];
  assert.equal(url, 'https://api.onesignal.com/notifications');
  assert.equal(options.headers.Authorization, 'Key test-only-key');
  const payload = JSON.parse(options.body);
  assert.deepEqual(payload.include_aliases, { external_id: [opaque] });
  assert.equal(payload.idempotency_key, item.id);
  assert.equal(payload.headings.pt, '🌟 Há 3 missões esperando sua aprovação');
  assert.equal(payload.url, 'https://desafia.app/pais/');
  assert.equal('tags' in payload, false); assert.equal('email' in payload, false);
  assert.deepEqual(calls.map((c) => c.name), ['notification_prepare', 'notification_claim', 'notification_validate_claim', 'notification_complete']);
  assert.equal(calls.at(-1).args.p_sent, true);
});
test('revoked claim is skipped immediately before HTTP', async () => {
  const calls = [];
  const handler = createNotificationHandler({ env: (k) => ({ DESAFIA_PUSH_ENABLED: 'true', DESAFIA_ONESIGNAL_APP_ID: opaque, DESAFIA_ONESIGNAL_REST_API_KEY: 'test', SUPABASE_SERVICE_ROLE_KEY: 'test-only-service' })[k],
    rpc: async (name, args) => { calls.push({ name, args }); return name === 'notification_claim' ? [item] : false; },
    request: async () => { assert.fail('must not call vendor'); } });
  assert.equal((await (await handler(req())).json()).sent, 0);
  assert.equal(calls.at(-1).args.p_error, 'no_longer_eligible');
});
test('transient HTTP/network failures retry without exposing vendor bodies', async () => {
  for (const status of [429, 503, 'network']) {
    let completion;
    const handler = createNotificationHandler({ env: (k) => ({ DESAFIA_PUSH_ENABLED: 'true', DESAFIA_ONESIGNAL_APP_ID: opaque, DESAFIA_ONESIGNAL_REST_API_KEY: 'test', SUPABASE_SERVICE_ROLE_KEY: 'test-only-service' })[k],
      rpc: async (name, args) => { if (name === 'notification_complete') completion = args; return name === 'notification_claim' ? [item] : true; },
      request: async () => { if (status === 'network') throw new Error('sensitive body'); return Response.json({ errors: ['sensitive body'] }, { status }); } });
    assert.equal((await (await handler(req())).json()).failed, 1);
    assert.equal(completion.p_retry, true); assert.equal(completion.p_sent, false);
    assert.equal(JSON.stringify(completion).includes('sensitive'), false);
  }
});
test('child and summary copy contains no child PII and links to the right app', () => {
  assert.equal(notificationContent({ event_type: 'child_reminder', nickname: 'private' }).url, 'https://desafia.app/');
  assert.equal(JSON.stringify(notificationContent({ event_type: 'child_reminder', nickname: 'private' })).includes('private'), false);
  assert.equal(notificationContent({ event_type: 'parent_daily_summary' }).url, 'https://desafia.app/pais/');
});


test('SDK init forces privacy first and fails closed if dashboard enables automatic prompts or wrong scope', async () => {
  for (const unsafe of [null, { autoResubscribe: true }, { promptOptions: { autoPrompt: true } },
    { notifyButton: { enable: true } }, { serviceWorkerParam: { scope: '/' } }]) {
    const calls = [];
    const sdk = { async setConsentRequired(v) { calls.push(['required', v]); },
      async setConsentGiven(v) { calls.push(['given', v]); },
      async init(options) { calls.push('init'); this.config = { userConfig: unsafe ? { ...options, ...unsafe } : options }; } };
    if (unsafe) await assert.rejects(initializeNotificationsSDK(sdk, opaque), /unsafe_push_configuration/);
    else await initializeNotificationsSDK(sdk, opaque);
    assert.deepEqual(calls, [['required', true], ['given', false], 'init']);
    // No consent release, permission, login, registration or opt-in during init.
  }
});


test('native opt-out fallback affects only the OneSignal registration, never the PWA worker', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    for (const scope of ['https://local.invalid/', 'https://local.invalid/onesignal/']) {
      let unsubscribed = false;
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { serviceWorker: {
        getRegistration: async (path) => { assert.equal(path, '/onesignal/'); return { scope, pushManager: {
          getSubscription: async () => ({ unsubscribe: async () => { unsubscribed = true; } }) } }; }
      } } });
      const { api } = browser(); await api.optOut();
      assert.equal(unsubscribed, scope.endsWith('/onesignal/'));
    }
  } finally { if (original) Object.defineProperty(globalThis, 'navigator', original); else delete globalThis.navigator; }
});
