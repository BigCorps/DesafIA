let started = false;

function buildUpdateBanner(onUpdate) {
  const existing = document.getElementById('pwaUpdate');
  if (existing) return existing;

  const banner = document.createElement('aside');
  banner.id = 'pwaUpdate';
  banner.className = 'pwa-update';
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  banner.innerHTML = `
    <div class="pwa-update-icon" aria-hidden="true">✨</div>
    <div class="pwa-update-copy"><strong>Nova versão pronta</strong><span>Atualize para usar as melhorias mais recentes.</span></div>
    <button class="pwa-update-now" type="button">Atualizar</button>
    <button class="pwa-update-later" type="button" aria-label="Atualizar depois">×</button>`;
  banner.querySelector('.pwa-update-now').addEventListener('click', onUpdate);
  banner.querySelector('.pwa-update-later').addEventListener('click', () => banner.classList.remove('show'));
  document.body.appendChild(banner);
  requestAnimationFrame(() => banner.classList.add('show'));
  return banner;
}

export async function setupPWA() {
  if (started || !('serviceWorker' in navigator) || location.protocol !== 'https:') return;
  started = true;

  let registration;
  let reloadRequested = false;
  let banner = null;

  const activateWaiting = () => {
    if (!registration?.waiting) return;
    reloadRequested = true;
    banner?.classList.remove('show');
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  };

  const offerUpdate = () => {
    if (!registration?.waiting || !navigator.serviceWorker.controller) return;
    banner = buildUpdateBanner(activateWaiting);
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadRequested) location.reload();
  });

  try {
    registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
    offerUpdate();

    const watchInstalling = (worker) => {
      if (!worker) return;
      if (worker.state === 'installed') { offerUpdate(); return; }
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed') offerUpdate();
      });
    };
    watchInstalling(registration.installing);
    registration.addEventListener('updatefound', () => watchInstalling(registration.installing));

    const check = () => registration?.update().catch(() => {});
    setTimeout(check, 2500);
    setInterval(check, 60 * 60 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
  } catch (error) {
    console.warn('PWA indisponível', error);
  }
}
