# Android / TWA — DesafIA

O app Android deve ser uma **Trusted Web Activity (TWA)** apontando para o domínio de produção do DesafIA.

Durante os testes web você pode usar `https://desafia.vercel.app/`. Para a Play Store, prefira definir primeiro o domínio definitivo e gerar o pacote Android já com ele, evitando uma atualização só para trocar de host.

## Antes de gerar

1. publique a versão final na Vercel;
2. confirme o `manifest.webmanifest` no domínio escolhido;
3. gere/obtenha o certificado de assinatura Android;
4. coloque o SHA-256 correto em `public/.well-known/assetlinks.json`;
5. faça deploy novamente;
6. confirme `/.well-known/assetlinks.json` publicamente;
7. teste Jogo → Pais → Google → retorno ao `/pais/` em aparelho real.

## Configuração conceitual

- Start URL: `/`
- Scope: `/`
- Display: `standalone`
- Orientação: `portrait`
- Cor principal: `#7658F5`
- Área dos pais: `/pais/`

Você pode usar PWABuilder ou Bubblewrap para gerar a TWA. O `assetlinks.json` precisa corresponder exatamente ao package name e ao certificado usados na versão assinada.

## Observação sobre Google OAuth

Ao sair da origem do DesafIA para a tela do Google, o Android pode mostrar UI do navegador/Custom Tab temporariamente. O importante é que, após autenticar, o redirect permitido do Supabase retorne para `<domínio>/pais/` e a sessão seja recuperada pelo `supabase-js`.
