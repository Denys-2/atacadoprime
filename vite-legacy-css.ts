/**
 * Plugin de compatibilidade de CSS para navegadores antigos (WebView Chrome < 111),
 * usado nas maquininhas POS Android (Q2I / TA-P100L).
 *
 * Faz duas transformações no CSS já compilado pelo Tailwind v4:
 *  1. Desembrulha `@layer nome { ... }` (cascade layers só existem a partir do Chrome 99).
 *  2. Converte literais `oklch(...)` para `rgb(...)` (oklch só a partir do Chrome 111).
 *
 * A ordem de saída do Tailwind já é theme → base → components → utilities, então
 * remover as camadas preserva a cascata.
 */
import type { Plugin } from "vite";

/** oklch → sRGB (Björn Ottosson). Retorna string `rgb(r g b)` ou `rgb(r g b / a)`. */
function oklchToRgb(l: number, c: number, hDeg: number, alpha?: string): string {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const L = l_ * l_ * l_;
  const M = m_ * m_ * m_;
  const S = s_ * s_ * s_;

  const lr = 4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
  const lg = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  const lb = -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S;

  const enc = (v: number) => {
    const s = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
    return Math.min(255, Math.max(0, Math.round(s * 255)));
  };

  const rgb = `${enc(lr)} ${enc(lg)} ${enc(lb)}`;
  return alpha ? `rgb(${rgb} / ${alpha})` : `rgb(${rgb})`;
}

const NUM = /^-?[\d.]+%?$/;

function parseComponent(raw: string, scale: number): number | null {
  const t = raw.trim();
  if (!NUM.test(t)) return null;
  const n = parseFloat(t);
  if (Number.isNaN(n)) return null;
  return t.endsWith("%") ? (n / 100) * scale : n;
}

/** Substitui todo `oklch(L C H[ / A])` com valores literais por `rgb(...)`. */
export function downlevelOklch(css: string): string {
  let out = "";
  let i = 0;
  while (i < css.length) {
    const start = css.indexOf("oklch(", i);
    if (start === -1) {
      out += css.slice(i);
      break;
    }
    // encontra o parêntese de fechamento correspondente
    let depth = 0;
    let end = -1;
    for (let j = start + 5; j < css.length; j++) {
      const ch = css[j];
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }
    if (end === -1) {
      out += css.slice(i);
      break;
    }
    const inner = css.slice(start + 6, end);
    out += css.slice(i, start);

    const [colorPart, alphaPart] = inner.split("/");
    const parts = colorPart.trim().split(/\s+/);
    const l = parts[0] !== undefined ? parseComponent(parts[0], 1) : null;
    const c = parts[1] !== undefined ? parseComponent(parts[1], 0.4) : null;
    const h = parts[2] !== undefined ? parseComponent(parts[2], 360) : 0;

    if (l === null || c === null || h === null || parts.length < 3) {
      out += css.slice(start, end + 1); // não é literal (usa var/calc) — mantém
    } else {
      out += oklchToRgb(l, c, h, alphaPart ? alphaPart.trim() : undefined);
    }
    i = end + 1;
  }
  return out;
}

/** Remove `@layer a, b;` e desembrulha blocos `@layer nome { ... }`. */
export function flattenCascadeLayers(css: string): string {
  // statements de ordenação: @layer theme, base, components, utilities;
  let out = css.replace(/@layer\s+[^;{}]+;/g, "");

  let guard = 0;
  while (guard++ < 20) {
    const match = /@layer\s+[^{};]*\{/.exec(out);
    if (!match) break;
    const openIdx = match.index + match[0].length - 1;
    let depth = 0;
    let closeIdx = -1;
    for (let j = openIdx; j < out.length; j++) {
      const ch = out[j];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          closeIdx = j;
          break;
        }
      }
    }
    if (closeIdx === -1) break;
    out =
      out.slice(0, match.index) +
      out.slice(openIdx + 1, closeIdx) +
      out.slice(closeIdx + 1);
  }
  return out;
}

export function legacyCss(css: string): string {
  return downlevelOklch(flattenCascadeLayers(css));
}

export function legacyCssPlugin(): Plugin {
  return {
    name: "prime-legacy-css",
    enforce: "post",
    transform(code, id) {
      if (!id.includes(".css")) return null;
      if (!code.includes("@layer") && !code.includes("oklch(")) return null;
      return { code: legacyCss(code), map: null };
    },
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === "asset" && file.fileName.endsWith(".css")) {
          const source = typeof file.source === "string" ? file.source : file.source.toString();
          if (source.includes("@layer") || source.includes("oklch(")) {
            file.source = legacyCss(source);
          }
        }
      }
    },
  };
}
