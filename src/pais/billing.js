async function normalizeError(error) {
  try {
    if (error?.context?.clone) {
      const parsed = await error.context.clone().json();
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch { /* ignora corpo não JSON */ }
  const raw = error?.context?.body || error?.message || error?.error || error;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return { error: raw }; }
  }
  return raw && typeof raw === 'object' ? raw : { error: 'billing_request_failed' };
}

export function createBillingClient(supabase) {
  async function call(action, familyId, extra = {}) {
    if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
    const { data, error } = await supabase.functions.invoke('desafia-billing', {
      body: { action, family_id: familyId, ...extra }
    });
    if (error) {
      const parsed = await normalizeError(error);
      const err = new Error(parsed?.error || error.message || 'billing_request_failed');
      err.details = parsed;
      throw err;
    }
    if (data?.error) {
      const err = new Error(data.error);
      err.details = data;
      throw err;
    }
    return data || {};
  }

  return {
    status: (familyId) => call('status', familyId),
    create: (familyId) => call('create', familyId),
    check: (familyId, invoiceId) => call('check', familyId, { invoice_id: invoiceId })
  };
}
