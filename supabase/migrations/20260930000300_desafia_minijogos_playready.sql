-- ============================================================================
-- DesafIA 0.6.0 — preparação dos minijogos para Google Play
--
-- Corrige a sincronização do limite diário quando a criança joga sem internet.
-- O cliente pode acumular vários segundos pendentes; o servidor aceita somente:
--   1) o que o cliente realmente informou;
--   2) no máximo o tempo real decorrido desde o último tick/início;
--   3) no máximo o saldo diário restante.
-- Assim, reconectar não devolve minutos e também não permite adiantar o relógio.
--
-- IMPORTANTE: esta migration já foi aplicada no Supabase de produção via MCP.
-- Este arquivo existe para manter o repositório como fonte de verdade.
-- ============================================================================

create or replace function desafia.play_tick(p_device_token text, p_seconds integer)
returns jsonb language plpgsql security definer
set search_path=desafia,pg_catalog,extensions,pg_temp as $$
declare
  pid uuid;
  fid uuid;
  today date;
  pd desafia.play_days;
  delta int;
  elapsed int;
  allowed int;
  mins int;
begin
  if auth.uid() is not null then raise exception 'FORBIDDEN'; end if;

  pid:=desafia.device_player(p_device_token);
  if pid is null then raise exception 'NOT_PAIRED'; end if;

  select p.family_id, f.play_minutes into fid, mins
    from desafia.players p
    join desafia.families f on f.id=p.family_id
   where p.id=pid;

  today:=desafia.family_today(fid);

  select * into pd
    from desafia.play_days
   where player_id=pid and day=today
   for update;

  if pd.player_id is null or pd.started_at is null then
    raise exception 'PLAY_NOT_STARTED';
  end if;

  allowed:=mins*60 + pd.bonus_seconds;

  elapsed:=greatest(
    0,
    ceil(extract(epoch from now() - coalesce(pd.last_tick_at, pd.started_at, now())))::int + 5
  );

  delta:=least(
    greatest(coalesce(p_seconds,0),0),
    elapsed,
    greatest(0, allowed - pd.used_seconds)
  );

  update desafia.play_days
     set used_seconds=used_seconds + delta,
         last_tick_at=now()
   where player_id=pid and day=today;

  return jsonb_build_object(
    'remaining_seconds', greatest(0, allowed - (
      select used_seconds
        from desafia.play_days
       where player_id=pid and day=today
    )),
    'accepted_seconds', delta
  );
end $$;

revoke execute on function desafia.play_tick(text, integer) from public, authenticated;
grant execute on function desafia.play_tick(text, integer) to anon;
grant execute on function desafia.play_tick(text, integer) to service_role;
