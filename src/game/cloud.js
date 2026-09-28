// Modo nuvem: o aparelho da criança entra com login anônimo e é ligado
// a uma criança da família por um código gerado no portal dos pais.

export function createCloud(sb) {
  let playerId = null;
  let channel = null;
  let timer = null;

  async function ensureSession() {
    const { data } = await sb.auth.getSession();
    if (data.session) return;
    const { error } = await sb.auth.signInAnonymously();
    if (error) throw error;
  }
  async function call(fn, args) {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw error;
    return data;
  }
  function map(d) {
    playerId = d.player.id;
    return {
      connected: true,
      familyName: d.family?.name || '',
      nickname: d.player.nickname,
      petName: d.player.pet_name,
      look: d.player.look,
      xp: d.player.xp,
      wallet: d.player.wallet,
      weekPoints: d.player.week_points,
      missions: d.missions || [],
      rewards: d.rewards || [],
      recentRewards: d.recent_rewards || [],
      ranking: d.ranking || [],
      challenges: d.challenges || [],
      leagues: d.leagues || []
    };
  }

  return {
    kind: 'cloud',
    async snapshot() {
      await ensureSession();
      const d = await call('kid_snapshot');
      return d ? map(d) : null;
    },
    async pair(code) {
      await ensureSession();
      await call('pair_device', { p_code: code });
    },
    async unpair() {
      try { await call('unpair_device'); } finally {
        if (channel) sb.removeChannel(channel);
        clearInterval(timer);
        await sb.auth.signOut();
      }
    },
    markDone: (id) => call('mark_mission_done', { p_mission: id }),
    requestReward: (id) => call('request_reward', { p_reward: id }),
    savePet: (name, look) => call('update_my_pet', { p_pet_name: name, p_look: look }),
    subscribe(onChange) {
      if (!playerId) return () => {};
      if (channel) sb.removeChannel(channel);
      channel = sb.channel('kid-' + playerId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mission_logs', filter: 'player_id=eq.' + playerId }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reward_requests', filter: 'player_id=eq.' + playerId }, onChange)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players', filter: 'id=eq.' + playerId }, onChange)
        .subscribe();
      // Segurança extra caso o tempo real caia: atualiza a cada 45 s.
      clearInterval(timer);
      timer = setInterval(onChange, 45000);
      return () => { sb.removeChannel(channel); clearInterval(timer); };
    }
  };
}
