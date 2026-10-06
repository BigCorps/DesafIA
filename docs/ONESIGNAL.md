# Notificações opcionais do DesafIA

Esta branch prepara código; não aplica SQL, não publica Edge Function, não muda
secrets/cron/Vercel e não envia push. **Mantenha `DESAFIA_PUSH_ENABLED=false` até
ativação explícita após revisão e testes em aparelhos reais.** Main e staging
não são alteradas por esta implementação.

## Configuração e isolamento

App ID público: `8c98389d-9805-467a-977a-7ea66a153d01`.

| Ambiente | Variável | Uso |
| --- | --- | --- |
| Frontend | `VITE_ONESIGNAL_APP_ID` | App ID público; fallback para o ID acima |
| Edge | `DESAFIA_ONESIGNAL_APP_ID` | App ID deste produto |
| Edge | `DESAFIA_ONESIGNAL_REST_API_KEY` | Credencial privada de envio |
| Edge | `DESAFIA_PUSH_ENABLED` | Envio somente se o valor for exatamente `true` |

Os secrets já são gerenciados fora deste repositório. A REST API Key nunca deve
ir para GitHub, Vercel ou frontend. Não se reutilizam secrets de outros produtos.
O runtime Edge também usa `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`; ambos
permanecem no backend. Não é necessário alterar autenticação Google, Android,
billing, pareamento ou configurar outro projeto Supabase.

## SDK v16 e dois service workers

`src/shared/notifications.js` carrega uma única instância de
`https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js`. O carregamento só
ocorre após interação explícita ou para restaurar/retirar consentimento já
registrado neste navegador. Inicialização: `requiresUserPrivacyConsent: true`,
`autoResubscribe: false`, todos os prompts automáticos e notify button desligados.
As APIs públicas `setConsentRequired(true)` e `setConsentGiven(false)` suspendem
a inicialização antes de qualquer consentimento, inclusive na integração
"typical", que pode ignorar opções JS. Uma checagem somente de leitura da
configuração efetiva exposta pelo v16 bloqueia ativação se o painel reabilitar
autoprompt/autoResubscribe/bell ou alterar o worker/scope. Se esse contrato
de configuração mudar, o comportamento é fail-closed. Restauração de consentimento
anterior só libera a inicialização após essa checagem, sem pedir permissão.
Somente `activate()` com consentimento, feature disponível e interação explícita
chama `Notifications.requestPermission()`, `login(externalId)` e
`User.PushSubscription.optIn()`. Negação/erro não é apresentado como push ativo.

Worker separado: `/onesignal/OneSignalSDKWorker.js`, com escopo `/onesignal/` e
`serviceWorkerOverrideForTypical: true`. Importa o worker oficial v16. Essa opção
preserva o caminho customizado mesmo em apps OneSignal configurados pelo painel.
O worker PWA `/sw.js`, seu cache, seu escopo `/` e atualização permanecem intactos.
O PushManager da inscrição usa a registration do worker OneSignal; ele não precisa
controlar a navegação normal do jogo para receber eventos push.

APIs e override conferidos no código oficial do SDK, revisão
[`0cf9a12982f7a8788b1c080292052f36131641c0`](https://github.com/OneSignal/OneSignal-Website-SDK/tree/0cf9a12982f7a8788b1c080292052f36131641c0),
especialmente `src/onesignal/OneSignal.ts`, `NotificationsNamespace.ts`,
`PushSubscriptionNamespace.ts` e `src/shared/config/app.test.ts`.
Referências: [Web SDK](https://documentation.onesignal.com/docs/web-sdk-reference),
[worker](https://documentation.onesignal.com/docs/onesignal-service-worker),
[Create notification](https://documentation.onesignal.com/reference/create-notification).

### CSP e origem

A revisão permite somente estas origens adicionais em `vercel.json`:

- `script-src`: `https://cdn.onesignal.com`, para SDK/shim e importScripts do worker;
- `connect-src`: `https://onesignal.com` e `https://api.onesignal.com`, para os endpoints oficiais do SDK v16.

O worker local continua com `worker-src 'self'` e escopo `/onesignal/`. A regra
CSP geral também é aplicada à resposta do worker e permite seu importScripts.
Não são necessários frame-src externo ou proxy iframe nesta integração HTTPS
same-origin. Não foram adicionados wildcard, `https:` irrestrito ou unsafe-eval.
Todas as demais diretivas, headers e política de deployment main/staging foram
preservadas. O teste JS verifica a CSP e é executado por `npm run check`.

No painel OneSignal, usar configuração Custom Code ou garantir que prompts
automáticos, bell e auto-resubscribe estejam desligados. A integração não os
contorna; configurações efetivas incompatíveis bloqueiam a ativação.
O app Web Push também precisa aceitar a origem HTTPS de teste nas configurações
OneSignal. URLs Vercel Preview e produção têm origens e inscrições distintas.
Sem CSP/origem compatíveis, push falha silenciosamente e o app segue funcionando.
Nesta branch somente a CSP versionada foi ajustada; não se modifica configuração remota OneSignal/Vercel.

## Consentimento e identidades

**Responsável:** Config. → Notificações → ativa aviso de missão e/ou resumo por
interação explícita e salva as preferências independentemente da inscrição
neste browser. Um botão separado “Ativar notificações neste aparelho” pede
permissão somente após clique. A RPC autenticada obtém/cria um UUID aleatório próprio,
distinto do `auth.users.id`; o browser pede permissão e sincroniza sua inscrição. A identidade é estável por responsável; preferências são por
responsável/família. Em um navegador novo, as checkboxes continuam refletindo as preferências backend;
o estado de inscrição local aparece separadamente. Erros ao salvar não retiram
inscrições saudáveis nem apagam preferências confirmadas. Logout faz optOut/logout e remove o
marcador de consentimento local. O opt-out também tenta remover a inscrição
push nativa exclusivamente da registration `/onesignal/`, caso CSP/fornecedor
impeça o SDK; nunca remove a registration PWA `/`. A saída do Supabase não
aguarda a rede OneSignal.

**Criança:** o responsável permite lembretes para um device específico, na família
da qual é membro. A RPC valida vínculo, grava consentidor/data e só então cria ou
ativa identidade opaca por `desafia.devices.id`. O device continua autenticado
pelo segredo local existente; somente seu hash existe no banco. O segredo nunca
é enviado ao OneSignal. Ao abrir o jogo pareado, a RPC device-safe retorna UUID
apenas com consentimento válido. O CTA discreto pede ativação no próprio aparelho;
não existe prompt automático no boot. Clique explícito revalida consentimento e
disponibilidade, pede permissão e sincroniza inscrição. Modo local/demo/QA não
registra push cloud nem cria identidades, preferências ou outbox.

Ao desabilitar, o backend deixa de considerar o alvo elegível. Na próxima
abertura/poll do device, optOut/logout remove consentimento local. Revogação ou
mudança do jogador vinculado ao device invalida consentimento e identidade via
trigger, sem modificar funções existentes de pareamento. Remoção do responsável
da família também invalida sua autorização. Um envio já aceito pelo fornecedor
antes da retirada não pode ser recolhido: consentimento é rechecado imediatamente
antes do HTTP, mas existe uma janela inevitável entre banco e fornecedor.

Identidades/tags/conteúdos não incluem nome da criança, idade, escola, email,
nome da família ou token. São enviados somente UUIDs opacos, conteúdo genérico,
contagem de pendências, destino e parâmetros técnicos de entrega. Nenhuma tag é
criada. Uma inscrição do navegador usa uma identidade atual por vez. Alternar entre
portal dos pais e perfil infantil no mesmo navegador pode exigir nova ativação;
para validar ambos simultaneamente, use aparelhos/perfis de navegador separados.
O fornecedor/browser ainda pode processar metadados de conexão e push
subscriptions. Preferências e rótulos dos aparelhos ficam no Supabase/UI, não no
payload do OneSignal.

## Banco, fila e limites

Migration nova: `20261006000100_desafia_notifications.sql`, posterior às quatro
migrations existentes. Cria somente objetos no schema `desafia`:

- `notification_identities`, `notification_parent_preferences`,
  `notification_device_preferences`;
- `notification_outbox` e `notification_delivery_events`.

RLS habilitada e acesso direto negado a `public`, `anon` e `authenticated`;
somente service role acessa tabelas. Browser usa RPC security definer com
search_path fixo, auth/device token e grants explícitos por assinatura.

RPCs browser: `my_notification_identity`, `parent_notification_settings`,
`parent_set_notification_preferences`, `parent_set_device_notifications`,
`parent_notification_subscription`, `device_notification_state`,
`device_notification_subscription`. As cinco primeiras são autenticadas; as duas
últimas são anon com validação do segredo local. Helpers/processor são exclusivos
do service role: `notification_in_quiet`, `notification_prepare`,
`notification_claim`, `notification_validate_claim`, `notification_complete` e
trigger `notification_device_changed`.

`mark_mission_done` mantém assinatura, ACL, validações, recompensas e comportamento
anteriores; acrescenta enqueue transacional somente no insert pending ou update
rejected → pending. Retry/tap em pending ou done não gera evento. Uma nova execução
legítima após rejeição tem UUID de transição próprio. Nenhuma migration histórica
é editada. Nenhum HTTP parte do PostgreSQL.

Eventos de aprovação aguardam dois minutos para agrupar missões próximas por
família/responsável. Claim conta pendências atuais, reserva um único item por
identidade e ignora irmãos já em processamento. Após sucesso, eventos anteriores
do grupo viram skipped/aggregated. Cooldown dos pais: 30 minutos; teto de quatro
entregas/reservas por responsável em 24h, compartilhado entre famílias e tipos.

Lembrete infantil: somente missão ativa child sem log (todo) ou rejected no dia
local. Pending aguardando adulto e done não são execução pendente. Um por
device/dia por padrão; dois somente com a segunda opção explícita. Cooldown: 90
minutos. Resumo: um por responsável/família/dia, somente com missão e/ou recompensa
pendente; não há push imediato de recompensa. Horários padrão: criança 18:00 /
19:30, resumo 19:00, silêncio 20:00 → 08:00. Times iguais silenciam todo o dia.

Datas/horários usam `families.timezone`, inclusive virada de dia e horário de verão.
Slots são criados até 45 minutos após o horário local; um scheduler atrasado além
dessa janela não envia lembretes antigos. Dedupe unique sobre todos os statuses
impede regenerar uma entrega já sent/failed/skipped. Limites são conservadores:
reservas de falhas ambíguas continuam contando para impedir rajadas.

Claim atômico com `FOR UPDATE SKIP LOCKED`, locks de identidade, lease de dez
minutos e claim token. RPC de conclusão só aceita claim atual. Recuperação/retry
reutiliza o mesmo outbox UUID como `idempotency_key` da API OneSignal, além do
controle no banco. Até cinco tentativas; backoff exponencial de 30 a 240 minutos
para timeout/HTTP 429/5xx. Falhas definitivas viram failed; falta de elegibilidade
vira skipped. Timeout HTTP é 15 segundos. Idempotência do fornecedor não é garantia
indefinida; não reabrir manualmente items sent ou recriar UUIDs para retry.

## Edge Function e scheduler futuro

Código: `supabase/functions/desafia-notifications/index.ts` + `delivery.js`.
Endpoint futuro:
`https://<PROJECT_REF>.supabase.co/functions/v1/desafia-notifications`.

- POST `{"action":"status"}`: capability pública, sem credenciais/identidades;
  `configured` indica app ID/key presentes; `delivery_enabled` exige também flag
  exata true. Com configured=true e delivery_enabled=false, consentimento,
  preferências, permission prompt por clique e inscrições continuam disponíveis.
- POST `{"action":"process"}`: exige `Authorization: Bearer <service role>`;
  segredo apenas no scheduler confiável. Não chamar esse endpoint do frontend.
- Flag ausente/false/outro valor: retorna `push_disabled`, não acessa fornecedor
  nem marca qualquer entrega como sent. Key/app ID ausentes: fail-closed.

Preparar execução externa a cada **15 minutos**; não existe cron nesta branch.
Uma implantação futura precisará `--no-verify-jwt` para a capability pública com
publishable keys modernas. A autorização do processamento é verificada dentro da
função; a operação continua protegida por service role mesmo sem o JWT gateway.
Não alterar auth global do Supabase compartilhado. Use um scheduler confiável com
credencial protegida, sem expor service role em código client ou logs. Criar rotina
de retenção dos registros técnicos será uma decisão operacional separada.

## Validação e troubleshooting

```sh
npm install
npm run check
node --test scripts/notifications.test.mjs scripts/qa-state.test.mjs
npm run build
git diff --check
# Somente se Deno já estiver instalado:
deno check supabase/functions/desafia-notifications/index.ts
```

Teste SQL opcional em PostgreSQL/WASM local, sem dados ou conexão remota. A
dependência de teste não entra no app/package-lock:

```sh
npm install --prefix /tmp/desafia-push-tools --no-audit --no-fund @electric-sql/pglite@0.5.8
DESAFIA_TEST_PGLITE_ROOT=/tmp/desafia-push-tools/node_modules/@electric-sql/pglite \
  node --test scripts/notifications-sql.test.mjs
```

O harness simula somente `auth.uid/jwt` e roles locais para carregar todas as
migrations reais e testar isolamento/RLS/ACL, identidades, consentimento,
revogação/repareamento, missão/recompensas existentes, grouping, claim/retry,
quiet hours, timezone e limites. Não substitui testes de concorrência com sessões
PostgreSQL independentes nem `deno check`/execução Edge real.

Antes da ativação, revisar e testar em ambiente de teste próprio: Chrome Android,
TWA, desktop e Safari/PWA instalada. Web Push depende de HTTPS, suporte do browser,
permissão do sistema e configuração OneSignal. iOS normalmente exige PWA instalada
na tela inicial; browsers podem exigir um novo clique após carregar SDK/rede para
preservar a ativação do usuário. Negação não será repetida automaticamente.

Se a seção disser indisponível: Edge ainda não implantada, config
ausente, RPC não instalada ou rede bloqueada. Se permissão não ativar: verificar
CSP no console, origem OneSignal, instalação/suporte do browser e permissões do
sistema. Status infantil autorizado significa consentimento parental, não push
ativo: ainda é necessário tocar no CTA do device. Se não houver entrega: verificar
pendências atuais, timezone, quiet hours, cooldown/daily limit, attempts/status e
configuração do scheduler, sem imprimir credenciais ou respostas cruas do vendor.

## Sequência externa após revisão

1. Revisar diff e PR para staging; não há merge nesta tarefa.
2. Revisar a CSP adicionada, conferir a origem no OneSignal e validar frontend no
   Preview de staging, mantendo envio desligado.
3. Revisar SQL, segurança e teste de concorrência em banco isolado; validar Edge
   com Deno/runtime Supabase. Só depois aplicar migration e publicar função mediante
   autorização, mantendo `DESAFIA_PUSH_ENABLED=false`.
4. Validar permissões/opt-out e inscrições em aparelhos de teste, configurar
   scheduler protegido e decidir retenção. Qualquer envio real/ativação exige
   autorização separada. A branch, sozinha, não torna backend ou push prontos para
   produção.

## Frequência de consultas frontend

Capability `action=status`: cache em memória por cliente Supabase de cinco minutos,
inclusive respostas negativas, com deduplicação de chamadas concorrentes. A UI usa
`configured`, nunca `delivery_enabled`, como disponibilidade para configuração.
A Edge continua retornando push_disabled sem preparar/processar fila ou chamar
fornecedor quando `DESAFIA_PUSH_ENABLED` não for exatamente true.

Estado infantil: consulta no início cloud e depois no máximo a cada três minutos;
os snapshots de oito segundos continuam passando pelo throttle sem RPC adicional.
Ao voltar a visible, permite rechecagem somente após pelo menos um minuto desde a
última consulta. Clique no CTA sempre revalida consentimento. Inscrição é sincronizada
somente se o estado observado divergir de `push_active`. Revogação bloqueia envios
no backend imediatamente; optOut local ocorre na próxima checagem razoável.
