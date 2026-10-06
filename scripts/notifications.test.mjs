import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createChildNotificationUI } from '../src/game/notifications.js';
import { renderNotifications, saveParentNotificationPreferences } from '../src/pais/notifications.js';
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
  assert.equal(await api.available({ functions: { invoke: async () => ({ data: { configured: 'true' } }) } }), false);
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
    assert.deepEqual(await (await handler(req('status', 'public'))).json(), { configured: true, delivery_enabled: false, status: 'push_disabled' });
    assert.deepEqual(calls, []); assert.deepEqual(requests, []);
  }
});
test('processing requires internal service credential; public status has no credentials', async () => {
  const { handler, calls, requests } = backend();
  assert.equal((await handler(req('process', 'anon'))).status, 401);
  assert.deepEqual(await (await handler(req('status', 'public'))).json(), { configured: true, delivery_enabled: true, status: 'available' });
  assert.deepEqual(calls, []); assert.deepEqual(requests, []);
  const missing = backend({ DESAFIA_ONESIGNAL_REST_API_KEY: '' });
  assert.equal((await (await missing.handler(req('status'))).json()).configured, false);
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


test('configured with delivery disabled permits explicit frontend subscription and caches capability for five minutes', async () => {
  let time = 0, probes = 0;
  const { sdk } = browser();
  const api = createNotifications({ load: async () => sdk, now: () => time,
    storage: { getItem: () => null, setItem() {}, removeItem() {} } });
  const sb = { functions: { invoke: async () => { probes++; return { data: { configured: true, delivery_enabled: false } }; } } };
  assert.deepEqual(await Promise.all(Array.from({ length: 10 }, () => api.available(sb))), Array(10).fill(true));
  assert.equal(probes, 1);
  assert.equal(await api.activate(opaque, 'child_device', { ...explicit, enabled: await api.available(sb) }), true);
  time = 299999; await api.available(sb); assert.equal(probes, 1);
  time = 300000; await api.available(sb); assert.equal(probes, 2);
});
test('rapid child refreshes do not repeat remote checks or unchanged subscription writes; visibility has a minimum interval', async () => {
  let time = 0, reads = 0, status = 0, writes = 0, optedOut = 0, authorized = true;
  const api = { kind: 'cloud', notificationState: async () => { reads++; return { authorized, external_id: opaque, push_active: true }; }, notificationSubscription: async () => { writes++; } };
  const notify = { available: async () => { status++; return true; }, restore: async () => true,
    remembered: () => ({ kind: 'child_device' }), optOut: async () => { optedOut++; } };
  const ui = createChildNotificationUI({}, { notify, now: () => time });
  for (let i = 0; i < 10; i++) { time = i * 8000; await ui.refresh(api); }
  assert.equal(reads, 1); assert.equal(status, 1); assert.equal(writes, 0);
  time = 180000; await ui.refresh(api); assert.equal(reads, 2);
  time = 180001; await ui.refresh(api, { visible: true }); assert.equal(reads, 2);
  time = 240000; authorized = false; await ui.refresh(api, { visible: true });
  assert.equal(reads, 3); assert.equal(optedOut, 1); assert.equal(writes, 0);
});
test('parent UI preserves backend preferences without a browser subscription and offers explicit activation', async () => {
  const button = { addEventListener() {} };
  const root = { innerHTML: '', querySelector: () => button, addEventListener() {} };
  const notify = { available: async () => true, restore: async () => false, state: () => ({ active: false }) };
  const sb = { rpc: async (name) => ({ data: name === 'parent_notification_settings' ? { parent: { approval_enabled: true, daily_summary_enabled: true }, devices: [] } : { external_id: opaque } }) };
  await renderNotifications({ sb, familyId: opaque, root, notify });
  assert.match(root.innerHTML, /name="approval" type="checkbox" checked/);
  assert.match(root.innerHTML, /name="summary" type="checkbox" checked/);
  assert.match(root.innerHTML, /Ativar notificações neste aparelho/);
  assert.doesNotMatch(root.innerHTML, /data-activate-notifications hidden/);
  assert.match(root.innerHTML, /Preferências salvas/);
});
test('failed parent preference RPC never opts out an existing healthy subscription', async () => {
  let optOut = 0;
  const notify = { state: () => ({ active: true }), optOut: async () => { optOut++; } };
  await assert.rejects(saveParentNotificationPreferences({ notify, familyId: opaque, values: {}, call: async (name) => { if (name === 'parent_set_notification_preferences') throw new Error('network'); return { active: true }; } }), /network/);
  assert.equal(optOut, 0);
  await saveParentNotificationPreferences({ notify, familyId: opaque, values: {}, call: async (name) => name === 'my_notification_identity' ? { active: true } : null });
  assert.equal(optOut, 0); // another family remains enabled
});
test('CSP adds only necessary OneSignal script/connect origins and preserves every other policy/config', () => {
  const current = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url)));
  const baseline = "default-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; img-src 'self' data: https://www.minhai.app; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";
  const csp = current.headers.flatMap((g) => g.headers).find((h) => h.key === 'Content-Security-Policy').value;
  assert.match(csp, /script-src 'self' https:\/\/cdn\.onesignal\.com;/);
  assert.match(csp, /connect-src [^;]*https:\/\/onesignal\.com https:\/\/api\.onesignal\.com;/);
  assert.equal(csp.replace(' https://cdn.onesignal.com', '').replace(' https://onesignal.com https://api.onesignal.com', ''), baseline);
  assert.deepEqual(current.git.deploymentEnabled, { '*': false, main: true, staging: true });
  assert.equal(csp.includes('unsafe-eval'), false);
});


test('parent save error restores confirmed UI preferences without removing a healthy subscription', async () => {
  let optOut = 0;
  const events = new Map(), button = { addEventListener() {} }, output = {}, browserStatus = {};
  const root = { innerHTML: '', dataset: {}, querySelector: (selector) => selector === 'output' ? output : selector === '[data-browser-status]' ? browserStatus : button,
    addEventListener: (name, fn) => events.set(name, fn) };
  const notify = { available: async () => true, restore: async () => true, state: () => ({ active: true }), optOut: async () => { optOut++; } };
  const sb = { rpc: async (name) => {
    if (name === 'parent_set_notification_preferences') return { error: new Error('offline') };
    return { data: name === 'parent_notification_settings' ? { parent: { approval_enabled: true, daily_summary_enabled: false }, devices: [] } : { external_id: opaque, active: true } };
  } };
  await renderNotifications({ sb, familyId: opaque, root, notify });
  const fields = { approval: { checked: false }, summary: { checked: false }, summaryTime: { value: '18:00' }, quietStart: { value: '20:00' }, quietEnd: { value: '08:00' } };
  const elements = Object.values(fields); elements.namedItem = (name) => fields[name];
  const form = { elements, hasAttribute: () => true, reportValidity: () => true };
  await events.get('submit')({ preventDefault() {}, target: form });
  assert.equal(optOut, 0);
  assert.equal(fields.approval.checked, true);
  assert.equal(fields.summary.checked, false);
  assert.equal(root.dataset.busy, 'false');
});
