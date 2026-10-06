import { notifications } from '../shared/notifications.js';

export function createChildNotificationUI(sb) {
  let busy = false, root = null, latest = null;
  const hide = () => { root?.remove(); root = null; };
  return {
    async refresh(api) {
      if (busy) return;
      busy = true;
      try {
        if (api?.kind !== 'cloud' || !sb) { hide(); return; }
        const authorized = await api.notificationState();
        latest = authorized;
        if (!authorized?.authorized || !await notifications.available(sb)) {
          hide(); if (notifications.remembered()?.kind === 'child_device') await notifications.optOut();
          return;
        }
        if (await notifications.restore(authorized.external_id, 'child_device')) {
          hide(); await api.notificationSubscription(true); return;
        }
        await api.notificationSubscription(false);
        if (root) return;
        root = document.createElement('aside');
        root.className = 'push-child-cta';
        root.setAttribute('aria-label', 'Lembretes opcionais');
        root.innerHTML = '<span>Seu responsável permitiu lembretes. Ativar neste aparelho?</span><button class="btn btn-soft">Ativar lembretes</button><button class="btn btn-ghost" aria-label="Fechar lembretes">Agora não</button>';
        root.lastElementChild.addEventListener('click', () => { sessionStorage.setItem('desafia-push-dismissed', '1'); hide(); });
        root.querySelector('button').addEventListener('click', async (event) => {
          const button = event.currentTarget; button.disabled = true;
          try {
            // Consent can be revoked between boot and this click; reread it.
            latest = await api.notificationState();
            const enabled = await notifications.available(sb);
            const active = await notifications.activate(latest?.external_id, 'child_device', { consent: latest?.authorized === true, enabled, interaction: true });
            if (active) { await api.notificationSubscription(true); hide(); }
            else { button.textContent = 'Não ativado · tentar depois'; }
          } catch { await notifications.optOut(); button.textContent = 'Indisponível · tentar depois'; }
          finally { button.disabled = false; }
        });
        if (!sessionStorage.getItem('desafia-push-dismissed')) document.body.appendChild(root);
      } catch { hide(); if (notifications.remembered()?.kind === 'child_device') await notifications.optOut(); }
      finally { busy = false; }
    }
  };
}
