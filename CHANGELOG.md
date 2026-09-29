# Changelog

## 0.3.0 — 29/09/2026

- DesafIA movido para schema isolado `desafia` no Supabase compartilhado da minhAi.
- Removida a necessidade de Supabase Anonymous Auth no aparelho infantil.
- Adicionado segredo local de aparelho com armazenamento apenas de SHA-256 no servidor.
- Removido Realtime público do jogo; atualização conectada agora usa polling leve e foco/visibilidade.
- Tabelas sem privilégios diretos para `anon`/`authenticated`; acesso via RPCs explícitas.
- XP separado de estrelas e nova curva de progressão.
- Casa do Pipo, meta familiar, sequência e bônus de dia completo.
- Interface infantil reorganizada para parecer jogo antes de parecer lista de tarefas.
- Portal dos pais reorganizado por pendências, família, rotina, prêmios, desafios e liga.
- PWA, Vercel e TWA mantidos como arquitetura de publicação.
