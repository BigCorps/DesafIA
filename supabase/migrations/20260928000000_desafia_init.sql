-- =====================================================================
-- Desafia — esquema inicial
-- Rode este arquivo inteiro no SQL Editor do Supabase (ou via CLI).
--
-- Modelo:
--   families        família (plano free/plus)
--   family_members  responsáveis (usuários com e-mail) de cada família
--   players         quem joga: crianças (kind=child) e adultos (kind=adult)
--   devices         aparelho da criança (login anônimo) ligado a um player
--   missions        missões da família (audience child/adult)
--   mission_logs    missão feita no dia (pending -> done/rejected)
--   rewards         prêmios combinados pelos pais
--   reward_requests pedidos de troca de estrelas por prêmio
--   challenges      desafios dos pais (Plus)
--   leagues         ligas entre famílias amigas (Plus)
--
-- Regras importantes:
--   * Estrelas (xp/wallet) só mudam por funções seguras, nunca pelo cliente.
--   * O aparelho da criança nunca tem e-mail: usa login anônimo + código.
--   * O plano Plus só é alterado pelo servidor (service role / webhook).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------
create table public.families (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(name) between 1 and 60),
  plan            text not null default 'free' check (plan in ('free','plus')),
  plan_expires_at timestamptz,
  timezone        text not null default 'America/Sao_Paulo',
  created_at      timestamptz not null default now()
);

create table public.family_members (
  family_id    uuid not null references public.families(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'parent' check (role in ('owner','parent')),
  display_name text not null default 'Responsável' check (char_length(display_name) between 1 and 30),
  created_at   timestamptz not null default now(),
  primary key (family_id, user_id)
);
create index family_members_user_idx on public.family_members(user_id);

create table public.players (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families(id) on delete cascade,
  kind       text not null default 'child' check (kind in ('child','adult')),
  user_id    uuid references auth.users(id) on delete cascade,
  nickname   text not null check (char_length(nickname) between 1 and 30),
  avatar     text not null default '🌸' check (char_length(avatar) <= 16),
  pet_name   text not null default 'Pipo' check (char_length(pet_name) between 1 and 12),
  look       jsonb not null default '{"color":"rosa","hat":"none","acc":"none"}'::jsonb,
  xp         integer not null default 0 check (xp >= 0),
  wallet     integer not null default 0 check (wallet >= 0),
  created_at timestamptz not null default now(),
  unique (family_id, user_id),
  check ((kind = 'adult') = (user_id is not null))
);
create index players_family_idx on public.players(family_id);

create table public.devices (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  player_id    uuid not null references public.players(id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index devices_player_idx on public.devices(player_id);

create table public.pairing_codes (
  code       text primary key,
  player_id  uuid not null references public.players(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.parent_invites (
  code       text primary key,
  family_id  uuid not null references public.families(id) on delete cascade,
  expires_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.missions (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  audience    text not null default 'child' check (audience in ('child','adult')),
  title       text not null check (char_length(title) between 1 and 60),
  icon        text not null default '⭐' check (char_length(icon) <= 16),
  points      integer not null default 20 check (points between 1 and 500),
  time_of_day text not null default 'any' check (time_of_day in ('any','manha','tarde','noite')),
  active      boolean not null default true,
  is_custom   boolean not null default false,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);
create index missions_family_idx on public.missions(family_id);

create table public.mission_logs (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  day        date not null,
  status     text not null default 'pending' check (status in ('pending','done','rejected')),
  points     integer not null check (points > 0),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  unique (player_id, mission_id, day)
);
create index mission_logs_player_day_idx on public.mission_logs(player_id, day);

create table public.rewards (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families(id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 60),
  icon       text not null default '🎁' check (char_length(icon) <= 16),
  cost       integer not null check (cost between 1 and 10000),
  active     boolean not null default true,
  is_custom  boolean not null default false,
  created_at timestamptz not null default now()
);
create index rewards_family_idx on public.rewards(family_id);

create table public.reward_requests (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id) on delete cascade,
  reward_id  uuid not null references public.rewards(id) on delete cascade,
  cost       integer not null check (cost > 0),
  status     text not null default 'pending' check (status in ('pending','delivered','denied')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null
);
create unique index reward_requests_one_pending
  on public.reward_requests(player_id, reward_id) where status = 'pending';

create table public.challenges (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  player_id   uuid references public.players(id) on delete cascade, -- null = todas as crianças
  mission_id  uuid not null references public.missions(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 60),
  target_days integer not null check (target_days between 1 and 60),
  prize       text check (char_length(prize) <= 80),
  starts_on   date not null,
  ends_on     date not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index challenges_family_idx on public.challenges(family_id);

create table public.leagues (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 40),
  code         text not null unique,
  owner_family uuid not null references public.families(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create table public.league_families (
  league_id uuid not null references public.leagues(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  nickname  text not null check (char_length(nickname) between 1 and 30),
  avatar    text not null default '🏡' check (char_length(avatar) <= 16),
  joined_at timestamptz not null default now(),
  primary key (league_id, family_id)
);

-- ---------------------------------------------------------------------
-- Funções auxiliares (usadas nas políticas)
-- ---------------------------------------------------------------------
create or replace function public.is_anonymous_user() returns boolean
language sql stable as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

create or replace function public.is_family_parent(fid uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from family_members where family_id = fid and user_id = auth.uid())
$$;

create or replace function public.is_player_parent(pid uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from players p join family_members m on m.family_id = p.family_id
    where p.id = pid and m.user_id = auth.uid())
$$;

create or replace function public.device_player() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select player_id from devices where user_id = auth.uid()
$$;

create or replace function public.device_family() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select p.family_id from devices d join players p on p.id = d.player_id where d.user_id = auth.uid()
$$;

create or replace function public.family_is_plus(fid uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from families where id = fid and plan = 'plus'
                 and (plan_expires_at is null or plan_expires_at > now()))
$$;

create or replace function public.family_today(fid uuid) returns date
language sql stable security definer set search_path = public, pg_temp as $$
  select (now() at time zone coalesce((select timezone from families where id = fid), 'America/Sao_Paulo'))::date
$$;

create or replace function public.family_week_start(fid uuid) returns date
language sql stable as $$
  select date_trunc('week', public.family_today(fid)::timestamp)::date
$$;

create or replace function public.player_week_points(pid uuid, since date) returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(sum(points), 0)::int from mission_logs
  where player_id = pid and status = 'done' and day >= since
$$;

create or replace function public.family_week_points(fid uuid) returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(sum(l.points), 0)::int
  from mission_logs l join players p on p.id = l.player_id
  where p.family_id = fid and l.status = 'done' and l.day >= public.family_week_start(fid)
$$;

create or replace function public.new_code() returns text
language plpgsql volatile as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- sem 0/O/1/I
  result text := '';
  i int;
begin
  for i in 1..8 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end $$;

create or replace function public.normalize_code(raw text) returns text
language sql immutable as $$
  select upper(regexp_replace(coalesce(raw, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

-- Plano grátis pode ligar/desligar e mudar pontos das missões/prêmios padrão,
-- mas trocar nome ou ícone (ou seja, criar algo novo) é do Plus.
create or replace function public.guard_free_edit() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.family_id <> old.family_id then
    raise exception 'INVALID_FAMILY';
  end if;
  if not old.is_custom and not public.family_is_plus(new.family_id)
     and (new.title is distinct from old.title or new.icon is distinct from old.icon) then
    raise exception 'PLUS_REQUIRED';
  end if;
  new.is_custom := old.is_custom;
  return new;
end $$;

create trigger missions_guard before update on public.missions
  for each row execute function public.guard_free_edit();
create trigger rewards_guard before update on public.rewards
  for each row execute function public.guard_free_edit();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.families        enable row level security;
alter table public.family_members  enable row level security;
alter table public.players         enable row level security;
alter table public.devices         enable row level security;
alter table public.pairing_codes   enable row level security;
alter table public.parent_invites  enable row level security;
alter table public.missions        enable row level security;
alter table public.mission_logs    enable row level security;
alter table public.rewards         enable row level security;
alter table public.reward_requests enable row level security;
alter table public.challenges      enable row level security;
alter table public.leagues         enable row level security;
alter table public.league_families enable row level security;

-- families
create policy families_select on public.families for select to authenticated
  using (public.is_family_parent(id));
create policy families_update on public.families for update to authenticated
  using (public.is_family_parent(id)) with check (public.is_family_parent(id));
create policy families_delete on public.families for delete to authenticated
  using (exists (select 1 from public.family_members m
                 where m.family_id = id and m.user_id = auth.uid() and m.role = 'owner'));

-- family_members
create policy members_select on public.family_members for select to authenticated
  using (public.is_family_parent(family_id));
create policy members_update on public.family_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy members_delete on public.family_members for delete to authenticated
  using (user_id = auth.uid());

-- players
create policy players_select on public.players for select to authenticated
  using (public.is_family_parent(family_id) or id = public.device_player());
create policy players_update on public.players for update to authenticated
  using (public.is_family_parent(family_id)) with check (public.is_family_parent(family_id));
create policy players_delete on public.players for delete to authenticated
  using (public.is_family_parent(family_id) and kind = 'child');

-- devices
create policy devices_select on public.devices for select to authenticated
  using (user_id = auth.uid() or public.is_player_parent(player_id));
create policy devices_delete on public.devices for delete to authenticated
  using (user_id = auth.uid() or public.is_player_parent(player_id));

-- missions
create policy missions_select on public.missions for select to authenticated
  using (public.is_family_parent(family_id) or family_id = public.device_family());
create policy missions_insert on public.missions for insert to authenticated
  with check (public.is_family_parent(family_id) and public.family_is_plus(family_id) and is_custom);
create policy missions_update on public.missions for update to authenticated
  using (public.is_family_parent(family_id)) with check (public.is_family_parent(family_id));
create policy missions_delete on public.missions for delete to authenticated
  using (public.is_family_parent(family_id) and is_custom);

-- mission_logs
create policy logs_select on public.mission_logs for select to authenticated
  using (public.is_player_parent(player_id) or player_id = public.device_player());

-- rewards
create policy rewards_select on public.rewards for select to authenticated
  using (public.is_family_parent(family_id) or family_id = public.device_family());
create policy rewards_insert on public.rewards for insert to authenticated
  with check (public.is_family_parent(family_id) and public.family_is_plus(family_id) and is_custom);
create policy rewards_update on public.rewards for update to authenticated
  using (public.is_family_parent(family_id)) with check (public.is_family_parent(family_id));
create policy rewards_delete on public.rewards for delete to authenticated
  using (public.is_family_parent(family_id) and is_custom);

-- reward_requests
create policy requests_select on public.reward_requests for select to authenticated
  using (public.is_player_parent(player_id) or player_id = public.device_player());

-- challenges
create policy challenges_select on public.challenges for select to authenticated
  using (public.is_family_parent(family_id)
         or (family_id = public.device_family()
             and (player_id is null or player_id = public.device_player())));
create policy challenges_insert on public.challenges for insert to authenticated
  with check (public.is_family_parent(family_id) and public.family_is_plus(family_id));
create policy challenges_update on public.challenges for update to authenticated
  using (public.is_family_parent(family_id))
  with check (public.is_family_parent(family_id) and public.family_is_plus(family_id));
create policy challenges_delete on public.challenges for delete to authenticated
  using (public.is_family_parent(family_id));

-- leagues (placar entre famílias só por função, para mostrar apenas apelidos)
create policy leagues_select on public.leagues for select to authenticated
  using (exists (select 1 from public.league_families lf
                 where lf.league_id = id and public.is_family_parent(lf.family_id)));
create policy leagues_delete on public.leagues for delete to authenticated
  using (public.is_family_parent(owner_family));
create policy league_families_select on public.league_families for select to authenticated
  using (public.is_family_parent(family_id));
create policy league_families_delete on public.league_families for delete to authenticated
  using (public.is_family_parent(family_id));

-- pairing_codes e parent_invites: sem políticas = acesso só pelas funções.

-- ---------------------------------------------------------------------
-- Permissões por coluna (estrelas e plano nunca pelo cliente)
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke insert, update on public.families, public.family_members, public.players,
  public.devices, public.pairing_codes, public.parent_invites, public.mission_logs,
  public.reward_requests, public.leagues, public.league_families from authenticated;
revoke update on public.missions, public.rewards, public.challenges from authenticated;

grant update (name, timezone)                     on public.families       to authenticated;
grant update (display_name)                       on public.family_members to authenticated;
grant update (nickname, avatar, pet_name, look)   on public.players        to authenticated;
grant update (title, icon, points, time_of_day, active, sort, audience) on public.missions to authenticated;
grant update (title, icon, cost, active)          on public.rewards        to authenticated;
grant update (title, target_days, prize, starts_on, ends_on, player_id, mission_id) on public.challenges to authenticated;
revoke all on public.pairing_codes, public.parent_invites from authenticated;

-- ---------------------------------------------------------------------
-- Conteúdo padrão de uma família nova
-- ---------------------------------------------------------------------
create or replace function public.seed_family(fid uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into missions (family_id, audience, title, icon, points, time_of_day, sort) values
    (fid, 'child', 'Escovar os dentes',        '🪥', 20, 'any',   1),
    (fid, 'child', 'Arrumar a cama',           '🛏️', 20, 'manha', 2),
    (fid, 'child', 'Ler por 10 minutos',       '📚', 20, 'any',   3),
    (fid, 'child', 'Beber um copo de água',    '💧', 10, 'any',   4),
    (fid, 'child', 'Guardar os brinquedos',    '🧸', 20, 'noite', 5),
    (fid, 'child', 'Fazer a lição de casa',    '✏️', 30, 'tarde', 6),
    (fid, 'adult', 'Ler junto com as crianças','📖', 20, 'any',   1),
    (fid, 'adult', 'Jantar sem celular',       '📵', 20, 'noite', 2),
    (fid, 'adult', 'Brincar 20 minutos',       '🧩', 20, 'any',   3);
  insert into rewards (family_id, title, icon, cost) values
    (fid, 'Escolher o jantar',     '🍕', 40),
    (fid, 'Sorvete com a família', '🍦', 60),
    (fid, 'Noite de filme',        '🎬', 80),
    (fid, 'Tarde no parque',       '🛝', 120),
    (fid, 'Passeio especial',      '🏝️', 200);
end $$;

-- ---------------------------------------------------------------------
-- Funções para os pais (portal)
-- ---------------------------------------------------------------------
create or replace function public.create_family(p_name text, p_display_name text, p_avatar text default '🦊')
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare fid uuid;
begin
  if auth.uid() is null or public.is_anonymous_user() then
    raise exception 'LOGIN_REQUIRED';
  end if;
  insert into families (name) values (trim(p_name)) returning id into fid;
  insert into family_members (family_id, user_id, role, display_name)
    values (fid, auth.uid(), 'owner', trim(p_display_name));
  insert into players (family_id, kind, user_id, nickname, avatar)
    values (fid, 'adult', auth.uid(), trim(p_display_name), coalesce(nullif(p_avatar, ''), '🦊'));
  perform public.seed_family(fid);
  return fid;
end $$;

create or replace function public.create_child(p_family uuid, p_nickname text, p_avatar text default '🌸')
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare pid uuid; n int;
begin
  if not public.is_family_parent(p_family) then raise exception 'FORBIDDEN'; end if;
  select count(*) into n from players where family_id = p_family and kind = 'child';
  if n >= 1 and not public.family_is_plus(p_family) then raise exception 'PLUS_REQUIRED'; end if;
  if n >= 10 then raise exception 'LIMIT_REACHED'; end if;
  insert into players (family_id, kind, nickname, avatar)
    values (p_family, 'child', trim(p_nickname), coalesce(nullif(p_avatar, ''), '🌸'))
    returning id into pid;
  return pid;
end $$;

create or replace function public.create_pairing_code(p_player uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare c text; exp timestamptz := now() + interval '30 minutes';
begin
  if not public.is_player_parent(p_player) then raise exception 'FORBIDDEN'; end if;
  if (select kind from players where id = p_player) <> 'child' then raise exception 'CHILD_ONLY'; end if;
  delete from pairing_codes where player_id = p_player or expires_at < now();
  loop
    c := public.new_code();
    begin
      insert into pairing_codes (code, player_id, expires_at) values (c, p_player, exp);
      exit;
    exception when unique_violation then
      -- tenta outro código
    end;
  end loop;
  return jsonb_build_object('code', c, 'expires_at', exp);
end $$;

create or replace function public.create_parent_invite(p_family uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare c text; exp timestamptz := now() + interval '2 days';
begin
  if not public.is_family_parent(p_family) then raise exception 'FORBIDDEN'; end if;
  delete from parent_invites where expires_at < now();
  loop
    c := public.new_code();
    begin
      insert into parent_invites (code, family_id, expires_at, created_by) values (c, p_family, exp, auth.uid());
      exit;
    exception when unique_violation then
    end;
  end loop;
  return jsonb_build_object('code', c, 'expires_at', exp);
end $$;

create or replace function public.accept_parent_invite(p_code text, p_display_name text, p_avatar text default '🐻')
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare fid uuid;
begin
  if auth.uid() is null or public.is_anonymous_user() then raise exception 'LOGIN_REQUIRED'; end if;
  select family_id into fid from parent_invites
    where code = public.normalize_code(p_code) and expires_at > now();
  if fid is null then raise exception 'INVALID_CODE'; end if;
  insert into family_members (family_id, user_id, role, display_name)
    values (fid, auth.uid(), 'parent', trim(p_display_name))
    on conflict (family_id, user_id) do nothing;
  insert into players (family_id, kind, user_id, nickname, avatar)
    values (fid, 'adult', auth.uid(), trim(p_display_name), coalesce(nullif(p_avatar, ''), '🐻'))
    on conflict (family_id, user_id) do nothing;
  delete from parent_invites where code = public.normalize_code(p_code);
  return fid;
end $$;

create or replace function public.decide_mission(p_log uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare l mission_logs;
begin
  select * into l from mission_logs where id = p_log for update;
  if l.id is null or not public.is_player_parent(l.player_id) then raise exception 'FORBIDDEN'; end if;
  if l.status <> 'pending' then return; end if;
  update mission_logs
     set status = case when p_approve then 'done' else 'rejected' end,
         decided_at = now(), decided_by = auth.uid()
   where id = p_log;
  if p_approve then
    update players set xp = xp + l.points, wallet = wallet + l.points where id = l.player_id;
  end if;
end $$;

-- Marca como feita direto (missões dos adultos, ou a criança sem aparelho).
create or replace function public.parent_mark_done(p_player uuid, p_mission uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare m missions; p players; today date; changed int;
begin
  select * into p from players where id = p_player;
  if p.id is null or not public.is_family_parent(p.family_id) then raise exception 'FORBIDDEN'; end if;
  if p.kind = 'adult' and p.user_id <> auth.uid() then raise exception 'FORBIDDEN'; end if;
  select * into m from missions where id = p_mission and family_id = p.family_id and active;
  if m.id is null then raise exception 'INVALID_MISSION'; end if;
  if (m.audience = 'adult') <> (p.kind = 'adult') then raise exception 'INVALID_MISSION'; end if;
  today := public.family_today(p.family_id);
  insert into mission_logs (player_id, mission_id, day, status, points, decided_at, decided_by)
    values (p.id, m.id, today, 'done', m.points, now(), auth.uid())
  on conflict (player_id, mission_id, day) do update
    set status = 'done', decided_at = now(), decided_by = auth.uid(), points = excluded.points
    where mission_logs.status <> 'done';
  get diagnostics changed = row_count;
  if changed > 0 then
    update players set xp = xp + m.points, wallet = wallet + m.points where id = p.id;
  end if;
end $$;

create or replace function public.decide_reward(p_request uuid, p_deliver boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r reward_requests;
begin
  select * into r from reward_requests where id = p_request for update;
  if r.id is null or not public.is_player_parent(r.player_id) then raise exception 'FORBIDDEN'; end if;
  if r.status <> 'pending' then return; end if;
  update reward_requests
     set status = case when p_deliver then 'delivered' else 'denied' end,
         decided_at = now(), decided_by = auth.uid()
   where id = p_request;
  if not p_deliver then
    update players set wallet = wallet + r.cost where id = r.player_id;
  end if;
end $$;

create or replace function public.create_league(p_family uuid, p_name text, p_nickname text, p_avatar text default '🏡')
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare lid uuid; c text;
begin
  if not public.is_family_parent(p_family) then raise exception 'FORBIDDEN'; end if;
  if not public.family_is_plus(p_family) then raise exception 'PLUS_REQUIRED'; end if;
  loop
    c := public.new_code();
    begin
      insert into leagues (name, code, owner_family) values (trim(p_name), c, p_family) returning id into lid;
      exit;
    exception when unique_violation then
    end;
  end loop;
  insert into league_families (league_id, family_id, nickname, avatar)
    values (lid, p_family, trim(p_nickname), coalesce(nullif(p_avatar, ''), '🏡'));
  return jsonb_build_object('id', lid, 'code', c);
end $$;

create or replace function public.join_league(p_family uuid, p_code text, p_nickname text, p_avatar text default '🏡')
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare lid uuid; n int;
begin
  if not public.is_family_parent(p_family) then raise exception 'FORBIDDEN'; end if;
  if not public.family_is_plus(p_family) then raise exception 'PLUS_REQUIRED'; end if;
  select id into lid from leagues where code = public.normalize_code(p_code);
  if lid is null then raise exception 'INVALID_CODE'; end if;
  select count(*) into n from league_families where league_id = lid;
  if n >= 20 then raise exception 'LIMIT_REACHED'; end if;
  insert into league_families (league_id, family_id, nickname, avatar)
    values (lid, p_family, trim(p_nickname), coalesce(nullif(p_avatar, ''), '🏡'))
    on conflict (league_id, family_id) do update set nickname = excluded.nickname, avatar = excluded.avatar;
  return lid;
end $$;

-- Placar de uma liga: só apelido, avatar e pontos da semana de cada família.
create or replace function public.league_scores(p_league uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare mine uuid;
begin
  select lf.family_id into mine from league_families lf
   where lf.league_id = p_league
     and (public.is_family_parent(lf.family_id) or lf.family_id = public.device_family())
   limit 1;
  if mine is null then raise exception 'FORBIDDEN'; end if;
  return (
    select jsonb_build_object(
      'id', l.id, 'name', l.name,
      'code', case when public.is_family_parent(mine) then l.code end,
      'families', coalesce((
        select jsonb_agg(x order by (x->>'points')::int desc)
        from (select jsonb_build_object(
                'nickname', lf.nickname, 'avatar', lf.avatar,
                'points', public.family_week_points(lf.family_id),
                'mine', lf.family_id = mine) as x
              from league_families lf where lf.league_id = l.id) s), '[]'::jsonb))
    from leagues l where l.id = p_league);
end $$;

create or replace function public.challenge_progress(c challenges, pid uuid) returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select count(distinct day)::int from mission_logs
  where player_id = pid and mission_id = c.mission_id and status = 'done'
    and day between c.starts_on and c.ends_on
$$;

-- Tudo que o portal dos pais precisa numa chamada.
create or replace function public.parent_dashboard(p_family uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare ws date; today date;
begin
  if not public.is_family_parent(p_family) then raise exception 'FORBIDDEN'; end if;
  ws := public.family_week_start(p_family);
  today := public.family_today(p_family);
  return jsonb_build_object(
    'family', (select jsonb_build_object('id', f.id, 'name', f.name, 'plan', f.plan,
                 'plus', public.family_is_plus(f.id), 'plan_expires_at', f.plan_expires_at,
                 'timezone', f.timezone,
                 'is_owner', exists (select 1 from family_members m where m.family_id = f.id
                                     and m.user_id = auth.uid() and m.role = 'owner'))
               from families f where f.id = p_family),
    'today', today,
    'week_start', ws,
    'me', (select id from players where family_id = p_family and user_id = auth.uid()),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'kind', p.kind, 'nickname', p.nickname, 'avatar', p.avatar,
        'pet_name', p.pet_name, 'look', p.look, 'xp', p.xp, 'wallet', p.wallet,
        'week_points', public.player_week_points(p.id, ws),
        'devices', (select count(*) from devices d where d.player_id = p.id),
        'is_me', p.user_id = auth.uid()) order by p.kind desc, p.created_at)
      from players p where p.family_id = p_family), '[]'::jsonb),
    'pending_missions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'player_id', l.player_id, 'nickname', p.nickname, 'avatar', p.avatar,
        'title', m.title, 'icon', m.icon, 'points', l.points, 'day', l.day, 'created_at', l.created_at)
        order by l.created_at)
      from mission_logs l join players p on p.id = l.player_id join missions m on m.id = l.mission_id
      where p.family_id = p_family and l.status = 'pending'), '[]'::jsonb),
    'pending_rewards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'player_id', q.player_id, 'nickname', p.nickname, 'avatar', p.avatar,
        'title', r.title, 'icon', r.icon, 'cost', q.cost, 'created_at', q.created_at)
        order by q.created_at)
      from reward_requests q join players p on p.id = q.player_id join rewards r on r.id = q.reward_id
      where p.family_id = p_family and q.status = 'pending'), '[]'::jsonb),
    'my_missions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'title', m.title, 'icon', m.icon, 'points', m.points,
        'done', exists (select 1 from mission_logs l join players p on p.id = l.player_id
                        where l.mission_id = m.id and l.day = today and l.status = 'done'
                          and p.family_id = p_family and p.user_id = auth.uid()))
        order by m.sort, m.created_at)
      from missions m where m.family_id = p_family and m.audience = 'adult' and m.active), '[]'::jsonb),
    'challenges', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'title', c.title, 'target_days', c.target_days, 'prize', c.prize,
        'starts_on', c.starts_on, 'ends_on', c.ends_on, 'player_id', c.player_id,
        'mission_title', m.title, 'mission_icon', m.icon,
        'progress', (select coalesce(jsonb_agg(jsonb_build_object(
                        'nickname', p.nickname, 'avatar', p.avatar,
                        'done', public.challenge_progress(c, p.id)) order by p.created_at), '[]'::jsonb)
                     from players p where p.family_id = p_family and p.kind = 'child'
                       and (c.player_id is null or c.player_id = p.id)))
        order by c.ends_on desc)
      from challenges c join missions m on m.id = c.mission_id
      where c.family_id = p_family and c.ends_on >= today - 14), '[]'::jsonb),
    'leagues', coalesce((
      select jsonb_agg(public.league_scores(lf.league_id))
      from league_families lf where lf.family_id = p_family), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------------
-- Funções para o aparelho da criança (login anônimo)
-- ---------------------------------------------------------------------
create or replace function public.pair_device(p_code text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare pid uuid;
begin
  if auth.uid() is null then raise exception 'LOGIN_REQUIRED'; end if;
  select player_id into pid from pairing_codes
    where code = public.normalize_code(p_code) and expires_at > now();
  if pid is null then raise exception 'INVALID_CODE'; end if;
  insert into devices (user_id, player_id) values (auth.uid(), pid)
    on conflict (user_id) do update set player_id = excluded.player_id, last_seen_at = now();
  delete from pairing_codes where player_id = pid;
  return pid;
end $$;

create or replace function public.unpair_device() returns void
language sql security definer set search_path = public, pg_temp as $$
  delete from devices where user_id = auth.uid()
$$;

create or replace function public.mark_mission_done(p_mission uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare pid uuid := public.device_player(); p players; m missions; today date; st text;
begin
  if pid is null then raise exception 'NOT_PAIRED'; end if;
  select * into p from players where id = pid;
  select * into m from missions where id = p_mission and family_id = p.family_id
    and active and audience = 'child';
  if m.id is null then raise exception 'INVALID_MISSION'; end if;
  today := public.family_today(p.family_id);
  insert into mission_logs (player_id, mission_id, day, status, points)
    values (pid, m.id, today, 'pending', m.points)
  on conflict (player_id, mission_id, day) do update
    set status = 'pending', created_at = now(), decided_at = null, decided_by = null, points = excluded.points
    where mission_logs.status = 'rejected';
  select status into st from mission_logs where player_id = pid and mission_id = m.id and day = today;
  return st;
end $$;

create or replace function public.request_reward(p_reward uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare pid uuid := public.device_player(); p players; r rewards; ok int;
begin
  if pid is null then raise exception 'NOT_PAIRED'; end if;
  select * into p from players where id = pid;
  select * into r from rewards where id = p_reward and family_id = p.family_id and active;
  if r.id is null then raise exception 'INVALID_REWARD'; end if;
  if exists (select 1 from reward_requests where player_id = pid and reward_id = r.id and status = 'pending') then
    return;
  end if;
  update players set wallet = wallet - r.cost where id = pid and wallet >= r.cost;
  get diagnostics ok = row_count;
  if ok = 0 then raise exception 'NOT_ENOUGH_STARS'; end if;
  insert into reward_requests (player_id, reward_id, cost) values (pid, r.id, r.cost);
end $$;

create or replace function public.update_my_pet(p_pet_name text, p_look jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare pid uuid := public.device_player(); clean jsonb;
begin
  if pid is null then raise exception 'NOT_PAIRED'; end if;
  clean := jsonb_build_object(
    'color', case when p_look->>'color' in ('rosa','azul','verde','amarelo','lilas') then p_look->>'color' else 'rosa' end,
    'hat',   case when p_look->>'hat' in ('none','bone','festa','gorro','coroa','mago') then p_look->>'hat' else 'none' end,
    'acc',   case when p_look->>'acc' in ('none','oculos','laco','gravata') then p_look->>'acc' else 'none' end);
  update players
     set pet_name = coalesce(nullif(left(trim(p_pet_name), 12), ''), pet_name),
         look = clean
   where id = pid;
end $$;

-- Tudo que o jogo da criança precisa numa chamada.
create or replace function public.kid_snapshot() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare pid uuid := public.device_player(); fid uuid; today date; ws date;
begin
  if pid is null then return null; end if;
  select family_id into fid from players where id = pid;
  today := public.family_today(fid);
  ws := public.family_week_start(fid);
  update devices set last_seen_at = now() where user_id = auth.uid();
  return jsonb_build_object(
    'today', today,
    'player', (select jsonb_build_object('id', id, 'nickname', nickname, 'avatar', avatar,
                 'pet_name', pet_name, 'look', look, 'xp', xp, 'wallet', wallet,
                 'week_points', public.player_week_points(id, ws))
               from players where id = pid),
    'family', (select jsonb_build_object('name', name) from families where id = fid),
    'missions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'title', m.title, 'icon', m.icon, 'points', m.points,
        'time_of_day', m.time_of_day, 'status', coalesce(l.status, 'todo'))
        order by m.sort, m.created_at)
      from missions m
      left join mission_logs l on l.mission_id = m.id and l.player_id = pid and l.day = today
      where m.family_id = fid and m.active and m.audience = 'child'), '[]'::jsonb),
    'rewards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'title', r.title, 'icon', r.icon, 'cost', r.cost,
        'pending', exists (select 1 from reward_requests q where q.reward_id = r.id
                           and q.player_id = pid and q.status = 'pending'))
        order by r.cost)
      from rewards r where r.family_id = fid and r.active), '[]'::jsonb),
    'recent_rewards', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'status', q.status, 'title', r.title, 'icon', r.icon))
      from reward_requests q join rewards r on r.id = q.reward_id
      where q.player_id = pid and q.status <> 'pending' and q.decided_at > now() - interval '2 days'), '[]'::jsonb),
    'ranking', coalesce((
      select jsonb_agg(x order by (x->>'points')::int desc)
      from (select jsonb_build_object(
              'nickname', p.nickname, 'avatar', p.avatar, 'kind', p.kind,
              'points', public.player_week_points(p.id, ws), 'me', p.id = pid) as x
            from players p where p.family_id = fid) s), '[]'::jsonb),
    'challenges', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', c.title, 'target_days', c.target_days, 'prize', c.prize,
        'icon', m.icon, 'done', public.challenge_progress(c, pid), 'ends_on', c.ends_on))
      from challenges c join missions m on m.id = c.mission_id
      where c.family_id = fid and (c.player_id is null or c.player_id = pid)
        and today between c.starts_on and c.ends_on), '[]'::jsonb),
    'leagues', coalesce((
      select jsonb_agg(public.league_scores(lf.league_id))
      from league_families lf where lf.family_id = fid), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------------
-- Execução de funções: só usuários logados (inclui anônimos)
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Realtime (o jogo e o portal atualizam sozinhos)
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.mission_logs, public.reward_requests, public.players;
