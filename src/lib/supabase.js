import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabaseReady = Boolean(url && key);
export const DESAFIA_SCHEMA = 'desafia';

export function createParentSupabase(storageKey = 'desafia-pais-auth') {
  if (!supabaseReady) return null;
  return createClient(url, key, {
    db: { schema: DESAFIA_SCHEMA },
    auth: { storageKey, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
}

export function createKidSupabase() {
  if (!supabaseReady) return null;
  return createClient(url, key, {
    db: { schema: DESAFIA_SCHEMA },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

const TOKEN_KEY = 'desafia-device-secret-v1';
function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
export function getDeviceToken() {
  let token = localStorage.getItem(TOKEN_KEY) || '';
  if (!/^[A-Za-z0-9_-]{40,80}$/.test(token)) {
    token = randomToken();
    localStorage.setItem(TOKEN_KEY, token);
  }
  return token;
}
export function rotateDeviceToken() {
  localStorage.removeItem(TOKEN_KEY);
  return getDeviceToken();
}

const MESSAGES = {
  PLUS_REQUIRED: 'Esse recurso faz parte do plano Plus.',
  FORBIDDEN: 'Você não tem permissão para isso.',
  INVALID_CODE: 'Código inválido ou vencido. Gere um novo código no portal dos pais.',
  TOO_MANY_ATTEMPTS: 'Muitas tentativas. Aguarde alguns minutos e gere um novo código.',
  NOT_ENOUGH_STARS: 'Ainda faltam estrelas para esse prêmio.',
  LIMIT_REACHED: 'Limite atingido.',
  LOGIN_REQUIRED: 'Entre com seu e-mail para continuar.',
  NOT_PAIRED: 'Este aparelho não está conectado a uma família.',
  INVALID_DEVICE_TOKEN: 'Não foi possível validar este aparelho. Conecte-o novamente.',
  INVALID_MISSION: 'Essa missão não está mais disponível.',
  INVALID_REWARD: 'Esse prêmio não está mais disponível.',
  CHILD_ONLY: 'Esse código só pode conectar uma criança.'
};
export function friendlyError(err) {
  const msg = String(err?.message || err?.error_description || err || '');
  for (const [code, text] of Object.entries(MESSAGES)) if (msg.includes(code)) return text;
  if (/Failed to fetch|NetworkError|fetch/i.test(msg)) return 'Sem conexão. Verifique a internet e tente de novo.';
  return 'Algo deu errado. Tente novamente em instantes.';
}
