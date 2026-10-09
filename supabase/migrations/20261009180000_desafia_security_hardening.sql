-- DesafIA 09/10/2026: strictly scoped RPC hardening.
-- Apply only after compatible client release; historical migrations remain intact.
begin;

-- Bounded global anonymous-pairing scan, independent of client-supplied token.
create index if not exists desafia_pairing_attempts_fail_window_idx
  on desafia.pairing_attempts (attempted_at desc)
  where success = false;

-- An INVALID_CODE exception would roll back the attempted-code log.
-- Instead return SQL NULL, which the compatible frontend translates to an error.
create or replace function desafia.pair_device(
  p_code text,
  p_device_token text,
  p_label text default 'Aparelho'
) returns uuid
language plpgsql
security definer
set search_path=desafia,pg_catalog,extensions,pg_temp
as $$
declare
  h bytea;
  pid uuid;
  token_fail_count integer;
  global_fail_count integer;
  did uuid;
begin
  if auth.uid() is not null then raise exception 'FORBIDDEN'; end if;
  h := desafia.token_hash(p_device_token);

  -- Serialize checks and writes even if a caller rotates its local token.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('desafia:pairing-rate-limit:v1',0)
  );

  select count(*) into token_fail_count
  from (
    select 1 from desafia.pairing_attempts
    where token_hash=h and success=false
      and attempted_at > now() - interval '10 minutes'
    limit 12
  ) recent_token;
  if token_fail_count >= 12 then raise exception 'TOO_MANY_ATTEMPTS'; end if;

  -- A deliberately conservative quota for the ENTIRE pairing endpoint;
  -- a deliberate attack can temporarily exhaust it (documented trade-off).
  select count(*) into global_fail_count
  from (
    select 1 from desafia.pairing_attempts
    where success=false and attempted_at > now() - interval '10 minutes'
    limit 1200
  ) recent_global;
  if global_fail_count >= 1200 then raise exception 'TOO_MANY_ATTEMPTS'; end if;

  select player_id into pid
  from desafia.pairing_codes
  where code=desafia.clean_code(p_code) and expires_at>now()
  for update;

  if pid is null then
    insert into desafia.pairing_attempts(token_hash,success) values(h,false);
    return null; -- do not RAISE: the insert must commit
  end if;
  if not exists(select 1 from desafia.players where id=pid and kind='child') then
    raise exception 'CHILD_ONLY';
  end if;

  insert into desafia.devices(player_id,token_hash,label,revoked_at,last_seen_at)
  values(pid,h,left(coalesce(nullif(trim(p_label),''),'Aparelho'),40),null,now())
  on conflict(token_hash) do update
    set player_id=excluded.player_id,label=excluded.label,
        revoked_at=null,last_seen_at=now()
  returning id into did;

  insert into desafia.pairing_attempts(token_hash,success) values(h,true);
  delete from desafia.pairing_codes where player_id=pid;
  return pid;
end $$;

-- A client cannot publish a score outside an actively permitted play session.
create or replace function desafia.game_score(
  p_device_token text,
  p_game text,
  p_score integer
) returns jsonb
language plpgsql
security definer
set search_path=desafia,pg_catalog,extensions,pg_temp
as $$
declare
  pid uuid;
  fid uuid;
  today date;
  disabled text[];
  st jsonb;
  b integer;
  before_score integer;
begin
  if auth.uid() is not null then raise exception 'FORBIDDEN'; end if;
  pid := desafia.device_player(p_device_token);
  if pid is null then raise exception 'NOT_PAIRED'; end if;
  select family_id into fid from desafia.players where id=pid;
  today := desafia.family_today(fid);

  -- Same row as play_tick, preventing a score/timeout lost-update race.
  perform 1 from desafia.play_days
    where player_id=pid and day=today and started_at is not null
    for update;
  if not found then raise exception 'PLAY_NOT_STARTED'; end if;

  -- Lock family row while checking parental settings.
  select games_disabled into disabled
  from desafia.families where id=fid for share;
  st := desafia.play_state(pid);

  if not coalesce((st->>'enabled')::boolean,false) then raise exception 'PLAY_OFF'; end if;
  if not coalesce((st->'missions'->>'ok')::boolean,false) then raise exception 'MISSIONS_PENDING'; end if;
  if not coalesce((st->>'started')::boolean,false) then raise exception 'PLAY_NOT_STARTED'; end if;
  if coalesce((st->>'remaining_seconds')::integer,0) <= 0 then raise exception 'LIMIT_REACHED'; end if;
  if p_game = any(coalesce(disabled,'{}'::text[])) then raise exception 'GAME_LOCKED'; end if;
  if not (p_game = any(desafia.game_catalog_for_family(fid))) then raise exception 'GAME_REQUIRES_PLUS'; end if;
  if not exists (
    select 1 from desafia.game_unlocks
    where player_id=pid and game_id=p_game
  ) then raise exception 'GAME_LOCKED'; end if;

  select best into before_score from desafia.game_scores
    where player_id=pid and game_id=p_game;

  insert into desafia.game_scores(player_id,game_id,best,plays)
  values(pid,p_game,least(greatest(coalesce(p_score,0),0),10000000),1)
  on conflict(player_id,game_id) do update
    set best=greatest(desafia.game_scores.best,excluded.best),
        plays=desafia.game_scores.plays+1,
        updated_at=now()
  returning best into b;
  return jsonb_build_object('best',b,'record',coalesce(before_score,0)<b);
end $$;

-- Restrict public invocation to deliberately anonymous child-device RPCs.
revoke execute on function desafia.pair_device(text,text,text) from public,authenticated;
revoke execute on function desafia.game_score(text,text,integer) from public,authenticated;
grant execute on function desafia.pair_device(text,text,text) to anon;
grant execute on function desafia.game_score(text,text,integer) to anon;

commit;
