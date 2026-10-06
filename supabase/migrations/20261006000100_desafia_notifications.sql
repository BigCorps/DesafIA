-- Optional push infrastructure. No remote deployment or activation is performed.
begin;

create table desafia.notification_identities (
  id uuid primary key default gen_random_uuid(),
  external_id uuid not null unique default gen_random_uuid(),
  identity_kind text not null check (identity_kind in ('parent','child_device')),
  user_id uuid unique references auth.users(id) on delete cascade,
  device_id uuid unique references desafia.devices(id) on delete cascade,
  active boolean not null default false,
  push_active boolean not null default false,
  consented_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((identity_kind='parent' and user_id is not null and device_id is null)
    or (identity_kind='child_device' and device_id is not null and user_id is null))
);
create table desafia.notification_parent_preferences (
  family_id uuid not null,
  user_id uuid not null,
  approval_enabled boolean not null default false,
  daily_summary_enabled boolean not null default false,
  daily_summary_time time not null default '19:00',
  quiet_start time not null default '20:00',
  quiet_end time not null default '08:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (family_id,user_id),
  foreign key (family_id,user_id) references desafia.family_members(family_id,user_id) on delete cascade
);
create table desafia.notification_device_preferences (
  device_id uuid primary key references desafia.devices(id) on delete cascade,
  child_reminders_enabled boolean not null default false,
  first_reminder_time time not null default '18:00',
  second_reminder_enabled boolean not null default false,
  second_reminder_time time not null default '19:30',
  quiet_start time not null default '20:00',
  quiet_end time not null default '08:00',
  consent_granted_by uuid references auth.users(id) on delete set null,
  consent_granted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table desafia.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references desafia.families(id) on delete cascade,
  event_type text not null check (event_type in ('mission_waiting_approval','child_reminder','parent_daily_summary')),
  target_kind text not null check (target_kind in ('parent','child_device')),
  target_user_id uuid references auth.users(id) on delete cascade,
  target_device_id uuid references desafia.devices(id) on delete cascade,
  payload jsonb not null default '{}',
  dedupe_key text not null unique,
  scheduled_for timestamptz not null default now(),
  status text not null default 'queued' check (status in ('queued','processing','sent','failed','skipped')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  onesignal_message_id text,
  sent_at timestamptz,
  claim_token uuid,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((target_kind='parent' and target_user_id is not null and target_device_id is null)
    or (target_kind='child_device' and target_device_id is not null and target_user_id is null))
);
create index notification_outbox_due on desafia.notification_outbox(status,scheduled_for);
create index notification_outbox_family on desafia.notification_outbox(family_id);
create index notification_outbox_user on desafia.notification_outbox(target_user_id) where target_user_id is not null;
create index notification_outbox_device on desafia.notification_outbox(target_device_id) where target_device_id is not null;
create table desafia.notification_delivery_events (
  outbox_id uuid primary key references desafia.notification_outbox(id) on delete cascade,
  identity_id uuid not null references desafia.notification_identities(id) on delete cascade,
  family_id uuid not null references desafia.families(id) on delete cascade,
  event_type text not null,
  local_day date not null,
  status text not null check (status in ('processing','sent','failed','skipped')),
  reserved_at timestamptz not null default now(),
  sent_at timestamptz
);
create index notification_delivery_identity_day on desafia.notification_delivery_events(identity_id,local_day,status);
create index notification_delivery_family on desafia.notification_delivery_events(family_id,event_type,local_day);

alter table desafia.notification_identities enable row level security;
alter table desafia.notification_parent_preferences enable row level security;
alter table desafia.notification_device_preferences enable row level security;
alter table desafia.notification_outbox enable row level security;
alter table desafia.notification_delivery_events enable row level security;
revoke all on desafia.notification_identities, desafia.notification_parent_preferences,
  desafia.notification_device_preferences, desafia.notification_outbox, desafia.notification_delivery_events from public,anon,authenticated;
grant select,insert,update,delete on desafia.notification_identities, desafia.notification_parent_preferences,
  desafia.notification_device_preferences, desafia.notification_outbox, desafia.notification_delivery_events to service_role;

-- No browser can access helpers/processor RPCs. Every definer has a safe path.
create function desafia.notification_in_quiet(p_time time,p_start time,p_end time)
returns boolean language sql immutable set search_path=pg_catalog,pg_temp as $$
  select case when p_start=p_end then true -- equal times deliberately silence the whole day
    when p_start<p_end then p_time>=p_start and p_time<p_end
    else p_time>=p_start or p_time<p_end end
$$;

create function desafia.my_notification_identity()
returns jsonb language plpgsql security definer set search_path=pg_catalog,desafia,pg_temp as $$
declare n desafia.notification_identities;
begin
  if not desafia.real_user() then raise exception 'LOGIN_REQUIRED'; end if;
  insert into desafia.notification_identities(identity_kind,user_id) values('parent',auth.uid()) on conflict(user_id) do nothing;
  select * into n from desafia.notification_identities where user_id=auth.uid();
  return jsonb_build_object('external_id',n.external_id,'push_active',n.push_active,'active',n.active);
end $$;

create function desafia.parent_notification_settings(p_family uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,desafia,pg_temp as $$
begin
  if not desafia.is_family_parent(p_family) then raise exception 'FORBIDDEN'; end if;
  return jsonb_build_object(
    'parent',coalesce((select to_jsonb(n)-'user_id'-'family_id' from desafia.notification_parent_preferences n where n.family_id=p_family and n.user_id=auth.uid()),'{}'),
    'devices',coalesce((select jsonb_agg(jsonb_build_object('device_id',d.id,'label',d.label,
      'preferences',coalesce(to_jsonb(n)-'device_id'-'consent_granted_by','{}'),
      'push_active',coalesce(i.active and i.push_active,false)))
      from desafia.devices d join desafia.players p on p.id=d.player_id
      left join desafia.notification_device_preferences n on n.device_id=d.id
      left join desafia.notification_identities i on i.device_id=d.id
      where p.family_id=p_family and p.kind='child' and d.revoked_at is null),'[]'));
end $$;

create function desafia.parent_set_notification_preferences(p_family uuid,p_approval boolean,p_summary boolean,p_summary_time time,p_quiet_start time,p_quiet_end time)
returns void language plpgsql security definer set search_path=pg_catalog,desafia,pg_temp as $$
begin
  if not desafia.is_family_parent(p_family) then raise exception 'FORBIDDEN'; end if;
  if p_approval is null or p_summary is null or p_summary_time is null or p_quiet_start is null or p_quiet_end is null then raise exception 'INVALID_PREFERENCES'; end if;
  insert into desafia.notification_parent_preferences(family_id,user_id,approval_enabled,daily_summary_enabled,daily_summary_time,quiet_start,quiet_end)
  values(p_family,auth.uid(),p_approval,p_summary,p_summary_time,p_quiet_start,p_quiet_end)
  on conflict(family_id,user_id) do update set approval_enabled=excluded.approval_enabled,daily_summary_enabled=excluded.daily_summary_enabled,
    daily_summary_time=excluded.daily_summary_time,quiet_start=excluded.quiet_start,quiet_end=excluded.quiet_end,updated_at=now();
  update desafia.notification_identities set active=exists(select 1 from desafia.notification_parent_preferences where user_id=auth.uid() and (approval_enabled or daily_summary_enabled)),
    consented_at=case when p_approval or p_summary then now() else consented_at end,updated_at=now() where user_id=auth.uid();
end $$;

create function desafia.parent_set_device_notifications(p_family uuid,p_device uuid,p_enabled boolean,p_first time,p_second_enabled boolean,p_second time,p_quiet_start time,p_quiet_end time)
returns void language plpgsql security definer set search_path=pg_catalog,desafia,pg_temp as $$
declare d desafia.devices;
begin
  if not desafia.is_family_parent(p_family) then raise exception 'FORBIDDEN'; end if;
  select dv.* into d from desafia.devices dv join desafia.players p on p.id=dv.player_id
    where dv.id=p_device and p.family_id=p_family and p.kind='child' and dv.revoked_at is null for update of dv;
  if d.id is null then raise exception 'FORBIDDEN'; end if;
  if p_enabled is null or p_first is null or p_second_enabled is null or p_second is null or p_quiet_start is null or p_quiet_end is null then raise exception 'INVALID_PREFERENCES'; end if;
  insert into desafia.notification_device_preferences(device_id,child_reminders_enabled,first_reminder_time,second_reminder_enabled,second_reminder_time,quiet_start,quiet_end,consent_granted_by,consent_granted_at)
  values(d.id,p_enabled,p_first,p_second_enabled,p_second,p_quiet_start,p_quiet_end,case when p_enabled then auth.uid() end,case when p_enabled then now() end)
  on conflict(device_id) do update set child_reminders_enabled=excluded.child_reminders_enabled,first_reminder_time=excluded.first_reminder_time,
    second_reminder_enabled=excluded.second_reminder_enabled,second_reminder_time=excluded.second_reminder_time,quiet_start=excluded.quiet_start,quiet_end=excluded.quiet_end,
    consent_granted_by=excluded.consent_granted_by,consent_granted_at=excluded.consent_granted_at,updated_at=now();
  if p_enabled then
    insert into desafia.notification_identities(identity_kind,device_id,active,consented_at) values('child_device',d.id,true,now())
    on conflict(device_id) do update set active=true,consented_at=now(),updated_at=now();
  else
    update desafia.notification_identities set active=false,push_active=false,consented_at=null,updated_at=now() where device_id=d.id;
  end if;
end $$;

create function desafia.device_notification_state(p_device_token text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,desafia,pg_temp as $$
declare d desafia.devices;n desafia.notification_device_preferences;i desafia.notification_identities;allowed boolean;
begin
  if auth.uid() is not null then raise exception 'FORBIDDEN'; end if;
  -- Existing token validation; raw tokens never enter any notification table.
  select * into d from desafia.devices where token_hash=desafia.token_hash(p_device_token) and revoked_at is null;
  if d.id is null then return jsonb_build_object('authorized',false,'push_active',false); end if;
  select * into n from desafia.notification_device_preferences where device_id=d.id;
  select * into i from desafia.notification_identities where device_id=d.id;
  allowed:=coalesce(n.child_reminders_enabled and n.consent_granted_at is not null and n.consent_granted_by is not null
    and i.active and exists(select 1 from desafia.family_members fm join desafia.players p on p.family_id=fm.family_id where p.id=d.player_id and fm.user_id=n.consent_granted_by),false);
  return jsonb_build_object('authorized',allowed,'external_id',case when allowed then i.external_id end,
    'push_active',allowed and coalesce(i.push_active,false),'first_reminder_time',n.first_reminder_time,
    'second_reminder_enabled',n.second_reminder_enabled,'second_reminder_time',n.second_reminder_time,'quiet_start',n.quiet_start,'quiet_end',n.quiet_end);
end $$;

create function desafia.parent_notification_subscription(p_active boolean)
returns void language plpgsql security definer set search_path=pg_catalog,desafia,pg_temp as $$
begin
  if not desafia.real_user() then raise exception 'LOGIN_REQUIRED'; end if;
  update desafia.notification_identities set push_active=coalesce(p_active,false),updated_at=now() where user_id=auth.uid();
end $$;
create function desafia.device_notification_subscription(p_device_token text,p_active boolean)
returns void language plpgsql security definer set search_path=pg_catalog,desafia,pg_temp as $$
declare s jsonb;
begin
  s:=desafia.device_notification_state(p_device_token);
  if p_active and not coalesce((s->>'authorized')::boolean,false) then raise exception 'FORBIDDEN'; end if;
  update desafia.notification_identities set push_active=coalesce(p_active,false),updated_at=now()
  where device_id=(select id from desafia.devices where token_hash=desafia.token_hash(p_device_token) and revoked_at is null);
end $$;

-- Preserve the entire existing mission transition, adding only RETURNING and a
-- transactional enqueue for rows actually inserted/re-submitted after rejection.
create or replace function desafia.mark_mission_done(p_device_token text,p_mission uuid)
returns text language plpgsql security definer set search_path=desafia,pg_catalog,extensions,pg_temp as $$
declare pid uuid;p desafia.players;m desafia.missions;today date;st text;changed uuid;transition uuid;
begin
  if auth.uid() is not null then raise exception 'FORBIDDEN'; end if;
  pid:=desafia.device_player(p_device_token);if pid is null then raise exception 'NOT_PAIRED'; end if;
  select * into p from desafia.players where id=pid;
  select * into m from desafia.missions where id=p_mission and family_id=p.family_id and active and audience='child';
  if m.id is null then raise exception 'INVALID_MISSION'; end if;
  today:=desafia.family_today(p.family_id);
  insert into desafia.mission_logs(player_id,mission_id,day,status,star_reward,xp_reward)
    values(pid,m.id,today,'pending',m.star_reward,m.xp_reward)
  on conflict(player_id,mission_id,day) do update set status='pending',created_at=now(),decided_at=null,decided_by=null,star_reward=excluded.star_reward,xp_reward=excluded.xp_reward where desafia.mission_logs.status='rejected'
  returning id into changed;
  select status into st from desafia.mission_logs where player_id=pid and mission_id=m.id and day=today;
  update desafia.devices set last_seen_at=now() where token_hash=desafia.token_hash(p_device_token);
  if changed is not null then
    transition:=gen_random_uuid();
    insert into desafia.notification_outbox(family_id,event_type,target_kind,target_user_id,dedupe_key,scheduled_for)
      select p.family_id,'mission_waiting_approval','parent',n.user_id,'mission:'||changed||':'||transition||':'||n.user_id,now()+interval '2 minutes'
      from desafia.notification_parent_preferences n where n.family_id=p.family_id and n.approval_enabled;
  end if;
  return st;
end $$;

-- A changed/revoked device cannot reuse consent from its previous pairing.
create function desafia.notification_device_changed()
returns trigger language plpgsql security definer set search_path=pg_catalog,desafia,pg_temp as $$
begin
  if new.revoked_at is not null or new.player_id is distinct from old.player_id then
    update desafia.notification_device_preferences set child_reminders_enabled=false,consent_granted_at=null,consent_granted_by=null,updated_at=now() where device_id=new.id;
    update desafia.notification_identities set active=false,push_active=false,consented_at=null,updated_at=now() where device_id=new.id;
    update desafia.notification_outbox set status='skipped',last_error='device_revoked',updated_at=now() where target_device_id=new.id and status in ('queued','failed');
  end if;
  return new;
end $$;
create trigger notification_device_changed after update of revoked_at,player_id on desafia.devices for each row execute function desafia.notification_device_changed();

-- Scheduler helpers are service-role only. Local family wall-clock handles DST;
-- each slot has a date-based dedupe key and is generated within 45 minutes only.
create function desafia.notification_prepare(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=pg_catalog,desafia,pg_temp as $$
declare r record;local_now timestamp;slot time;slot_number integer;total integer:=0;n integer;
begin
  for r in select n.*,p.family_id,d.revoked_at,f.timezone,i.active,i.push_active from desafia.notification_device_preferences n
    join desafia.devices d on d.id=n.device_id join desafia.players p on p.id=d.player_id join desafia.families f on f.id=p.family_id
    join desafia.notification_identities i on i.device_id=d.id where n.child_reminders_enabled and n.consent_granted_at is not null and n.consent_granted_by is not null
    and d.revoked_at is null and i.active and i.push_active and p.kind='child'
    and exists(select 1 from desafia.family_members fm where fm.family_id=p.family_id and fm.user_id=n.consent_granted_by)
    and exists(select 1 from desafia.missions m left join desafia.mission_logs l on l.player_id=p.id and l.mission_id=m.id and l.day=(p_now at time zone f.timezone)::date
      where m.family_id=p.family_id and m.active and m.audience='child' and coalesce(l.status,'todo') in ('todo','rejected'))
  loop
    local_now:=p_now at time zone r.timezone;
    for slot_number in 1..(case when r.second_reminder_enabled then 2 else 1 end) loop
      slot:=case when slot_number=1 then r.first_reminder_time else r.second_reminder_time end;
      if local_now>=local_now::date+slot and local_now<local_now::date+slot+interval '45 minutes'
        and not desafia.notification_in_quiet(local_now::time,r.quiet_start,r.quiet_end) then
        insert into desafia.notification_outbox(family_id,event_type,target_kind,target_device_id,dedupe_key,payload,scheduled_for)
        values(r.family_id,'child_reminder','child_device',r.device_id,'child:'||r.device_id||':'||local_now::date||':'||slot_number,
          jsonb_build_object('day',local_now::date,'slot',slot_number),p_now) on conflict(dedupe_key) do nothing;
        get diagnostics n=row_count;total:=total+n;
      end if;
    end loop;
  end loop;
  for r in select n.*,f.timezone from desafia.notification_parent_preferences n join desafia.families f on f.id=n.family_id
    join desafia.notification_identities i on i.user_id=n.user_id where n.daily_summary_enabled and i.active and i.push_active
    and (exists(select 1 from desafia.mission_logs l join desafia.players p on p.id=l.player_id where p.family_id=n.family_id and l.status='pending')
      or exists(select 1 from desafia.reward_requests rr join desafia.players p on p.id=rr.player_id where p.family_id=n.family_id and rr.status='pending'))
  loop
    local_now:=p_now at time zone r.timezone;
    if local_now>=local_now::date+r.daily_summary_time and local_now<local_now::date+r.daily_summary_time+interval '45 minutes'
      and not desafia.notification_in_quiet(local_now::time,r.quiet_start,r.quiet_end) then
      insert into desafia.notification_outbox(family_id,event_type,target_kind,target_user_id,dedupe_key,payload,scheduled_for)
      values(r.family_id,'parent_daily_summary','parent',r.user_id,'summary:'||r.family_id||':'||r.user_id||':'||local_now::date,
        jsonb_build_object('day',local_now::date),p_now) on conflict(dedupe_key) do nothing;
      get diagnostics n=row_count;total:=total+n;
    end if;
  end loop;
  return total;
end $$;

create function desafia.notification_claim(p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path=pg_catalog,desafia,pg_temp as $$
declare q desafia.notification_outbox;i desafia.notification_identities;np desafia.notification_parent_preferences;nd desafia.notification_device_preferences;
  local_now timestamp;tz text;pending integer;reward_count integer;allowed boolean;day_count integer;last_push timestamptz;token uuid;result jsonb:='[]';limit_count integer:=0;
begin
  -- Lease recovery reuses the SAME UUID/idempotency key, never a new message.
  update desafia.notification_outbox set status=case when attempts>=5 then 'failed' else 'queued' end,updated_at=now()
    where status='processing' and claimed_at<now()-interval '10 minutes';
  for q in select * from desafia.notification_outbox where status='queued' and scheduled_for<=now() and attempts<5
    order by scheduled_for,id limit greatest(1,least(p_limit,50))*10 for update skip locked
  loop
    exit when limit_count>=greatest(1,least(p_limit,50));
    select * into i from desafia.notification_identities where (q.target_kind='parent' and user_id=q.target_user_id)
      or (q.target_kind='child_device' and device_id=q.target_device_id) for update skip locked;
    if i.id is null then continue; end if;
    if exists(select 1 from desafia.notification_outbox o where o.id<>q.id and o.status='processing'
      and ((q.target_kind='parent' and o.target_user_id=q.target_user_id) or (q.target_kind='child_device' and o.target_device_id=q.target_device_id))) then continue; end if;
    select timezone into tz from desafia.families where id=q.family_id;local_now:=now() at time zone tz;
    allowed:=i.active and i.push_active and i.consented_at is not null
      and (case when q.event_type='mission_waiting_approval' then q.created_at>now()-interval '24 hours' else q.payload->>'day'=local_now::date::text end);
    pending:=0;reward_count:=0;
    if q.target_kind='parent' then
      select * into np from desafia.notification_parent_preferences where family_id=q.family_id and user_id=q.target_user_id;
      allowed:=coalesce(allowed and (case when q.event_type='mission_waiting_approval' then np.approval_enabled else np.daily_summary_enabled end),false);
      select count(*) into pending from desafia.mission_logs l join desafia.players p on p.id=l.player_id where p.family_id=q.family_id and l.status='pending';
      if q.event_type='parent_daily_summary' then
        select count(*) into reward_count from desafia.reward_requests rr join desafia.players p on p.id=rr.player_id where p.family_id=q.family_id and rr.status='pending';
      end if;
      allowed:=allowed and pending+reward_count>0;
      if allowed and desafia.notification_in_quiet(local_now::time,np.quiet_start,np.quiet_end) then
        update desafia.notification_outbox set scheduled_for=now()+interval '15 minutes' where id=q.id;continue;
      end if;
    else
      select * into nd from desafia.notification_device_preferences where device_id=q.target_device_id;
      allowed:=coalesce(allowed and nd.child_reminders_enabled and nd.consent_granted_at is not null and nd.consent_granted_by is not null
        and exists(select 1 from desafia.devices d join desafia.players p on p.id=d.player_id join desafia.family_members fm on fm.family_id=p.family_id
          where d.id=q.target_device_id and d.revoked_at is null and p.family_id=q.family_id and fm.user_id=nd.consent_granted_by),false);
      select count(*) into pending from desafia.devices d join desafia.players p on p.id=d.player_id join desafia.missions m on m.family_id=p.family_id
        left join desafia.mission_logs l on l.player_id=p.id and l.mission_id=m.id and l.day=local_now::date
        where d.id=q.target_device_id and m.active and m.audience='child' and coalesce(l.status,'todo') in ('todo','rejected');
      allowed:=allowed and pending>0 and (coalesce((q.payload->>'slot')::integer,1)=1 or nd.second_reminder_enabled);
      if allowed and desafia.notification_in_quiet(local_now::time,nd.quiet_start,nd.quiet_end) then
        update desafia.notification_outbox set scheduled_for=now()+interval '15 minutes' where id=q.id;continue;
      end if;
    end if;
    -- Daily notifications expire; immediate approvals older than a day do too.
    allowed:=allowed and (case when q.event_type='mission_waiting_approval' then q.created_at>now()-interval '24 hours' else q.payload->>'day'=local_now::date::text end);
    if not allowed then
      update desafia.notification_outbox set status='skipped',last_error='no_longer_eligible',updated_at=now() where id=q.id;
      update desafia.notification_delivery_events set status='skipped' where outbox_id=q.id;continue;
    end if;
    select count(*),max(coalesce(sent_at,reserved_at)) into day_count,last_push from desafia.notification_delivery_events
      where identity_id=i.id and outbox_id<>q.id and status in ('processing','sent')
      and (case when q.target_kind='parent' then reserved_at>now()-interval '24 hours' else local_day=local_now::date end);
    if day_count>=(case when q.target_kind='parent' then 4 when nd.second_reminder_enabled then 2 else 1 end) then
      update desafia.notification_outbox set status='skipped',last_error='daily_limit',updated_at=now() where id=q.id;continue;
    end if;
    if last_push>now()-(case when q.target_kind='parent' then interval '30 minutes' else interval '90 minutes' end) then
      update desafia.notification_outbox set scheduled_for=last_push+case when q.target_kind='parent' then interval '30 minutes' else interval '90 minutes' end where id=q.id;continue;
    end if;
    token:=gen_random_uuid();
    update desafia.notification_outbox set status='processing',attempts=attempts+1,claim_token=token,claimed_at=now(),updated_at=now() where id=q.id;
    insert into desafia.notification_delivery_events(outbox_id,identity_id,family_id,event_type,local_day,status)
      values(q.id,i.id,q.family_id,q.event_type,local_now::date,'processing')
      on conflict(outbox_id) do update set status='processing';
    result:=result||jsonb_build_array(jsonb_build_object('id',q.id,'claim_token',token,'external_id',i.external_id,
      'event_type',q.event_type,'mission_count',pending,'reward_count',reward_count,'attempts',q.attempts+1));limit_count:=limit_count+1;
  end loop;
  return result;
end $$;

create function desafia.notification_complete(p_id uuid,p_claim uuid,p_sent boolean,p_message_id text default null,p_error text default null,p_retry boolean default false)
returns boolean language plpgsql security definer set search_path=pg_catalog,desafia,pg_temp as $$
declare q desafia.notification_outbox;
begin
  select * into q from desafia.notification_outbox where id=p_id and status='processing' and claim_token=p_claim for update;
  if q.id is null then return false; end if;
  update desafia.notification_outbox set status=case when p_sent then 'sent' when p_error='no_longer_eligible' then 'skipped' when p_retry and attempts<5 then 'queued' else 'failed' end,
    scheduled_for=case when p_sent then scheduled_for else now()+make_interval(mins=>least(240,15*(2^least(attempts,4))::integer)) end,
    sent_at=case when p_sent then now() end,onesignal_message_id=case when p_sent then left(p_message_id,100) end,
    last_error=case when p_sent then null else left(p_error,100) end,updated_at=now() where id=q.id;
  -- Ambiguous network failures retain the reservation to suppress other messages.
  update desafia.notification_delivery_events set status=case when p_sent then 'sent' when p_error='no_longer_eligible' then 'skipped' when p_retry then 'processing' else 'failed' end,
    sent_at=case when p_sent then now() end where outbox_id=q.id;
  if p_sent and q.event_type='mission_waiting_approval' then
    update desafia.notification_outbox set status='skipped',last_error='aggregated',updated_at=now()
      where id<>q.id and family_id=q.family_id and target_user_id=q.target_user_id and event_type=q.event_type and status='queued' and created_at<=q.claimed_at;
  end if;
  return true;
end $$;

create function desafia.notification_validate_claim(p_id uuid,p_claim uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,desafia,pg_temp as $$
declare q desafia.notification_outbox;i desafia.notification_identities;tz text;local_now timestamp;n record;
begin
  select * into q from desafia.notification_outbox where id=p_id and claim_token=p_claim and status='processing' and claimed_at>now()-interval '10 minutes';
  if q.id is null then return false; end if;
  select * into i from desafia.notification_identities where (q.target_kind='parent' and user_id=q.target_user_id) or (q.target_kind='child_device' and device_id=q.target_device_id);
  if not coalesce(i.active and i.push_active and i.consented_at is not null,false) then return false; end if;
  select timezone into tz from desafia.families where id=q.family_id;local_now:=now() at time zone tz;
  if q.target_kind='parent' then
    select * into n from desafia.notification_parent_preferences where family_id=q.family_id and user_id=q.target_user_id;
    return coalesce((case when q.event_type='mission_waiting_approval' then n.approval_enabled else n.daily_summary_enabled end)
      and not desafia.notification_in_quiet(local_now::time,n.quiet_start,n.quiet_end)
      and exists(select 1 from desafia.family_members where family_id=q.family_id and user_id=q.target_user_id)
      and (exists(select 1 from desafia.mission_logs l join desafia.players p on p.id=l.player_id where p.family_id=q.family_id and l.status='pending')
        or (q.event_type='parent_daily_summary' and exists(select 1 from desafia.reward_requests rr join desafia.players p on p.id=rr.player_id where p.family_id=q.family_id and rr.status='pending'))),false);
  else
    select * into n from desafia.notification_device_preferences where device_id=q.target_device_id;
    return coalesce(n.child_reminders_enabled and n.consent_granted_at is not null and n.consent_granted_by is not null
      and not desafia.notification_in_quiet(local_now::time,n.quiet_start,n.quiet_end)
      and q.payload->>'day'=local_now::date::text
      and (coalesce((q.payload->>'slot')::integer,1)=1 or n.second_reminder_enabled)
      and exists(select 1 from desafia.devices d join desafia.players p on p.id=d.player_id join desafia.family_members fm on fm.family_id=p.family_id
        where d.id=q.target_device_id and d.revoked_at is null and p.family_id=q.family_id and fm.user_id=n.consent_granted_by)
      and exists(select 1 from desafia.devices d join desafia.players p on p.id=d.player_id join desafia.missions m on m.family_id=p.family_id
        left join desafia.mission_logs l on l.player_id=p.id and l.mission_id=m.id and l.day=local_now::date
        where d.id=q.target_device_id and m.active and m.audience='child' and coalesce(l.status,'todo') in ('todo','rejected')),false);
  end if;
end $$;

-- Explicit function ACLs; never alter historical/global function permissions.
revoke all on function desafia.notification_in_quiet(time,time,time),desafia.my_notification_identity(),desafia.parent_notification_settings(uuid),
  desafia.parent_set_notification_preferences(uuid,boolean,boolean,time,time,time),
  desafia.parent_set_device_notifications(uuid,uuid,boolean,time,boolean,time,time,time),
  desafia.device_notification_state(text),desafia.parent_notification_subscription(boolean),desafia.device_notification_subscription(text,boolean),
  desafia.notification_validate_claim(uuid,uuid),desafia.notification_device_changed(),desafia.notification_prepare(timestamptz),desafia.notification_claim(integer),
  desafia.notification_complete(uuid,uuid,boolean,text,text,boolean) from public,anon,authenticated;
grant execute on function desafia.my_notification_identity(),desafia.parent_notification_settings(uuid),
  desafia.parent_set_notification_preferences(uuid,boolean,boolean,time,time,time),
  desafia.parent_set_device_notifications(uuid,uuid,boolean,time,boolean,time,time,time),desafia.parent_notification_subscription(boolean) to authenticated;
grant execute on function desafia.device_notification_state(text),desafia.device_notification_subscription(text,boolean) to anon;
grant execute on function desafia.notification_in_quiet(time,time,time),desafia.my_notification_identity(),desafia.parent_notification_settings(uuid),
  desafia.parent_set_notification_preferences(uuid,boolean,boolean,time,time,time),
  desafia.parent_set_device_notifications(uuid,uuid,boolean,time,boolean,time,time,time),
  desafia.device_notification_state(text),desafia.parent_notification_subscription(boolean),desafia.device_notification_subscription(text,boolean),
  desafia.notification_validate_claim(uuid,uuid),desafia.notification_device_changed(),desafia.notification_prepare(timestamptz),desafia.notification_claim(integer),
  desafia.notification_complete(uuid,uuid,boolean,text,text,boolean) to service_role;
-- CREATE OR REPLACE preserves mark_mission_done's original ACL and signature.
commit;
