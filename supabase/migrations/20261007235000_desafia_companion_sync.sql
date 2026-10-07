begin;

create table if not exists desafia.companion_journals (
  player_id      uuid primary key references desafia.players(id) on delete cascade,
  actions        jsonb not null default '{}'::jsonb check (jsonb_typeof(actions) = 'object'),
  action_day     date,
  today_actions  text[] not null default '{}'::text[] check (cardinality(today_actions) <= 7),
  updated_at     timestamptz not null default now()
);

alter table desafia.companion_journals enable row level security;

revoke all on desafia.companion_journals from public, anon, authenticated;
grant all on desafia.companion_journals to service_role;

create or replace function desafia.companion_journal_state(p_device_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path=desafia,pg_catalog,extensions,pg_temp as $$
declare
  pid uuid;
  fid uuid;
  today date;
  row_state desafia.companion_journals;
  has_day boolean;
begin
  if auth.uid() is not null then raise exception 'FORBIDDEN'; end if;

  pid := desafia.device_player(p_device_token);
  if pid is null then raise exception 'NOT_PAIRED'; end if;

  select family_id into fid from desafia.players where id=pid;
  today := desafia.family_today(fid);

  select * into row_state
  from desafia.companion_journals
  where player_id=pid;

  select exists(
    select 1 from desafia.daily_completions dc
    where dc.player_id=pid
  ) into has_day;

  return jsonb_build_object(
    'actions', coalesce(row_state.actions, '{}'::jsonb),
    'action_day', case when row_state.action_day=today then row_state.action_day else today end,
    'today_actions', case when row_state.action_day=today then to_jsonb(row_state.today_actions) else '[]'::jsonb end,
    'has_completed_day', has_day
  );
end $$;

create or replace function desafia.record_companion_action(
  p_device_token text,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path=desafia,pg_catalog,extensions,pg_temp as $$
declare
  pid uuid;
  fid uuid;
  today date;
  action_id text := trim(coalesce(p_action,''));
  row_state desafia.companion_journals;
  current_count integer;
begin
  if auth.uid() is not null then raise exception 'FORBIDDEN'; end if;

  if action_id not in (
    'sceneTree','sceneBooks','scenePlant','sceneTelescope',
    'hug','highfive','tap'
  ) then
    raise exception 'INVALID_COMPANION_ACTION';
  end if;

  pid := desafia.device_player(p_device_token);
  if pid is null then raise exception 'NOT_PAIRED'; end if;

  select family_id into fid from desafia.players where id=pid;
  today := desafia.family_today(fid);

  insert into desafia.companion_journals(player_id,action_day,today_actions)
  values(pid,today,'{}'::text[])
  on conflict(player_id) do nothing;

  select * into row_state
  from desafia.companion_journals
  where player_id=pid
  for update;

  if row_state.action_day is distinct from today then
    row_state.action_day := today;
    row_state.today_actions := '{}'::text[];
  end if;

  if not action_id = any(row_state.today_actions) then
    begin
      current_count := greatest(0, least(12, coalesce((row_state.actions->>action_id)::integer,0)));
    exception when others then
      current_count := 0;
    end;

    row_state.actions := jsonb_set(
      coalesce(row_state.actions,'{}'::jsonb),
      array[action_id],
      to_jsonb(least(12,current_count+1)),
      true
    );
    row_state.today_actions := array_append(row_state.today_actions,action_id);
  end if;

  update desafia.companion_journals
  set actions=row_state.actions,
      action_day=row_state.action_day,
      today_actions=row_state.today_actions,
      updated_at=now()
  where player_id=pid;

  update desafia.devices
     set last_seen_at=now()
   where token_hash=desafia.token_hash(p_device_token)
     and revoked_at is null;

  return desafia.companion_journal_state(p_device_token);
end $$;

revoke execute on function desafia.companion_journal_state(text) from public, anon, authenticated;
revoke execute on function desafia.record_companion_action(text,text) from public, anon, authenticated;
grant execute on function desafia.companion_journal_state(text) to anon;
grant execute on function desafia.record_companion_action(text,text) to anon;
grant execute on function desafia.companion_journal_state(text) to service_role;
grant execute on function desafia.record_companion_action(text,text) to service_role;

commit;
