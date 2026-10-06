// Optional local PostgreSQL/WASM tests: no Supabase connection or project changes.
// Point DESAFIA_TEST_PGLITE_ROOT at an isolated @electric-sql/pglite installation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.env.DESAFIA_TEST_PGLITE_ROOT;
if (!root) throw new Error('Set DESAFIA_TEST_PGLITE_ROOT to the @electric-sql/pglite package directory (see docs/ONESIGNAL.md).');
const { PGlite } = await import(pathToFileURL(resolve(root, 'dist/index.js')));
const { pgcrypto } = await import(pathToFileURL(resolve(root, 'dist/contrib/pgcrypto.js')));
const db = new PGlite({ extensions: { pgcrypto } });
const sql = (query, args = []) => db.query(query, args);
const value = async (query, args = []) => (await sql(query, args)).rows[0].value;
const parent = '10000000-0000-4000-8000-000000000001';
const outsider = '10000000-0000-4000-8000-000000000002';
const family = '20000000-0000-4000-8000-000000000001';
const player = '30000000-0000-4000-8000-000000000001';
const device = '40000000-0000-4000-8000-000000000001';
const mission = '50000000-0000-4000-8000-000000000001';
const token = 'a'.repeat(64);
const login = (id = parent) => sql("select set_config('request.jwt.claim.sub',$1,false)", [id || '']);
const prefs = () => sql("select desafia.parent_set_notification_preferences($1,true,true,'19:00',(now()+interval '8h')::time,(now()+interval '9h')::time)", [family]);
const authorize = (enabled = true, second = false) => sql("select desafia.parent_set_device_notifications($1,$2,$3,'18:00',$4,'19:30',(now()+interval '8h')::time,(now()+interval '9h')::time)", [family, device, enabled, second]);
const claim = () => value('select desafia.notification_claim() as value');
const state = () => value('select desafia.device_notification_state($1) as value', [token]);
const mark = () => value('select desafia.mark_mission_done($1,$2) as value', [token, mission]);
const count = () => value('select count(*)::integer as value from desafia.notification_outbox');
const activateParent = async () => {
  await login(); await sql('select desafia.my_notification_identity()'); await prefs();
  await sql('select desafia.parent_notification_subscription(true)');
};
const activateChild = async (second = false) => {
  await login(); await authorize(true, second); await login(null);
  await sql('select desafia.device_notification_subscription($1,true)', [token]);
};
const due = () => sql("update desafia.notification_outbox set scheduled_for=now()-interval '1 minute'");
const childItem = (slot = 1, suffix = '') => sql(`insert into desafia.notification_outbox(family_id,event_type,target_kind,target_device_id,dedupe_key,payload)
  values($1,'child_reminder','child_device',$2,$3,jsonb_build_object('day',(now() at time zone 'UTC')::date,'slot',$4::integer))`, [family, device, `test-child:${slot}:${suffix}`, slot]);
const complete = (item, success = true, retry = false) => value('select desafia.notification_complete($1,$2,$3,$4,$5,$6) as value', [item.id, item.claim_token, success, success ? 'test-message' : null, success ? null : 'test_network', retry]);

test('notification migration and delivery contracts on isolated PostgreSQL', async (t) => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema extensions; create extension pgcrypto with schema extensions;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;`);
  const dir = new URL('../supabase/migrations/', import.meta.url);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const definitions = () => sql("select p.oid::regprocedure::text as signature,pg_get_functiondef(p.oid) as definition,p.proacl::text as acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='desafia'");
  let before;
  for (const file of files) {
    if (file === '20261006000100_desafia_notifications.sql') before = (await definitions()).rows;
    await db.exec(await readFile(new URL(file, dir), 'utf8'));
  }
  const after = (await definitions()).rows;
  await t.test('all historical RPC definitions/ACLs stay identical except mission enqueue; no public tables', async () => {
    for (const row of before) {
      const current = after.find((r) => r.signature === row.signature);
      assert.equal(current.acl, row.acl, row.signature);
      if (!row.signature.includes('.mark_mission_done(')) assert.equal(current.definition, row.definition, row.signature);
    }
    assert.equal(await value("select count(*)::integer as value from pg_tables where schemaname='public'"), 0);
  });
  async function scenario(name, run) {
    await t.test(name, async () => {
      await db.exec('begin');
      try {
        await db.exec(`insert into auth.users(id) values('${parent}'),('${outsider}');
          insert into desafia.families(id,name,timezone) values('${family}','Local test','UTC');
          insert into desafia.family_members(family_id,user_id) values('${family}','${parent}');
          insert into desafia.players(id,family_id,nickname) values('${player}','${family}','Local child');
          insert into desafia.devices(id,player_id,token_hash) values('${device}','${player}',desafia.token_hash('${token}'));
          insert into desafia.missions(id,family_id,title,star_reward,xp_reward) values('${mission}','${family}','Local mission',20,10);`);
        await login(null); await run();
      } finally { await db.exec('rollback'); await db.exec('reset role'); }
    });
  }
  await scenario('RLS and explicit ACLs prevent direct browser/table access and processor calls', async () => {
    const tables = (await sql("select tablename from pg_tables where schemaname='desafia' and tablename like 'notification_%'")).rows;
    assert.equal(tables.length, 5);
    for (const { tablename } of tables) {
      assert.equal(await value('select relrowsecurity as value from pg_class where oid=$1::regclass', [`desafia.${tablename}`]), true);
      for (const role of ['anon', 'authenticated']) assert.equal(await value('select has_table_privilege($1,$2,\'SELECT,INSERT,UPDATE,DELETE\') as value', [role, `desafia.${tablename}`]), false);
    }
    for (const role of ['anon', 'authenticated']) {
      assert.equal(await value("select has_function_privilege($1,'desafia.notification_claim(integer)','EXECUTE') as value", [role]), false);
      assert.equal(await value("select has_function_privilege($1,'desafia.notification_prepare(timestamptz)','EXECUTE') as value", [role]), false);
    }
    assert.equal(await value("select has_function_privilege('anon','desafia.device_notification_state(text)','EXECUTE') as value"), true);
    assert.equal(await value("select has_function_privilege('authenticated','desafia.my_notification_identity()','EXECUTE') as value"), true);
  });
  await scenario('parent identity is opaque/stable; strangers cannot authorize family devices', async () => {
    await login();
    const first = await value('select desafia.my_notification_identity() as value');
    assert.notEqual(first.external_id, parent); assert.equal(first.active, false);
    assert.equal((await value('select desafia.my_notification_identity() as value')).external_id, first.external_id);
    await login(outsider);
    await db.exec('savepoint denied');
    await assert.rejects(authorize(), /FORBIDDEN/);
    await db.exec('rollback to savepoint denied');
    await assert.rejects(sql('select desafia.parent_notification_settings($1)', [family]), /FORBIDDEN/);
    await db.exec('rollback to savepoint denied');
  });
  await scenario('child identity only follows parental consent; disable/revoke removes external ID', async () => {
    assert.equal((await state()).authorized, false); assert.equal((await state()).external_id, null);
    assert.equal(await value('select count(*)::integer as value from desafia.notification_identities'), 0);
    await activateChild();
    assert.equal((await state()).authorized, true); assert.equal((await state()).push_active, true);
    await login(); await authorize(false); await login(null);
    assert.equal((await state()).authorized, false); assert.equal((await state()).external_id, null);
    await activateChild();
    await sql('update desafia.devices set revoked_at=now() where id=$1', [device]);
    assert.deepEqual(await state(), { authorized: false, push_active: false });
    assert.equal(await value('select active as value from desafia.notification_identities where device_id=$1', [device]), false);
  });
  await scenario('changed pairing cannot reuse old parental consent', async () => {
    await activateChild();
    const other = '30000000-0000-4000-8000-000000000002';
    await sql('insert into desafia.players(id,family_id,nickname) values($1,$2,\'Another local child\')', [other, family]);
    await sql('update desafia.devices set player_id=$1 where id=$2', [other, device]);
    assert.equal((await state()).authorized, false); assert.equal((await state()).external_id, null);
  });
  await scenario('mission retry does not duplicate; rejected resubmission does; original rewards remain intact', async () => {
    await activateParent(); await login(null);
    assert.equal(await mark(), 'pending'); assert.equal(await count(), 1);
    assert.equal(await mark(), 'pending'); assert.equal(await count(), 1);
    const log = await value('select id as value from desafia.mission_logs');
    await login(); await sql('select desafia.decide_mission($1,false)', [log]); await login(null);
    assert.equal(await mark(), 'pending'); assert.equal(await count(), 2);
    await login(); await sql('select desafia.decide_mission($1,true)', [log]); await login(null);
    assert.equal(await mark(), 'done'); assert.equal(await count(), 2);
    // Existing mission + complete-day bonus: no additional push rewards.
    assert.deepEqual((await sql('select xp,wallet from desafia.players where id=$1', [player])).rows[0], { xp: 25, wallet: 45 });
    await login(); await sql('select desafia.decide_mission($1,true)', [log]);
    assert.deepEqual((await sql('select xp,wallet from desafia.players where id=$1', [player])).rows[0], { xp: 25, wallet: 45 });
  });
  await scenario('aggregation, competing claims, claim tokens and sent dedupe', async () => {
    await activateParent(); await login(null); await mark();
    const second = '50000000-0000-4000-8000-000000000002';
    await sql('insert into desafia.missions(id,family_id,title) values($1,$2,\'Second local mission\')', [second, family]);
    await sql('select desafia.mark_mission_done($1,$2)', [token, second]); await due();
    const items = await claim(); assert.equal(items.length, 1); assert.equal(items[0].mission_count, 2);
    assert.deepEqual(await claim(), []);
    assert.equal(await value('select desafia.notification_complete($1,$2,true) as value', [items[0].id, parent]), false);
    assert.equal(await complete(items[0]), true); assert.equal(await complete(items[0]), false);
    assert.equal(await value("select count(*)::integer as value from desafia.notification_outbox where last_error='aggregated'"), 1);
    assert.deepEqual(await claim(), []);
  });
  await scenario('lease retry reuses outbox UUID, changes claim token and preserves reservation', async () => {
    await activateParent(); await login(null); await mark(); await due();
    const [first] = await claim(); await complete(first, false, true); await due();
    const [retry] = await claim(); assert.equal(retry.id, first.id); assert.notEqual(retry.claim_token, first.claim_token);
    assert.equal(await complete(first), false);
    await sql("update desafia.notification_outbox set claimed_at=now()-interval '11 minutes' where id=$1", [retry.id]);
    const [recovered] = await claim(); assert.equal(recovered.id, first.id); assert.notEqual(recovered.claim_token, retry.claim_token);
    assert.equal(await value('select count(*)::integer as value from desafia.notification_delivery_events'), 1);
  });
  await scenario('quiet hours cross midnight and honor exact boundaries', async () => {
    for (const [at, expected] of [['19:59', false], ['20:00', true], ['23:59', true], ['00:00', true], ['07:59', true], ['08:00', false]]) {
      assert.equal(await value("select desafia.notification_in_quiet($1::time,'20:00','08:00') as value", [at]), expected, at);
    }
    assert.equal(await value("select desafia.notification_in_quiet('12:00','08:00','08:00') as value"), true);
  });
  await scenario('scheduler uses family timezone and daily/slot dedupe, never UTC assumptions', async () => {
    await activateParent(); await activateChild(true);
    await sql("insert into desafia.missions(id,family_id,title) values('50000000-0000-4000-8000-000000000002',$1,'Waiting mission')", [family]);
    await sql("insert into desafia.mission_logs(player_id,mission_id,day,status,star_reward,xp_reward) values($1,'50000000-0000-4000-8000-000000000002',current_date,'pending',20,10)", [player]);
    await sql("update desafia.families set timezone='Asia/Tokyo' where id=$1", [family]);
    await sql("update desafia.notification_device_preferences set quiet_start='20:00',quiet_end='08:00' where device_id=$1", [device]);
    await sql("update desafia.notification_parent_preferences set quiet_start='20:00',quiet_end='08:00' where family_id=$1", [family]);
    assert.equal(await value("select desafia.notification_prepare('2026-10-06T09:15:00Z') as value"), 1); // Tokyo 18:15
    assert.equal(await value("select desafia.notification_prepare('2026-10-06T09:30:00Z') as value"), 0);
    assert.equal(await value("select desafia.notification_prepare('2026-10-06T10:15:00Z') as value"), 1); // Tokyo 19:15 summary
    assert.equal(await value("select desafia.notification_prepare('2026-10-06T10:35:00Z') as value"), 1); // child second slot
    assert.equal(await value("select desafia.notification_prepare('2026-10-06T11:15:00Z') as value"), 0); // quiet 20:15
    assert.equal(await count(), 3);
  });
  await scenario('child default max one/day; explicit second allows two, then stops', async () => {
    await activateChild(); await childItem(); const [first] = await claim(); assert.ok(first); await complete(first);
    await childItem(1, 'duplicate'); assert.deepEqual(await claim(), []);
    assert.equal(await value("select count(*)::integer as value from desafia.notification_outbox where last_error='daily_limit'"), 1);
    await login(); await authorize(true, true); await login(null);
    await sql("update desafia.notification_delivery_events set sent_at=now()-interval '2 hours',reserved_at=now()-interval '2 hours'");
    await childItem(2); const [second] = await claim(); assert.ok(second); await complete(second);
    await childItem(2, 'duplicate'); assert.deepEqual(await claim(), []);
  });
  await scenario('no child reminders while waiting for approval or done; rejected remains eligible', async () => {
    await activateChild(); await mark(); await childItem(); assert.deepEqual(await claim(), []);
    await sql("update desafia.mission_logs set status='rejected'");
    await childItem(1, 'resubmitted'); const [rejected] = await claim(); assert.ok(rejected);
    await sql("update desafia.mission_logs set status='done'");
    assert.equal(await value('select desafia.notification_validate_claim($1,$2) as value', [rejected.id, rejected.claim_token]), false);
  });
  await scenario('revoked consent is rechecked after claim and prevents later delivery', async () => {
    await activateChild(); await childItem(); const [item] = await claim(); assert.ok(item);
    assert.equal(await value('select desafia.notification_validate_claim($1,$2) as value', [item.id, item.claim_token]), true);
    await login(); await authorize(false);
    assert.equal(await value('select desafia.notification_validate_claim($1,$2) as value', [item.id, item.claim_token]), false);
  });
  await scenario('parent cooldown and shared four-per-24h limit suppress bursts', async () => {
    await activateParent(); await login(null); await mark(); await due();
    const [first] = await claim(); await complete(first);
    for (let attempt = 0; attempt < 3; attempt++) {
      await sql("update desafia.mission_logs set status='rejected'"); await mark(); await due();
      assert.deepEqual(await claim(), []); // still inside cooldown
      await sql("update desafia.notification_delivery_events set sent_at=now()-interval '31 minutes',reserved_at=now()-interval '31 minutes'");
      await due(); const [next] = await claim(); assert.ok(next); await complete(next);
    }
    await sql("update desafia.mission_logs set status='rejected'"); await mark(); await due();
    assert.deepEqual(await claim(), []);
    assert.equal(await value("select count(*)::integer as value from desafia.notification_outbox where last_error='daily_limit'"), 1);
  });
  await scenario('summary requires real pendencies; rewards alone qualify and daily key stays unique', async () => {
    await activateParent();
    await sql("update desafia.notification_parent_preferences set daily_summary_time=(now() at time zone 'UTC')::time");
    assert.equal(await value('select desafia.notification_prepare() as value'), 0);
    await sql("insert into desafia.rewards(id,family_id,title,cost) values('60000000-0000-4000-8000-000000000001',$1,'Local reward',100)", [family]);
    await sql("insert into desafia.reward_requests(player_id,reward_id,cost) values($1,'60000000-0000-4000-8000-000000000001',100)", [player]);
    assert.equal(await value('select desafia.notification_prepare() as value'), 1);
    assert.equal(await value('select desafia.notification_prepare() as value'), 0);
    const [summary] = await claim(); assert.equal(summary.event_type, 'parent_daily_summary');
    assert.equal(summary.mission_count, 0); assert.equal(summary.reward_count, 1);
    await complete(summary);
    assert.equal(await value('select desafia.notification_prepare() as value'), 0);
  });
  await scenario('repeated wall-clock hour during DST still generates only one daily slot', async () => {
    await activateChild();
    await sql("update desafia.families set timezone='America/New_York'");
    await sql("update desafia.notification_device_preferences set first_reminder_time='01:00',quiet_start='12:00',quiet_end='13:00'");
    assert.equal(await value("select desafia.notification_prepare('2026-11-01T05:15:00Z') as value"), 1);
    assert.equal(await value("select desafia.notification_prepare('2026-11-01T06:15:00Z') as value"), 0);
  });
  await scenario('expired daily item is skipped even with all-day quiet hours', async () => {
    await activateChild(); await childItem();
    await sql("update desafia.notification_device_preferences set quiet_start='00:00',quiet_end='00:00'");
    await sql("update desafia.notification_outbox set payload=payload||jsonb_build_object('day',current_date-1)");
    assert.deepEqual(await claim(), []);
    assert.equal(await value('select status as value from desafia.notification_outbox'), 'skipped');
  });
  await db.close();
});
