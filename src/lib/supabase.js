import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** true quando as variáveis de ambiente do Supabase foram configuradas. */
export const supabaseReady = Boolean(url && key);

/**
 * Cria o cliente com uma chave de sessão própria.
 * O jogo (login anônimo da criança) e o portal (login dos pais) ficam no mesmo
 * domínio, então cada um guarda a sessão num lugar diferente para não se misturarem.
 */
export function createSupabase(storageKey, { detectSessionInUrl = false } = {}) {
  if (!supabaseReady) return null;
  return createClient(url, key, {
    auth: { storageKey, persistSession: true, autoRefreshToken: true, detectSessionInUrl }
  });
}

const MESSAGES = {
  PLUS_REQUIRED: 'Esse recurso faz parte do plano Plus.',
  FORBIDDEN: 'Você não tem permissão para isso.',
  INVALID_CODE: 'Código inválido ou vencido. Gere um novo código no portal dos pais.',
  NOT_ENOUGH_STARS: 'Ainda faltam estrelas para esse prêmio.',
  LIMIT_REACHED: 'Limite atingido.',
  LOGIN_REQUIRED: 'Entre com seu e-mail para continuar.',
  NOT_PAIRED: 'Este aparelho não está conectado a uma família.',
  INVALID_MISSION: 'Essa missão não está mais disponível.',
  INVALID_REWARD: 'Esse prêmio não está mais disponível.',
  CHILD_ONLY: 'Só aparelhos de crianças podem ser conectados com código.'
};

/** Traduz erros do Supabase/funções para mensagens em português. */
export function friendlyError(err) {
  const msg = (err && (err.message || err.error_description || String(err))) || '';
  for (const code of Object.keys(MESSAGES)) if (msg.includes(code)) return MESSAGES[code];
  if (msg.includes('row-level security')) return MESSAGES.PLUS_REQUIRED;
  if (msg.toLowerCase().includes('anonymous')) return 'Ative o login anônimo no Supabase (veja o README).';
  if (msg.toLowerCase().includes('fetch')) return 'Sem conexão. Verifique a internet e tente de novo.';
  return 'Algo deu errado. Tente de novo em instantes.';
}
