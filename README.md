# DesafIA 0.4.0

**Pequenos desafios, grandes hábitos.**

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

## Supabase

A migration correta é somente:

`supabase/migrations/20260929000100_desafia_schema.sql`

A migration antiga foi removida do ZIP final para evitar aplicação acidental.

Se você **já aplicou essa migration no Supabase da minhAi**, a versão 0.4.0 não exige SQL adicional.

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
supabase/
  migrations/           migration isolada do DesafIA
  VERIFICACAO-...sql    auditoria somente leitura
  ATIVAR-PLUS-TESTE.sql helper opcional de teste
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
