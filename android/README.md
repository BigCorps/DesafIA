# Android / TWA — DesafIA

O app Android deve ser uma **Trusted Web Activity (TWA)** apontando para o domínio definitivo do DesafIA.

Durante os testes web use `https://desafia.vercel.app/`. Para a Play Store, defina primeiro o domínio definitivo e só então gere o projeto Bubblewrap.


## Play Console x domínio definitivo

Você pode **criar o app no Play Console agora**, reservar/confirmar o package name, preencher ficha da loja, público-alvo, Segurança dos dados, acesso ao app e política de privacidade mesmo enquanto `desafia.vercel.app` continua sendo o ambiente de teste.

Para o **AAB que irá para produção**, prefira esperar o domínio definitivo. A TWA associa o app ao host através de Digital Asset Links; mudar de `desafia.vercel.app` para outro domínio depois exige atualizar o host do projeto Android, publicar `assetlinks.json` no novo domínio e enviar uma nova versão do AAB.

Como a data atual já é posterior a 31/08/2026, novos apps enviados ao Google Play para celular devem usar **targetSdkVersion 36 (Android 16) ou superior**. Configure o projeto Bubblewrap/Gradle dessa forma desde o primeiro AAB.

Portanto, a ordem recomendada é: criar a entrada do app no Play Console agora → terminar ficha/políticas → registrar o domínio definitivo → gerar Bubblewrap definitivo → configurar Digital Asset Links → enviar AAB para teste interno/produção.

## Estratégia de pagamento na primeira publicação

O app da Google Play será **consumption-only**: ele reconhece o Plus comprado no Web/PWA, mas não mostra checkout PIX nem link externo de compra dentro da versão distribuída pela Play.

Para marcar a instalação como distribuição Play, configure o `startUrl` do Bubblewrap como:

```text
https://SEU-DOMINIO/?store=play
```

O frontend persiste esse marcador e, no Portal dos Pais, troca o card de cobrança por uma mensagem informativa. Um PWA instalado diretamente pelo navegador continua com checkout PIX normal.

Mais detalhes: `PLUS-E-PLAY.md`.

## Antes de gerar

1. publique e teste a versão web;
2. defina o domínio definitivo;
3. confirme o `manifest.webmanifest`;
4. gere o projeto `android/twa` com Bubblewrap usando `/?store=play` como Start URL;
5. gere/obtenha o certificado de assinatura Android;
6. coloque o SHA-256 correto em `public/.well-known/assetlinks.json`;
7. faça deploy novamente;
8. confirme `/.well-known/assetlinks.json` publicamente;
9. teste Jogo → Pais → Google → retorno ao `/pais/`;
10. confira que o app Play reconhece Plus existente, mas não mostra o botão PIX.

## Configuração conceitual

- Start URL: `/?store=play`
- Scope: `/`
- Display: `standalone`
- Orientação: `portrait`
- Cor principal: `#7658F5`
- Área dos pais: `/pais/`

O `assetlinks.json` precisa corresponder exatamente ao package name e ao certificado usados na versão assinada.

## Google OAuth

Ao sair da origem do DesafIA para a tela do Google, o Android pode mostrar UI do navegador/Custom Tab temporariamente. Após autenticar, o redirect permitido do Supabase deve retornar para `<domínio>/pais/` e a sessão é recuperada pelo `supabase-js`.

## Depois do Bubblewrap

O repositório já possui workflow de GitHub Actions preparado para compilar o projeto Android em `android/twa` e gerar o AAB. Bubblewrap cria o projeto uma vez; o Actions passa a fazer os builds seguintes.
