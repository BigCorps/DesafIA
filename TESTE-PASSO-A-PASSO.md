# DesafIA 0.3 — passo a passo para instalar e testar

Este guia considera a arquitetura da BigCorps: **o DesafIA usa o mesmo projeto Supabase da minhAi**, mas todo o backend do jogo fica isolado no schema `desafia`.

> **Não execute a migration antiga `20260928000000_desafia_init.sql`.** A versão correta deste ZIP é `supabase/migrations/20260929000100_desafia_schema.sql`.

---

## Visão geral

Você vai fazer quatro coisas:

1. instalar o schema `desafia` no Supabase da minhAi;
2. adicionar esse schema à Data API, sem mudar o Auth global;
3. testar localmente em dois navegadores/aparelhos;
4. importar o repositório na Vercel e testar no domínio final.

### O que NÃO precisa fazer

- não criar outro projeto Supabase;
- não habilitar **Anonymous Sign-In**;
- não alterar o `Site URL` global da minhAi;
- não criar tabelas no `public`;
- não configurar Realtime para o aparelho infantil;
- não colocar `service_role` no Vercel/frontend.

---

# PARTE A — instalar no Supabase da minhAi

## 1. Abra o projeto correto

No Supabase, selecione o projeto **minhAi** — o mesmo usado pelos outros apps BigCorps.

O DesafIA foi preparado para coexistir com os schemas/produtos existentes.

## 2. Execute a migration

Abra **SQL Editor → New query**.

Copie o conteúdo inteiro de:

`supabase/migrations/20260929000100_desafia_schema.sql`

Execute uma única vez.

A migration usa uma transação (`begin`/`commit`) e cria somente objetos `desafia.*`.

Ela não contém:

- `REVOKE` global no `public`;
- loop sobre funções do `public`;
- alteração de tabelas PixWiki/minhAi/FuncionarIA/ConviteIA/MelhorIA;
- publicação em `supabase_realtime`.

## 3. Adicione `desafia` aos Exposed schemas

No Dashboard do Supabase, abra a configuração da **Data API / Exposed schemas**.

Mantenha tudo que já existe e **adicione**:

`desafia`

Não remova nenhum schema existente.

A migration já faz os `GRANT` do DesafIA de forma restrita. O schema precisa estar exposto apenas para o PostgREST enxergar as RPCs.

### Importante

Mesmo exposto, o browser não tem privilégio direto nas tabelas. O acesso é pelas funções liberadas explicitamente.

## 4. NÃO habilite Anonymous Sign-In

Nesta versão, **deixe o Anonymous Sign-In como está**.

O aparelho infantil não cria usuário em `auth.users`.

O fluxo é:

```text
Pai gera código temporário
        ↓
Jogo cria segredo aleatório de 256 bits no aparelho
        ↓
Criança informa o código
        ↓
RPC pair_device valida o código
        ↓
Banco salva somente SHA-256(segredo)
        ↓
Próximas RPCs exigem o segredo do aparelho
```

Se o responsável desconectar o aparelho pelo portal, aquele segredo deixa de funcionar.

## 5. Configure os Redirect URLs do portal

Como o Supabase é compartilhado, **não troque o Site URL global** para `desafia.app`.

Em **Authentication → URL Configuration → Redirect URLs**, apenas adicione:

- `http://localhost:5173/pais/`
- `https://desafia.app/pais/`
- `https://www.desafia.app/pais/` apenas se realmente usar `www`
- a URL de Preview da Vercel, caso queira testar Magic Link em preview

O código do portal informa `emailRedirectTo` explicitamente como `/pais/` do domínio atual.

## 6. Rode a verificação somente leitura

Depois da migration, execute:

`supabase/VERIFICACAO-APOS-INSTALAR.sql`

Confira principalmente:

- todas as tabelas aparecem em `desafia`;
- `rowsecurity = true` em todas;
- a consulta de privilégios de tabela para `anon/authenticated` retorna **zero linhas**;
- as RPCs aparecem com grants separados por papel;
- `supabase_realtime` não contém tabelas `desafia`.

---

# PARTE B — preparar o projeto local

## 7. Use Node 22.12 ou superior

Confira:

```bash
node -v
```

## 8. Instale as dependências

Na raiz do ZIP:

```bash
npm install
```

O `package.json` fixa as versões utilizadas. O primeiro `npm install` gerará/atualizará `package-lock.json`; faça commit dele ao subir a versão final no GitHub.

## 9. Crie `.env.local`

Copie:

```bash
cp .env.example .env.local
```

Preencha com o **mesmo Supabase da minhAi**:

```env
VITE_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Se o projeto ainda não usar publishable key moderna, também é aceito:

```env
VITE_SUPABASE_ANON_KEY=eyJ...
```

Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` no frontend.

## 10. Rode as checagens

```bash
npm run check
npm run build
```

Depois:

```bash
npm run dev
```

Abra:

- jogo: `http://localhost:5173/`
- portal: `http://localhost:5173/pais/`

---

# PARTE C — teste rápido sem banco

## 11. Teste o modo local primeiro

Abra `/` e escolha **Experimentar sem conectar**.

Valide:

- onboarding de nome/cor;
- abas Missões / Casa / Prêmios / Família / Visual;
- Pipo reage ao toque;
- período dia/tarde/noite muda ao tocar no sol/lua;
- “Fiz!” deixa uma missão pendente;
- **Área dos adultos** pede a continha;
- no modo adulto local você consegue aprovar/rejeitar;
- todas as seis missões aprovadas entregam ao total:
  - `120 ⭐` pelas missões;
  - `63 XP` pelas missões;
  - `+25 ⭐ / +15 XP` pelo dia completo;
  - total esperado no primeiro dia: **145 ⭐ e 78 XP**;
- o bônus de dia completo só acontece uma vez;
- pedir prêmio desconta estrelas;
- negar o prêmio devolve as estrelas.

---

# PARTE D — teste conectado pai + criança

## 12. Entre no portal dos pais

Abra `/pais/`.

Informe seu e-mail e abra o Magic Link recebido.

Na primeira entrada, crie a família.

## 13. Adicione uma criança

Aba **Família → Adicionar criança**.

No plano grátis, uma criança é permitida.

## 14. Gere o código de conexão

Na criança, clique em **Conectar aparelho**.

O portal gera um código de 8 caracteres, válido por 30 minutos e uso único.

## 15. Conecte o jogo

Em outro navegador, perfil, janela anônima ou outro aparelho:

1. abra `/`;
2. digite o código;
3. toque em **Conectar com minha família**;
4. personalize nome/cor do Pipo.

O aparelho passa a guardar um segredo aleatório em `localStorage`. O servidor conhece apenas o hash.

## 16. Teste uma missão

Na criança:

1. toque em **Fiz!**;
2. a missão deve mostrar **Esperando adulto**.

No portal:

1. a pendência aparece em **Hoje**;
2. clique em **Aprovar**.

O jogo consulta o backend automaticamente a cada poucos segundos e também quando volta ao foco.

Depois da aprovação:

- estrelas aumentam;
- XP aumenta;
- a barra de nível avança;
- Pipo reage;
- a missão fica concluída.

## 17. Teste “Tentar de novo”

Envie outra missão e clique em **Tentar de novo** no portal.

No jogo, ela volta a permitir `Fiz!` e não concede pontos.

## 18. Teste o dia completo

Aprove todas as missões infantis do dia.

Na última aprovação:

- o banco insere `daily_completions` uma única vez;
- soma `+25 ⭐ / +15 XP`;
- aparece a comemoração **Dia completo!** no jogo;
- a sequência diária passa a considerar esse dia.

Aprovar novamente a mesma missão não pode duplicar o bônus.

## 19. Teste prêmios

Quando houver saldo:

1. no jogo, escolha um prêmio e clique **Trocar**;
2. o saldo é reservado imediatamente;
3. no portal, abra **Hoje**;
4. marque **Entregue** ou **Agora não**.

Se escolher **Agora não**, as estrelas devem voltar.

## 20. Teste desconectar aparelho

No portal:

**Família → aparelho conectado → Desconectar**.

Em no máximo um ciclo de atualização, o jogo deixa de receber snapshot e volta para a tela de conexão.

O responsável pode gerar um novo código e conectar novamente. O aparelho passa a usar um novo vínculo válido.

---

# PARTE E — testar o Plus

## 21. Ative manualmente só para o teste

Use o arquivo:

`supabase/ATIVAR-PLUS-TESTE.sql`

Primeiro consulte a família pelo seu e-mail; depois rode manualmente o `UPDATE` comentado com o UUID correto.

Com Plus, teste:

- segunda criança;
- missões personalizadas;
- prêmios personalizados;
- desafios;
- criação/entrada em ligas.

Depois você pode voltar a família para `free` pelo mesmo arquivo.

---

# PARTE F — Vercel

## 22. Suba este ZIP final ao GitHub

Substitua o conteúdo do repositório `BigCorps/DesafIA` pelo conteúdo deste ZIP e faça commit/push.

Não envie `.env.local`.

## 23. Importe na Vercel

Crie um projeto Vercel separado apontando para `BigCorps/DesafIA`.

O repositório já informa:

- Framework: Vite;
- Build: `npm run build`;
- Output: `dist`.

## 24. Variáveis da Vercel

Cadastre em Production e Preview:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Use os valores do Supabase da minhAi.

## 25. Domínio

Adicione:

`desafia.app`

Se usar `www.desafia.app`, redirecione para o domínio principal ou inclua também nos redirects do Supabase.

Depois confirme novamente o passo 5 dos Redirect URLs.

---

# PARTE G — PWA / Play Store depois do teste web

## 26. Teste como PWA

No Android/Chrome, abra `https://desafia.app` e instale/adicone à tela inicial.

Valide:

- abertura em standalone;
- ícone correto;
- modo local abre mesmo sem rede depois da primeira visita;
- portal dos pais continua exigindo rede.

## 27. Só depois faça a TWA

Leia `android/README.md`.

Antes de enviar à Play Store:

1. obtenha o SHA-256 da chave **Play App Signing**;
2. substitua o placeholder em `public/.well-known/assetlinks.json`;
3. faça novo deploy;
4. confirme que `https://desafia.app/.well-known/assetlinks.json` está acessível;
5. gere o `.aab` pelo PWABuilder/Bubblewrap.

---

# Checklist final do primeiro teste

- [ ] migration nova executou sem erro;
- [ ] schema `desafia` foi adicionado aos Exposed schemas;
- [ ] Anonymous Sign-In permaneceu inalterado/desnecessário;
- [ ] Site URL global do Supabase não foi trocado;
- [ ] Redirect `/pais/` foi adicionado;
- [ ] consulta de privilégios de tabela retorna zero linhas para `anon/authenticated`;
- [ ] `npm run check` passou;
- [ ] `npm run build` passou;
- [ ] modo local funciona;
- [ ] Magic Link funciona;
- [ ] família e criança foram criadas;
- [ ] código conecta o aparelho;
- [ ] missão pendente aparece no portal;
- [ ] aprovação atualiza o jogo;
- [ ] bônus diário não duplica;
- [ ] prêmio negado devolve saldo;
- [ ] desconectar aparelho invalida o acesso;
- [ ] Vercel Production funciona no domínio;
- [ ] contatos da política/termos foram preenchidos antes do lançamento público.

Se algum passo falhar, anote **qual passo**, a mensagem exibida e, se for SQL, a linha/erro do Supabase. Isso permite corrigir sem precisar mexer nos demais produtos da minhAi.
