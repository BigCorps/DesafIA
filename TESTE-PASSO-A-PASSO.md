# DesafIA 0.5.0 — passo a passo de publicação e teste

Este guia usa a arquitetura definida para a BigCorps: **projeto Vercel separado para o DesafIA e o mesmo Supabase da minhAi, isolado no schema `desafia`.**

> Se a migration base `20260929000100_desafia_schema.sql` já foi aplicada, **não aplique novamente**. Para a 0.5.0 execute somente `20260930000100_desafia_billing.sql`.

---

## 1. Supabase — confirmar a base

No projeto Supabase da **minhAi**, confira:

- schema `desafia` existente;
- **Data API → Exposed schemas** contém `desafia`;
- provider **Google** continua ativo em Authentication;
- Redirect URLs contém `https://desafia.vercel.app/pais/` durante os testes;
- não é necessário habilitar Anonymous Sign-In.

Para uma instalação nova, execute somente:

`supabase/migrations/20260929000100_desafia_schema.sql`

Depois você pode rodar a consulta somente leitura:

`supabase/VERIFICACAO-APOS-INSTALAR.sql`

### Atualização 0.5 — Billing

Se a base já existe, execute **somente**:

`supabase/migrations/20260930000100_desafia_billing.sql`

Depois confira com:

`supabase/VERIFICACAO-BILLING.sql`

A migration antiga não faz parte deste ZIP final.

---

## 2. Supabase Edge Function — cobrança Plus

A cobrança roda no Supabase, não no Vercel. O frontend nunca recebe credenciais do Banco Inter.

Deploy da função:

```bash
supabase functions deploy desafia-billing --project-ref qyonozbroekuqlotqcbm
```

O projeto compartilhado já usa `BANCO_INTER_API_KEY` nos outros produtos. Confirme que esse secret continua disponível para Edge Functions.

Defina também o preço do Plus em centavos:

```bash
supabase secrets set DESAFIA_PLUS_MONTHLY_CENTS=VALOR_EM_CENTAVOS --project-ref qyonozbroekuqlotqcbm
```

**Não há preço inventado no código.** Defina o valor comercial escolhido antes do teste real de cobrança.

A Edge Function usa a empresa recebedora BigCorps já existente e a mesma infraestrutura Inter dos outros produtos.

---

## 3. Vercel — variáveis corretas

No projeto Vercel **desafia → Settings → Environment Variables**, confirme:

```env
VITE_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_CHAVE_REAL_COMPLETA
```

Use a chave publishable real inteira. `sb_publishable_...` é apenas exemplo e agora o app detecta esse placeholder como configuração inválida.

Marque pelo menos **Production** e **Preview**. Depois de alterar uma variável, faça **Redeploy**, pois Vite incorpora `VITE_*` no build.

---

## 4. Teste local de integridade

Com Node 22.12+:

```bash
npm install
npm run check
npm run build
npm run dev
```

Abra:

- `http://localhost:5173/`
- `http://localhost:5173/pais/`

---

## 5. Teste infantil sem banco

Em `/`, escolha **Experimentar sem conectar** e valide:

1. onboarding de nome e cor;
2. sugestões **Pipo / Lumi / Nino / Zupi** e nome livre;
3. toque no personagem várias vezes, aguardando o pequeno cooldown;
4. confirme reações diferentes: pulo, riso, balanço, giro, piscar/amassar ou dança;
5. quando ele fala, os cards da esquerda saem e voltam após o balão;
6. recolha o painel por **Ver só o <nome>**;
7. feche/reabra a página e confirme que o painel mantém a preferência;
8. abra o painel novamente e teste Missões / Casa / Prêmios / Família / Visual;
9. toque em **Pais** e valide o gate adulto;
10. depois da continha, confirme que o jogo navega para `/pais/` mesmo estando em modo local/demo;
11. expanda o painel, role a lista até o fim e confirme que a alça continua acessível e o conteúdo consegue voltar normalmente.

### Economia esperada no primeiro dia local

Com as seis missões padrão aprovadas:

- missões: `120 ⭐` e `63 XP`;
- bônus do dia: `+25 ⭐` e `+15 XP`;
- total: **145 ⭐ e 78 XP**.

O bônus não pode ser duplicado.

---

## 6. Teste Google do responsável

Em produção, abra:

`https://desafia.vercel.app/pais/`

1. toque em **Continuar com Google**;
2. escolha a conta;
3. confirme retorno para `/pais/`;
4. na primeira entrada, deve aparecer **somente** o campo de nome da família;
5. crie a família e confirme que o dashboard abre imediatamente no topo;
6. saia e entre novamente com Google e confirme que o dashboard abre direto, sem tela de criação;
7. confirme que login/setup/dashboard nunca aparecem empilhados;
8. use o botão **Jogo** do topo e confirme que volta para `/` na mesma janela/PWA;
9. volte ao portal pelo botão **Pais** dentro do jogo.

O login Google não depende do SMTP de Magic Link.

---

## 7. Teste pai + criança conectados

No portal:

1. crie/adicione a criança;
2. clique em **Conectar aparelho**;
3. copie o código temporário.

Em outro navegador/perfil/aparelho:

1. abra `/`;
2. informe o código;
3. conecte;
4. escolha nome/cor;
5. confirme que o snapshot daquela criança aparece.

---

## 8. Fluxo de missão

Na criança:

1. toque **Fiz!**;
2. deve aparecer **Esperando adulto**.

No portal:

1. a pendência aparece em **Hoje**;
2. aprove.

No jogo, após o polling/foco:

- estrelas sobem;
- XP sobe;
- missão vira concluída;
- personagem reage.

Depois repita com **Tentar de novo** e confirme que não entrega pontos.

---

## 9. Prêmios e revogação

Com saldo suficiente:

1. criança solicita prêmio;
2. portal marca **Entregue** ou **Agora não**;
3. se negar, estrelas retornam.

Depois, em **Família**, desconecte o aparelho. Em até um ciclo de sincronização, o jogo deve voltar para a tela de pareamento.

---

## 10. Teste do DesafIA Plus via PIX

Antes deste teste, defina `DESAFIA_PLUS_MONTHLY_CENTS`, aplique a migration de billing e faça deploy de `desafia-billing`.

No navegador Web/PWA normal:

1. entre em `/pais/` com Google;
2. abra **Config. → Plano**;
3. confirme que aparece o valor configurado;
4. toque em **Ativar DesafIA Plus**;
5. confirme QR Code, PIX Copia e Cola e valor correto;
6. copie o PIX e pague pelo banco;
7. mantenha o modal aberto ou toque em **Já paguei · verificar agora**;
8. o portal deve mostrar **Plus liberado!**;
9. o topo deve mudar para **Plus ✦**;
10. confirme em Família que agora é possível adicionar a segunda criança;
11. teste criação de missão personalizada, prêmio personalizado, desafio e liga.

### Renovação

Com o Plus ativo, gere outro PIX. Após pagar, `plan_expires_at` deve ganhar mais 30 dias **a partir do vencimento atual**, sem perder dias restantes.

### Idempotência

Atualize a página e verifique novamente a mesma cobrança paga. O período não pode ser acrescentado duas vezes.

---

## 11. Teste do modo Google Play (sem APK ainda)

Abra no navegador:

`https://desafia.vercel.app/?store=play`

Depois entre no Portal dos Pais. Em **Config. → Plano**:

- não deve existir botão de PIX;
- não deve existir link externo de compra;
- deve aparecer a mensagem de que contratação/renovação é feita fora do aplicativo;
- se a família já tiver Plus, o status Plus continua aparecendo normalmente.

Para voltar ao comportamento Web/PWA durante QA, abra `https://desafia.vercel.app/?store=web` uma vez (ou limpe os dados do site).

Na TWA definitiva, o Bubblewrap usará `/?store=play` como Start URL.

---

## 12. Teste da PWA

No Chrome/Android:

1. instale o DesafIA ou adicione à tela inicial;
2. abra instalado e confira que não há conteúdo escondido pelo notch/barra de gesto;
3. use o modo **Ver só o personagem**;
4. entre em **Pais** pelo jogo;
5. use **Jogo** no portal para voltar;
6. feche/reabra e confirme que o pareamento e preferência do painel permanecem.

O manifest também oferece atalhos de sistema para **Jogar** e **Área dos pais** em plataformas que suportam shortcuts.

---

## 13. Teste de atualização da PWA

Este teste exige duas versões publicadas em sequência.

1. abra/instale a versão atual;
2. publique uma versão em que `CACHE` de `public/sw.js` tenha sido incrementado;
3. volte ao app ou reabra;
4. deve aparecer **Nova versão pronta**;
5. toque em **Atualizar**;
6. a página deve recarregar apenas uma vez com a versão nova;
7. o console não deve mostrar `Response body is already used`.

O novo service worker clona a `Response` imediatamente antes do cache, eliminando a corrida da versão anterior.

---

## 14. Teste offline

Depois de abrir o jogo online pelo menos uma vez:

1. desligue a conexão;
2. recarregue o jogo;
3. o shell e assets já preparados devem abrir;
4. recursos que dependem do Supabase naturalmente não sincronizam até a conexão voltar;
5. ao reconectar/focar, o modo conectado volta a consultar o backend.

Não considere o portal dos pais um recurso offline: aprovações e administração dependem do Supabase.

---

## 15. Checklist antes de considerar aprovado

- [ ] Google entra e retorna para `/pais/`.
- [ ] Primeiro acesso pede só o nome da família e abre o dashboard.
- [ ] Acessos seguintes abrem o dashboard direto.
- [ ] Login, criação e dashboard nunca aparecem juntos.
- [ ] Família é criada/carregada.
- [ ] Código conecta a criança.
- [ ] Missão pendente chega ao portal.
- [ ] Aprovar soma estrelas/XP uma única vez.
- [ ] Negar missão não soma pontos.
- [ ] Prêmio reserva e devolve saldo corretamente quando negado.
- [ ] Revogar aparelho invalida o vínculo.
- [ ] Modo imersivo abre/fecha e persiste, com personagem centralizado.
- [ ] Ao rolar o painel até o fim, a alça continua acessível e o touch não fica preso.
- [ ] Cards não cobrem o balão de fala.
- [ ] Reações do personagem não empilham.
- [ ] Pai ↔ jogo navega dentro da PWA.
- [ ] Sem erro `Response body is already used` no console.
- [ ] Atualização da PWA apresenta o aviso e recarrega uma vez.
- [ ] Web/PWA gera PIX Plus pelo Inter com o valor configurado.
- [ ] Pagamento confirmado libera Plus por 30 dias uma única vez.
- [ ] Renovação antecipada preserva dias restantes.
- [ ] `?store=play` oculta checkout e links de compra no portal.
- [ ] Plus adquirido fora do app é reconhecido no modo Play.
- [ ] `npm run check` e `npm run build` passam.

Quando todos estiverem marcados, a versão web está pronta para seguir para o teste da TWA/Play Store.
