import { getDeviceToken, rotateDeviceToken } from '../lib/supabase.js';

export function createCloud(sb) {
  let token = getDeviceToken();
  let timer = null;
  let visibilityHandler = null;

  async function call(fn, args = {}) {
    const { data, error } = await sb.rpc(fn, { p_device_token: token, ...args });
    if (error) throw error;
    return data;
  }
  function map(data) {
    if (!data?.player) return null;
    return {
      connected:true,
      familyName:data.family?.name || '',
      nickname:data.player.nickname,
      petName:data.player.pet_name,
      look:data.player.look || {},
      xp:Number(data.player.xp || 0),
      wallet:Number(data.player.wallet || 0),
      weekPoints:Number(data.player.week_points || 0),
      streak:Number(data.player.streak || 0),
      missions:data.missions || [],
      rewards:data.rewards || [],
      recentRewards:data.recent_rewards || [],
      ranking:data.ranking || [],
      challenges:data.challenges || [],
      leagues:data.leagues || [],
      familyGoal:data.family_goal || {current:0,target:500},
      dailyBonusDay:data.player.daily_bonus_day || null
    };
  }
  return {
    kind:'cloud',
    async snapshot(){ return map(await call('kid_snapshot')); },
    async pair(code){
      const { data, error } = await sb.rpc('pair_device', {
        p_code: code,
        p_device_token: token,
        p_label: /Android/i.test(navigator.userAgent) ? 'Android' : /iPhone|iPad/i.test(navigator.userAgent) ? 'iPhone/iPad' : 'Navegador'
      });
      if(error) throw error;
      return data;
    },
    markDone:(id)=>call('mark_mission_done',{p_mission:id}),
    requestReward:(id)=>call('request_reward',{p_reward:id}),
    savePet:(name,look)=>call('update_my_pet',{p_pet_name:name,p_look:look}),
    async unpair(){
      try { await call('unpair_device'); } finally { token = rotateDeviceToken(); }
    },
    subscribe(onChange){
      clearInterval(timer);
      timer=setInterval(onChange,8000);
      visibilityHandler=()=>{ if(document.visibilityState==='visible') onChange(); };
      document.addEventListener('visibilitychange',visibilityHandler);
      window.addEventListener('focus',onChange);
      return ()=>{
        clearInterval(timer);
        document.removeEventListener('visibilitychange',visibilityHandler);
        window.removeEventListener('focus',onChange);
      };
    }
  };
}
