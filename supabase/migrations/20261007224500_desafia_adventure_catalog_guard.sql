begin;

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

  if not exists (
    select 1
    from (values
      ('arvore_portinha','bater','borboleta_azul'),
      ('arvore_portinha','seguir','bolota_bussola'),
      ('livro_sussurrante','pagina_dourada','marcador_dourado'),
      ('livro_sussurrante','pagina_desenhada','dragao_papel'),
      ('jardim_gotas','folha','joaninha_soneca'),
      ('jardim_gotas','terra','semente_cantora'),
      ('telescopio_luzes','luz_rapida','cometa_mirim'),
      ('telescopio_luzes','luz_calma','coelho_lunar'),
      ('vento_dancante','pena','pena_espiral'),
      ('vento_dancante','fita','fita_de_pipa'),
      ('ponte_nuvens','nuvem','peixe_nuvem'),
      ('ponte_nuvens','brilho','pedra_arco_iris'),
      ('trilha_luzes','voando','vagalume_lanterna'),
      ('trilha_luzes','folhas','folha_prateada'),
      ('piquenique_estrelas','frutinha','fruta_estrela'),
      ('piquenique_estrelas','copinho','copo_amizade')
    ) as allowed(adventure_id,choice_id,discovery_id)
    where allowed.adventure_id=adventure
      and allowed.choice_id=choice
      and allowed.discovery_id=discovery
  ) then
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

revoke execute on function desafia.complete_adventure(text,text,text,text) from public, anon, authenticated;
grant execute on function desafia.complete_adventure(text,text,text,text) to anon;
grant execute on function desafia.complete_adventure(text,text,text,text) to service_role;

commit;
