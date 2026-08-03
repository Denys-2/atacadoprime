import { useEffect, useState } from "react";

export type PosDensity = "auto" | "compact" | "normal";

const KEY = "pos-density-v1";

/** Fator de zoom aplicado ao shell do POS conforme o tamanho real da tela. */
function computeScale(mode: PosDensity): number {
  if (typeof window === "undefined") return 1;
  // O APK já fixa o WebView em 360px CSS. Aplicar também o zoom automático
  // reduziria novamente o conteúdo e quebraria o encaixe na tela da Q2I.
  if (window.navigator.userAgent.includes("PrimeQ2I/")) return 1;
  if (mode === "normal") return 1;
  if (mode === "compact") return 0.8;

  const w = window.innerWidth;
  const h = window.innerHeight;
  // Maquininhas típicas: Sunmi V1/V2 (320x480 ~ 480x854), Gertec, PAX A920.
  if (w <= 340 || h <= 480) return 0.72;
  if (w <= 400 || h <= 620) return 0.82;
  if (w <= 480) return 0.9;
  return 1;
}

export function usePosDensity() {
  const [mode, setMode] = useState<PosDensity>("auto");
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const saved = window.localStorage.getItem(KEY) as PosDensity | null;
    const initial: PosDensity =
      saved === "compact" || saved === "normal" || saved === "auto" ? saved : "auto";
    setMode(initial);
    setScale(computeScale(initial));
  }, []);

  useEffect(() => {
    const onResize = () => setScale(computeScale(mode));
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [mode]);

  const cycle = () => {
    const next: PosDensity = mode === "auto" ? "compact" : mode === "compact" ? "normal" : "auto";
    setMode(next);
    setScale(computeScale(next));
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* storage indisponível na WebView */
    }
  };

  return { mode, scale, cycle };
}
