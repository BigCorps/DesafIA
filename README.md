# DesafIA 0.5.3

**Pequenos desafios, grandes hábitos.**

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
- **Modo local:** funciona sem Supabase para demonstração e testes rápidos.

```text
BigCorps/DesafIA
       │
       ├── Vercel → desafia.vercel.app (teste)
       │            depois: domínio definitivo
       │
       └── Supabase minhAi
              └── schema desafia
```

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

A migration antiga foi removida do ZIP final para evitar aplicação acidental.

Se a migration base já está aplicada, para atualizar da 0.4.x para a 0.5.0 execute **somente a migration de billing**. Não rode novamente a migration base.

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
