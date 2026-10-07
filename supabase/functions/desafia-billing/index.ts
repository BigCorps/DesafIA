import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const BANCO_INTER_API_KEY = Deno.env.get('BANCO_INTER_API_KEY') ?? ''
const PRICE_CENTS = Math.max(0, Number(Deno.env.get('DESAFIA_PLUS_MONTHLY_CENTS') ?? '0'))
const QR_BASE_URL = Deno.env.get('DESAFIA_QR_BASE_URL') || 'https://www.minhai.app/api/qrcode'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers })
}

function brl(cents: number) {
  return (Math.max(0, Number(cents || 0)) / 100).toFixed(2)
}

function isPaidStatus(value: unknown) {
  return ['CONCLUIDA', 'PAGO', 'REALIZADO', 'CONCLUIDO'].includes(String(value || '').toUpperCase())
}

async function readBody(req: Request) {
  const raw = await req.text()
  if (!raw.trim()) return {} as Record<string, unknown>
  try { return JSON.parse(raw) as Record<string, unknown> }
  catch { throw new Error('invalid_json') }
}

async function getUser(req: Request, supabase: any) {
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return null
  const { data, error } = await supabase.auth.getUser(jwt)
  return error ? null : data.user || null
}

async function familyAccess(db: any, userId: string, familyId: string) {
  const { data: member } = await db
    .from('family_members')
    .select('family_id,role')
    .eq('family_id', familyId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!member) return null
  const { data: family } = await db
    .from('families')
    .select('id,name,plan,plan_expires_at')
    .eq('id', familyId)
    .maybeSingle()
  return family ? { member, family } : null
}

async function billingCompany(supabase: any) {
  const { data, error } = await supabase
    .from('companies')
    .select('id,user_id,name,receiving_pix_key,receiving_pix_key_type')
    .eq('name', 'Gerente BigCorps')
    .eq('email_contato', 'contato@bigcorps.com.br')
    .limit(1)
    .maybeSingle()
  if (error || !data) throw new Error('billing_company_not_found')
  if (!String(data.receiving_pix_key || '').trim()) throw new Error('billing_pix_key_not_configured')
  return data
}

async function generatePix(amountCents: number, label: string, pixKey: string) {
  if (!BANCO_INTER_API_KEY) throw new Error('banco_inter_not_configured')
  const response = await fetch('https://inter.btsolucao.com.br/cob.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${BANCO_INTER_API_KEY}`,
    },
    body: JSON.stringify({
      amount: { original: brl(amountCents) },
      expiresIn: 1800,
      displayText: label.slice(0, 120),
      modalidadeAlteracao: 0,
      chave: pixKey,
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data?.txid || !data?.pixCopiaECola) {
    console.error('[desafia-billing] Inter create:', data)
    throw new Error('pix_create_failed')
  }
  return data
}

async function checkInter(txid: string) {
  if (!BANCO_INTER_API_KEY) throw new Error('banco_inter_not_configured')
  const response = await fetch(
    `https://inter.btsolucao.com.br/get.php?txid=${encodeURIComponent(txid)}`,
    { headers: { Authorization: `Bearer ${BANCO_INTER_API_KEY}`, Accept: 'application/json' } },
  )
  const raw = await response.json().catch(() => ({}))
  if (!response.ok) return { paid: false, raw }
  const data = raw?.data || raw
  return {
    paid: isPaidStatus(data?.status),
    amount: Number(data?.valor ?? data?.amount?.original ?? 0),
    paidAt: data?.datapagamento || data?.horario || data?.paid_at || new Date().toISOString(),
    raw,
  }
}

function paymentPayload(invoice: any) {
  if (!invoice) return null
  return {
    invoice_id: invoice.id,
    status: invoice.status,
    plan_code: invoice.plan_code,
    amount_cents: Number(invoice.amount_cents || 0),
    pix_code: invoice.pix_code || null,
    qr_code_url: invoice.qr_code_url || null,
    expires_at: invoice.expires_at || null,
    paid_at: invoice.paid_at || null,
    period_end: invoice.period_end || null,
  }
}

async function latestPending(db: any, familyId: string) {
  const now = new Date().toISOString()
  await db
    .from('billing_invoices')
    .update({ status: 'expired', updated_at: now })
    .eq('family_id', familyId)
    .eq('status', 'pending')
    .lte('expires_at', now)

  const { data } = await db
    .from('billing_invoices')
    .select('*')
    .eq('family_id', familyId)
    .eq('status', 'pending')
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data || null
}

async function statusPayload(db: any, access: any) {
  const nowIso = new Date().toISOString()
  await db.from('subscriptions').update({ status: 'expired', updated_at: nowIso })
    .eq('family_id', access.family.id).eq('status', 'active').lte('current_period_end', nowIso)
  const { data: subscription } = await db
    .from('subscriptions')
    .select('*')
    .eq('family_id', access.family.id)
    .maybeSingle()
  const pending = await latestPending(db, access.family.id)
  const expires = access.family.plan_expires_at ? new Date(access.family.plan_expires_at).getTime() : 0
  const plus = access.family.plan === 'plus' && (!access.family.plan_expires_at || expires > Date.now())
  return {
    success: true,
    configured: PRICE_CENTS > 0 && Boolean(BANCO_INTER_API_KEY),
    plan: {
      code: 'plus_monthly',
      name: 'DesafIA Plus',
      price_cents: PRICE_CENTS,
      period_days: 30,
      currency: 'BRL',
      features: [
        'Até 10 crianças na família',
        'Missões personalizadas',
        'Prêmios personalizados',
        'Desafios em família',
        'Ligas entre famílias',
        '3 jogos extras e Tesouros do Parque',
      ],
    },
    family: {
      id: access.family.id,
      name: access.family.name,
      plus,
      plan_expires_at: access.family.plan_expires_at,
    },
    subscription: subscription || null,
    pending_payment: paymentPayload(pending),
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ error: 'billing_backend_not_configured' }, 503)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const db = supabase.schema('desafia')
  const user = await getUser(req, supabase)
  if (!user) return json({ error: 'unauthorized' }, 401)

  try {
    const body = await readBody(req)
    const action = String(body.action || 'status')
    const familyId = String(body.family_id || '')
    if (!familyId) return json({ error: 'family_id_required' }, 400)

    const access = await familyAccess(db, user.id, familyId)
    if (!access) return json({ error: 'forbidden' }, 403)

    if (action === 'status') {
      return json(await statusPayload(db, access))
    }

    if (action === 'create') {
      if (PRICE_CENTS <= 0) return json({ error: 'billing_price_not_configured' }, 503)
      if (!BANCO_INTER_API_KEY) return json({ error: 'banco_inter_not_configured' }, 503)

      const existing = await latestPending(db, familyId)
      if (existing?.pix_code && existing?.txid) {
        return json({ success: true, reused: true, payment: paymentPayload(existing) })
      }

      const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString()
      let invoice: any = null
      const insert = await db.from('billing_invoices').insert({
        family_id: familyId,
        user_id: user.id,
        plan_code: 'plus_monthly',
        provider: 'inter',
        channel: 'web',
        amount_cents: PRICE_CENTS,
        currency: 'BRL',
        status: 'pending',
        expires_at: expiresAt,
        metadata: { created_by: user.id },
      }).select('*').single()

      if (insert.error) {
        // Dois cliques simultâneos: reaproveita a cobrança que ganhou a corrida.
        const raced = await latestPending(db, familyId)
        if (raced?.pix_code && raced?.txid) {
          return json({ success: true, reused: true, payment: paymentPayload(raced) })
        }
        throw insert.error
      }
      invoice = insert.data

      try {
        const billing = await billingCompany(supabase)
        const pixKey = String(billing.receiving_pix_key || '').trim()
        const pix = await generatePix(
          PRICE_CENTS,
          `DesafIA Plus - ${String(access.family.name || 'familia').slice(0, 70)}`,
          pixKey,
        )
        const providerQr = String(pix.qrcode || '')
        const qrCodeUrl = providerQr.startsWith('data:')
          ? providerQr
          : `${QR_BASE_URL}?size=400&data=${encodeURIComponent(String(pix.pixCopiaECola))}&color=%237658F5`
        const { data: updated, error } = await db
          .from('billing_invoices')
          .update({
            txid: String(pix.txid),
            pix_code: String(pix.pixCopiaECola),
            qr_code_url: qrCodeUrl,
            metadata: {
              created_by: user.id,
              receiving_company_id: billing.id,
              receiving_pix_key_type: billing.receiving_pix_key_type || null,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', invoice.id)
          .eq('status', 'pending')
          .select('*')
          .single()
        if (error || !updated) throw error || new Error('invoice_update_failed')
        return json({ success: true, reused: false, payment: paymentPayload(updated) })
      } catch (error) {
        await db.from('billing_invoices').update({
          status: 'failed',
          updated_at: new Date().toISOString(),
          metadata: { ...(invoice?.metadata || {}), error: error instanceof Error ? error.message : String(error) },
        }).eq('id', invoice.id).eq('status', 'pending')
        throw error
      }
    }

    if (action === 'check') {
      const invoiceId = String(body.invoice_id || '')
      if (!invoiceId) return json({ error: 'invoice_id_required' }, 400)
      const { data: invoice } = await db
        .from('billing_invoices')
        .select('*')
        .eq('id', invoiceId)
        .eq('family_id', familyId)
        .maybeSingle()
      if (!invoice) return json({ error: 'invoice_not_found' }, 404)

      if (invoice.applied_at || invoice.status === 'paid') {
        return json({ success: true, status: 'paid', payment: paymentPayload(invoice) })
      }
      if (invoice.status !== 'pending') {
        return json({ success: false, status: invoice.status, payment: paymentPayload(invoice) })
      }
      if (invoice.expires_at && new Date(invoice.expires_at).getTime() <= Date.now()) {
        await db.from('billing_invoices').update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('id', invoice.id).eq('status', 'pending')
        return json({ success: false, status: 'expired' })
      }
      if (!invoice.txid) return json({ error: 'invoice_without_pix' }, 409)

      const result = await checkInter(String(invoice.txid))
      if (!result.paid) return json({ success: false, status: 'pending', payment: paymentPayload(invoice) })

      const expected = Number(invoice.amount_cents || 0) / 100
      if (Number.isFinite(result.amount) && result.amount > 0 && Math.abs(result.amount - expected) > 0.01) {
        return json({ error: 'paid_amount_mismatch' }, 409)
      }

      const paidAt = new Date(result.paidAt || Date.now()).toISOString()
      const { data: applied, error: applyError } = await db.rpc('apply_paid_invoice', {
        p_invoice_id: invoice.id,
        p_paid_at: paidAt,
      })
      if (applyError) throw applyError

      const { data: finalInvoice } = await db.from('billing_invoices').select('*').eq('id', invoice.id).single()
      return json({ success: true, status: 'paid', applied, payment: paymentPayload(finalInvoice) })
    }

    return json({ error: 'invalid_action' }, 400)
  } catch (error) {
    console.error('[desafia-billing]', error)
    return json({ error: error instanceof Error ? error.message : 'internal_error' }, 500)
  }
})
