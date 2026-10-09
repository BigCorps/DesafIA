import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { paymentAmountMatches, paidAmountCents } from '../supabase/functions/desafia-billing/payment-validation.js';
import { selectDistribution } from '../src/shared/platform.js';
import { createLocal } from '../src/game/local.js';
import { createQAState } from '../src/game/qa-state.js';
import { GAME_IDS, FREE_GAME_IDS, PLUS_GAME_IDS } from '../src/games/registry.js';

const migration = readFileSync(new URL('../supabase/migrations/20261009180000_desafia_security_hardening.sql', import.meta.url), 'utf8');
const cloud = readFileSync(new URL('../src/game/cloud.js', import.meta.url), 'utf8');
const billing = readFileSync(new URL('../supabase/functions/desafia-billing/index.ts', import.meta.url), 'utf8');

test('paid status rejects missing, malformed, incorrect, or fractional-cent amounts', () => {
  for (const value of [null, undefined, '', 0, -19.9, NaN, Infinity, '19.900',
    '19.900', 19.91, 19.899, 'wrong']) {
    assert.equal(paymentAmountMatches(value, 1990), false, String(value));
  }
  assert.equal(paymentAmountMatches(19.9, 1990), true);
  assert.equal(paymentAmountMatches('19.90', 1990), true);
  assert.equal(paymentAmountMatches('19,90', 1990), true);
  assert.equal(paidAmountCents(19.9), 1990);
  assert.equal(paymentAmountMatches(19.9, 0), false);
  assert.equal(paymentAmountMatches(19.9, Number.NaN), false);
  assert.match(billing, /if \(!paymentAmountMatches\(result\.amount, Number\(invoice\.amount_cents\)\)\)/);
});

test('failed code commits its SQL attempt and the client translates NULL', () => {
  const start = migration.indexOf('if pid is null then');
  const end = migration.indexOf('end if;', start);
  assert.ok(start > 0 && end > start);
  const invalid = migration.slice(start, end);
  assert.match(invalid, /insert into desafia\.pairing_attempts\(token_hash,success\)/);
  assert.match(invalid, /return null;/);
  assert.doesNotMatch(invalid, /raise exception/);
  assert.match(cloud, /if \(!data\) throw new Error\('INVALID_CODE'\)/);
});

test('pairing has per-device and cross-token concurrency rate limits', () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /token_fail_count >= 12/);
  assert.match(migration, /global_fail_count >= 1200/);
  assert.match(migration, /pairing_attempts_fail_window_idx/);
  assert.match(migration, /if auth\.uid\(\) is not null/);
});

test('score RPC checks mission, time, parental game settings and Plus access', () => {
  const game = migration.slice(migration.indexOf('create or replace function desafia.game_score'));
  for (const keyword of ['for update', 'for share', 'PLAY_OFF', 'MISSIONS_PENDING',
    'PLAY_NOT_STARTED', 'LIMIT_REACHED', 'games_disabled', 'GAME_LOCKED',
    'GAME_REQUIRES_PLUS', 'game_unlocks']) assert.ok(game.includes(keyword), keyword);
  assert.match(game, /device_player\(p_device_token\)/);
});

test('Play distribution resists ?store=web downgrade', () => {
  assert.equal(selectDistribution('play', 'web'), 'play');
  assert.equal(selectDistribution('play', null), 'play');
  assert.equal(selectDistribution('web', 'play'), 'play');
  assert.equal(selectDistribution(null, 'play'), 'play');
  assert.equal(selectDistribution('web', 'web'), 'web');
  assert.equal(selectDistribution(null, null), 'web');
});

function memoryStorage() {
  const items = new Map();
  return {
    get length() { return items.size; },
    getItem: (k) => items.get(k) ?? null,
    setItem: (k,v) => { items.set(k,String(v)); },
    removeItem: (k) => { items.delete(k); },
    key: (i) => [...items.keys()][i] ?? null,
    clear: () => { items.clear(); }
  };
}

test('offline demo cannot use paid catalog or previously persisted paid unlocks', async () => {
  const storage = memoryStorage();
  const local = createLocal({ storage, stateKey: 'demo-state', playKey: 'demo-play' });
  const before = await local.playStatus();
  assert.equal(before.plus, false);
  assert.deepEqual(before.catalog, FREE_GAME_IDS);
  storage.setItem('demo-play', JSON.stringify({
    day: before.day, unlocked: [PLUS_GAME_IDS[0]], startedDay: before.day,
    featured: PLUS_GAME_IDS[0], newGames: [PLUS_GAME_IDS[0]], best: { [PLUS_GAME_IDS[0]]: 999 }
  }));
  const after = await local.playStatus();
  assert.deepEqual(after.unlocked, []);
  assert.deepEqual(after.new_games, []);
  assert.equal(after.featured, null);
  assert.deepEqual(after.best, {});
  await assert.rejects(local.gameScore(PLUS_GAME_IDS[0],100), /GAME_REQUIRES_PLUS/);
});

test('isolated QA mode preserves explicit access to all games', async () => {
  const qa = createQAState(memoryStorage());
  await qa.unlockEverything();
  const play = await qa.api.playStatus();
  assert.equal(play.plus, true);
  assert.deepEqual(play.catalog, GAME_IDS);
  assert.ok(PLUS_GAME_IDS.every((id)=>play.unlocked.includes(id)));
});
