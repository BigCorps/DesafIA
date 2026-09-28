# App Android (TWA)

O app da Play Store é uma **Trusted Web Activity**: abre `https://desafia.app` em tela cheia. Gere o pacote **depois** que o site estiver no ar com o domínio final, porque as ferramentas leem o `manifest.webmanifest` publicado.

## Valores para usar

| Campo | Valor |
|---|---|
| Domínio (host) | `desafia.app` |
| URL inicial | `/?origem=app` |
| Nome do app | `Desafia` |
| Nome curto (launcher) | `Desafia` |
| Package ID | `app.desafia` |
| Cor do tema / barra de status | `#7B61FF` |
| Cor da barra de navegação | `#7B61FF` |
| Cor de fundo da abertura (splash) | `#7B61FF` |
| Ícone | `https://desafia.app/icons/icon-512.png` |
| Ícone adaptável (maskable) | `https://desafia.app/icons/maskable-512.png` |
| Ícone monocromático | `https://desafia.app/icons/monochrome-512.png` |
| Orientação | Retrato (portrait) |
| Modo de exibição | Standalone |
| Notificações | Desligado |
| Localização | Desligado |
| Alias da chave | `desafia` |
| Versão inicial | versionCode `1`, versionName `1.0.0` |

## Opção A: PWABuilder (sem instalar nada)

1. Abra [pwabuilder.com](https://www.pwabuilder.com) e informe `https://desafia.app`.
2. **Package for stores → Android → Generate Package**.
3. Em **Options**, preencha com a tabela acima.
4. Em **Signing key**, escolha **Create new** (ou **Use mine**, se já tiver uma chave). Guarde o arquivo `.keystore` e as senhas fora do repositório (gerenciador de senhas). Sem essa chave de upload você não consegue mandar novas versões (a não ser pedindo troca ao Google).
5. Baixe o zip. Dentro dele estão o `.aab` (para a Play Store), um `.apk` (para testar no celular) e um `assetlinks.json` de exemplo.

## Opção B: Bubblewrap (linha de comando)

Precisa do Node.js. Na primeira vez ele baixa sozinho o JDK e o Android SDK.

```bash
npm i -g @bubblewrap/cli
mkdir -p android/twa && cd android/twa
bubblewrap init --manifest https://desafia.app/manifest.webmanifest
# responda com os valores da tabela; crie a chave com alias "desafia"
bubblewrap build
```

Gera `app-release-bundle.aab` e `app-release-signed.apk`. Pode fazer commit da pasta `android/twa` (o `.gitignore` já impede subir a chave), assim o GitHub Actions consegue gerar novas versões.

## Ligar o site ao app (assetlinks)

1. Envie o `.aab` para o Play Console (teste interno serve).
2. **Proteger e testar → Integridade do app → Assinatura de apps**: copie a impressão digital **SHA-256** da *chave de assinatura do app* (e, se quiser, também a da *chave de upload*).
3. Cole em `public/.well-known/assetlinks.json`:

   ```json
   "sha256_cert_fingerprints": [
     "AA:BB:CC:...:SHA256_DA_CHAVE_DO_GOOGLE",
     "11:22:33:...:SHA256_DA_SUA_CHAVE_DE_UPLOAD"
   ]
   ```

4. Commit e deploy. Confira em `https://desafia.app/.well-known/assetlinks.json`.
5. Desinstale e instale de novo pelo teste interno: o app deve abrir sem barra de endereço.

## Novas versões

- Mudou só o site: não precisa de nova versão na loja.
- Mudou ícone, nome, cores ou pacote: aumente o `appVersionCode` no `twa-manifest.json` (`bubblewrap update` e `bubblewrap build`) ou gere de novo no PWABuilder com a mesma chave.

## Build pelo GitHub Actions (opcional)

O workflow `.github/workflows/android.yml` gera o `.aab` assinado a partir de `android/twa` quando você clica em **Actions → Android (TWA) → Run workflow**.

Cadastre em **Settings → Secrets and variables → Actions**:

| Secret | Conteúdo |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | a chave em base64: `base64 -w0 android.keystore` (no Mac: `base64 -i android.keystore`) |
| `ANDROID_KEYSTORE_PASSWORD` | senha do keystore |
| `ANDROID_KEY_ALIAS` | `desafia` |
| `ANDROID_KEY_PASSWORD` | senha da chave |
