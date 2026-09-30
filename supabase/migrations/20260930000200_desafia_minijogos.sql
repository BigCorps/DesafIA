-- ============================================================================
-- DesafIA — Parque de minijogos
--
-- Regras:
--   * O parque abre quando TODAS as missões infantis do dia estão concluídas
--     (aprovadas pelo adulto; os pais podem aceitar também as "esperando").
--   * Os pais definem quantos minutos por dia (0 = desligado, 10, 30, 60 ou livre).
--   * A cada dia completo, um jogo novo é desbloqueado aleatoriamente para o
--     álbum da criança (no primeiro dia, dois). Depois que todos estiverem
--     liberados, o sorteio escolhe o "jogo destaque" do dia.
--   * O tempo é contado no servidor (play_tick), então apagar dados do app
--     não zera o limite.
--
-- Rode DEPOIS de 20260929000100_desafia_schema.sql e 20260930000100_desafia_billing.sql.
-- ============================================================================
begin;

-- --------------------------------------------------------------------------
-- Configuração da família
-- --------------------------------------------------------------------------
alter table desafia.families
  add column if not exists play_minutes integer not null default 30
    check (play_minutes between 0 and 180);
alter table desafia.families
  add column if not exists play_requires_approval boolean not null default true;
alter table desafia.families
  add column if not exists games_disabled text[] not null default '{}';

-- --------------------------------------------------------------------------
-- Tabelas
-- --------------------------------------------------------------------------
create table if not exists desafia.play_days (
  player_id     uuid not null references desafia.players(id) on delete cascade,
  day           date not null,
  used_seconds  integer not null default 0 check (used_seconds >= 0),
  bonus_seconds integer not null default 0 check (bonus_seconds between 0 and 10800),
  new_games     text[] not null default '{}',
  featured_game text,
  started_at    timestamptz,
  last_tick_at  timestamptz,
  created_at    timestamptz not null default now(),
  primary key (player_id, day)
);

create table if not exists desafia.game_unlocks (
  player_id   uuid not null references desafia.players(id) on delete cascade,
  game_id     text not null,
  unlocked_on date not null,
  created_at  timestamptz not null default now(),
  primary key (player_id, game_id)
);

create table if not exists desafia.game_scores (
  player_id  uuid not null references desafia.players(id) on delete cascade,
  game_id    text not null,
  best       integer not null default 0 check (best between 0 and 10000000),
  plays      integer not null default 0 check (plays >= 0),
  updated_at timestamptz not null default now(),
  primary key (player_id, game_id)
);

alter table desafia.play_days    enable row level security;
alter table desafia.game_unlocks enable row level security;
alter table desafia.game_scores  enable row level security;

-- --------------------------------------------------------------------------
-- Catálogo (manter igual a src/games/registry.js)
-- --------------------------------------------------------------------------
create or replace function desafia.game_catalog()
returns text[] language sql immutable
set search_path=desafia,pg_catalog,extensions,pg_temp as $$
  select array['pula','voa','trenzinho','torre','bloquinhos','evolucao','frutas','memoria','estrelinha','cores']::text[]
$$;

-- Missões do dia: quantas existem e quantas contam para liberar o parque.
create or replace function desafia.play_missions_state(pid uuid)
returns jsonb language plpgsql stable security definer
set search_path=desafia,pg_catalog,extensions,pg_temp as $$
declare fid uuid; today date; approval boolean; total int; ok int; waiting int;
begin
  select p.family_id, f.play_requires_approval into fid, approval
    from desafia.players p join desafia.families f on f.id=p.family_id where p.id=pid;
  today:=desafia.family_today(fid);
  select count(*),
         count(*) filter (where l.status='done'),
         count(*) filter (where l.status='pending')
    into total, ok, waiting
    from desafia.missions m
    left join desafia.mission_logs l on l.mission_id=m.id and l.player_id=pid and l.day=today
   where m.family_id=fid and m.active and m.audience='child';
  return jsonb_build_object(
    'total', total,
    'done', ok,
    'waiting', waiting,
    'requires_approval', approval,
    'ok', total > 0 and (ok = total or (not approval and ok + waiting = total))
  );
end $$;

-- Estado completo do parque para um jogador.
create or replace function desafia.play_state(pid uuid)
returns jsonb language plpgsql stable security definer
set search_path=desafia,pg_catalog,extensions,pg_temp as $$
declare f desafia.families; today date; pd desafia.play_days; ms jsonb; allowed int;
begin
  select fam.* into f from desafia.families fam join desafia.players p on p.family_id=fam.id where p.id=pid;
  today:=desafia.family_today(f.id);
  select * into pd from desafia.play_days where player_id=pid and day=today;
  ms:=desafia.play_missions_state(pid);
  allowed:=f.play_minutes*60 + coalesce(pd.bonus_seconds,0);
  return jsonb_build_object(
    'day', today,
    'enabled', f.play_minutes > 0 or coalesce(pd.bonus_seconds,0) > 0,
    'minutes', f.play_minutes,
    'allowed_seconds', allowed,
    'used_seconds', coalesce(pd.used_seconds,0),
    'remaining_seconds', greatest(0, allowed - coalesce(pd.used_seconds,0)),
    'started', pd.started_at is not null,
    'missions', ms,
    'unlocked', coalesce((select jsonb_agg(u.game_id order by u.created_at)
                            from desafia.game_unlocks u where u.player_id=pid), '[]'::jsonb),
    'new_games', to_jsonb(coalesce(pd.new_games, '{}'::text[])),
    'featured', pd.featured_game,
    'disabled', to_jsonb(f.games_disabled),
    'best', coalesce((select jsonb_object_agg(s.game_id, s.best)
                        from desafia.game_scores s where s.player_id=pid), '{}'::jsonb)
  );
end $$;

-- --------------------------------------------------------------------------
-- Aparelho da criança (papel anon + segredo do aparelho)
-- --------------------------------------------------------------------------
create or replace function desafia.play_status(p_device_token text)
returns jsonb language plpgsql security definer
set search_path=desafia,pg_catalog,extensions,pg_temp as $$
declare pid uuid;
begin
  if auth.uid() is not null then raise exception 'FORBIDDEN'; end if;
  pid:=desafia.device_player(p_device_token);
  if pid is null then raise exception 'NOT_PAIRED'; end if;
  return desafia.play_state(pid);
end $$;

-- Abre o parque do dia: confere as missões, sorteia jogos novos e o destaque.
create or replace function desafia.play_start(p_device_token text)
returns jsonb language plpgsql security definer
set search_path=desafia,pg_catalog,extensions,pg_temp as $$
declare
  pid uuid; fid uuid; today date; st jsonb; disabled text[]; pool text[];
  already int; want int; picked text[] := '{}'; g text; feat text; yesterday text;
begin
  if auth.uid() is not null then raise exception 'FORBIDDEN'; end if;
  pid:=desafia.device_player(p_device_token);
  if pid is null then raise exception 'NOT_PAIRED'; end if;
  select family_id into fid from desafia.players where id=pid;
  today:=desafia.family_today(fid);
  st:=desafia.play_state(pid);
  if not (st->>'enabled')::boolean then raise exception 'PLAY_OFF'; end if;
  if not (st->'missions'->>'ok')::boolean then raise exception 'MISSIONS_PENDING'; end if;

  -- Já abriu hoje: só devolve o estado.
  if exists (select 1 from desafia.play_days where player_id=pid and day=today and started_at is not null) then
    return st;
  end if;

  select games_disabled into disabled from desafia.families where id=fid;
  select count(*) into already from desafia.game_unlocks where player_id=pid;
  want:=case when already=0 then 2 else 1 end;

  -- Jogos ainda não descobertos (e não desligados pelos pais), em ordem aleatória.
  for g in
    select x from unnest(desafia.game_catalog()) x
    where x <> all(disabled)
      and not exists (select 1 from desafia.game_unlocks u where u.player_id=pid and u.game_id=x)
    order by random()
    limit want
  loop
    insert into desafia.game_unlocks(player_id,game_id,unlocked_on) values (pid,g,today)
      on conflict do nothing;
    picked:=picked || g;
  end loop;

  if array_length(picked,1) > 0 then
    feat:=picked[1];
  else
    -- Álbum completo: sorteia um destaque diferente do de ontem.
    select featured_game into yesterday from desafia.play_days
      where player_id=pid and day<today order by day desc limit 1;
    select u.game_id into feat from desafia.game_unlocks u
      where u.player_id=pid and u.game_id <> all(disabled) and u.game_id is distinct from yesterday
      order by random() limit 1;
  end if;

  insert into desafia.play_days(player_id,day,new_games,featured_game,started_at)
    values (pid,today,picked,feat,now())
  on conflict (player_id,day) do update
    set new_games=excluded.new_games, featured_game=excluded.featured_game, started_at=now();

  return desafia.play_state(pid);
end $$;

-- Desconta tempo jogado. O servidor limita cada chamada ao tempo real decorrido.
create or replace function desafia.play_tick(p_device_token text, p_seconds integer)
returns jsonb language plpgsql security definer
set search_path=desafia,pg_catalog,extensions,pg_temp as $$
declare pid uuid; fid uuid; today date; pd desafia.play_days; delta int; allowed int; mins int;
begin
  if auth.uid() is not null then raise exception 'FORBIDDEN'; end if;
  pid:=desafia.device_player(p_device_token);
  if pid is null then raise exception 'NOT_PAIRED'; end if;
  select p.family_id, f.play_minutes into fid, mins
    from desafia.players p join desafia.families f on f.id=p.family_id where p.id=pid;
  today:=desafia.family_today(fid);
  select * into pd from desafia.play_days where player_id=pid and day=today for update;
  if pd.player_id is null or pd.started_at is null then raise exception 'PLAY_NOT_STARTED'; end if;

  delta:=least(
    greatest(coalesce(p_seconds,0),0),
    60,
    ceil(extract(epoch from now() - coalesce(pd.last_tick_at, now() - interval '60 seconds')))::int + 5
  );
  allowed:=mins*60 + pd.bonus_seconds;
  update desafia.play_days
     set used_seconds=least(allowed, used_seconds + delta), last_tick_at=now()
   where player_id=pid and day=today;
  return jsonb_build_object('remaining_seconds',
    greatest(0, allowed - (select used_seconds from desafia.play_days where player_id=pid and day=today)));
end $$;

-- Guarda o recorde de um jogo (só de jogos já desbloqueados).
create or replace function desafia.game_score(p_device_token text, p_game text, p_score integer)
returns jsonb language plpgsql security definer
set search_path=desafia,pg_catalog,extensions,pg_temp as $$
declare pid uuid; b int; before int;
begin
  if auth.uid() is not null then raise exception 'FORBIDDEN'; end if;
  pid:=desafia.device_player(p_device_token);
  if pid is null then raise exception 'NOT_PAIRED'; end if;
  if not exists (select 1 from desafia.game_unlocks where player_id=pid and game_id=p_game) then
    raise exception 'GAME_LOCKED';
  end if;
  select best into before from desafia.game_scores where player_id=pid and game_id=p_game;
  insert into desafia.game_scores(player_id,game_id,best,plays)
    values (pid,p_game,least(greatest(coalesce(p_score,0),0),10000000),1)
  on conflict (player_id,game_id) do update
    set best=greatest(desafia.game_scores.best, excluded.best),
        plays=desafia.game_scores.plays+1, updated_at=now()
  returning best into b;
  return jsonb_build_object('best', b, 'record', coalesce(before,0) < b);
end $$;

-- --------------------------------------------------------------------------
-- Portal dos pais
-- --------------------------------------------------------------------------
create or replace function desafia.parent_play_settings(p_family uuid)
returns jsonb language plpgsql stable security definer
set search_path=desafia,pg_catalog,extensions,pg_temp as $$
declare f desafia.families; today date;
begin
  if not desafia.is_family_parent(p_family) then raise exception 'FORBIDDEN'; end if;
  select * into f from desafia.families where id=p_family;
  today:=desafia.family_today(p_family);
  return jsonb_build_object(
    'minutes', f.play_minutes,
    'requires_approval', f.play_requires_approval,
    'disabled', to_jsonb(f.games_disabled),
    'catalog', to_jsonb(desafia.game_catalog()),
    'children', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'nickname', p.nickname, 'avatar', p.avatar,
        'used_seconds', coalesce(pd.used_seconds,0),
        'bonus_seconds', coalesce(pd.bonus_seconds,0),
        'opened_today', pd.started_at is not null,
        'unlocked', (select count(*) from desafia.game_unlocks u where u.player_id=p.id),
        'missions', desafia.play_missions_state(p.id),
        'best', coalesce((select jsonb_object_agg(s.game_id, jsonb_build_object('best',s.best,'plays',s.plays))
                            from desafia.game_scores s where s.player_id=p.id), '{}'::jsonb))
        order by p.created_at)
      from desafia.players p
      left join desafia.play_days pd on pd.player_id=p.id and pd.day=today
      where p.family_id=p_family and p.kind='child'), '[]'::jsonb)
  );
end $$;

create or replace function desafia.parent_update_play(p_family uuid, p_minutes integer, p_requires_approval boolean, p_disabled text[])
returns void language plpgsql security definer
set search_path=desafia,pg_catalog,extensions,pg_temp as $$
declare clean text[];
begin
  if not desafia.is_family_parent(p_family) then raise exception 'FORBIDDEN'; end if;
  if p_minutes is null or p_minutes < 0 or p_minutes > 180 then raise exception 'INVALID_MINUTES'; end if;
  select coalesce(array_agg(distinct x), '{}') into clean
    from unnest(coalesce(p_disabled,'{}')) x where x = any(desafia.game_catalog());
  if array_length(clean,1) >= array_length(desafia.game_catalog(),1) then raise exception 'KEEP_ONE_GAME'; end if;
  update desafia.families
     set play_minutes=p_minutes, play_requires_approval=coalesce(p_requires_approval,true), games_disabled=clean
   where id=p_family;
end $$;

-- Tempo extra só para hoje (ex.: +15 min num dia especial).
create or replace function desafia.parent_add_play_time(p_family uuid, p_player uuid, p_minutes integer)
returns void language plpgsql security definer
set search_path=desafia,pg_catalog,extensions,pg_temp as $$
declare today date;
begin
  if not desafia.is_family_parent(p_family) then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from desafia.players where id=p_player and family_id=p_family and kind='child') then
    raise exception 'FORBIDDEN';
  end if;
  if p_minutes is null or p_minutes < 1 or p_minutes > 120 then raise exception 'INVALID_MINUTES'; end if;
  today:=desafia.family_today(p_family);
  insert into desafia.play_days(player_id,day,bonus_seconds) values (p_player,today,p_minutes*60)
  on conflict (player_id,day) do update
    set bonus_seconds=least(10800, desafia.play_days.bonus_seconds + p_minutes*60);
end $$;

-- --------------------------------------------------------------------------
-- Permissões
-- --------------------------------------------------------------------------
revoke all on desafia.play_days, desafia.game_unlocks, desafia.game_scores from public, anon, authenticated;
grant all on desafia.play_days, desafia.game_unlocks, desafia.game_scores to service_role;

revoke execute on function desafia.game_catalog() from public, anon, authenticated;
revoke execute on function desafia.play_missions_state(uuid) from public, anon, authenticated;
revoke execute on function desafia.play_state(uuid) from public, anon, authenticated;
revoke execute on function desafia.play_status(text) from public, anon, authenticated;
revoke execute on function desafia.play_start(text) from public, anon, authenticated;
revoke execute on function desafia.play_tick(text, integer) from public, anon, authenticated;
revoke execute on function desafia.game_score(text, text, integer) from public, anon, authenticated;
revoke execute on function desafia.parent_play_settings(uuid) from public, anon, authenticated;
revoke execute on function desafia.parent_update_play(uuid, integer, boolean, text[]) from public, anon, authenticated;
revoke execute on function desafia.parent_add_play_time(uuid, uuid, integer) from public, anon, authenticated;

grant execute on function desafia.play_status(text) to anon;
grant execute on function desafia.play_start(text) to anon;
grant execute on function desafia.play_tick(text, integer) to anon;
grant execute on function desafia.game_score(text, text, integer) to anon;
grant execute on function desafia.parent_play_settings(uuid) to authenticated;
grant execute on function desafia.parent_update_play(uuid, integer, boolean, text[]) to authenticated;
grant execute on function desafia.parent_add_play_time(uuid, uuid, integer) to authenticated;
grant execute on all functions in schema desafia to service_role;

commit;
