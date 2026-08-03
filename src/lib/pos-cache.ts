/**
 * Anti-cache / cache-busting helpers para o terminal POS.
 *
 * Contrato:
 * - A assinatura de build é derivada dos nomes (hasheados) dos assets JS
 *   servidos no HTML de /pos. Cada deploy gera hashes novos.
 * - Se a assinatura remota diferir da assinatura carregada, a página é
 *   recarregada com cache-busting.
 * - Recargas são limitadas a 1 a cada RELOAD_COOLDOWN_MS para nunca entrar
 *   em loop na maquininha.
 */

const SIGNATURE_KEY = "pos:build-signature";
const RELOAD_AT_KEY = "pos:last-hard-reload";
const RELOAD_COOLDOWN_MS = 60_000;

const ASSET_RE = /\/(?:_build\/)?assets\/[A-Za-z0-9._@-]+\.(?:js|css)/g;

function readStore(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* modo privado: segue sem persistir */
  }
}

/** Assinatura dos assets já carregados nesta página. */
export function getLocalBuildSignature(): string {
  if (typeof document === "undefined") return "";
  const urls = Array.from(
    document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>("script[src],link[rel=stylesheet][href]"),
  )
    .map((el) => ("src" in el ? el.src : el.href))
    .map((url) => url.replace(window.location.origin, ""))
    .filter((url) => ASSET_RE.test(`${url}`));
  ASSET_RE.lastIndex = 0;
  return Array.from(new Set(urls)).sort().join("|");
}

/** Assinatura publicada agora no servidor (sempre no-store). */
export async function fetchRemoteBuildSignature(path = "/pos"): Promise<string | null> {
  try {
    const res = await fetch(`${path}?_cachebust=${Date.now()}`, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const found = html.match(ASSET_RE);
    if (!found?.length) return null;
    return Array.from(new Set(found)).sort().join("|");
  } catch {
    return null;
  }
}

/** Remove service workers e caches antigos que travam a versão na maquininha. */
export async function purgeBrowserCaches(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister().catch(() => false)));
    }
  } catch {
    /* ignora */
  }
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key).catch(() => false)));
    }
  } catch {
    /* ignora */
  }
}

function canHardReload(): boolean {
  const last = Number(readStore(RELOAD_AT_KEY) ?? 0);
  return !Number.isFinite(last) || Date.now() - last > RELOAD_COOLDOWN_MS;
}

/** Recarrega descartando cache, com trava anti-loop. */
export async function hardReload(): Promise<void> {
  if (!canHardReload()) return;
  writeStore(RELOAD_AT_KEY, String(Date.now()));
  await purgeBrowserCaches();
  const url = new URL(window.location.href);
  url.searchParams.set("_v", String(Date.now()));
  window.location.replace(url.toString());
}

/**
 * Compara a build local com a publicada e recarrega se houver versão nova.
 * Retorna true quando disparou a recarga.
 */
export async function checkForNewBuild(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const local = getLocalBuildSignature() || readStore(SIGNATURE_KEY) || "";
  const remote = await fetchRemoteBuildSignature();
  if (!remote) return false;
  if (!local) {
    writeStore(SIGNATURE_KEY, remote);
    return false;
  }
  if (local === remote) {
    writeStore(SIGNATURE_KEY, remote);
    return false;
  }
  writeStore(SIGNATURE_KEY, remote);
  if (!canHardReload()) return false;
  await hardReload();
  return true;
}

export const POS_CACHE_POLL_MS = 120_000;
