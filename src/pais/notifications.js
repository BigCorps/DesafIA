import { notifications } from '../shared/notifications.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const time = (value, fallback) => esc(String(value || fallback).slice(0, 5));
export async function renderNotifications({ sb, familyId, root }) {
  if (!root) return;
  root.innerHTML = '<h2>🔔 Notificações</h2><p class="lead">Verificando disponibilidade…</p>';
  const call = async (name, args = {}) => { const { data, error } = await sb.rpc(name, args); if (error) throw error; return data; };
  try {
    if (!await notifications.available(sb)) {
      root.innerHTML = '<h2>🔔 Notificações</h2><p class="lead">Notificações ainda não estão habilitadas. As preferências permanecem desativadas.</p>';
      return;
    }
    const data = await call('parent_notification_settings', { p_family: familyId });
    const pref = data.parent || {};
    if (pref.approval_enabled || pref.daily_summary_enabled) {
      const identity = await call('my_notification_identity');
      const active = await notifications.restore(identity.external_id, 'parent');
      // A passive check in another browser must not disable an existing subscription.
      if (active) await call('parent_notification_subscription', { p_active: true });
    } else if (notifications.remembered()?.kind === 'parent') {
      // Only log out if all this parent's families are disabled (identity.active).
      const identity = await call('my_notification_identity');
      if (!identity.active) await notifications.optOut();
    }
    root.innerHTML = `<h2>🔔 Notificações</h2><p class="lead">Opcionais, sem anúncios e com horários de silêncio. As preferências são compartilhadas por responsável e família.</p>
      <form data-notification-parent><h3>Neste aparelho</h3>
        <label class="switch"><input name="approval" type="checkbox" ${pref.approval_enabled && notifications.state().active ? 'checked' : ''}> Avisar quando houver missão para aprovar</label>
        <label class="switch"><input name="summary" type="checkbox" ${pref.daily_summary_enabled && notifications.state().active ? 'checked' : ''}> Resumo diário de pendências</label>
        <label class="field">Horário do resumo<input class="input" name="summaryTime" type="time" value="${time(pref.daily_summary_time, '19:00')}" required></label>
        <div class="two"><label class="field">Silêncio a partir de<input class="input" name="quietStart" type="time" value="${time(pref.quiet_start, '20:00')}" required></label>
          <label class="field">Até<input class="input" name="quietEnd" type="time" value="${time(pref.quiet_end, '08:00')}" required></label></div>
        <button class="btn btn-soft">Salvar horários</button>
      </form><h3>Aparelhos da criança</h3>
      ${(data.devices || []).map((device) => {
        const p = device.preferences || {};
        const status = !p.child_reminders_enabled ? 'Desativado' : device.push_active ? 'Ativo' : 'Autorizado pelo responsável — aguardando ativação no aparelho';
        return `<form data-notification-device="${esc(device.device_id)}" class="card"><strong>${esc(device.label || 'Aparelho')}</strong><p data-device-status>${status}</p>
          <label class="switch"><input name="enabled" type="checkbox" ${p.child_reminders_enabled ? 'checked' : ''}> Permitir lembretes</label>
          <label class="field">Primeiro lembrete<input class="input" name="first" type="time" value="${time(p.first_reminder_time,'18:00')}" required></label>
          <label class="switch"><input name="secondEnabled" type="checkbox" ${p.second_reminder_enabled ? 'checked' : ''}> Permitir segundo lembrete (no máximo dois por dia)</label>
          <label class="field">Segundo lembrete<input class="input" name="second" type="time" value="${time(p.second_reminder_time,'19:30')}" required></label>
          <div class="two"><label class="field">Silêncio a partir de<input class="input" name="quietStart" type="time" value="${time(p.quiet_start,'20:00')}" required></label>
            <label class="field">Até<input class="input" name="quietEnd" type="time" value="${time(p.quiet_end,'08:00')}" required></label></div><button class="btn btn-soft">Salvar para este aparelho</button></form>`;
      }).join('') || '<p>Nenhum aparelho infantil conectado.</p>'}
      <output aria-live="polite">${notifications.state().active ? 'Notificações ativas neste aparelho.' : 'Ative uma opção para autorizar notificações neste aparelho.'}</output>`;
    let busy = false;
    async function save(form) {
      if (busy || !form.reportValidity()) return;
      busy = true; root.dataset.busy = 'true';
      for (const input of form.elements) input.disabled = true;
      const output = root.querySelector('output');
      const get = (name) => form.elements.namedItem(name);
      const checked = (name) => get(name).checked;
      const value = (name) => get(name).value;
      try {
        if (!await notifications.available(sb)) throw new Error('Notificações temporariamente indisponíveis.');
        if (form.hasAttribute('data-notification-parent')) {
          const wanted = checked('approval') || checked('summary');
          if (wanted && !notifications.state().active) {
            const identity = await call('my_notification_identity');
            if (!await notifications.activate(identity.external_id, 'parent', { consent: true, enabled: true, interaction: true })) {
              get('approval').checked = false; get('summary').checked = false;
              throw new Error('Permissão não concedida ou push indisponível. Nenhuma opção foi ativada neste aparelho.');
            }
          }
          await call('parent_set_notification_preferences', { p_family: familyId, p_approval: checked('approval'), p_summary: checked('summary'),
            p_summary_time: value('summaryTime'), p_quiet_start: value('quietStart'), p_quiet_end: value('quietEnd') });
          const identity = await call('my_notification_identity');
          // Disabling this family's options must not cancel other families.
          if (!identity.active) {
            await call('parent_notification_subscription', { p_active: false });
            await notifications.optOut();
          } else if (notifications.state().active) {
            await call('parent_notification_subscription', { p_active: true });
          }
        } else {
          await call('parent_set_device_notifications', { p_family: familyId, p_device: form.dataset.notificationDevice, p_enabled: checked('enabled'),
            p_first: value('first'), p_second_enabled: checked('secondEnabled'), p_second: value('second'), p_quiet_start: value('quietStart'), p_quiet_end: value('quietEnd') });
          const updated = await call('parent_notification_settings', { p_family: familyId });
          const device = updated.devices.find((d) => d.device_id === form.dataset.notificationDevice);
          form.querySelector('[data-device-status]').textContent = !checked('enabled') ? 'Desativado' : device?.push_active ? 'Ativo' : 'Autorizado pelo responsável — aguardando ativação no aparelho';
        }
        output.textContent = 'Preferências salvas. Os lembretes infantis ainda precisam de ativação no próprio aparelho.';
      } catch {
        if (form.hasAttribute('data-notification-parent')) {
          get('approval').checked = false; get('summary').checked = false;
          await notifications.optOut();
        }
        output.textContent = 'Não foi possível ativar/salvar. Confira a permissão do navegador e tente novamente.';
      }
      finally { busy = false; root.dataset.busy = 'false'; for (const input of form.elements) input.disabled = false; }
    }
    root.addEventListener('submit', (event) => { event.preventDefault(); save(event.target); });
    root.addEventListener('change', (event) => { if (event.target.type === 'checkbox' && event.target.closest('[data-notification-parent]')) save(event.target.form); });
  } catch {
    root.innerHTML = '<h2>🔔 Notificações</h2><p class="lead">Notificações indisponíveis no momento. O restante do DesafIA continua funcionando.</p>';
  }
}
