import { notifications } from '../shared/notifications.js';

export function createChildNotificationUI(sb, { notify = notifications, now = Date.now } = {}) {
  let busy = false, root = null, latest = null, lastCheck = -Infinity, currentApi = null;
  const hide = () => { root?.remove(); root = null; };
  return {
    async refresh(api, { visible = false } = {}) {
      if (api?.kind !== 'cloud' || !sb) { hide(); currentApi = null; lastCheck = -Infinity; return; }
      const interval = visible ? 60 * 1000 : 3 * 60 * 1000;
      if (api === currentApi && now() - lastCheck < interval) return;
      if (busy) return;
      busy = true; currentApi = api; lastCheck = now();
      try {
        const authorized = await api.notificationState();
        if (api !== currentApi) return;
        latest = authorized;
        const configured = authorized?.authorized && await notify.available(sb);
        if (api !== currentApi) return;
        if (!configured) {
          hide(); if (notify.remembered()?.kind === 'child_device') await notify.optOut();
          return;
        }
        const active = await notify.restore(authorized.external_id, 'child_device');
        if (api !== currentApi) return;
        if (active) {
          hide(); if (authorized.push_active !== true) await api.notificationSubscription(true); return;
        }
        if (authorized.push_active === true) await api.notificationSubscription(false);
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
            latest = await api.notificationState(); lastCheck = now();
            const enabled = await notify.available(sb);
            const active = await notify.activate(latest?.external_id, 'child_device', { consent: latest?.authorized === true, enabled, interaction: true });
            if (active) { if (latest.push_active !== true) await api.notificationSubscription(true); hide(); }
            else { button.textContent = 'Não ativado · tentar depois'; }
          } catch { await notify.optOut(); button.textContent = 'Indisponível · tentar depois'; }
          finally { button.disabled = false; }
        });
        if (!sessionStorage.getItem('desafia-push-dismissed')) document.body.appendChild(root);
      } catch { hide(); if (notify.remembered()?.kind === 'child_device') await notify.optOut(); }
      finally { busy = false; }
    }
  };
}
