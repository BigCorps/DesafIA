# DesafIA 0.6.0

## Modo QA local (desenvolvimento / Vercel Preview)

Em desenvolvimento (`npm run dev`) ou em um deployment **Preview** da Vercel,
abra `/?qa=1`. O painel QA permite pular/reabrir onboarding, simular missões
a fazer, aguardando aprovação ou aprovadas, editar estrelas/XP, selecionar
progresso baixo/intermediário/avançado e desbloquear os dez jogos existentes.
“Desbloquear e ver todos os jogos” também aprova as missões simuladas e reinicia
os 30 minutos do parque local. Os presets de missões reiniciam a economia do
dia simulado antes de aplicar as regras existentes de recompensa e bônus.
Em QA, os botões de pais alternam a visão de aprovação local, sem abrir login.

Os dados QA ficam em `sessionStorage`, sob `desafia-qa-v1:`, isolados do estado
normal e do Supabase. Persistem ao recarregar a mesma aba; o reset limpa apenas
esse namespace, incluindo onboarding, recordes e preferências QA. O QA não
registra service worker e requer conexão para carregar assets não disponíveis.
Sem `?qa=1`, a interface e o fluxo normais permanecem iguais.

O build só libera QA quando `VERCEL_ENV=preview`; builds de produção ou sem
essa identificação removem o painel, mesmo com `?qa=1`. Para conferir Preview
localmente: `VERCEL_ENV=preview npm run build`. Não use esse artefato como build
de produção. A variável de sistema `VERCEL_ENV` precisa estar disponível no
build da Vercel; sua ausência bloqueia QA por padrão.

Validação: `npm run check`, `node --test scripts/qa-state.test.mjs` e
`npm run build`. Os testes cobrem isolamento, aprovação, economia, reset,
desbloqueio de jogos, limites de progresso e o bloqueio de produção.

**Pequenos desafios, grandes hábitos.**

**Novo na 0.6.0 — Parque de jogos:** 10 minijogos que abrem quando todas as missões do dia estão concluídas, pelo tempo que os pais escolherem (10, 30, 60 min ou livre). A cada dia completo, um jogo surpresa entra no álbum da criança.

**Ícone oficial 0.5.2:** personagem ampliado para melhor leitura no celular e na Play Store.

**Correção 0.5.3:** personagem novamente apoiado na montanha no modo imersivo, mantendo a cobertura total do terreno na base da tela.

**0.5.1:** corrige o retorno Pais → Jogo em mobile, mantém a alça do painel acessível após BFCache/alteração de viewport, cobre a base do terreno no modo imersivo e usa chevron SVG alinhado no expansor.

O DesafIA é um jogo familiar de hábitos: a criança cumpre missões reais, um responsável confirma, ela recebe estrelas para recompensas e XP para fazer seu personagem crescer e transformar o mundo dele.

## Arquitetura final

- **Jogo infantil:** `/` — Vite/PWA, preparado para TWA Android.
- **Portal dos pais:** `/pais/` — Google OAuth, família, aprovações e configuração.
- **Backend:** mesmo projeto Supabase da minhAi, em schema isolado `desafia`.
- **Deploy:** projeto Vercel próprio do repositório DesafIA.
- **Criança conectada:** segredo aleatório local do aparelho; **não usa Anonymous Auth**.
- **Modo local:** funciona sem Supabase para demonstração e testes rápidos, com os 10 minijogos gratuitos (os 6 Plus exigem entitlement remoto; o QA isolado pode simulá-los).

```text
BigCorps/DesafIA
       │
       ├── Vercel → desafia.vercel.app (teste)
       │            depois: domínio definitivo
       │
       └── Supabase minhAi
              └── schema desafia
```

## Notificações opcionais (preparadas, envio desligado)

A integração OneSignal v16 usa consentimento explícito do responsável e do
aparelho infantil, identidades opacas e fila isolada em `desafia`.
`DESAFIA_PUSH_ENABLED` deve permanecer `false` até ativação autorizada. Nenhuma
migration, Edge Function ou cron é aplicada automaticamente por esta branch.
Veja [docs/ONESIGNAL.md](docs/ONESIGNAL.md) para configuração, testes e os
CSP e pré-requisitos de origem antes de validar inscrições no Preview com envio desligado.

## Segurança do aparelho infantil

O Supabase é compartilhado por vários produtos BigCorps. Para não habilitar Anonymous Auth globalmente, o aparelho infantil cria um segredo aleatório de 256 bits. O banco guarda somente o SHA-256 desse segredo em `desafia.devices`.

As ações da criança passam por RPCs específicas e precisam apresentar o segredo. O responsável pode revogar o aparelho pelo portal a qualquer momento.

## Funcionalidades desta versão

0.5.0 adiciona a cobrança real do Plus via PIX Banco Inter no Web/PWA e separa o entitlement do meio de pagamento, deixando a primeira versão da Google Play em modo consumption-only.


- schema isolado `desafia.*`, sem alterações globais em `public`;
- tabelas sem acesso direto para `anon` ou `authenticated`;
- RPCs separadas para responsáveis e aparelhos infantis;
- Google OAuth para responsáveis, reutilizando o Auth da minhAi;
- código de pareamento de uso único + segredo do aparelho;
- XP separado de estrelas;
- níveis de progressão longa;
- casa/mundo do personagem;
- meta cooperativa semanal;
- sequência de dias sem punição;
- bônus de dia completo `+25 ⭐ / +15 XP`;
- painel inferior recolhível e modo imersivo;
- Pipo, Lumi, Nino e Zupi como sugestões, além de nome livre;
- reações aleatórias do personagem ao toque;
- botão dos pais dentro do jogo protegido por continha;
- navegação jogo ↔ portal dentro da PWA;
- cache offline do shell e assets já visitados/pré-carregados;
- aviso de nova versão da PWA antes de ativar um service worker novo;
- safe areas para celulares com recorte/notch.
- cobrança do DesafIA Plus via PIX Banco Inter no portal Web/PWA;
- liberação idempotente de 30 dias de Plus após confirmação do PIX;
- histórico de invoices e subscriptions no schema `desafia`;
- distribuição Google Play em modo consumption-only, sem checkout externo dentro do app;
- estrutura preparada para `provider = google_play` no futuro.

## Parque de jogos (0.6.0)

Quando **todas as missões infantis do dia** estão concluídas, o parque abre. Os pais controlam tudo na aba **Jogos** do portal:

- tempo por dia: desligado, 10, 30, 60 minutos ou um valor livre até 180;
- **+15 min hoje** para um dia especial, por criança;
- exigir aprovação de todas as missões antes de liberar (padrão) ou aceitar as "esperando adulto";
- ligar e desligar cada jogo.

Na criança:

- o personagem avisa "Tudo feito! O parque de jogos abriu 🎡" e aparece um botão na cena;
- ao abrir o parque, uma roleta sorteia o **jogo surpresa do dia** para o álbum (2 no primeiro dia, depois 1 por dia completo; com o álbum completo, sorteia um destaque diferente de ontem);
- cada jogo tem recorde, medalhas de bronze/prata/ouro e dificuldade que cresce;
- o personagem aparece nos jogos com a cor, o chapéu e o acessório que a criança escolheu;
- quando o tempo acaba, ele boceja: "Hora de descansar os olhos. Amanhã tem mais!".

| Jogo | Idade | Como joga |
|---|---|---|
| 🏃 Pula-Pula | 4+ | corrida com pulo duplo, 3 corações |
| 🪽 Voa Alto | 5+ | voar entre árvores, chão e teto só empurram |
| 🚂 Trenzinho de Frutas | 5+ | cobrinha que atravessa as bordas, com setas na tela |
| 🏗️ Torre Alta | 4+ | empilhar blocos, bônus por acerto certinho |
| 🧱 Quebra-Bloquinhos | 6+ | fases infinitas, blocos fortes e estrelas bônus |
| 🌱 Evolução | 7+ | juntar peças iguais de semente até diamante |
| 🍓 Combina Frutas | 6+ | combinar 3, 25 jogadas, combos dão jogadas extras |
| 🃏 Memória | 4+ | 5 fases, com uma olhadinha nas cartas no começo |
| ⭐ Pega-Estrelinha | 3+ | pegar estrelas e fugir da chuva em 40 s |
| 🎵 Siga as Cores | 4+ | sequência de cores e sons, com segunda chance |

Regras técnicas:

- o tempo é descontado **no servidor** (`play_tick`), limitado ao tempo real decorrido; apagar os dados do app não zera o limite;
- os jogos não acessam a rede, não têm anúncios, links nem compras; os sons são sintetizados;
- cada jogo tem 2 a 5 KB, é carregado só quando aberto e fica disponível offline pelo service worker;
- a lista de jogos existe em dois lugares que precisam ser iguais: `src/games/registry.js` e `desafia.game_catalog()` (o `npm run check` confere);
- no modo sem conexão, o parque usa 30 min por dia e as missões "esperando adulto" contam.

## DesafIA Plus e pagamentos

O preço do Plus **não fica no frontend**. Configure o secret da Edge Function:

```text
DESAFIA_PLUS_MONTHLY_CENTS=<valor em centavos>
```

A Edge Function `desafia-billing` reutiliza a infraestrutura Banco Inter/BigCorps já usada pelos produtos minhAi. A chave `BANCO_INTER_API_KEY` permanece somente no Supabase.

Fluxo Web/PWA: **Config. → Plano → PIX → confirmação Inter → +30 dias de Plus**. A renovação PIX não é automática nesta versão.

Para a Google Play, a primeira publicação é consumption-only: o app reconhece um Plus existente, mas não exibe checkout PIX nem link de compra. O TWA deve iniciar por `/?store=play`. Veja [`PLUS-E-PLAY.md`](PLUS-E-PLAY.md).

## Supabase

A instalação base usa:

`supabase/migrations/20260929000100_desafia_schema.sql`

A cobrança Plus acrescenta:

`supabase/migrations/20260930000100_desafia_billing.sql`

O parque de minijogos acrescenta (rode depois da de billing):

`supabase/migrations/20260930000200_desafia_minijogos.sql`

Depois confira com `supabase/VERIFICACAO-MINIJOGOS.sql`.

A migration antiga foi removida do ZIP final para evitar aplicação acidental.

Se a migration base já está aplicada, para atualizar da 0.4.x para a 0.5.0 execute **somente a migration de billing**. Da 0.5.x para a 0.6.0, execute **somente a de minijogos**. Não rode novamente as anteriores.

O schema `desafia` deve estar incluído em **Data API → Exposed schemas**. As tabelas continuam protegidas; o frontend acessa apenas as RPCs explicitamente liberadas.

## Variáveis do Vercel

No projeto Vercel **desafia**, configure:

```env
VITE_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_CHAVE_REAL_COMPLETA
```

O frontend rejeita placeholders como `sb_publishable_...` para evitar um falso estado de configuração válida.

Nunca coloque `service_role` no frontend.

## Google OAuth

O portal dos responsáveis usa o provider Google já configurado no Supabase compartilhado da minhAi.

Em **Authentication → URL Configuration → Redirect URLs**, mantenha o endereço utilizado pelo DesafIA, por exemplo:

```text
https://desafia.vercel.app/pais/
```

Quando houver domínio definitivo, adicione também:

```text
https://desafia.app/pais/
```

Não é necessário trocar o Site URL global da minhAi.

## PWA e atualização

O service worker não força atualização no meio de uma ação. Quando uma versão nova estiver instalada e aguardando, o usuário verá:

**Nova versão pronta → Atualizar**

Ao tocar em **Atualizar**, o novo worker assume e a página recarrega uma única vez.

Para releases futuras que alterem o app, incremente a constante `CACHE` em `public/sw.js` para uma nova versão.

## Instalação e testes

Siga:

[`TESTE-PASSO-A-PASSO.md`](TESTE-PASSO-A-PASSO.md)

Comandos locais:

```bash
cp .env.example .env.local
npm install
npm run check
npm run build
npm run dev
```

URLs:

- jogo: `http://localhost:5173/`
- pais: `http://localhost:5173/pais/`

Sem `.env.local`, o jogo pode ser testado por **Experimentar sem conectar**.

## Estrutura

```text
src/
  game/                 jogo infantil
  games/                parque: registry, kit, arcade e os 10 minijogos
  pais/                 portal dos responsáveis
  shared/               personagem, progressão, PWA e estilos
  lib/supabase.js       clientes Supabase + segredo local do aparelho
  pais/billing.js       cliente da Edge Function de cobrança
  shared/platform.js    separa Web/PWA da distribuição Google Play
supabase/
  migrations/           migration isolada do DesafIA
  VERIFICACAO-...sql    auditoria somente leitura
  ATIVAR-PLUS-TESTE.sql helper opcional de teste
  VERIFICACAO-BILLING.sql auditoria somente leitura do billing
  functions/desafia-billing/ Edge Function Inter/Plus
public/
  manifest.webmanifest
  sw.js
  icons/
  .well-known/assetlinks.json
```

## Regra de produto

> **A criança cuida do personagem cuidando da própria rotina.**

Estrelas dão recompensa rápida. XP dá progressão longa. O mundo do personagem torna hábitos reais visíveis. Ranking e ligas são opcionais; a meta principal é cooperativa dentro da família.

## Antes da Play Store

- preencher/revisar contatos e textos de `/privacidade/` e `/termos/`;
- preencher o SHA-256 real em `public/.well-known/assetlinks.json`;
- concluir os formulários de público infantil/dados aplicáveis da Play Console;
- testar a TWA com o domínio definitivo;
- testar Google OAuth em aparelho real;
- validar atualização de uma versão instalada para a seguinte.

Desenvolvido por **BigCorps** · Tecnologia **minhAi**.
