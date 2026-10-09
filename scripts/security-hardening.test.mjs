import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { paymentAmountMatches, paidAmountCents } from '../supabase/functions/desafia-billing/payment-validation.js';
import { selectDistribution } from '../src/shared/platform.js';

const migration = readFileSync(new URL('../supabase/migrations/20261009180000_desafia_security_hardening.sql', import.meta.url), 'utf8');
const cloud = readFileSync(new URL('../src/game/cloud.js', import.meta.url), 'utf8');
const billing = readFileSync(new URL('../supabase/functions/desafia-billing/index.ts', import.meta.url), 'utf8');

test('paid status rejects missing, malformed, incorrect, or fractional-cent amounts', () => {
  for (const value of [null, undefined, '', 0, -19.9, NaN, Infinity, '19,90',
    '19.900', 19.91, 19.899, 'wrong']) {
    assert.equal(paymentAmountMatches(value, 1990), false, String(value));
  }
  assert.equal(paymentAmountMatches(19.9, 1990), true);
  assert.equal(paymentAmountMatches('19.90', 1990), true);
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
