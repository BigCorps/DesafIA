# Limpeza após substituir os arquivos

Se o seu método de upload apenas sobrescreve/adiciona arquivos, apague manualmente do repositório os arquivos antigos que não fazem parte desta versão:

- `.env` (não deve ficar versionado; use variáveis do Vercel)
- `supabase/migrations/20260928000000_desafia_init.sql` (migration antiga; não usar)

A versão 0.4.1 usa somente `supabase/migrations/20260929000100_desafia_schema.sql`.
