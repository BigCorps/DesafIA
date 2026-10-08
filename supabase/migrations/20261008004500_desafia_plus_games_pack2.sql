begin;

create or replace function desafia.game_catalog()
returns text[] language sql immutable
set search_path=desafia,pg_catalog,extensions,pg_temp as $$
  select array[
    'pula','voa','trenzinho','torre','bloquinhos','evolucao','frutas','memoria','estrelinha','cores',
    'labirinto','constelacoes','ritmo','quebracabeca','robo','cozinha'
  ]::text[]
$$;

commit;
