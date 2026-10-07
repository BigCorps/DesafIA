begin;

create or replace function desafia.game_catalog()
returns text[] language sql immutable
set search_path=desafia,pg_catalog,extensions,pg_temp as $$
  select array[
    'pula','voa','trenzinho','torre','bloquinhos','evolucao','frutas','memoria','estrelinha','cores',
    'labirinto','constelacoes','ritmo'
  ]::text[]
$$;

create or replace function desafia.game_catalog_free()
returns text[] language sql immutable
set search_path=desafia,pg_catalog,extensions,pg_temp as $$
  select array[
    'pula','voa','trenzinho','torre','bloquinhos','evolucao','frutas','memoria','estrelinha','cores'
  ]::text[]
$$;

create or replace function desafia.game_catalog_for_family(fid uuid)
returns text[] language sql stable security definer
set search_path=desafia,pg_catalog,extensions,pg_temp as $$
  select case when desafia.family_is_plus(fid)
    then desafia.game_catalog()
    else desafia.game_catalog_free()
  end
$$;

create or replace function desafia.play_state(pid uuid)
returns jsonb language plpgsql stable security definer
set search_path=desafia,pg_catalog,extensions,pg_temp as $$
declare
  f desafia.families;
  today date;
  pd desafia.play_days;
  ms jsonb;
  allowed int;
  catalog text[];
  plus_active boolean;
begin
  select fam.* into f
  from desafia.families fam
  join desafia.players p on p.family_id=fam.id
  where p.id=pid;

  if f.id is null then raise exception 'PLAYER_NOT_FOUND'; end if;

  today:=desafia.family_today(f.id);
  select * into pd from desafia.play_days where player_id=pid and day=today;
  ms:=desafia.play_missions_state(pid);
  allowed:=f.play_minutes*60 + coalesce(pd.bonus_seconds,0);
  plus_active:=desafia.family_is_plus(f.id);
  catalog:=desafia.game_catalog_for_family(f.id);

  return jsonb_build_object(
    'day', today,
    'enabled', f.play_minutes > 0 or coalesce(pd.bonus_seconds,0) > 0,
    'minutes', f.play_minutes,
    'allowed_seconds', allowed,
    'used_seconds', coalesce(pd.used_seconds,0),
    'remaining_seconds', greatest(0, allowed - coalesce(pd.used_seconds,0)),
    'started', pd.started_at is not null,
    'missions', ms,
    'plus', plus_active,
    'catalog', to_jsonb(catalog),
    'unlocked', coalesce((select jsonb_agg(u.game_id order by u.created_at)
                            from desafia.game_unlocks u where u.player_id=pid), '[]'::jsonb),
    'new_games', to_jsonb(coalesce(pd.new_games, '{}'::text[])),
    'featured', pd.featured_game,
    'disabled', to_jsonb(f.games_disabled),
    'best', coalesce((select jsonb_object_agg(s.game_id, s.best)
                        from desafia.game_scores s where s.player_id=pid), '{}'::jsonb)
  );
end $$;

create or replace function desafia.play_start(p_device_token text)
returns jsonb language plpgsql security definer
set search_path=desafia,pg_catalog,extensions,pg_temp as $$
declare
  pid uuid;
  fid uuid;
  today date;
  st jsonb;
  disabled text[];
  catalog text[];
  already int;
  want int;
  picked text[] := '{}';
  g text;
  feat text;
  yesterday text;
begin
  if auth.uid() is not null then raise exception 'FORBIDDEN'; end if;

  pid:=desafia.device_player(p_device_token);
  if pid is null then raise exception 'NOT_PAIRED'; end if;

  select family_id into fid from desafia.players where id=pid;
  today:=desafia.family_today(fid);
  st:=desafia.play_state(pid);

  if not (st->>'enabled')::boolean then raise exception 'PLAY_OFF'; end if;
  if not (st->'missions'->>'ok')::boolean then raise exception 'MISSIONS_PENDING'; end if;

  if exists (
    select 1 from desafia.play_days
    where player_id=pid and day=today and started_at is not null
  ) then
    return st;
  end if;

  select coalesce(games_disabled,'{}'::text[]) into disabled
  from desafia.families where id=fid;
  catalog:=desafia.game_catalog_for_family(fid);

  select count(*) into already
  from desafia.game_unlocks
  where player_id=pid and game_id=any(catalog);

  want:=case when already=0 then 2 else 1 end;

  for g in
    select x
    from unnest(catalog) x
    where not (x=any(disabled))
      and not exists (
        select 1 from desafia.game_unlocks u
        where u.player_id=pid and u.game_id=x
      )
    order by random()
    limit want
  loop
    insert into desafia.game_unlocks(player_id,game_id,unlocked_on)
    values (pid,g,today)
    on conflict do nothing;
    picked:=picked || g;
  end loop;

  if array_length(picked,1) > 0 then
    feat:=picked[1];
  else
    select featured_game into yesterday
    from desafia.play_days
    where player_id=pid and day<today
    order by day desc
    limit 1;

    select u.game_id into feat
    from desafia.game_unlocks u
    where u.player_id=pid
      and u.game_id=any(catalog)
      and not (u.game_id=any(disabled))
      and u.game_id is distinct from yesterday
    order by random()
    limit 1;

    if feat is null then
      select u.game_id into feat
      from desafia.game_unlocks u
      where u.player_id=pid
        and u.game_id=any(catalog)
        and not (u.game_id=any(disabled))
      order by random()
      limit 1;
    end if;
  end if;

  insert into desafia.play_days(player_id,day,new_games,featured_game,started_at)
  values (pid,today,picked,feat,now())
  on conflict (player_id,day) do update
    set new_games=excluded.new_games,
        featured_game=excluded.featured_game,
        started_at=now();

  return desafia.play_state(pid);
end $$;

create or replace function desafia.game_score(
  p_device_token text,
  p_game text,
  p_score integer
)
returns jsonb language plpgsql security definer
set search_path=desafia,pg_catalog,extensions,pg_temp as $$
declare
  pid uuid;
  fid uuid;
  b int;
  before int;
begin
  if auth.uid() is not null then raise exception 'FORBIDDEN'; end if;

  pid:=desafia.device_player(p_device_token);
  if pid is null then raise exception 'NOT_PAIRED'; end if;

  select family_id into fid from desafia.players where id=pid;

  if not (p_game=any(desafia.game_catalog_for_family(fid))) then
    raise exception 'GAME_REQUIRES_PLUS';
  end if;

  if not exists (
    select 1 from desafia.game_unlocks
    where player_id=pid and game_id=p_game
  ) then
    raise exception 'GAME_LOCKED';
  end if;

  select best into before
  from desafia.game_scores
  where player_id=pid and game_id=p_game;

  insert into desafia.game_scores(player_id,game_id,best,plays)
  values (pid,p_game,least(greatest(coalesce(p_score,0),0),10000000),1)
  on conflict (player_id,game_id) do update
    set best=greatest(desafia.game_scores.best, excluded.best),
        plays=desafia.game_scores.plays+1,
        updated_at=now()
  returning best into b;

  return jsonb_build_object('best',b,'record',coalesce(before,0)<b);
end $$;

create or replace function desafia.parent_play_settings(p_family uuid)
returns jsonb language plpgsql stable security definer
set search_path=desafia,pg_catalog,extensions,pg_temp as $$
declare
  f desafia.families;
  today date;
  catalog text[];
  plus_active boolean;
begin
  if not desafia.is_family_parent(p_family) then raise exception 'FORBIDDEN'; end if;

  select * into f from desafia.families where id=p_family;
  today:=desafia.family_today(p_family);
  plus_active:=desafia.family_is_plus(p_family);
  catalog:=desafia.game_catalog_for_family(p_family);

  return jsonb_build_object(
    'minutes', f.play_minutes,
    'requires_approval', f.play_requires_approval,
    'disabled', to_jsonb(f.games_disabled),
    'plus', plus_active,
    'catalog', to_jsonb(desafia.game_catalog()),
    'available_catalog', to_jsonb(catalog),
    'children', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'nickname', p.nickname,
        'avatar', p.avatar,
        'used_seconds', coalesce(pd.used_seconds,0),
        'bonus_seconds', coalesce(pd.bonus_seconds,0),
        'opened_today', pd.started_at is not null,
        'unlocked', (select count(*) from desafia.game_unlocks u where u.player_id=p.id),
        'unlocked_available', (select count(*) from desafia.game_unlocks u where u.player_id=p.id and u.game_id=any(catalog)),
        'missions', desafia.play_missions_state(p.id),
        'best', coalesce((
          select jsonb_object_agg(s.game_id,jsonb_build_object('best',s.best,'plays',s.plays))
          from desafia.game_scores s
          where s.player_id=p.id
        ), '{}'::jsonb)
      ) order by p.created_at)
      from desafia.players p
      left join desafia.play_days pd on pd.player_id=p.id and pd.day=today
      where p.family_id=p_family and p.kind='child'
    ), '[]'::jsonb)
  );
end $$;

revoke execute on function desafia.game_catalog_free() from public,anon,authenticated;
revoke execute on function desafia.game_catalog_for_family(uuid) from public,anon,authenticated;
revoke execute on function desafia.play_state(uuid) from public,anon,authenticated;
revoke execute on function desafia.play_start(text) from public,authenticated;
revoke execute on function desafia.game_score(text,text,integer) from public,authenticated;
revoke execute on function desafia.parent_play_settings(uuid) from public,anon;

grant execute on function desafia.play_start(text) to anon;
grant execute on function desafia.game_score(text,text,integer) to anon;
grant execute on function desafia.parent_play_settings(uuid) to authenticated;
grant execute on function desafia.game_catalog_free() to service_role;
grant execute on function desafia.game_catalog_for_family(uuid) to service_role;
grant execute on function desafia.play_state(uuid) to service_role;

commit;
