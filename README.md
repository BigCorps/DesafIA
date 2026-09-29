# DesafIA 0.3

**Cuide do Pipo cuidando da sua rotina.**
O DesafIA é um jogo familiar de hábitos: a criança cumpre missões reais, um responsável confirma, ela recebe estrelas para recompensas e XP para fazer o Pipo crescer e transformar a casa dele.

## Arquitetura

- **Jogo infantil:** `/` — Vite/PWA, preparado para TWA Android.
- **Portal dos pais:** `/pais/` — Magic Link, família, aprovações e configuração.
- **Backend:** mesmo projeto Supabase da minhAi, em schema isolado `desafia`.
- **Deploy:** projeto Vercel próprio para o repositório DesafIA.
- **Modo infantil conectado:** segredo aleatório local do aparelho; **não usa Anonymous Auth**.
- **Modo local:** funciona sem Supabase para demonstração e testes rápidos.

```text
BigCorps/DesafIA
       │
       ├── Vercel → desafia.app
       │
       └── Supabase minhAi
              └── schema desafia
```

## Por que o aparelho infantil não usa Supabase Anonymous Auth

O projeto Supabase é compartilhado por vários produtos BigCorps. Uma sessão criada com `signInAnonymously()` recebe o papel Postgres `authenticated`, o que obrigaria a revisar todas as políticas legadas dos outros produtos antes de ativar esse provider globalmente.

Nesta versão o aparelho cria um segredo aleatório de 256 bits no navegador. O banco guarda apenas `SHA-256(segredo)` em `desafia.devices`. Todas as ações infantis passam por RPCs próprias e precisam apresentar esse segredo. O responsável pode revogar o aparelho a qualquer momento.

Isso mantém o DesafIA isolado sem alterar o comportamento do Auth dos demais apps.

## O que mudou

- migration totalmente isolada em `desafia.*`;
- nenhuma alteração global em `public`;
- nenhuma tabela exposta diretamente a `anon` ou `authenticated`;
- RPCs separadas para responsáveis e aparelhos infantis;
- segredo de aparelho + hash criptográfico + código de pareamento de uso único;
- limite de tentativas por aparelho durante o pareamento;
- polling leve no jogo, evitando Realtime público para a criança;
- XP separado de estrelas;
- curva de níveis mais longa;
- Casa do Pipo e desbloqueios visuais;
- meta cooperativa semanal da família;
- bônus de dia completo: `+25 ⭐ / +15 XP`;
- sequência de dias sem linguagem punitiva;
- onboarding infantil com nome/cor;
- portal dos pais reorganizado, com pendências primeiro;
- Node 22+ e versões npm pinadas.

## Instalação e teste

Siga **na ordem**:

[`TESTE-PASSO-A-PASSO.md`](TESTE-PASSO-A-PASSO.md)

A migration correta é:

`supabase/migrations/20260929000100_desafia_schema.sql`

Depois dela, use a consulta somente leitura:

`supabase/VERIFICACAO-APOS-INSTALAR.sql`

## Rodar localmente

```bash
cp .env.example .env.local
npm install
npm run check
npm run dev
```

URLs:

- jogo: `http://localhost:5173/`
- pais: `http://localhost:5173/pais/`

Sem `.env.local`, o jogo infantil ainda pode ser testado pelo botão **Experimentar sem conectar**.

## Banco e segurança

O browser não recebe `INSERT`, `UPDATE`, `DELETE` nem `SELECT` direto nas tabelas `desafia.*`.

- `anon`: pode executar apenas as RPCs infantis explicitamente liberadas;
- `authenticated`: pode executar apenas as RPCs de responsáveis explicitamente liberadas;
- `service_role`: permanece disponível para operações server-side futuras;
- RLS fica habilitado em todas as tabelas como defesa adicional;
- nenhuma função do DesafIA recebe `EXECUTE` por herança de `PUBLIC`.

## Estrutura

```text
src/
  game/                 jogo infantil
  pais/                 portal dos responsáveis
  shared/               Pipo, progressão e estilos
  lib/supabase.js       clientes Supabase + segredo local do aparelho
supabase/
  migrations/           instalação do schema desafia
  VERIFICACAO-...sql    auditoria somente leitura
  ATIVAR-PLUS-TESTE.sql helper opcional de teste
public/
  manifest.webmanifest
  sw.js
  icons/
  .well-known/assetlinks.json
brand/
  icone.svg
  gerar_icones.py
android/
  README.md
```

## Regra de produto

> **A criança cuida do Pipo cuidando da própria rotina.**

Estrelas dão recompensa rápida. XP dá progressão longa. A Casa do Pipo torna hábitos reais visíveis no mundo do personagem. Ranking e ligas são opcionais; a meta principal é cooperativa dentro da família.

## Antes do lançamento público

- preencher os contatos em `/privacidade/` e `/termos/`;
- revisar os textos legais para público infantil;
- configurar SMTP do Supabase para Magic Links em produção;
- preencher o SHA-256 real em `public/.well-known/assetlinks.json` antes da Play Store;
- concluir os formulários aplicáveis da Play Console;
- gerar e commitar `package-lock.json` depois do primeiro `npm install` neste ZIP.

Desenvolvido por **BigCorps** · Tecnologia **minhAi**.
