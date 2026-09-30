# Changelog

## 0.4.1 — correções de teste mobile/pais

- Área dos pais passa a abrir o portal real mesmo quando o jogo está em modo local/demo;
- modo imersivo reposiciona o personagem para o centro visual e eleva o terreno junto com ele;
- transformações das animações foram adaptadas para manter a centralização também durante pulo, dança e outras reações;
- jogo mobile passa a manter a viewport fixa: somente o conteúdo do painel rola, deixando a alça sempre acessível;
- painel inferior reseta a rolagem ao abrir/fechar para evitar estados presos após rolagens longas;
- corrigido o bug em que login, criação de família e dashboard apareciam empilhados: `hidden` agora sempre prevalece;
- retorno do Google OAuth limpa a URL e abre a visão correta no topo;
- primeiro acesso pede somente o nome da família e usa o primeiro nome da conta Google para o responsável;
- depois de criar a família, o dashboard abre imediatamente; acessos seguintes entram direto nele;
- portal dos pais agora usa o ícone oficial do DesafIA.app no header e nas telas iniciais;
- assinatura do login padronizada para `DesafIA.app | Desenvolvido por BigCorps | Tecnologia minhAi`;
- cache PWA incrementado para garantir atualização desta correção.

## 0.4.0 — Etapa 4/4 · candidata final

- service worker refeito para eliminar a corrida que podia causar `Response body is already used`;
- cache da PWA agora usa versão própria e pré-carrega também os assets gerados pelo Vite encontrados nas páginas principais;
- atualizações do app passam a aparecer em um aviso **Nova versão pronta → Atualizar**, sem recarregar a criança no meio de uma ação;
- ao confirmar a atualização, o novo service worker assume e a página recarrega uma única vez;
- safe areas revisadas para aparelhos com notch/recorte e PWA em tela cheia;
- portal dos pais passou a registrar o mesmo service worker e recebeu link explícito **Jogo** para voltar dentro da PWA;
- o botão **Abrir jogo** do portal agora navega na mesma janela, em vez de abrir uma aba externa;
- manifest ganhou atalhos de sistema para **Jogar** e **Área dos pais**;
- detecção de configuração do Supabase agora rejeita placeholders como `sb_publishable_...`, evitando um falso estado de configuração válida;
- migration antiga e perigosa removida do pacote final; permanece somente a migration isolada em `desafia.*`;
- documentação de instalação/teste consolidada para Google OAuth, Vercel e schema compartilhado.

## 0.3.3 — Etapa 3/4

- personagem ganhou sete reações ao toque: pulo, risada, balanço, giro, piscada/amassadinha, dança e cumprimento;
- reação é escolhida aleatoriamente sem repetir imediatamente a anterior;
- cooldown curto evita spam de animações, mas mantém microfeedback para toques extras;
- vibração leve é usada quando suportada e desativada junto com movimento reduzido;
- onboarding oferece Pipo, Lumi, Nino e Zupi como sugestões, além de nome livre;
- tela Visual também permite trocar rapidamente entre os nomes sugeridos;
- nome escolhido atualiza alça do modo imersivo, ARIA do personagem, título da página, mensagens e celebração;
- textos fixos foram generalizados para não amarrar o produto ao nome Pipo.

## 0.3.2 — Etapa 2/4

- painel inferior infantil agora pode ser recolhido e expandido por uma alça grande;
- modo imersivo **Ver só o personagem** ocupa praticamente toda a tela com o mundo dele;
- no modo imersivo, HUD, meta familiar, estrelas e atalho dos pais saem da frente;
- preferência de painel aberto/fechado fica salva no aparelho;
- tocar na meta familiar reabre o painel automaticamente já na aba Família.

## 0.3.1 — Etapa 1/4

- login dos responsáveis trocado de Magic Link para Google OAuth;
- reutiliza o Google já configurado no Supabase compartilhado da minhAi;
- botão rápido **Pais** dentro da tela do jogo;
- acesso ao portal dos pais funciona dentro da própria PWA/app após o gate adulto;
- cards de nome/XP e meta familiar saem lateralmente enquanto o personagem fala e retornam ao fim do balão;
- mantido o modo adulto local para demonstração offline.

## 0.3.0 — base arquitetural

- DesafIA movido para schema isolado `desafia` no Supabase compartilhado da minhAi;
- removida a necessidade de Supabase Anonymous Auth no aparelho infantil;
- adicionado segredo local de aparelho com armazenamento apenas de SHA-256 no servidor;
- removido Realtime público do jogo; atualização conectada usa polling leve e foco/visibilidade;
- tabelas sem privilégios diretos para `anon`/`authenticated`; acesso via RPCs explícitas;
- XP separado de estrelas e curva de progressão mais longa;
- casa do personagem, meta familiar, sequência e bônus de dia completo;
- portal dos pais reorganizado por pendências, família, rotina, prêmios, desafios e liga.
