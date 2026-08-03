import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Copy, Check, Share2 } from "lucide-react";
import { V2 } from "@/components/v2/theme";

export const Route = createFileRoute("/_authenticated/pos/instalar")({
  component: PosInstalar,
  head: () => ({
    meta: [
      { title: "Instalar o POS na maquininha | Atacado Prime" },
      {
        name: "description",
        content:
          "Link direto e QR Code para instalar o atalho do POS Prime na tela inicial da maquininha pelo Firefox ou Chrome.",
      },
      { property: "og:title", content: "Instalar o POS na maquininha | Atacado Prime" },
      {
        property: "og:description",
        content:
          "Link direto e QR Code para instalar o atalho do POS Prime na tela inicial da maquininha pelo Firefox ou Chrome.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const INSTALL_URL = "https://primeautomotive.app/pos/vender";
const APK_URL = "https://primeautomotive.app/prime-q2i.apk?v=10";


type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function PosInstalar() {
  const [qr, setQr] = useState("");
  const [apkQr, setApkQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [apkCopied, setApkCopied] = useState(false);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    QRCode.toDataURL(INSTALL_URL, { width: 320, margin: 1 }).then(setQr).catch(() => setQr(""));
    QRCode.toDataURL(APK_URL, { width: 320, margin: 1 }).then(setApkQr).catch(() => setApkQr(""));

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setStatus("Copie manualmente o endereço acima.");
    }
  };

  const copyApk = async () => {
    try {
      await navigator.clipboard.writeText(APK_URL);
      setApkCopied(true);
      window.setTimeout(() => setApkCopied(false), 1800);
    } catch {
      setStatus("Copie manualmente o endereço do APK.");
    }
  };



  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "POS Prime", url: INSTALL_URL });
      } catch {
        /* cancelado */
      }
    } else {
      copy();
    }
  };

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setStatus(outcome === "accepted" ? "Atalho instalado na tela inicial." : "Instalação cancelada.");
    setPrompt(null);
  };

  const card = { background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER } as const;

  return (
    <div className="p-3 space-y-3">
      <h1 className="text-base font-semibold flex items-center gap-2" style={{ color: V2.LIGHT_TEXT }}>
        <Download className="h-4 w-4" style={{ color: V2.TEAL }} />
        Instalar o POS na maquininha
      </h1>

      <div className="rounded-lg border p-3 space-y-3" style={card}>
        {qr && (
          <img
            src={qr}
            alt="QR Code com o link de instalação do POS Prime"
            className="mx-auto w-40 h-40 rounded-md border"
            style={{ borderColor: V2.LIGHT_BORDER }}
          />
        )}
        <div className="text-center text-[12px] font-mono break-all" style={{ color: V2.LIGHT_TEXT }}>
          {INSTALL_URL}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={copy}
            className="h-11 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1"
            style={{ borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_TEXT }}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado" : "Copiar link"}
          </button>
          <button
            type="button"
            onClick={share}
            className="h-11 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1"
            style={{ borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_TEXT }}
          >
            <Share2 className="h-4 w-4" /> Compartilhar
          </button>
        </div>
        {prompt && (
          <button
            type="button"
            onClick={install}
            className="w-full h-12 rounded-lg text-sm font-bold text-white"
            style={{ background: V2.TEAL }}
          >
            Instalar agora (adicionar ícone)
          </button>
        )}
        {status && (
          <p className="text-[11px] text-center" style={{ color: V2.LIGHT_MUTED }}>
            {status}
          </p>
        )}
      </div>

      <div className="rounded-lg border p-3 space-y-3" style={card}>
        <p className="text-sm font-semibold" style={{ color: V2.LIGHT_TEXT }}>
          Aplicativo Prime Q2I v10 (impressão nativa + layout POS)
        </p>
        <p className="text-[12px] leading-snug" style={{ color: V2.LIGHT_MUTED }}>
          Desinstale a versão anterior, baixe esta v10 direto na maquininha e instale novamente. Ela usa o contrato
          AIDL completo do fabricante, detecta o serviço de
          impressão e mostra uma barra no rodapé: verde = conectada, vermelha = não conectada (toque na barra
          para ver o diagnóstico e imprimir um teste).
        </p>
        {apkQr && (
          <img
            src={apkQr}
            alt="QR Code para baixar o aplicativo Prime Q2I"
            className="mx-auto w-40 h-40 rounded-md border"
            style={{ borderColor: V2.LIGHT_BORDER }}
          />
        )}
        <div className="text-center text-[12px] font-mono break-all" style={{ color: V2.LIGHT_TEXT }}>
          {APK_URL}
        </div>
        <a
          href={APK_URL}
          download
          className="w-full h-12 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2"
          style={{ background: V2.TEAL }}
        >
          <Download className="h-4 w-4" /> Baixar APK agora
        </a>
        <button
          type="button"
          onClick={copyApk}
          className="w-full h-11 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1"
          style={{ borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_TEXT }}
        >
          {apkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {apkCopied ? "Copiado" : "Copiar link do APK"}
        </button>
      </div>


      <div className="rounded-lg border p-3 space-y-2 text-[12px] leading-snug" style={card}>
        <p className="font-semibold" style={{ color: V2.LIGHT_TEXT }}>
          Firefox (Android / maquininha)
        </p>
        <ol className="list-decimal pl-4 space-y-1" style={{ color: V2.LIGHT_MUTED }}>
          <li>Abra o link acima no Firefox.</li>
          <li>Toque no menu ⋮ (canto superior direito).</li>
          <li>Escolha “Instalar” ou “Adicionar à tela inicial”.</li>
          <li>Confirme o nome “POS Prime” — o ícone aparece na tela inicial.</li>
        </ol>
        <p className="font-semibold pt-1" style={{ color: V2.LIGHT_TEXT }}>
          Chrome (Android)
        </p>
        <ol className="list-decimal pl-4 space-y-1" style={{ color: V2.LIGHT_MUTED }}>
          <li>Menu ⋮ → “Instalar app” / “Adicionar à tela inicial”.</li>
        </ol>
        <p className="pt-1" style={{ color: V2.LIGHT_MUTED }}>
          O atalho abre em tela cheia, sem barra do navegador, direto na tela de venda. Não é um arquivo APK: é o
          próprio sistema instalado como aplicativo pelo navegador.
        </p>
      </div>
    </div>
  );
}
