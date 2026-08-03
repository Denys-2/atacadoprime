// Camada única de impressão para o módulo POS.
// O botão principal do POS usa SOMENTE a bridge da impressora interna.
// RawBT e impressão do navegador não são fallback automático: o primeiro abre
// descoberta Bluetooth e o segundo força folha A4 em vários Android POS.

import { useEffect, useState } from "react";

export type PrinterDriver = "native" | "system" | "share" | "rawbt";


/** Marcador visual de versão do módulo de impressão (confirma o deploy na maquininha). */
export const POS_PRINT_VERSION = "P13";
export const POS_PRINT_COLOR = "#0d7377";

declare global {
  interface Window {
    sunmiPrinter?: {
      printerInit?: () => void;
      printText?: (t: string) => void;
      lineWrap?: (n: number) => void;
      printBarCode?: (code: string, symbology: number, height: number, width: number, textposition: number) => void;
      cutPaper?: () => void;
    };
    /** Bridges comuns injetadas por WebViews de maquininhas (Gertec, PAX, apps wrapper). */
    AndroidPrinter?: { print?: (t: string) => void; printText?: (t: string) => void };
    PrinterBridge?: { print?: (t: string) => void; printText?: (t: string) => void };
    Android?: { print?: (t: string) => void; printText?: (t: string) => void };
    /** Ponte oficial injetada pelo aplicativo Android da Q2I. */
    PrimePrinter?: {
      isReady?: () => boolean;
      printText?: (text: string) => boolean | string | void;
      status?: () => string;
      lastPrintResult?: () => string;
    };
  }
}

const PREF_KEY = "pos_printer_driver";
const PREVIEW_ID = "pos-print-preview-overlay";

type AnyBridge = Record<string, unknown> | undefined;

/** Nomes de método usados pelas WebViews de maquininhas para imprimir texto. */
const PRINT_METHODS = [
  "printText",
  "print",
  "printString",
  "printStr",
  "printLine",
  "writeText",
  "write",
  "sendData",
  "printerPrintText",
  "posPrintText",
  "imprimir",
  "imprimirTexto",
] as const;

const BRIDGE_HINT = /print|impress|sunmi|gertec|elgin|pax|pos|android|bridge|terminal|native|jsinterface|o100/i;

function bridgeMethod(o: AnyBridge): ((t: string) => void) | null {
  if (!o) return null;
  for (const m of PRINT_METHODS) {
    const fn = o[m];
    if (typeof fn === "function") return (t: string) => (fn as (s: string) => void).call(o, t);
  }
  return null;
}

/** Varre TODAS as globais da WebView procurando qualquer ponte de impressão. */
function findAndroidBridge(): { key: string; print: (t: string) => void } | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, AnyBridge>;
  let keys: string[] = [];
  try {
    keys = Object.getOwnPropertyNames(w);
  } catch {
    keys = Object.keys(w);
  }
  // 1) Primeiro os nomes que parecem de impressora.
  const ordered = [...keys.filter((k) => BRIDGE_HINT.test(k)), ...keys.filter((k) => !BRIDGE_HINT.test(k))];
  for (const k of ordered) {
    if (k === "window" || k === "self" || k === "top" || k === "parent" || k === "frames") continue;
    let obj: AnyBridge;
    try {
      obj = w[k];
    } catch {
      continue;
    }
    if (!obj || typeof obj !== "object") continue;
    const fn = bridgeMethod(obj);
    if (fn) return { key: k, print: fn };
  }
  return null;
}

function nativeBridge() {
  if (typeof window === "undefined") return null;
  if (window.PrimePrinter?.printText && window.PrimePrinter.isReady?.() !== false) return "prime" as const;
  if (window.sunmiPrinter?.printText) return "sunmi" as const;
  return findAndroidBridge() ? ("android" as const) : null;
}

export function isNativePrinterReady() {
  return nativeBridge() !== null;
}

/**
 * A ponte nativa é injetada pelo WebView e pode aparecer depois do primeiro
 * render. Este hook reavalia até encontrá-la, evitando botão travado em cinza.
 */
export function useNativePrinterReady() {
  const [ready, setReady] = useState(() => isNativePrinterReady());
  useEffect(() => {
    if (ready) return;
    const id = window.setInterval(() => {
      if (isNativePrinterReady()) {
        setReady(true);
        window.clearInterval(id);
      }
    }, 400);
    return () => window.clearInterval(id);
  }, [ready]);
  return ready;
}



/** Lista o que existe nesta maquininha — usado no diagnóstico da tela. */
export function printerDiagnostics() {
  const w = (typeof window !== "undefined" ? window : {}) as unknown as Record<string, unknown>;
  const found = Object.keys(w).filter((k) => /print|sunmi|gertec|elgin|pax|pos|android|bridge/i.test(k));
  return {
    ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
    bridge: nativeBridge() ?? "nenhuma",
    androidBridgeKey: findAndroidBridge()?.key ?? null,
    globaisEncontradas: found.slice(0, 40),
    preferencia: getPrinterPref(),
  };
}

export type BridgeCandidate = { path: string; methods: string[] };

/** Varredura profunda (2 níveis) de objetos injetados na WebView com métodos de impressão. */
export function scanBridgeCandidates(): BridgeCandidate[] {
  if (typeof window === "undefined") return [];
  const w = window as unknown as Record<string, unknown>;
  const out: BridgeCandidate[] = [];
  const skip = new Set(["window", "self", "top", "parent", "frames", "document", "location", "navigator"]);
  let keys: string[] = [];
  try {
    keys = Object.getOwnPropertyNames(w);
  } catch {
    keys = Object.keys(w);
  }
  const inspect = (obj: unknown, path: string, depth: number) => {
    if (!obj || (typeof obj !== "object" && typeof obj !== "function") || depth > 2) return;
    let props: string[] = [];
    try {
      props = [...Object.getOwnPropertyNames(obj), ...Object.keys(obj as object)];
    } catch {
      return;
    }
    const methods = [...new Set(props)].filter((p) => {
      if (!/print|imprim|write|send|ticket|cupom|receipt|papel|paper/i.test(p)) return false;
      try {
        return typeof (obj as Record<string, unknown>)[p] === "function";
      } catch {
        return false;
      }
    });
    if (methods.length) out.push({ path, methods: methods.slice(0, 12) });
    if (depth < 2) {
      for (const p of [...new Set(props)].slice(0, 60)) {
        if (skip.has(p)) continue;
        let child: unknown;
        try {
          child = (obj as Record<string, unknown>)[p];
        } catch {
          continue;
        }
        if (child && typeof child === "object" && child !== obj) inspect(child, `${path}.${p}`, depth + 1);
      }
    }
  };
  for (const k of keys) {
    if (skip.has(k)) continue;
    let obj: unknown;
    try {
      obj = w[k];
    } catch {
      continue;
    }
    if (obj && (typeof obj === "object" || typeof obj === "function")) inspect(obj, k, 1);
  }
  // remove duplicatas por caminho
  const seen = new Set<string>();
  return out.filter((c) => (seen.has(c.path) ? false : (seen.add(c.path), true))).slice(0, 60);
}

function resolvePath(path: string): { holder: Record<string, unknown>; obj: Record<string, unknown> } | null {
  if (typeof window === "undefined") return null;
  let cur: unknown = window;
  for (const part of path.split(".")) {
    if (!cur || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[part];
  }
  if (!cur || typeof cur !== "object") return null;
  return { holder: cur as Record<string, unknown>, obj: cur as Record<string, unknown> };
}

/** Tenta imprimir um texto por um caminho/método específico e devolve o resultado. */
export function tryBridgePrint(path: string, method: string, text: string): { ok: boolean; detail: string } {
  const target = resolvePath(path);
  const obj = target?.obj;
  const fn = obj?.[method];
  if (typeof fn !== "function") return { ok: false, detail: "método indisponível" };
  const call = fn as (...args: unknown[]) => unknown;
  const attempts: unknown[][] = [[text], [text, 1], [text, 0, 0], []];
  for (const args of attempts) {
    try {
      const r = call.apply(obj, args);
      return { ok: true, detail: `chamado com ${args.length} argumento(s) → ${String(r)}` };
    } catch (e) {
      if (args === attempts[attempts.length - 1]) return { ok: false, detail: String(e) };
    }
  }
  return { ok: false, detail: "nenhuma assinatura aceita" };
}


/** Preferência salva pelo operador ("auto" = detecção automática). */
export function getPrinterPref(): PrinterDriver | "auto" {
  if (typeof localStorage === "undefined") return "auto";
  const v = localStorage.getItem(PREF_KEY);
  // P6: a ÚNICA preferência válida é "native". Qualquer valor antigo
  // (system/share/rawbt/maq/app/folha) é apagado — eram eles que abriam o
  // diálogo de impressora do Android / a busca por Bluetooth.
  if (v === "native") return "native";
  if (v !== null) {
    try { localStorage.removeItem(PREF_KEY); } catch { /* ignore */ }
  }
  return "auto";
}


export function setPrinterPref(v: PrinterDriver | "auto") {
  try {
    if (v === "auto") localStorage.removeItem(PREF_KEY);
    else localStorage.setItem(PREF_KEY, v);
  } catch {
    /* storage bloqueado */
  }
}

export function detectDriver(): PrinterDriver {
  const pref = getPrinterPref();
  if (pref !== "auto") return pref;
  // AUTO nunca chama window.print(): na TA-P100L o serviço do navegador abre
  // novamente a própria prévia, criando um ciclo. A impressão direta só é
  // possível quando a WebView expõe uma bridge nativa.
  return "native";
}


// O serviço de impressão do Android costuma IGNORAR "@page size" e usar o papel
// selecionado no diálogo. Por isso o cupom é fluido (100% da largura do papel):
// em 58 mm ele preenche a bobina; em A4 ele continua legível.
const DOC_STYLES = `
  @page { size: auto; margin: 0; }
  html, body { width: 100%; background: #fff; }
  body { font-family: 'Courier New', monospace; font-size: 12pt; line-height: 1.25; margin: 0; padding: 2mm; color: #000; box-sizing: border-box; }
  .pos-ticket { width: 100%; max-width: 100%; margin: 0 auto; box-sizing: border-box; word-break: break-word; }
  .center { text-align: center; }
  .right { text-align: right; }
  .row { display: flex; justify-content: space-between; gap: 4px; }
  .hr { border-top: 1px dashed #000; margin: 4px 0; }
  .bold { font-weight: 700; }
  .lg { font-size: 14pt; }
  .xl { font-size: 17pt; }
  img, svg { display: block; margin: 0 auto; max-width: 100%; height: auto; }
`;

function buildDocument(html: string, copies: number) {
  const body = Array.from({ length: copies })
    .map((_, i) =>
      `${i > 0 ? '<div style="page-break-before:always"></div>' : ""}<div class="pos-ticket">${html}</div>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cupom</title><style>${DOC_STYLES}</style></head><body>${body}</body></html>`;
}


/** Mostra o cupom para conferência com botão de envio direto ao RawBT. */
export function openPrintPreview(html: string, copies = 1) {
  document.getElementById(PREVIEW_ID)?.remove();
  const doc = buildDocument(html, copies);
  const overlay = document.createElement("div");
  overlay.id = PREVIEW_ID;
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;";

  const card = document.createElement("div");
  card.style.cssText =
    "background:#fff;border-radius:14px;overflow:hidden;width:100%;max-width:380px;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,.3);";

  const frame = document.createElement("iframe");
  frame.style.cssText = "border:0;width:100%;flex:1;min-height:55vh;background:#fff;";
  frame.srcdoc = doc;

  const bar = document.createElement("div");
  bar.style.cssText = "display:flex;gap:8px;padding:12px;border-top:1px solid #e5e0d8;background:#faf8f5;";

  const close = document.createElement("button");
  close.textContent = "Fechar";
  close.style.cssText =
    "flex:1;height:44px;border-radius:10px;border:1px solid #d8d2c7;background:#fff;font-weight:600;font-size:15px;";
  close.onclick = () => overlay.remove();

  const hasBridge = !!nativeBridge();
  const print = document.createElement("button");
  print.textContent = hasBridge ? "Imprimir" : "Sem app Prime Q2I";
  print.disabled = !hasBridge;
  print.style.cssText =
    `flex:1;height:44px;border-radius:10px;border:0;background:${hasBridge ? POS_PRINT_COLOR : "#9ca3af"};color:#fff;font-weight:700;font-size:15px;`;
  print.onclick = async () => {
    print.disabled = true;
    print.textContent = "Enviando...";
    try {
      await printHTML(html, { copies });
      print.textContent = "Enviado à impressora";
      window.setTimeout(() => overlay.remove(), 600);
    } catch (error: unknown) {
      print.disabled = false;
      print.textContent = error instanceof Error ? error.message : "Impressora indisponível";
    }
  };

  bar.append(close, print);
  card.append(frame, bar);
  overlay.append(card);
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}


/** Largura da bobina de 58mm na fonte padrão da impressora interna. */
const COLS = 32;

function wrap(text: string, width = COLS): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!cur.length) {
      cur = w;
    } else if (cur.length + 1 + w.length <= width) {
      cur += " " + w;
    } else {
      lines.push(cur);
      cur = w;
    }
    while (cur.length > width) {
      lines.push(cur.slice(0, width));
      cur = cur.slice(width);
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

const centerLine = (s: string) =>
  s.length >= COLS ? s : " ".repeat(Math.floor((COLS - s.length) / 2)) + s;

/** Label à esquerda e valor à direita, preenchendo a largura da bobina. */
function rowLines(label: string, value: string): string[] {
  if (!value) return wrap(label);
  if (label.length + 1 + value.length <= COLS) {
    return [label + " ".repeat(COLS - label.length - value.length) + value];
  }
  const out = wrap(label);
  const last = out.pop() ?? "";
  if (last.length + 1 + value.length <= COLS) {
    out.push(last + " ".repeat(COLS - last.length - value.length) + value);
  } else {
    out.push(last, " ".repeat(Math.max(0, COLS - value.length)) + value);
  }
  return out;
}

/**
 * Converte o HTML do cupom em texto monoespaçado de 32 colunas.
 * Usa a estrutura semântica (.row/.center/.hr) em vez de innerText, que
 * colava rótulo e valor ("SubtotalR$ 4,50") e estourava a largura do papel.
 */
function htmlToText(html: string): string {
  const root = document.createElement("div");
  root.innerHTML = html;
  const lines: string[] = [];

  const walk = (el: Element, inheritedCenter = false) => {
    for (const node of Array.from(el.children)) {
      const cls = node.className?.toString?.() ?? "";
      const centered = inheritedCenter || cls.includes("center");
      if (node.tagName.toLowerCase() === "svg") continue;
      if (node.getAttribute?.("data-qr")) continue; // QR vai por comando nativo
      if (cls.includes("hr")) {
        lines.push("-".repeat(COLS));
        continue;
      }
      const spans = Array.from(node.children).filter((c) => c.tagName.toLowerCase() === "span");
      if (cls.includes("row") && spans.length >= 2) {
        const label = (spans[0].textContent ?? "").trim();
        const value = (spans[spans.length - 1].textContent ?? "").trim();
        lines.push(...rowLines(label, value));
        continue;
      }
      if (node.children.length && !node.textContent?.trim()) {
        walk(node, centered);
        continue;
      }
      const txt = (node.textContent ?? "").replace(/\s+/g, " ").trim();
      if (!txt) {
        if (node.children.length) walk(node, centered);
        continue;
      }
      const wrapped = wrap(txt);
      lines.push(...(centered ? wrapped.map(centerLine) : wrapped));
    }
  };
  walk(root);

  // Não usar trim() global: ele removeria o recuo das linhas centralizadas
  // do cabeçalho (nome da loja) deixando-as coladas à esquerda.
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");

}


/** Lê o conteúdo do QR marcado no cupom (data-qr). */
function extractQr(html: string): string | null {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root.querySelector("[data-qr]")?.getAttribute("data-qr") || null;
}

const QR_METHODS = ["printQr", "printQRCode", "printQrCode", "printQrcode", "printQRcode"] as const;

/** Tenta imprimir o QR como gráfico pela ponte nativa. Retorna true se enviou. */
function printQrNative(content: string): boolean {
  if (typeof window === "undefined" || !content) return false;
  const targets: Record<string, unknown>[] = [];
  if (window.PrimePrinter) targets.push(window.PrimePrinter as unknown as Record<string, unknown>);
  if (window.sunmiPrinter) targets.push(window.sunmiPrinter as unknown as Record<string, unknown>);
  const found = findAndroidBridge();
  if (found) {
    const w = window as unknown as Record<string, Record<string, unknown>>;
    if (w[found.key]) targets.push(w[found.key]);
  }
  for (const t of targets) {
    for (const m of QR_METHODS) {
      const fn = t[m];
      if (typeof fn !== "function") continue;
      const call = fn as (...a: unknown[]) => unknown;
      for (const args of [[content, 6], [content], [content, 6, 2]] as unknown[][]) {
        try {
          const r = call.apply(t, args);
          if (r === false) continue;
          return true;
        } catch {
          /* tenta próxima assinatura */
        }
      }
    }
  }
  return false;
}

/** Imprime um HTML já renderizado (cupom ou etiqueta) usando o driver disponível. */
export async function printHTML(html: string, opts?: { copies?: number; preview?: boolean }) {
  const copies = opts?.copies ?? 1;
  if (opts?.preview) {
    openPrintPreview(html, copies);
    return;
  }

  const qr = extractQr(html);
  const text = htmlToText(html);
  const bridge = nativeBridge();

  // Única rota de impressão: a ponte nativa da maquininha (silenciosa).
  if (bridge) {
    const prime = window.PrimePrinter as unknown as
      | { printReceipt?: (t: string, q: string, f: string) => boolean }
      | undefined;

    for (let i = 0; i < copies; i++) {
      // Caminho preferido: cupom + QR gráfico em um único trabalho de impressão.
      if (bridge === "prime" && typeof prime?.printReceipt === "function") {
        const ok = prime.printReceipt(text + "\n", qr || "", "");
        if (ok === false) throw new Error("A impressora interna recusou o cupom");
        continue;
      }

      if (bridge === "prime" && window.PrimePrinter?.printText) {
        const result = window.PrimePrinter.printText(text + "\n");
        if (result === false) throw new Error("A impressora interna recusou o cupom");
      } else if (bridge === "sunmi" && window.sunmiPrinter) {
        window.sunmiPrinter.printerInit?.();
        window.sunmiPrinter.printText?.(text + "\n");
      } else {
        findAndroidBridge()?.print(text + "\n");
      }

      // QR do cupom: gráfico quando a maquininha aceitar, senão o link em texto.
      if (qr) printQrNative(qr);
      const rodape = "\n\n";
      if (bridge === "prime") window.PrimePrinter?.printText?.(rodape);
      else if (bridge === "sunmi" && window.sunmiPrinter) {
        window.sunmiPrinter.printText?.(rodape);
        window.sunmiPrinter.lineWrap?.(3);
        window.sunmiPrinter.cutPaper?.();
      } else findAndroidBridge()?.print(rodape);
    }
    return;
  }



  // Sem ponte nativa NÃO existe impressão: window.print() abre o diálogo do
  // Android (folha/Bluetooth) e RawBT abre outro app. Ambos foram removidos.
  throw new Error("Abra o aplicativo PRIME Q2I v3 — o Chrome não imprime direto");
}


