# Desafia

**Pequenos desafios, grandes hábitos.**

Jogo infantil de rotina: a criança cuida de um bichinho virtual (o Pipo) que cresce quando ela cumpre missões do dia a dia. Os adultos aprovam as missões, combinam prêmios reais e criam desafios pelo portal dos pais.

- **Jogo da criança** (`/`): PWA que vira app Android (TWA) para a Play Store. Grátis, sem anúncios, sem compras dentro do app.
- **Portal dos pais** (`/pais/`): site onde os adultos entram por e-mail, aprovam missões, conectam aparelhos e assinam o Plus.
- **Backend**: Supabase (banco Postgres, login, tempo real). Hospedagem: Vercel.

---

## Sumário

1. [O que tem neste repositório](#1-o-que-tem-neste-repositório)
2. [Rodar no computador](#2-rodar-no-computador)
3. [Configurar o Supabase](#3-configurar-o-supabase)
4. [Publicar na Vercel](#4-publicar-na-vercel)
5. [Testar de ponta a ponta](#5-testar-de-ponta-a-ponta)
6. [Plano grátis e Plus](#6-plano-grátis-e-plus)
7. [Publicar na Play Store](#7-publicar-na-play-store)
8. [Ícones e artes](#8-ícones-e-artes)
9. [Como o sistema funciona](#9-como-o-sistema-funciona)
10. [Checklist antes de lançar](#10-checklist-antes-de-lançar)
11. [Problemas comuns](#11-problemas-comuns)

---

## 1. O que tem neste repositório

```
index.html                  Jogo da criança
pais/index.html             Portal dos pais
privacidade/, termos/       Páginas legais (modelos para revisar com advogado)
src/
  game/                     Lógica do jogo (modo local e modo conectado)
  pais/                     Lógica do portal
  shared/pet.js             O personagem em SVG (usado no jogo, portal e ícones)
  lib/supabase.js           Cliente do Supabase e mensagens de erro em português
public/
  manifest.webmanifest      Manifesto do app (nome, cores, ícones)
  sw.js                     Service worker (abre sem internet)
  icons/                    Ícones do app em todos os tamanhos
  fonts/                    Fontes hospedadas no próprio app (licença OFL)
  .well-known/assetlinks.json  Ligação do site com o app Android
supabase/migrations/        Banco completo: tabelas, segurança e funções
brand/                      Ícone da Play Store, arte de destaque e gerador
android/README.md           Como gerar o app Android
.github/workflows/          Build automático do site e do Android
vercel.json                 Configuração da Vercel
```

Tecnologia: Vite + JavaScript puro + `@supabase/supabase-js`. Não precisa de framework.

---

## 2. Rodar no computador

Precisa do [Node.js 20 ou mais novo](https://nodejs.org).

```bash
npm install
npm run dev
```

Abra `http://localhost:5173`. **Sem configurar o Supabase o jogo já funciona em modo local**: os dados ficam só no navegador e os adultos aprovam no próprio aparelho (botão “Área dos adultos”, que pede uma continha de multiplicação).

Para ligar o modo conectado, crie o arquivo `.env.local` a partir do exemplo:

```bash
cp .env.example .env.local
```

e preencha com os dados do Supabase (próxima seção). Depois rode `npm run dev` de novo.

- Jogo: `http://localhost:5173/`
- Portal dos pais: `http://localhost:5173/pais/`

---

## 3. Configurar o Supabase

### 3.1 Criar o projeto

1. Entre em [supabase.com](https://supabase.com) → **New project**.
2. Nome: `desafia`. Região: **South America (São Paulo)**, para ficar perto dos usuários.
3. Guarde a senha do banco num lugar seguro (não vai para o código).

### 3.2 Criar o banco

Opção A, a mais simples (pelo navegador):

1. No projeto, abra **SQL Editor** → **New query**.
2. Copie todo o conteúdo de `supabase/migrations/20260928000000_desafia_init.sql`, cole e clique em **Run**.
3. Deve aparecer “Success. No rows returned”.

Opção B, pela linha de comando:

```bash
npx supabase login
npx supabase init            # só se ainda não existir supabase/config.toml
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

> O `SEU_PROJECT_REF` é o código do projeto, que aparece no endereço `https://SEU_PROJECT_REF.supabase.co`.

O script cria tudo: tabelas, regras de segurança (RLS), funções, missões e prêmios padrão de cada família nova e o tempo real.

### 3.3 Ativar o login anônimo (obrigatório para o jogo)

O aparelho da criança **não usa e-mail**. Ele entra de forma anônima e é ligado à família por um código que os pais geram.

**Authentication → Sign In / Providers → Allow anonymous sign-ins → ativar → Save.**

> Recomendado: em **Authentication → Attack Protection**, ative o CAPTCHA (Cloudflare Turnstile) e mantenha limites de criação de contas, para evitar abuso de logins anônimos. Se ativar o CAPTCHA, será preciso passar o token no `signInAnonymously` (ver documentação do Supabase).

### 3.4 Login dos pais por e-mail

1. **Authentication → Sign In / Providers → Email**: deixe ativado. A confirmação de e-mail pode ficar ligada.
2. **Authentication → URL Configuration**:
   - **Site URL**: `https://desafia.app`
   - **Redirect URLs** (adicione todas):
     - `https://desafia.app/pais/`
     - `http://localhost:5173/pais/`
     - `https://*-SEU-TIME.vercel.app/pais/` (para testar nas prévias da Vercel; troque pelo seu time)
3. Opcional, mas recomendado: **Authentication → Emails → SMTP Settings**. O e-mail padrão do Supabase tem limite baixo de envios por hora. Para produção, use um SMTP próprio (Resend, Amazon SES, Brevo etc.) com remetente `nao-responda@desafia.app`.
4. Opcional: em **Authentication → Emails → Templates → Magic Link**, traduza o texto para português. Exemplo:

   ```html
   <h2>Entrar no Desafia</h2>
   <p>Toque no botão para entrar no portal dos pais:</p>
   <p><a href="{{ .ConfirmationURL }}">Entrar</a></p>
   <p>Se não foi você, ignore este e-mail.</p>
   ```

### 3.5 Pegar as chaves

**Project Settings → API Keys** (em projetos antigos: **Settings → API**):

| Variável | Onde pegar |
|---|---|
| `VITE_SUPABASE_URL` | Project URL, algo como `https://abcd1234.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Chave **publishable** (`sb_publishable_...`) ou a antiga **anon public** |

> **Nunca use a chave `service_role` / `secret` no site.** Ela ignora toda a segurança. Ela só serve no servidor (por exemplo, no webhook de pagamento).

### 3.6 Conferir o tempo real

O script já adiciona `mission_logs`, `reward_requests` e `players` à publicação do Realtime. Para conferir: **Database → Publications → supabase_realtime**. É isso que faz o jogo mostrar a estrela voando assim que o adulto aprova no portal.

---

## 4. Publicar na Vercel

### 4.1 Subir o repositório

```bash
git init
git add .
git commit -m "Desafia: primeira versão"
git branch -M main
git remote add origin https://github.com/BigCorps/desafia.git
git push -u origin main
```

### 4.2 Importar

1. Em [vercel.com/new](https://vercel.com/new), escolha o repositório `desafia`.
2. **Framework Preset**: Vite (já detectado; o `vercel.json` também define).
3. Build Command `npm run build`, Output Directory `dist` (já definidos).
4. Em **Environment Variables**, cadastre para **Production, Preview e Development**:

   | Nome | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | URL do projeto Supabase |
   | `VITE_SUPABASE_ANON_KEY` | Chave publishable/anon |
   | `VITE_CHECKOUT_URL` | (opcional) link de pagamento do Plus |

5. **Deploy**.

> As variáveis `VITE_` entram no código na hora do build. Se mudar alguma, faça **Redeploy**.

### 4.3 Domínio desafia.app

1. **Project → Settings → Domains → Add** → `desafia.app` (e `www.desafia.app` redirecionando para ele).
2. Se comprou o domínio na própria Vercel, o DNS já fica certo. Se comprou fora, siga os registros que a Vercel mostrar (A `76.76.21.21` para o domínio raiz e CNAME `cname.vercel-dns.com` para o `www`, ou troque os nameservers para os da Vercel).
3. Domínios `.app` exigem HTTPS; a Vercel cria o certificado sozinha.
4. Volte ao Supabase e confira se o **Site URL** e as **Redirect URLs** usam o domínio final.

### 4.4 O que o `vercel.json` já faz

- Serve `/.well-known/assetlinks.json` como JSON (necessário para o app Android abrir sem barra de endereço).
- Não guarda cache do `sw.js` (atualizações chegam rápido).
- Cache longo para os arquivos com hash em `/assets/`.
- Cabeçalhos de segurança (sem câmera, microfone ou localização; bloqueio de iframe).

---

## 5. Testar de ponta a ponta

1. Abra `https://desafia.app/pais/` no seu celular ou computador, informe seu e-mail e toque no link recebido.
2. **Criar minha família**: nome da família, como as crianças chamam você e um avatar.
3. Aba **Família** → adicione uma criança (só o apelido).
4. Toque em **Conectar aparelho**. Aparece um código de 8 letras válido por 30 minutos.
5. Em outro aparelho (ou aba anônima), abra `https://desafia.app/`, digite o código e toque em **Conectar**. O bichinho comemora.
6. No jogo, toque em **Fiz!** numa missão. Ela fica “Esperando um adulto”.
7. No portal, aba **Hoje**, toque em **Aprovar**. No jogo, a estrela voa até o contador.
8. Com estrelas suficientes, peça um prêmio no jogo. No portal, marque **Entregue** (a criança vê a comemoração) ou **Agora não** (as estrelas voltam).
9. Para testar o Plus, veja a seção abaixo e confira as abas **Desafios** e **Liga**.

---

## 6. Plano grátis e Plus

| Recurso | Grátis | Plus |
|---|---|---|
| Jogo completo, bichinho, visual, níveis | ✓ | ✓ |
| Crianças | 1 | até 10 |
| Missões e prêmios padrão (ligar, desligar, mudar estrelas) | ✓ | ✓ |
| Adultos jogando e convite para outro responsável | ✓ | ✓ |
| Missões e prêmios personalizados | | ✓ |
| Desafios com prêmio especial | | ✓ |
| Liga entre famílias | | ✓ |

As regras ficam **no banco**, não só na tela. Mesmo que alguém mexa no site, o Supabase recusa.

### Ativar o Plus manualmente (para testes ou para os primeiros clientes)

No **SQL Editor** do Supabase:

```sql
-- descobrir o id da família pelo e-mail do responsável
select f.id, f.name, f.plan
from families f
join family_members m on m.family_id = f.id
join auth.users u on u.id = m.user_id
where u.email = 'cliente@email.com';

-- ativar por 1 mês
update families
set plan = 'plus', plan_expires_at = now() + interval '1 month'
where id = 'COLE-O-ID-AQUI';

-- voltar para o grátis
update families set plan = 'free', plan_expires_at = null where id = 'COLE-O-ID-AQUI';
```

Com `plan_expires_at` vazio o Plus não vence. Quando vence, a família volta ao grátis sozinha e não perde nada: missões e desafios já criados continuam lá.

### Cobrança automática (próximo passo)

1. Crie o produto de assinatura no seu processador (Mercado Pago, Stripe, Asaas, Hotmart…).
2. Cadastre o link de pagamento em `VITE_CHECKOUT_URL`. O botão **Assinar o Plus** abre esse link com `?family=ID&email=...`, para você saber de quem é o pagamento.
3. Crie uma Edge Function no Supabase que recebe o webhook do processador, confere a assinatura do webhook e roda, com a chave `service_role` (guardada como secret da função, nunca no site):

   ```sql
   update families set plan = 'plus', plan_expires_at = <fim do período pago> where id = <family>;
   ```

### Regra importante da Play Store

O app infantil **não pode vender nem apontar para compra**. Por isso:

- o jogo não mostra selos de Plus, preços nem links de pagamento;
- a assinatura acontece só no portal dos pais, no navegador;
- dentro do jogo, a “Área dos adultos” fica atrás de uma pergunta de multiplicação (parental gate) e não tem link para o portal.

Mantenha assim ao evoluir o app.

---

## 7. Publicar na Play Store

O app Android é uma **TWA (Trusted Web Activity)**: um app nativo leve que abre `https://desafia.app` em tela cheia usando o Chrome do aparelho. Atualizou o site, atualizou o app, sem nova versão na loja (só precisa de nova versão se mudar ícone, nome ou pacote).

Passo a passo detalhado e valores de configuração em [`android/README.md`](android/README.md). Resumo:

1. Com o site no ar, gere o pacote no [PWABuilder](https://www.pwabuilder.com) (mais fácil, sem instalar nada) ou com o [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap).
2. Pacote (package name): `app.desafia`.
3. Crie o app no Play Console e envie o `.aab`.
4. Em **Play Console → Proteger e testar → Integridade do app → Assinatura de apps**, copie a **impressão digital SHA-256 da chave de assinatura do app** (a do Google, não só a sua de upload).
5. Cole em `public/.well-known/assetlinks.json` no lugar de `TROQUE:PELO:...`, faça commit e deploy. Pode colocar as duas chaves (a do Google e a de upload) na lista.
6. Confira em `https://desafia.app/.well-known/assetlinks.json` e no [verificador do Google](https://developers.google.com/digital-asset-links/tools/generator). Se estiver errado, o app abre com uma barra de endereço no topo.

### Checklist do app infantil (Programa Famílias)

- **Público-alvo e conteúdo**: faixa etária das crianças (ex.: 5 a 8 e 9 a 12) e, se quiser, também adultos, já que os pais usam.
- **Anúncios**: “Não, o app não contém anúncios”.
- **Segurança dos dados** (Data safety), sugestão de respostas:
  - Dados coletados: e-mail (dos adultos, no portal), identificadores do app (ID anônimo do aparelho), atividade no app (missões, estrelas).
  - Finalidade: funcionalidade do app. Nada é compartilhado com terceiros para publicidade.
  - Dados criptografados em trânsito: sim. Usuário pode pedir exclusão: sim (no portal).
- **Política de privacidade**: `https://desafia.app/privacidade/` (preencha os campos entre colchetes antes).
- **Classificação indicativa**: responda o questionário (sem violência, sem interação entre usuários, sem compras).
- **Parental gate**: já existe na “Área dos adultos”.
- **Capturas de tela**: tire no celular com o app instalado (Missões, Visual, Placar e a comemoração do nível). Mínimo de 2, ideal 4 a 8, formato retrato.
- **Ícone** `brand/play-icone-512.png` e **arte de destaque** `brand/play-arte-destaque-1024x500.png`.

---

## 8. Ícones e artes

Tudo é gerado a partir do personagem por um script:

```bash
pip install cairosvg
npm run icons        # o mesmo que: python3 brand/gerar_icones.py
```

| Arquivo | Uso |
|---|---|
| `public/icons/icon-*.png` | Ícones do PWA (cantos arredondados) |
| `public/icons/maskable-*.png` | Ícone adaptável do Android (com área segura) |
| `public/icons/monochrome-512.png` | Ícone temático do Android 13+ |
| `public/icons/apple-touch-icon.png` | Atalho no iPhone |
| `public/favicon.svg` | Aba do navegador |
| `brand/play-icone-512.png` | Ícone da ficha da Play Store |
| `brand/play-arte-destaque-1024x500.png` | Arte de destaque da Play Store |
| `brand/*.svg` | Originais editáveis (Figma, Illustrator, Inkscape) |

Para a arte de destaque sair com a fonte certa, instale `public/fonts/Grandstander.ttf` no sistema antes de rodar o script.

---

## 9. Como o sistema funciona

### Contas

- **Adultos** entram com e-mail (link mágico, sem senha) e ficam em `family_members`.
- **Crianças** não têm conta. O aparelho entra de forma anônima e o código de 8 letras liga esse login anônimo a uma criança (`devices`). Os pais podem desconectar o aparelho quando quiserem.
- O jogo e o portal guardam a sessão em chaves diferentes (`desafia-kid-auth` e `desafia-pais-auth`), então um adulto pode abrir o portal no aparelho da criança sem desconectar o jogo.

### Estrelas

Cada missão aprovada soma pontos em dois contadores do jogador:

- `xp`: faz o bichinho crescer (a cada 100 estrelas sobe um nível; os estágios mudam até o nível 4 e alguns chapéus liberam nos níveis 2 e 3);
- `wallet`: estrelas para trocar por prêmios.

Pedir um prêmio já desconta as estrelas; se o adulto recusar, elas voltam. Ninguém altera `xp`, `wallet` ou `plan` direto: só as funções do banco, que conferem as permissões.

### Segurança (RLS)

Toda tabela tem Row Level Security. Cada família só enxerga os próprios dados; o aparelho da criança só enxerga a própria criança e as missões da família; na liga, as outras famílias aparecem só com apelido e pontos. Todas as funções exigem login e o papel `anon` não executa nenhuma.

### Principais funções do banco

| Função | Quem chama | O que faz |
|---|---|---|
| `create_family` | adulto | Cria família, responsável, jogador adulto e conteúdo padrão |
| `create_child` | adulto | Adiciona criança (1 no grátis) |
| `create_pairing_code` | adulto | Gera código de 8 letras por 30 min |
| `pair_device` / `unpair_device` | aparelho | Conecta e desconecta |
| `kid_snapshot` | aparelho | Tudo que o jogo mostra, numa chamada |
| `mark_mission_done` | aparelho | Missão fica pendente |
| `decide_mission` | adulto | Aprova (soma estrelas) ou pede para tentar de novo |
| `parent_mark_done` | adulto | Marca direto (missões dos adultos ou criança sem aparelho) |
| `request_reward` / `decide_reward` | aparelho / adulto | Pedido e entrega de prêmio |
| `parent_dashboard` | adulto | Tudo que o portal mostra, numa chamada |
| `create_parent_invite` / `accept_parent_invite` | adulto | Segundo responsável |
| `create_league` / `join_league` / `league_scores` | adulto | Liga entre famílias (Plus) |

### Dia e semana

O “dia” segue o fuso da família (`America/Sao_Paulo` por padrão). As missões reiniciam à meia-noite e o placar zera toda segunda-feira.

### Sem internet

O service worker guarda o jogo. Um aparelho conectado mostra o último estado salvo e tenta reconectar sozinho a cada 15 segundos.

---

## 10. Checklist antes de lançar

- [ ] Migração rodada no Supabase de produção
- [ ] Login anônimo ativado
- [ ] Site URL e Redirect URLs com `https://desafia.app`
- [ ] SMTP próprio configurado (limite do e-mail padrão é baixo)
- [ ] Variáveis na Vercel e domínio `desafia.app` ativo com HTTPS
- [ ] Teste completo da seção 5 feito em dois aparelhos
- [ ] Campos `[...]` preenchidos em `/privacidade/` e `/termos/` e revisados por advogado
- [ ] `assetlinks.json` com o SHA-256 do Play App Signing
- [ ] Formulários de Famílias, Segurança dos dados e classificação na Play Console
- [ ] Capturas de tela tiradas no celular
- [ ] Marca registrada: pesquisar “Desafia” no INPI (classes 9, 41 e 42) e o `.com.br` no Registro.br

---

## 11. Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Jogo só funciona “sem conectar” | Variáveis `VITE_` não configuradas, ou faltou Redeploy |
| “Ative o login anônimo no Supabase” | Seção 3.3 |
| Link do e-mail abre a página inicial em vez do portal | Falta `https://desafia.app/pais/` nas Redirect URLs |
| Link do e-mail diz que expirou | Abriu em outro aparelho/navegador, ou link já usado. Peça outro |
| “Código inválido ou vencido” | O código dura 30 min e só serve uma vez. Gere outro no portal |
| Aprovação não aparece na hora no jogo | Confira a publicação do Realtime (3.6). O jogo também atualiza a cada 45 s e ao voltar para o app |
| App Android com barra de endereço | `assetlinks.json` com SHA-256 errado ou sem deploy |
| E-mails não chegam | Limite do SMTP padrão do Supabase; configure SMTP próprio |

---

Feito com carinho pela BigCorps.
