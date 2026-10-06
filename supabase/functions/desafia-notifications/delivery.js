// Shared pure handler for Deno and offline tests. Never log vendor bodies/keys.
const response = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type' }
});

export function notificationContent(item) {
  if (item.event_type === 'mission_waiting_approval') return {
    title: item.mission_count === 1 ? '🌟 Uma missão está esperando sua aprovação' : `🌟 Há ${item.mission_count} missões esperando sua aprovação`,
    message: 'Toque para conferir no DesafIA.', url: 'https://desafia.app/pais/'
  };
  if (item.event_type === 'child_reminder') return {
    title: '🌟 Tem uma missão esperando por você', message: 'Quando quiser, seu companheiro está por aqui.', url: 'https://desafia.app/'
  };
  if (item.event_type === 'parent_daily_summary') return {
    title: '🌟 Resumo do DesafIA', message: 'Há pendências para conferir em família. Toque para ver.', url: 'https://desafia.app/pais/'
  };
  throw new Error('unsupported_event');
}

export function createNotificationHandler({ env, rpc, request = fetch }) {
  return async (req) => {
    if (req.method === 'OPTIONS') return response({ ok: true });
    if (req.method !== 'POST') return response({ error: 'method_not_allowed' }, 405);
    let body;
    try { body = await req.json(); } catch { return response({ error: 'invalid_json' }, 400); }
    const enabled = env('DESAFIA_PUSH_ENABLED') === 'true';
    // Public capability information contains no credentials or identities.
    if (body?.action === 'status') {
      const configured = Boolean(env('DESAFIA_ONESIGNAL_APP_ID') && env('DESAFIA_ONESIGNAL_REST_API_KEY'));
      return response({ configured, delivery_enabled: enabled && configured, status: !enabled ? 'push_disabled' : configured ? 'available' : 'push_not_configured' });
    }
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!serviceKey || req.headers.get('authorization') !== `Bearer ${serviceKey}`) return response({ error: 'unauthorized' }, 401);
    if (!enabled) return response({ status: 'push_disabled', sent: 0 });
    const appId = env('DESAFIA_ONESIGNAL_APP_ID'), apiKey = env('DESAFIA_ONESIGNAL_REST_API_KEY');
    if (!appId || !apiKey) return response({ status: 'push_not_configured', sent: 0 }, 503);
    try {
      await rpc('notification_prepare');
      const items = await rpc('notification_claim', { p_limit: 20 });
      let sent = 0, failed = 0;
      for (const item of items || []) {
        // Recheck consent/eligibility after claim and immediately before HTTP.
        if (!await rpc('notification_validate_claim', { p_id: item.id, p_claim: item.claim_token })) {
          await rpc('notification_complete', { p_id: item.id, p_claim: item.claim_token, p_sent: false, p_error: 'no_longer_eligible' });
          continue;
        }
        let messageId = null, error = null, retry = false;
        try {
          const content = notificationContent(item);
          const res = await request('https://api.onesignal.com/notifications', {
            method: 'POST', signal: AbortSignal.timeout(15000),
            headers: { 'Content-Type': 'application/json', Authorization: `Key ${apiKey}` },
            body: JSON.stringify({ app_id: appId, target_channel: 'push',
              include_aliases: { external_id: [item.external_id] },
              idempotency_key: item.id, headings: { en: content.title, pt: content.title },
              contents: { en: content.message, pt: content.message }, url: content.url, ttl: 1800 })
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && typeof data.id === 'string' && data.id) messageId = data.id;
          else { error = res.ok ? 'no_push_subscription' : `onesignal_http_${res.status}`; retry = res.status === 429 || res.status >= 500; }
        } catch { error = 'vendor_request_failed'; retry = true; }
        await rpc('notification_complete', { p_id: item.id, p_claim: item.claim_token,
          p_sent: Boolean(messageId), p_message_id: messageId, p_error: error, p_retry: retry });
        messageId ? sent++ : failed++;
      }
      return response({ status: 'processed', claimed: items?.length || 0, sent, failed });
    } catch { return response({ error: 'notification_processing_failed' }, 500); }
  };
}
