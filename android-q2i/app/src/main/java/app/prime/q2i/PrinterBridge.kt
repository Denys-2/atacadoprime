package app.prime.q2i

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import android.util.Log
import android.webkit.JavascriptInterface
import com.iposprinter.iposprinterservice.IPosPrinterCallback
import com.iposprinter.iposprinterservice.IPosPrinterService
import woyou.aidlservice.jiuiv5.ICallback
import woyou.aidlservice.jiuiv5.IWoyouService

private const val TAG = "PrimePrinter"

/** Ações AIDL conhecidas de impressoras embutidas. */
private val KNOWN_ACTIONS = listOf(
    "com.iposprinter.iposprinterservice.IPosPrintService",
    "com.iposprinter.iposprinterservice.IPosPrinterService",
    "woyou.aidlservice.jiuiv5.IWoyouService",
    "com.sunmi.printerservice.IWoyouService",
)

/**
 * Ponte entre o POS web (window.PrimePrinter) e o serviço de impressão interno.
 * Descobre os serviços disponíveis via PackageManager e tenta vincular a todos.
 */
class PrinterBridge(private val context: Context) {

    private var iposService: IPosPrinterService? = null
    private var sunmiService: IWoyouService? = null
    private val log = mutableListOf<String>()
    private val connections = mutableListOf<ServiceConnection>()
    private var lastResult = "aguardando"

    private val iposCallback = object : IPosPrinterCallback.Stub() {
        override fun onRunResult(isSuccess: Boolean) {
            lastResult = if (isSuccess) "comando confirmado" else "comando recusado"
            note("callback ipos: $lastResult")
        }
        override fun onReturnString(result: String?) {
            lastResult = result ?: "retorno vazio"
            note("retorno ipos: $lastResult")
        }
    }

    private val sunmiCallback = object : ICallback.Stub() {
        override fun onRunResult(isSuccess: Boolean) = Unit
        override fun onReturnString(result: String?) = Unit
        override fun onRaiseException(code: Int, msg: String?) = Unit
        override fun onPrintResult(code: Int, msg: String?) = Unit
    }

    private fun note(msg: String) {
        Log.i(TAG, msg)
        synchronized(log) {
            log.add(msg)
            if (log.size > 40) log.removeAt(0)
        }
    }

    private fun connectionFor(action: String, label: String) = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            if (binder == null) {
                note("BIND vazio: $label")
                return
            }
            if (action.startsWith("woyou") || action.startsWith("com.sunmi")) {
                sunmiService = runCatching { IWoyouService.Stub.asInterface(binder) }.getOrNull()
                note("CONECTADO sunmi: $label")
            } else {
                iposService = runCatching { IPosPrinterService.Stub.asInterface(binder) }.getOrNull()
                runCatching { iposService?.printerInit(iposCallback) }
                note("CONECTADO ipos: $label")
            }
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            note("DESCONECTADO: $label")
        }
    }

    fun bind() {
        val pm = context.packageManager
        var found = 0

        val officialIntent = Intent("com.iposprinter.iposprinterservice.IPosPrintService").apply {
            setPackage("com.iposprinter.iposprinterservice")
        }
        val officialConnection = connectionFor(
            "com.iposprinter.iposprinterservice.IPosPrintService",
            "SDK Q1/Q2 oficial",
        )
        val officialBound = runCatching {
            context.bindService(officialIntent, officialConnection, Context.BIND_AUTO_CREATE)
        }.getOrDefault(false)
        if (officialBound) {
            connections.add(officialConnection)
            found++
            note("bindService OK: SDK Q1/Q2 oficial")
        } else {
            note("bindService FALHOU: SDK Q1/Q2 oficial")
        }

        for (action in KNOWN_ACTIONS) {
            val matches = runCatching { pm.queryIntentServices(Intent(action), 0) }.getOrDefault(emptyList())
            if (matches.isEmpty()) {
                note("sem serviço para $action")
                continue
            }
            for (info in matches) {
                val pkg = info.serviceInfo.packageName
                val cls = info.serviceInfo.name
                found++
                val label = "$action -> $pkg/$cls"
                val intent = Intent(action).apply { component = ComponentName(pkg, cls) }
                val conn = connectionFor(action, label)
                val ok = runCatching {
                    context.bindService(intent, conn, Context.BIND_AUTO_CREATE)
                }.getOrDefault(false)
                if (ok) {
                    connections.add(conn)
                    note("bindService OK: $label")
                } else {
                    note("bindService FALHOU: $label")
                }
            }
        }
        if (found == 0) note("nenhum serviço AIDL de impressora encontrado no aparelho")
    }

    fun unbind() {
        connections.forEach { runCatching { context.unbindService(it) } }
        connections.clear()
    }

    // ---- API exposta ao JavaScript ----

    @JavascriptInterface
    fun isReady(): Boolean = iposService != null || sunmiService != null

    @JavascriptInterface
    fun status(): String = when {
        iposService != null -> "ipos"
        sunmiService != null -> "sunmi"
        else -> "offline"
    }

    @JavascriptInterface
    fun diagnostics(): String = synchronized(log) { log.joinToString("\n") }

    @JavascriptInterface
    fun lastPrintResult(): String = lastResult

    @JavascriptInterface
    fun printText(text: String): Boolean {
        val payload = if (text.endsWith("\n")) text else "$text\n"
        iposService?.let { service ->
            return runCatching {
                val status = service.getPrinterStatus()
                note("status ipos antes de imprimir: $status")
                if (status != 0) {
                    lastResult = "impressora indisponível (status $status)"
                    return false
                }
                service.printerInit(iposCallback)
                service.printSpecifiedTypeText(payload, "ST", 24, iposCallback)
                service.printerPerformPrint(150, iposCallback)
                lastResult = "cupom enviado"
                note("impressão enviada (ipos)")
                true
            }.getOrElse {
                note("falha ipos: ${it.message}")
                false
            }
        }
        sunmiService?.let { service ->
            return runCatching {
                service.printText(payload, sunmiCallback)
                service.lineWrap(3, sunmiCallback)
                note("impressão enviada (sunmi)")
                true
            }.getOrElse {
                note("falha sunmi: ${it.message}")
                false
            }
        }
        note("nenhum serviço vinculado ao imprimir")
        return false
    }

    /** Comandos ESC/POS para QR (usado quando só há serviço sunmi/RAW). */
    private fun escposQr(data: String, moduleSize: Int): ByteArray {
        val bytes = data.toByteArray(Charsets.UTF_8)
        val len = bytes.size + 3
        val out = java.io.ByteArrayOutputStream()
        out.write(byteArrayOf(0x1B, 0x61, 0x01)) // centraliza
        out.write(byteArrayOf(0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00)) // modelo 2
        out.write(byteArrayOf(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, moduleSize.toByte()))
        out.write(byteArrayOf(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31)) // correção M
        out.write(byteArrayOf(0x1D, 0x28, 0x6B, (len and 0xFF).toByte(), ((len shr 8) and 0xFF).toByte(), 0x31, 0x50, 0x30))
        out.write(bytes)
        out.write(byteArrayOf(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30)) // imprime
        out.write(byteArrayOf(0x1B, 0x61, 0x00))
        out.write("\n".toByteArray())
        return out.toByteArray()
    }

    /** Imprime apenas o QR (gráfico). */
    @JavascriptInterface
    fun printQr(data: String, moduleSize: Int): Boolean {
        if (data.isBlank()) return false
        val size = if (moduleSize in 1..16) moduleSize else 6
        iposService?.let { service ->
            return runCatching {
                service.setPrinterPrintAlignment(1, iposCallback)
                service.printQRCode(data, size, 2, iposCallback)
                service.setPrinterPrintAlignment(0, iposCallback)
                lastResult = "QR enviado"
                note("QR enviado (ipos)")
                true
            }.getOrElse {
                note("falha QR ipos: ${it.message}")
                runCatching {
                    service.printRawData(escposQr(data, size), iposCallback)
                    note("QR enviado (ipos raw)")
                    true
                }.getOrDefault(false)
            }
        }
        sunmiService?.let { service ->
            return runCatching {
                service.sendRAWData(escposQr(data, size), sunmiCallback)
                note("QR enviado (sunmi raw)")
                true
            }.getOrElse {
                note("falha QR sunmi: ${it.message}")
                false
            }
        }
        return false
    }

    /** Cupom completo em um único trabalho: texto + QR + rodapé + avanço. */
    @JavascriptInterface
    fun printReceipt(text: String, qr: String, footer: String): Boolean {
        val body = if (text.endsWith("\n")) text else "$text\n"
        iposService?.let { service ->
            return runCatching {
                val status = service.getPrinterStatus()
                if (status != 0) {
                    lastResult = "impressora indisponível (status $status)"
                    note("status ipos: $status")
                    return false
                }
                service.printerInit(iposCallback)
                service.printSpecifiedTypeText(body, "ST", 24, iposCallback)
                if (qr.isNotBlank()) {
                    service.setPrinterPrintAlignment(1, iposCallback)
                    runCatching { service.printQRCode(qr, 6, 2, iposCallback) }
                        .onFailure { service.printRawData(escposQr(qr, 6), iposCallback) }
                    service.setPrinterPrintAlignment(0, iposCallback)
                }
                if (footer.isNotBlank()) {
                    service.setPrinterPrintAlignment(1, iposCallback)
                    service.printSpecifiedTypeText("$footer\n", "ST", 24, iposCallback)
                    service.setPrinterPrintAlignment(0, iposCallback)
                }
                service.printerPerformPrint(150, iposCallback)
                lastResult = "cupom enviado"
                note("cupom completo enviado (ipos)")
                true
            }.getOrElse {
                note("falha cupom ipos: ${it.message}")
                false
            }
        }
        sunmiService?.let { service ->
            return runCatching {
                service.printText(body, sunmiCallback)
                if (qr.isNotBlank()) service.sendRAWData(escposQr(qr, 6), sunmiCallback)
                if (footer.isNotBlank()) service.printText("$footer\n", sunmiCallback)
                service.lineWrap(3, sunmiCallback)
                note("cupom completo enviado (sunmi)")
                true
            }.getOrElse {
                note("falha cupom sunmi: ${it.message}")
                false
            }
        }
        note("nenhum serviço vinculado ao imprimir")
        return false
    }
}
