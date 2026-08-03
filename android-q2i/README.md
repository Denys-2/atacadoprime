# Prime Q2I — APK ponte de impressão

App Android mínimo: abre o POS em WebView (tela cheia) e expõe `window.PrimePrinter`
ligado ao serviço AIDL interno da maquininha (`com.iposprinter.iposprinterservice`).

## Como gerar o APK (3 opções)

### Opção A — Android Studio (recomendada, grátis)
1. Instale o Android Studio (https://developer.android.com/studio).
2. `File → Open` e selecione a pasta `android-q2i`.
3. Aguarde o Gradle sincronizar (baixa dependências sozinho).
4. `Build → Build Bundle(s)/APK(s) → Build APK(s)`.
5. O arquivo sai em `app/build/outputs/apk/debug/app-debug.apk`.
6. Copie para a Q2I (USB, Google Drive ou WhatsApp Web) e instale
   (permita "Fontes desconhecidas").

### Opção B — Linha de comando
```bash
cd android-q2i
./gradlew assembleDebug
# APK em app/build/outputs/apk/debug/app-debug.apk
```

### Opção C — GitHub Actions (sem instalar nada)
Se o projeto estiver no GitHub, o workflow em `.github/workflows/android.yml`
compila o APK a cada push e disponibiliza para download em "Actions → Artifacts".

## Configuração
A URL aberta pelo app está em `app/src/main/java/app/prime/q2i/MainActivity.kt`
na constante `POS_URL`. Padrão: `https://primeautomotive.app/pos/vender`.

## Como funciona
- `PrinterBridge` tenta vincular, em ordem: `com.iposprinter.iposprinterservice`,
  `woyou.aidlservice.jiuiv5` (Sunmi) e `com.telpo.tps550.api`.
- Vinculando qualquer um, `window.PrimePrinter.isReady()` retorna `true` e o
  botão Imprimir do POS envia o cupom direto para a bobina, sem RawBT e sem diálogo.
- Se nenhum vincular, o app mostra qual serviço falhou (útil para diagnóstico).
