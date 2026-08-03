package app.prime.q2i

import android.annotation.SuppressLint
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity

private const val APP_VERSION = 10
private const val POS_URL = "https://primeautomotive.app/pos/vender?primeApp=$APP_VERSION&nocache=$APP_VERSION"

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var bridge: PrinterBridge
    private lateinit var banner: TextView
    private var lastError: String? = null
    private var errorRetries = 0

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        bridge = PrinterBridge(applicationContext)
        bridge.bind()

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.cacheMode = android.webkit.WebSettings.LOAD_NO_CACHE
            // A Q2I informa uma viewport larga ao WebView. O HTML é travado em
            // 360px CSS; não usamos overview porque ele aplicava uma segunda
            // escala e deixava o módulo com aparência de página de computador.
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = false
            settings.setSupportZoom(false)
            settings.builtInZoomControls = false
            settings.displayZoomControls = false
            settings.textZoom = 100
            settings.layoutAlgorithm = android.webkit.WebSettings.LayoutAlgorithm.NORMAL
            settings.userAgentString = (settings.userAgentString ?: "") + " PrimeQ2I/$APP_VERSION Mobile"
            setInitialScale(100)
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: android.webkit.WebResourceRequest?,
                ): Boolean {
                    val url = request?.url?.toString() ?: return false
                    // mantém toda navegação do sistema dentro do app
                    return !url.startsWith("https://primeautomotive.app")
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    lastError = null
                    // Trava o layout em 360px CSS = breakpoints de celular.
                    // initial-scale deve ser 1: window.screen.width já está em
                    // pixels CSS e usá-lo como multiplicador causava zoom duplo.
                    view?.evaluateJavascript(
                        """(function(){
                          var m=document.querySelector('meta[name=viewport]');
                          if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}
                          m.setAttribute('content','width=360, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
                          document.documentElement.style.width='100%';
                          document.body.style.width='100%';
                          document.documentElement.style.overflowX='hidden';
                          document.body.style.overflowX='hidden';
                        })();""",
                        null,
                    )
                }

                override fun onReceivedError(
                    view: WebView?,
                    request: android.webkit.WebResourceRequest?,
                    error: android.webkit.WebResourceError?,
                ) {
                    if (request?.isForMainFrame != true) return
                    lastError = "rede: ${error?.description} (${request.url})"
                    showLoadError()
                }

                override fun onReceivedHttpError(
                    view: WebView?,
                    request: android.webkit.WebResourceRequest?,
                    errorResponse: android.webkit.WebResourceResponse?,
                ) {
                    if (request?.isForMainFrame != true) return
                    lastError = "HTTP ${errorResponse?.statusCode} em ${request.url}"
                    showLoadError()
                }
            }
            webChromeClient = WebChromeClient()
            addJavascriptInterface(bridge, "PrimePrinter")
        }

        banner = TextView(this).apply {
            textSize = 11f
            setPadding(12, 6, 12, 6)
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#B3000000"))
            text = "PRIME Q2I v$APP_VERSION"
            visibility = android.view.View.GONE
            setOnClickListener { showDiagnostics() }
        }

        val root = FrameLayout(this)
        root.addView(
            webView,
            FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT),
        )
        root.addView(
            banner,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM,
            ),
        )
        setContentView(root)

        webView.clearCache(true)
        webView.clearHistory()
        webView.loadUrl(POS_URL)
        banner.postDelayed(::refreshBanner, 1500)
    }

    private fun showLoadError() {
        if (errorRetries < 1) {
            errorRetries++
            webView.postDelayed({ webView.loadUrl(POS_URL) }, 1200)
            return
        }
        banner.visibility = android.view.View.VISIBLE
        banner.text = "PRIME Q2I v$APP_VERSION · falha ao abrir: $lastError — toque para recarregar"
        banner.setBackgroundColor(Color.parseColor("#CCB3261E"))
        banner.setOnClickListener {
            errorRetries = 0
            lastError = null
            banner.setOnClickListener { showDiagnostics() }
            webView.loadUrl(POS_URL)
        }
    }

    private fun refreshBanner() {
        // Barra de status removida a pedido do usuário: só aparece em erro de carregamento.
        if (lastError == null) banner.visibility = android.view.View.GONE
        banner.postDelayed(::refreshBanner, 4000)
    }

    /** Versão do Android System WebView — CSS moderno exige Chrome 111+. */
    private fun webViewVersion(): String {
        val ua = webView.settings.userAgentString ?: return "?"
        return Regex("Chrome/(\\d+)").find(ua)?.groupValues?.get(1) ?: "?"
    }

    private fun showDiagnostics() {
        val text = bridge.diagnostics().ifBlank { "sem registros" }
        AlertDialog.Builder(this)
            .setTitle("Diagnóstico da impressora")
            .setMessage(text)
            .setPositiveButton("Imprimir teste") { _, _ ->
                val ok = bridge.printText("*** TESTE PRIME Q2I ***\nponte nativa ativa\n")
                banner.text = if (ok) "teste enviado à impressora" else "falha ao enviar teste"
            }
            .setNegativeButton("Fechar", null)
            .show()
    }

    override fun onDestroy() {
        bridge.unbind()
        super.onDestroy()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}
