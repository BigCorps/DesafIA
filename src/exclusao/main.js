import '../shared/base.css';
import './exclusao.css';
import { createParentSupabase, supabaseReady, friendlyError } from '../lib/supabase.js';

const sb = createParentSupabase('desafia-exclusao-auth');
const $ = (id) => document.getElementById(id);
const CONFIRM_TEXT = 'excluir meus dados';
let session = null;

function show(id, visible) {
  $(id).hidden = !visible;
}

function cleanAuthUrl() {
  if (!location.hash && !location.search) return;
  try { history.replaceState(null, '', '/exclusao/'); } catch {}
}

function render() {
  const logged = Boolean(session?.user);
  show('authBox', !logged);
  show('requestBox', logged);
  if (logged) $('accountEmail').textContent = session.user.email || 'conta Google';
}

async function loginGoogle() {
  $('authError').textContent = '';
  if (!supabaseReady || !sb) {
    $('authError').textContent = 'A autenticação não está disponível no momento.';
    return;
  }
  $('googleBtn').disabled = true;
  try {
    const redirectTo = new URL('/exclusao/', location.origin).href;
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
    });
    if (error) throw error;
  } catch (err) {
    $('authError').textContent = friendlyError(err);
    $('googleBtn').disabled = false;
  }
}

async function requestDeletion() {
  const input = $('confirmInput').value.trim().toLowerCase();
  if (input !== CONFIRM_TEXT || !session?.user || !sb) return;

  const btn = $('deleteBtn');
  btn.disabled = true;
  $('status').className = 'status';
  $('status').textContent = 'Enviando solicitação…';

  try {
    const { error } = await sb.functions.invoke('delete-user-data', {
      body: {
        userId: session.user.id,
        email: session.user.email,
        brand: 'desafia'
      }
    });
    if (error) throw error;

    $('status').className = 'status ok';
    $('status').textContent = 'Solicitação registrada. A BigCorps verificará vínculos com outros produtos antes da exclusão definitiva.';
    $('confirmInput').disabled = true;
    window.setTimeout(async () => {
      try { await sb.auth.signOut(); } catch {}
    }, 1200);
  } catch (err) {
    $('status').className = 'status error';
    $('status').textContent = friendlyError(err);
    btn.disabled = false;
  }
}

$('googleBtn').addEventListener('click', loginGoogle);
$('confirmInput').addEventListener('input', (e) => {
  $('deleteBtn').disabled = e.target.value.trim().toLowerCase() !== CONFIRM_TEXT;
});
$('deleteBtn').addEventListener('click', requestDeletion);

(async () => {
  if (!sb || !supabaseReady) {
    render();
    $('authError').textContent = 'A autenticação não está disponível no momento.';
    return;
  }

  const { data } = await sb.auth.getSession();
  session = data?.session || null;
  cleanAuthUrl();
  render();

  sb.auth.onAuthStateChange((_event, nextSession) => {
    session = nextSession;
    cleanAuthUrl();
    render();
  });
})();
