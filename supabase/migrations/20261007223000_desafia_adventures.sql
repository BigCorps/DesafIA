begin;

create table if not exists desafia.adventure_days (
  player_id     uuid not null references desafia.players(id) on delete cascade,
  day           date not null,
  adventure_id  text not null check (char_length(adventure_id) between 1 and 64),
  choice_id     text not null check (char_length(choice_id) between 1 and 64),
  discovery_id  text not null check (char_length(discovery_id) between 1 and 64),
  created_at    timestamptz not null default now(),
  primary key (player_id, day)
);

create table if not exists desafia.adventure_discoveries (
  player_id       uuid not null references desafia.players(id) on delete cascade,
  discovery_id    text not null check (char_length(discovery_id) between 1 and 64),
  adventure_id    text not null check (char_length(adventure_id) between 1 and 64),
  choice_id       text not null check (char_length(choice_id) between 1 and 64),
  first_found_at  timestamptz not null default now(),
  first_day       date not null,
  primary key (player_id, discovery_id)
);

create index if not exists desafia_adventure_discoveries_player_found_idx
  on desafia.adventure_discoveries(player_id, first_found_at desc);

alter table desafia.adventure_days enable row level security;
alter table desafia.adventure_discoveries enable row level security;

revoke all on desafia.adventure_days, desafia.adventure_discoveries from public, anon, authenticated;
grant all on desafia.adventure_days, desafia.adventure_discoveries to service_role;

create or replace function desafia.adventure_state(p_device_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path=desafia,pg_catalog,extensions,pg_temp as $$
declare
  pid uuid;
  fid uuid;
  today date;
begin
  if auth.uid() is not null then raise exception 'FORBIDDEN'; end if;

  pid := desafia.device_player(p_device_token);
  if pid is null then raise exception 'NOT_PAIRED'; end if;

  select family_id into fid from desafia.players where id=pid;
  today := desafia.family_today(fid);

  return jsonb_build_object(
    'day', today,
    'eligible', exists(
      select 1 from desafia.daily_completions dc
      where dc.player_id=pid and dc.day=today
    ),
    'completed_today', exists(
      select 1 from desafia.adventure_days ad
      where ad.player_id=pid and ad.day=today
    ),
    'today', (
      select jsonb_build_object(
        'day',ad.day,
        'adventure_id',ad.adventure_id,
        'choice_id',ad.choice_id,
        'discovery_id',ad.discovery_id,
        'created_at',ad.created_at
      )
      from desafia.adventure_days ad
      where ad.player_id=pid and ad.day=today
    ),
    'discoveries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',d.discovery_id,
        'adventure_id',d.adventure_id,
        'choice_id',d.choice_id,
        'first_found_at',d.first_found_at,
        'first_day',d.first_day
      ) order by d.first_found_at)
      from desafia.adventure_discoveries d
      where d.player_id=pid
    ), '[]'::jsonb)
  );
end $$;

create or replace function desafia.complete_adventure(
  p_device_token text,
  p_adventure text,
  p_choice text,
  p_discovery text
)
returns jsonb
language plpgsql
security definer
set search_path=desafia,pg_catalog,extensions,pg_temp as $$
declare
  pid uuid;
  fid uuid;
  today date;
  inserted integer;
  existing desafia.adventure_days;
  adventure text := lower(trim(coalesce(p_adventure,'')));
  choice text := lower(trim(coalesce(p_choice,'')));
  discovery text := lower(trim(coalesce(p_discovery,'')));
begin
  if auth.uid() is not null then raise exception 'FORBIDDEN'; end if;

  pid := desafia.device_player(p_device_token);
  if pid is null then raise exception 'NOT_PAIRED'; end if;

  if adventure !~ '^[a-z0-9_]{1,64}$'
     or choice !~ '^[a-z0-9_]{1,64}$'
     or discovery !~ '^[a-z0-9_]{1,64}$' then
    raise exception 'INVALID_ADVENTURE';
  end if;

  select family_id into fid from desafia.players where id=pid;
  today := desafia.family_today(fid);

  if not exists(
    select 1 from desafia.daily_completions dc
    where dc.player_id=pid and dc.day=today
  ) then
    raise exception 'ADVENTURE_LOCKED';
  end if;

  insert into desafia.adventure_days(player_id,day,adventure_id,choice_id,discovery_id)
  values(pid,today,adventure,choice,discovery)
  on conflict(player_id,day) do nothing;
  get diagnostics inserted = row_count;

  if inserted = 0 then
    select * into existing
    from desafia.adventure_days
    where player_id=pid and day=today;

    if existing.adventure_id<>adventure
       or existing.choice_id<>choice
       or existing.discovery_id<>discovery then
      raise exception 'ADVENTURE_ALREADY_DONE';
    end if;
  end if;

  insert into desafia.adventure_discoveries(
    player_id,discovery_id,adventure_id,choice_id,first_day
  )
  values(pid,discovery,adventure,choice,today)
  on conflict(player_id,discovery_id) do nothing;

  update desafia.devices
     set last_seen_at=now()
   where token_hash=desafia.token_hash(p_device_token)
     and revoked_at is null;

  return desafia.adventure_state(p_device_token);
end $$;

revoke execute on function desafia.adventure_state(text) from public, anon, authenticated;
revoke execute on function desafia.complete_adventure(text,text,text,text) from public, anon, authenticated;
grant execute on function desafia.adventure_state(text) to anon;
grant execute on function desafia.complete_adventure(text,text,text,text) to anon;
grant execute on function desafia.adventure_state(text) to service_role;
grant execute on function desafia.complete_adventure(text,text,text,text) to service_role;

commit;
