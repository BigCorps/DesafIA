import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocal } from '../src/game/local.js';
import { createQAState } from '../src/game/qa-state.js';
import { isQAEnabled, isQAAllEnabled, scopedQAStorage } from '../src/shared/qa-environment.js';
import { levelOf, levelProgress, stageOf, unlockedHouseItems, LEVEL_THRESHOLDS } from '../src/shared/progression.js';
import { GAME_IDS } from '../src/games/registry.js';
import config from '../vite.config.js';

function memory() {
  const data = new Map();
  return { get length() { return data.size; }, key: (i) => [...data.keys()][i],
    getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k) };
}
const fixture = () => { const backing = memory(); const storage = scopedQAStorage(backing); return { backing, storage, qa: createQAState(storage) }; };

test('QA requires an allowed build and the exact URL opt-in', () => {
  for (const search of ['', '?qa=0', '?qa=true', '?other=1']) assert.equal(isQAEnabled(true, search), false);
  assert.equal(isQAEnabled(true, '?qa=1'), true);
  assert.equal(isQAEnabled(false, '?qa=1'), false);
  assert.equal(isQAAllEnabled(true, '?qa=1&all=1'), true);
  assert.equal(isQAAllEnabled(true, '?qa=1'), false);
  assert.equal(isQAAllEnabled(false, '?qa=1&all=1'), false);
});
test('build gate fails closed for production and unknown builds', () => {
  const previous = process.env.VERCEL_ENV;
  try {
    for (const [env, command, allowed] of [['production','build',false],['production','serve',false],['preview','build',true],['','build',false],['','serve',true]]) {
      process.env.VERCEL_ENV = env;
      assert.equal(config({command}).define.__DESAFIA_QA_ALLOWED__, String(allowed));
    }
  } finally { if (previous === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previous; }
});
test('QA onboarding and state never overwrite ordinary local state', () => {
  const { backing, storage, qa } = fixture();
  backing.setItem('desafia-local-v3', 'normal-state');
  backing.setItem('desafia-local-onboarded', 'normal-onboarding');
  qa.onboarding(true);
  qa.economy(35, 250);
  assert.equal(storage.getItem('desafia-local-onboarded'), '1');
  qa.onboarding(false);
  assert.equal(storage.getItem('desafia-local-onboarded'), null);
  assert.equal(backing.getItem('desafia-local-v3'), 'normal-state');
  assert.equal(backing.getItem('desafia-local-onboarded'), 'normal-onboarding');
});
test('pending missions require approval and award nothing until approved', async () => {
  const { qa } = fixture();
  await qa.missions('pending');
  const pending = await qa.api.snapshot();
  assert.ok(pending.missions.every((m) => m.status === 'pending'));
  assert.equal(pending.wallet, 0); assert.equal(pending.xp, 0);
  assert.equal((await qa.api.playStatus()).missions.requires_approval, true);
  assert.equal((await qa.api.playStatus()).missions.ok, false);
  await assert.rejects(qa.api.playStart(), /MISSIONS_PENDING/);
  await qa.missions('done');
  const done = await qa.api.snapshot();
  assert.ok(done.missions.every((m) => m.status === 'done'));
  assert.equal(done.wallet, 145); assert.equal(done.xp, 78);
  for (const m of done.missions) await qa.api.decideMission(m.id, true);
  assert.equal((await qa.api.snapshot()).wallet, 145);
  await qa.missions('todo');
  assert.ok((await qa.api.snapshot()).missions.every((m) => m.status === 'todo'));
  assert.equal((await qa.api.snapshot()).dailyBonusDay, null);
});
test('unlock uses the existing catalogue and starts a playable local park', async () => {
  const { qa } = fixture();
  await qa.unlockGames();
  const play = await qa.api.playStatus();
  assert.deepEqual(play.unlocked, GAME_IDS);
  assert.equal(play.started, true); assert.equal(play.missions.ok, true);
  assert.equal(play.remaining_seconds, 1800);
  await qa.api.gameScore(GAME_IDS[0], 250);
  assert.equal((await qa.api.playStatus()).best[GAME_IDS[0]], 250);
});
test('QA tudo liberado abre gates sem tocar em Supabase', async () => {
  const { qa } = fixture();
  const snap = await qa.unlockEverything();
  const play = await qa.api.playStatus();
  assert.equal(snap.wallet, 5000);
  assert.equal(levelOf(snap.xp), LEVEL_THRESHOLDS.length);
  assert.ok(snap.missions.every((m) => m.status === 'done'));
  assert.equal(snap.dailyBonusDay, snap.adventure.day);
  assert.equal(snap.streak, 7);
  assert.deepEqual(play.unlocked, GAME_IDS);
  assert.equal(play.plus, true);
  assert.equal(play.catalog.length, GAME_IDS.length);
  assert.equal(play.started, true);
  assert.equal(play.remaining_seconds, 1800);
});

test('progress presets reuse level and house unlock rules', async () => {
  const { qa } = fixture();
  for (const [preset, level, stage] of [['low',1,1],['medium',6,3],['high',12,4]]) {
    qa.progress(preset); const snap = await qa.api.snapshot();
    assert.equal(levelOf(snap.xp), level); assert.equal(stageOf(snap.xp), stage);
    assert.ok(unlockedHouseItems(snap.xp).every((item) => item.level <= level));
  }
});
test('economy rejects invalid input atomically and survives recreation', async () => {
  const { storage, qa } = fixture();
  qa.economy(42, 700);
  for (const value of [-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => qa.economy(50, value));
  const snap = await createQAState(storage).api.snapshot();
  assert.equal(snap.wallet, 42); assert.equal(snap.xp, 700);
});
test('QA reset removes only QA state, including games, onboarding and preferences', async () => {
  const { backing, storage, qa } = fixture();
  backing.setItem('other-app', 'keep');
  storage.setItem('desafia-panel-collapsed-v1', '1');
  qa.onboarding(true); await qa.unlockGames(); qa.reset();
  assert.equal(backing.getItem('other-app'), 'keep');
  assert.equal(storage.getItem('desafia-local-onboarded'), null);
  assert.equal(storage.getItem('desafia-panel-collapsed-v1'), null);
  assert.equal((await qa.api.snapshot()).xp, 0);
  assert.deepEqual((await qa.api.playStatus()).unlocked, []);
});
test('ordinary local adapter still uses its original state and game keys', async () => {
  const storage = memory(); const api = createLocal({storage});
  for (const mission of (await api.snapshot()).missions) { await api.markDone(mission.id); await api.decideMission(mission.id, true); }
  const snap = await api.snapshot(); assert.equal(snap.wallet,145); assert.equal(snap.xp,78);
  await api.playStart();
  assert.ok(storage.getItem('desafia-local-v3')); assert.ok(storage.getItem('desafia-local-play-v1'));
  assert.equal(storage.getItem('state'), null);
});
test('level boundaries and progress remain consistent', () => {
  LEVEL_THRESHOLDS.forEach((xp, i) => { assert.equal(levelOf(xp), i + 1); assert.equal(levelProgress(xp).pct, 0); if (xp > 0) assert.equal(levelOf(xp - 1), i); });
  assert.equal(levelOf(-1),1); assert.equal(stageOf(250),2);
});
