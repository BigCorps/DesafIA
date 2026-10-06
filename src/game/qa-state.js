import { createLocal } from './local.js';
import { GAME_IDS } from '../games/registry.js';
import { LEVEL_THRESHOLDS } from '../shared/progression.js';

export function createQAState(storage) {
  const options = { storage, stateKey: 'state', playKey: 'play' };
  // QA models the parent's approval gate; the ordinary demo keeps its own rules.
  function localWithApproval() {
    const local = createLocal(options);
    return {
      ...local,
      async playStatus() {
        const status = await local.playStatus();
        status.missions.requires_approval = true;
        status.missions.ok = status.missions.total > 0 && status.missions.done === status.missions.total;
        return status;
      },
      async playStart() {
        if (!(await this.playStatus()).missions.ok) throw new Error('MISSIONS_PENDING');
        await local.playStart();
        return this.playStatus();
      }
    };
  }
  let api = localWithApproval();
  const reload = () => { api = localWithApproval(); };
  const edit = (change) => {
    const state = JSON.parse(storage.getItem('state'));
    change(state);
    storage.setItem('state', JSON.stringify(state));
    reload();
  };
  return {
    get api() { return api; },
    onboarding(done) {
      done ? storage.setItem('desafia-local-onboarded', '1') : storage.removeItem('desafia-local-onboarded');
    },
    async missions(status) {
      if (!['todo', 'pending', 'done'].includes(status)) throw new Error('Invalid QA mission status');
      // Clear the simulated day before applying existing completion/approval rules.
      edit((s) => { s.missions.forEach((m) => { m.status = 'todo'; }); s.dailyBonusDay = null; s.completedDays = []; s.wallet = 0; s.xp = 0; s.weekPoints = 0; });
      if (status !== 'todo') {
        for (const mission of (await api.snapshot()).missions) {
          await api.markDone(mission.id);
          if (status === 'done') await api.decideMission(mission.id, true);
        }
      }
    },
    economy(wallet, xp) {
      const safe = (value) => { const n = Number(value); if (!Number.isSafeInteger(n) || n < 0) throw new Error('Use números inteiros não negativos.'); return n; };
      const stars = safe(wallet), experience = safe(xp);
      edit((s) => { s.wallet = stars; s.xp = experience; });
    },
    progress(preset) {
      const presets = { low: [0, 0], medium: [250, LEVEL_THRESHOLDS[5]], high: [1000, LEVEL_THRESHOLDS[11]] };
      if (!presets[preset]) throw new Error('Invalid QA progress preset');
      this.economy(...presets[preset]);
    },
    async unlockGames() {
      await this.missions('done');
      await api.playStart();
      const play = JSON.parse(storage.getItem('play'));
      Object.assign(play, { unlocked: [...GAME_IDS], newGames: [], featured: GAME_IDS[0], used: 0 });
      storage.setItem('play', JSON.stringify(play));
    },
    reset() { storage.clear(); reload(); }
  };
}
