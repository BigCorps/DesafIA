# DesafIA Android (TWA)

O app Android deve ser uma **Trusted Web Activity** apontando para `https://desafia.app/`.

## Antes de gerar o AAB

1. publique a versão web na Vercel;
2. confirme `https://desafia.app/manifest.webmanifest`;
3. confirme os ícones em `/icons/`;
4. obtenha o SHA-256 da chave **Play App Signing** na Play Console;
5. substitua o placeholder em `public/.well-known/assetlinks.json`;
6. faça novo deploy e confirme `https://desafia.app/.well-known/assetlinks.json`.

## Configuração sugerida

- Application ID / package: `app.desafia`
- Start URL: `https://desafia.app/`
- Display mode: standalone/TWA
- Orientation: portrait
- Theme color: `#7658F5`
- Background: `#7658F5`

## Gerar

A forma mais simples é importar `https://desafia.app` no PWABuilder e gerar o pacote Android. Também é possível usar Bubblewrap.

O jogo infantil não contém checkout, preço ou link comercial. O portal dos pais fica no navegador e pode ser acessado separadamente pelo responsável.

## Quando uma nova versão Android é necessária

Mudanças normais do jogo chegam pela web. Gere novo AAB quando mudar algo nativo, por exemplo:

- package name;
- ícone/splash do pacote;
- permissões Android;
- configurações TWA;
- assinatura/asset links;
- requisitos da Play Store que exijam novo bundle.
