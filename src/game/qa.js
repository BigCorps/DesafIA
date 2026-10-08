import { createQAState } from './qa-state.js';
import './qa.css';

export function mountQA({ storage, beforeChange, onChange, onboarding, games, allMode = false }) {
  const state = createQAState(storage);
  const panel = document.createElement('details');
  panel.id = 'qa-panel';
  panel.open = !allMode;
  panel.innerHTML = `<summary>QA · ${allMode ? 'tudo liberado' : 'somente teste local'}</summary>
    <p>Estado isolado nesta aba. Não envia dados ao Supabase.</p>
    <button data-qa="all">Liberar tudo</button>
    <button data-qa="onboard">Concluir / pular onboarding</button>
    <button data-qa="onboard-show">Reabrir onboarding</button>
    <button data-qa="games">Desbloquear e ver todos os jogos</button>
    <fieldset><legend>Missões / aprovação dos pais</legend>
      <button data-qa="todo">Pendentes (a fazer)</button>
      <button data-qa="pending">Aguardando aprovação</button>
      <button data-qa="done">Concluídas / aprovadas</button>
    </fieldset>
    <form><label>Estrelas <input name="stars" type="number" min="0" step="1" value="0" required></label>
      <label>XP <input name="xp" type="number" min="0" step="1" value="0" required></label>
      <button>Aplicar estrelas e XP</button></form>
    <fieldset><legend>Progresso</legend><button data-qa="low">Baixo</button>
      <button data-qa="medium">Intermediário</button><button data-qa="high">Avançado</button></fieldset>
    <button data-qa="reset">Resetar todo o QA</button>
    <output aria-live="polite"></output>`;
  document.body.appendChild(panel);
  state.api.snapshot().then((snap) => {
    panel.querySelector('[name=stars]').value = snap.wallet;
    panel.querySelector('[name=xp]').value = snap.xp;
  });
  let busy = false;
  async function run(change) {
    if (busy) return;
    busy = true;
    try {
      await beforeChange();
      await change();
      await onChange();
      const snap = await state.api.snapshot();
      panel.querySelector('[name=stars]').value = snap.wallet;
      panel.querySelector('[name=xp]').value = snap.xp;
      panel.querySelector('output').textContent = 'Estado QA atualizado.';
    } catch (error) { panel.querySelector('output').textContent = error.message; }
    finally { busy = false; }
  }
  panel.addEventListener('click', (event) => {
    const action = event.target.closest('[data-qa]')?.dataset.qa;
    if (!action) return;
    run(async () => {
      if (action === 'onboard' || action === 'onboard-show') {
        state.onboarding(action === 'onboard'); onboarding(action === 'onboard-show');
      } else if (action === 'all') {
        await state.unlockEverything(); onboarding(false);
      } else if (action === 'games') {
        state.onboarding(true); onboarding(false); await state.unlockGames();
      } else if (['todo', 'pending', 'done'].includes(action)) await state.missions(action);
      else if (action === 'reset') { state.reset(); onboarding(true); }
      else state.progress(action);
    }).then(() => { if (action === 'games' || action === 'all') games(); });
  });
  panel.querySelector('form').addEventListener('submit', (event) => {
    event.preventDefault();
    run(() => state.economy(panel.querySelector('[name=stars]').value, panel.querySelector('[name=xp]').value));
  });
  return state;
}
